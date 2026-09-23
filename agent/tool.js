'use strict';

// Three tools:
//   write_effect        - the agent's only way to actually produce
//                         anything (validates for real, spends an
//                         attempt, gates deployment)
//   preview_effect      - a cheap look at a draft's real render, no
//                         validation gate and no attempt spent, for
//                         iterating before submission
//   read_archive_piece  - any past piece by UUID, source and images
//                         included, so the pieces that fall outside the
//                         opening payload's recent slice stay reachable
// write_effect's retry accounting lives in the shared `attempts` object
// the caller (agent/session.js) owns and inspects from outside the loop -
// this tool's run() enforces the same limit from inside, belt-and-
// suspenders (see the plan's reasoning on why neither alone is trusted).

const fs = require('fs');
const path = require('path');
const { betaTool } = require('@anthropic-ai/sdk/helpers/beta/json-schema');
const config = require('./config');
const { EFFECTS_DIR } = config;
const { validateProgram } = require('../validate');
const { renderQuickPreview, MAX_PREVIEW_T_SECONDS } = require('../validate/quickPreview');
const {
  contactSheetPathsFor,
  imageBlockFromGif,
  loadPieceByUuid,
  pieceContentBlocks,
} = require('./archive');
const { resolveKnowledgeFile } = require('./knowledge');
const { EPOCHS } = require('../validate/epochs');

// A scratch basename for this attempt's preview artifacts - never
// actually written as a .js file itself (validateProgram only uses it
// to derive where to write the .gif/.epoch-*.gif files, it never writes
// source to this path), so there's no risk of a stray placeholder effect
// file.
function scratchPreviewBase(issuedUuid, attemptNumber) {
  return path.join(EFFECTS_DIR, `.attempt-${issuedUuid}-${attemptNumber}.js`);
}

// Same idea for preview_effect's one-off contact sheets - a dot-prefixed
// scratch name in the same directory, deleted as soon as it's been read
// into an image block (see createPreviewEffectTool's run()), so nothing
// preview-related ever lingers on disk.
function scratchPreviewSheetPath(issuedUuid, callNumber) {
  return path.join(EFFECTS_DIR, `.preview-${issuedUuid}-${callNumber}.gif`);
}

function deleteIfExists(p) {
  if (!p) return;
  try {
    fs.unlinkSync(p);
  } catch {
    // fine if it was never written
  }
}

const n = (v, digits) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '--');

// The per-15s-window series the validator already computes and, until now,
// threw away at this boundary. It is the single most useful thing here:
// a whole-run average hides the "weak window" failure shape (a piece that
// averages fine but goes near-still for 15s around t=55), which is exactly
// what the liveliness floor trips on and exactly what a model otherwise
// has to reconstruct by guesswork. Same data validate/collapseGates.js
// compares early-vs-late.
function formatWindowTable(windows) {
  if (!windows || windows.length < 2) return null;
  const rows = windows.map((w) => {
    const span = `t=${String(Math.round(w.startSeconds)).padStart(3)}-${String(
      Math.round(w.endSeconds)
    ).padStart(3)}s`;
    return (
      `  ${span}  temporal=${n(w.temporalVariance, 4)}  spread=${n(w.spread, 1)}  ` +
      `edgeMass=${n(w.edgeMass, 3)}  motionSpread=${n(w.motionSpread, 1)}  ` +
      `bright=${n(w.meanBrightness, 1)}  contrast=${n(w.spatialContrast, 1)}`
    );
  });
  return `Per-window metrics (${windows.length} x 15s windows, neutral input):\n${rows.join('\n')}`;
}

// Everything the report knows, rendered for the model rather than for the
// CLI (validate/index.js's formatReport is the human-facing sibling - the
// two deliberately differ: this one leads with numbers the model can act
// on and omits the checkbox list it already infers from the errors).
function formatReportForModel(report) {
  const sections = [];

  if (report.metrics) {
    const m = report.metrics;
    sections.push(
      `Whole-run metrics (neutral input): temporalVariance=${n(m.temporalVariance, 4)} ` +
        `meanBrightness=${n(m.meanBrightness, 2)} spatialContrast=${n(m.spatialContrast, 2)}` +
        (typeof m.spread === 'number'
          ? ` spread=${n(m.spread, 1)} edgeMass=${n(m.edgeMass, 3)} motionSpread=${n(m.motionSpread, 1)}`
          : '')
    );
  }

  const collapse = report.collapse || {};
  if (collapse.details) {
    const d = collapse.details;
    const horizon = collapse.windows && collapse.windows.length
      ? `${Math.round(collapse.windows[collapse.windows.length - 1].endSeconds)}s`
      : '0s';
    sections.push(
      `Collapse (early-vs-late, horizon=${horizon}` +
        `${collapse.stoppedEarly ? ', converged early - the piece stopped changing' : ''}): ` +
        `temporalRatio=${n(d.temporalRatio, 2)} spreadRatio=${n(d.spreadRatio, 2)} ` +
        `motionSpreadRatio=${n(d.motionSpreadRatio, 2)} minLateEdgeMass=${n(d.minLateEdgeMass, 2)}`
    );
  } else if (collapse.windows && collapse.windows.length) {
    sections.push(
      `Collapse: not evaluated - the run produced only ${collapse.windows.length} window(s), ` +
        `fewer than the 4 needed to compare early against late.`
    );
  }

  const table = formatWindowTable(collapse.windows);
  if (table) sections.push(table);

  if (report.warnings && report.warnings.length) {
    sections.push(
      `Warnings (soft - these did NOT fail the piece):\n${report.warnings.map((w) => `  - ${w}`).join('\n')}`
    );
  }

  return sections.join('\n\n');
}

// The contact sheets for THIS attempt, as image blocks, so the model can
// look at what it just made instead of only reading numbers off it. The
// numeric gates deliberately cannot judge whether a piece reads as
// anything (CLAUDE.md: the contact sheets exist for "what numeric gates
// can't"), and without this the only way to see a draft is to have already
// committed it. Cheap since validate/preview.js's UPSCALE dropped to 2.
function contactSheetBlocks(report) {
  const paths = report.contactSheetPaths || [];
  const blocks = [];
  paths.forEach((sheetPath, i) => {
    if (!sheetPath) return;
    const epoch = EPOCHS[i];
    let image;
    try {
      image = imageBlockFromGif(sheetPath);
    } catch {
      return; // sheet never got written; the numbers above still stand
    }
    blocks.push({
      type: 'text',
      text: `[your draft at t≈${epoch.label}: a 3x3 grid of frames ~0.7s apart]`,
    });
    blocks.push(image);
  });
  return blocks;
}

// Pre-flights the attached knowledgeUpdates against the same rules
// agent/knowledge.js will enforce at commit time, returning one problem
// string per bad entry (empty if all are fine). Worth doing here because
// the commit happens after the session has ended: without this, a
// rejected update's only trace is a console line the model never sees and
// cannot act on, and the knowledge write silently doesn't happen while
// the piece commits fine.
// Returns one { ok } | { ok: false, problem } per entry, positionally.
function knowledgeUpdateChecks(knowledgeUpdates) {
  const checks = [];
  // Entries are applied in order, so a document created by an earlier
  // entry is already on disk by the time a later one runs - track them
  // here too, or two document entries for the same new file would both
  // look fine on disk now and only collide at commit.
  const createdHere = new Set();

  knowledgeUpdates.forEach((update, i) => {
    const label = `knowledgeUpdates[${i}]`;
    const { file, note, mode } = update || {};
    if (!file || !note) {
      checks.push({ ok: false, problem: `${label} needs both \`file\` and \`note\` - it will be skipped.` });
      return;
    }
    if (mode && mode !== 'note' && mode !== 'document') {
      checks.push({ ok: false, problem: `${label}.mode must be "note" or "document", got "${mode}".` });
      return;
    }
    let resolved;
    try {
      resolved = resolveKnowledgeFile(file);
    } catch (err) {
      checks.push({ ok: false, problem: `${label}.file is not usable: ${err.message}` });
      return;
    }
    if (mode === 'document' && (fs.existsSync(resolved) || createdHere.has(resolved))) {
      const why = createdHere.has(resolved)
        ? 'is already created by an earlier entry in this same list'
        : 'already exists';
      checks.push({
        ok: false,
        problem:
          `${label}: mode "document" only creates new files, and ${file} ${why} - either use ` +
          'mode "note" to append to it, or choose a filename that does not exist yet.',
      });
      return;
    }
    if (mode === 'document') createdHere.add(resolved);
    checks.push({ ok: true });
  });

  return checks;
}

// { attempts, issuedUuid, maxAttempts? } -> a BetaRunnableTool for
// client.beta.messages.toolRunner. maxAttempts defaults to config's, but
// session.js's --max-attempts override must flow through here explicitly
// (not read fresh from config) so the tool's own enforcement and the
// message it shows the model both match whatever the outer loop is
// actually enforcing.
function createWriteEffectTool({
  attempts,
  issuedUuid,
  maxAttempts = config.MAX_ATTEMPTS,
  maxKnowledgeUpdates = config.MAX_KNOWLEDGE_UPDATES,
}) {
  return betaTool({
    name: 'write_effect',
    description:
      'Submit a complete VFX effect program (frontmatter + code) to be validated. ' +
      `You have ${maxAttempts} attempts total this session; validation errors are ` +
      'returned so you can fix and retry. Optionally propose knowledgeUpdates - they are ' +
      'committed only if THIS exact submission passes validation.\n\n' +
      'Whether it passes or fails, the result gives you the real measurements from the ' +
      'real runtime: whole-run liveliness metrics, the early-vs-late collapse ratios, the ' +
      'full per-15-second-window series (temporal variance, spread, edgeMass, motionSpread, ' +
      'brightness, contrast), any soft warnings, and the contact sheets of what you just ' +
      'rendered. These are the actual numbers the gates are computed from, measured on the ' +
      'actual program in the actual QuickJS sandbox - so prefer reading them over ' +
      'reimplementing the renderer or the metrics yourself to predict them.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description:
            'The complete effect program source, including the /*@vfx ... @vfx*/ frontmatter block.',
        },
        knowledgeUpdates: {
          type: 'array',
          maxItems: maxKnowledgeUpdates,
          description:
            'Optional: knowledge-base writes to commit alongside this piece - lessons appended to ' +
            'existing files, whole new files created, or both. They are committed together, and ' +
            'ONLY if this submission validates, so put them on the submission you expect to pass; ' +
            `stating an intention in your reasoning does not write anything. Up to ` +
            `${maxKnowledgeUpdates} per session. A session that genuinely learned several things - ` +
            'a craft technique worth a new cookbook, an attempt note under each dossier it argued ' +
            'with, a manifesto - should write all of them here rather than picking one.',
          items: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description:
                  'Path relative to knowledge/, e.g. "artists/jim-campbell.md". Must be directly ' +
                  'under knowledge/artists/ or knowledge/craft/ (no nesting, no "knowledge/" ' +
                  'prefix); a new filename creates a new file (e.g. your own manifesto/notes).',
              },
              note: {
                type: 'string',
                description:
                  'In mode "note", the note prose only - the host stamps the date and UUID, do ' +
                  'not include them yourself. In mode "document", the ENTIRE file content, ' +
                  'written verbatim: open with your own `# Heading`, structure it with `##` ' +
                  'sections, and write it as the finished document a future session will read.',
              },
              mode: {
                type: 'string',
                enum: ['note', 'document'],
                description:
                  'How to write it. "note" (the default) appends one dated, UUID-stamped bullet ' +
                  'to the file - right for attempt notes and lessons added to an existing dossier ' +
                  'or cookbook. "document" writes `note` verbatim as a complete new file and is ' +
                  'the ONLY way to author a real document, such as your manifesto under ' +
                  'knowledge/naming.md; it creates a file that does not exist yet and will be ' +
                  'rejected if one already does, so it can never overwrite a dossier.',
              },
            },
            required: ['file', 'note'],
          },
        },
      },
      required: ['source'],
    },
    run: async ({ source, knowledgeUpdates }) => {
      if (attempts.passed) {
        return 'Already validated successfully this session - do not call this tool again.';
      }
      if (attempts.count >= maxAttempts) {
        return `Attempt budget (${maxAttempts}) already exhausted - do not call this tool again.`;
      }

      attempts.count += 1;
      const attemptNumber = attempts.count;
      const scratchBase = scratchPreviewBase(issuedUuid, attemptNumber);
      const contactSheetPaths = contactSheetPathsFor(scratchBase);

      const report = await validateProgram(source, { filePath: scratchBase, contactSheetPaths });
      attempts.history.push({
        attemptNumber,
        pass: report.pass,
        errors: report.errors,
        warnings: report.warnings,
      });

      // Read the sheets into memory BEFORE the failure path unlinks them -
      // a failed attempt is exactly when seeing the draft matters most.
      const sheetBlocks = contactSheetBlocks(report);
      const measurements = formatReportForModel(report);
      const updates = Array.isArray(knowledgeUpdates) ? knowledgeUpdates : [];
      const kuChecks = knowledgeUpdateChecks(updates);
      const kuAccepted = updates
        .filter((u, i) => kuChecks[i].ok)
        .map((u) => `  - ${u.mode === 'document' ? 'create' : 'append to'} knowledge/${u.file}`);
      const kuRejected = kuChecks.filter((c) => !c.ok).map((c) => `  - ${c.problem}`);
      const kuNote = kuRejected.length
        ? `\n\nKNOWLEDGE UPDATES THAT WILL BE REJECTED:\n${kuRejected.join('\n')}`
        : '';

      if (!report.pass) {
        deleteIfExists(report.gifPath);
        for (const p of report.contactSheetPaths || []) deleteIfExists(p);

        const remaining = maxAttempts - attempts.count;
        const errorList = report.errors.map((e) => `  - ${e}`).join('\n');
        const next =
          remaining > 0
            ? 'Fix these and call write_effect again.'
            : 'Do not call write_effect again - respond with text only.';
        const header =
          `FAILED validation (attempt ${attemptNumber}/${maxAttempts}, ` +
          `${remaining > 0 ? `${remaining} remaining` : 'no attempts remaining'}):\n${errorList}`;
        return [
          { type: 'text', text: `${header}\n\n${measurements}${kuNote}\n\n${next}` },
          ...sheetBlocks,
        ];
      }

      attempts.passed = true;
      attempts.final = {
        source,
        frontmatter: report.frontmatter,
        knowledgeUpdates: updates,
        gifPath: report.gifPath,
        contactSheetPaths: report.contactSheetPaths,
      };
      const kuStatus =
        (kuAccepted.length ? `\n\nKnowledge updates accepted:\n${kuAccepted.join('\n')}` : '') +
        kuNote +
        (kuRejected.length
          ? '\n\nThe piece still commits, and any accepted updates above still land; the rejected ' +
            'ones do not. Say so in your closing message so the omission is on the record.'
          : '');
      return [
        {
          type: 'text',
          text:
            `PASSED validation on attempt ${attemptNumber}/${maxAttempts}. This piece will be ` +
            `committed to the library.\n\n${measurements}${kuStatus}`,
        },
        ...sheetBlocks,
      ];
    },
  });
}

// { previewBudget, issuedUuid, maxPreviewCalls? } -> a BetaRunnableTool
// for client.beta.messages.toolRunner. previewBudget is a shared
// { count } object the caller (agent/session.js) creates once per
// session and never inspects from outside - unlike write_effect's
// `attempts`, nothing downstream depends on this budget except this
// tool's own enforcement, so there's no belt-and-suspenders need here.
function createPreviewEffectTool({ previewBudget, issuedUuid, maxPreviewCalls = config.MAX_PREVIEW_CALLS }) {
  return betaTool({
    name: 'preview_effect',
    description:
      'Render ONE real contact-sheet look at a draft, at a simulated time you choose - no ' +
      'validation gate, no frontmatter requirement, and it does NOT spend one of your ' +
      'write_effect attempts. Use this while iterating on a draft (does the tile line up, ' +
      'does the defect read, is the color balance right) instead of hand-simulating what the ' +
      `code would produce. Capped at ${maxPreviewCalls} calls this session, and \`t\` is capped ` +
      `at ${MAX_PREVIEW_T_SECONDS}s - a piece's long-run behavior is what write_effect's real ` +
      'validation (with its collapse gate) is for, not this tool. Returns the same ' +
      'meanBrightness/spatialContrast/temporalVariance/spread/edgeMass numbers the real ' +
      'validator reports, computed the same way, over just the frames captured here.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description:
            'The effect program source so far - frontmatter can be incomplete or absent, this ' +
            'never validates or commits anything.',
        },
        t: {
          type: 'number',
          description: `Simulated seconds into the run to preview (default 0). Capped at ${MAX_PREVIEW_T_SECONDS}.`,
        },
      },
      required: ['source'],
    },
    run: async ({ source, t }) => {
      if (previewBudget.count >= maxPreviewCalls) {
        return (
          `Preview budget (${maxPreviewCalls}) already used up this session - do not call ` +
          'preview_effect again. Use write_effect when ready.'
        );
      }
      previewBudget.count += 1;
      const callNumber = previewBudget.count;
      const sheetPath = scratchPreviewSheetPath(issuedUuid, callNumber);

      const result = await renderQuickPreview(source, { t, outputPath: sheetPath });

      if (result.error) {
        deleteIfExists(result.contactSheetPath);
        return (
          `Preview ${callNumber}/${maxPreviewCalls} failed: ${result.error}\n\n` +
          '(This did not spend a write_effect attempt.)'
        );
      }

      const remaining = maxPreviewCalls - previewBudget.count;
      const clampNote = result.clamped
        ? ` (clamped from your requested t - ${MAX_PREVIEW_T_SECONDS}s is the preview cap)`
        : '';
      const s = result.stats;
      const statsLine = s
        ? `temporalVariance=${n(s.temporalVariance, 4)} meanBrightness=${n(s.meanBrightness, 2)} ` +
          `spatialContrast=${n(s.spatialContrast, 2)} spread=${n(s.spread, 1)} edgeMass=${n(s.edgeMass, 3)}`
        : '(not enough frames reached to compute stats)';
      const header =
        `Preview ${callNumber}/${maxPreviewCalls} at t≈${result.targetSeconds}s${clampNote}, ` +
        `${remaining} preview call(s) remaining.\n\n${statsLine}`;

      let image = null;
      if (result.contactSheetPath) {
        try {
          image = imageBlockFromGif(result.contactSheetPath);
        } catch {
          // sheet failed to read back - the stats/header text above still stands
        }
      }
      deleteIfExists(result.contactSheetPath);

      const blocks = [{ type: 'text', text: header }];
      if (image) {
        blocks.push({ type: 'text', text: `[preview at t≈${result.targetSeconds}s: a 3x3 grid of frames ~0.7s apart]` });
        blocks.push(image);
      }
      return blocks;
    },
  });
}

// { archiveReadBudget, maxArchiveReads? } -> a BetaRunnableTool for
// client.beta.messages.toolRunner. The opening payload can only afford to
// show the newest RECENT_PIECES_LIMIT pieces (and source for fewer still),
// which leaves everything older present in the manifest but unreadable -
// a problem naming.md makes concrete: its grounding rule demands the
// manifesto cite pieces it can actually verify, and a session has no
// memory of any run but its own. This tool closes that gap.
function createReadArchivePieceTool({
  archiveReadBudget,
  maxArchiveReads = config.MAX_ARCHIVE_READS,
}) {
  return betaTool({
    name: 'read_archive_piece',
    description:
      'Pull one past piece from the library by UUID - its frontmatter, rationale, lineage, full ' +
      'source, and its epoch contact sheets - exactly as the recent pieces appear in the opening ' +
      'archive. Use it for any piece the library manifest lists but does not show in full, and ' +
      'whenever you need to see what an older piece actually IS rather than rely on its title: ' +
      "grounding a manifesto claim or a name under knowledge/naming.md, citing lineage against a " +
      'piece outside the recent slice, or checking whether the idea you are about to pursue is ' +
      `one you already made. Capped at ${maxArchiveReads} calls this session; a failed lookup ` +
      '(unknown UUID) does not count against that cap. Pieces already shown in full in the ' +
      'opening archive do not need fetching.',
    inputSchema: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string',
          description:
            'The piece\'s UUID, exactly as it appears in the library manifest (frontmatter `id`).',
        },
      },
      required: ['uuid'],
    },
    run: async ({ uuid }) => {
      if (archiveReadBudget.count >= maxArchiveReads) {
        return (
          `Archive read budget (${maxArchiveReads}) already used up this session - do not call ` +
          'read_archive_piece again. The library manifest still lists every piece by UUID and ' +
          'title if you need to cite one.'
        );
      }

      const { piece, error } = await loadPieceByUuid(uuid);
      if (error) {
        // Deliberately NOT charged against the budget: a failed lookup
        // returns one line of text and costs nothing, and charging for a
        // mistyped UUID would spend a slot the model never got value from.
        // MAX_ITERATIONS still bounds any runaway retry loop from outside.
        return `Could not read archive piece: ${error}`;
      }

      archiveReadBudget.count += 1;
      const remaining = maxArchiveReads - archiveReadBudget.count;
      const header =
        `Archive piece ${archiveReadBudget.count}/${maxArchiveReads} ` +
        `(${remaining} read(s) remaining), in full:`;

      return [
        { type: 'text', text: header },
        ...pieceContentBlocks(piece, { includeSource: true }),
      ];
    },
  });
}

module.exports = { createWriteEffectTool, createPreviewEffectTool, createReadArchivePieceTool };
