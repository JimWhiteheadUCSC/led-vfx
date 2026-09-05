'use strict';

// The write_effect tool: the agent's only way to actually produce
// anything. Retry accounting lives in the shared `attempts` object the
// caller (agent/session.js) owns and inspects from outside the loop -
// this tool's run() enforces the same limit from inside, belt-and-
// suspenders (see the plan's reasoning on why neither alone is trusted).

const fs = require('fs');
const path = require('path');
const { betaTool } = require('@anthropic-ai/sdk/helpers/beta/json-schema');
const config = require('./config');
const { EFFECTS_DIR } = config;
const { validateProgram } = require('../validate');
const { contactSheetPathsFor, imageBlockFromGif } = require('./archive');
const { EPOCHS } = require('../validate/epochs');

// A scratch basename for this attempt's preview artifacts - never
// actually written as a .js file itself (validateProgram only uses it
// to derive where to write the .gif/.epoch-*.gif files, it never writes
// source to this path), so there's no risk of a stray placeholder effect
// file.
function scratchPreviewBase(issuedUuid, attemptNumber) {
  return path.join(EFFECTS_DIR, `.attempt-${issuedUuid}-${attemptNumber}.js`);
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

// { attempts, issuedUuid, maxAttempts? } -> a BetaRunnableTool for
// client.beta.messages.toolRunner. maxAttempts defaults to config's, but
// session.js's --max-attempts override must flow through here explicitly
// (not read fresh from config) so the tool's own enforcement and the
// message it shows the model both match whatever the outer loop is
// actually enforcing.
function createWriteEffectTool({ attempts, issuedUuid, maxAttempts = config.MAX_ATTEMPTS }) {
  return betaTool({
    name: 'write_effect',
    description:
      'Submit a complete VFX effect program (frontmatter + code) to be validated. ' +
      `You have ${maxAttempts} attempts total this session; validation errors are ` +
      'returned so you can fix and retry. Optionally propose a knowledgeUpdate - it is ' +
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
        knowledgeUpdate: {
          type: 'object',
          description:
            'Optional: a lesson to append to the knowledge base. Only committed if this submission validates.',
          properties: {
            file: {
              type: 'string',
              description:
                'Path relative to knowledge/, e.g. "artists/jim-campbell.md". Must be directly ' +
                'under knowledge/artists/ or knowledge/craft/ (no nesting); a new filename creates ' +
                'a new file (e.g. your own manifesto/notes).',
            },
            note: {
              type: 'string',
              description:
                'The note prose only - the host stamps the date and UUID, do not include them yourself.',
            },
          },
          required: ['file', 'note'],
        },
      },
      required: ['source'],
    },
    run: async ({ source, knowledgeUpdate }) => {
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
          { type: 'text', text: `${header}\n\n${measurements}\n\n${next}` },
          ...sheetBlocks,
        ];
      }

      attempts.passed = true;
      attempts.final = {
        source,
        frontmatter: report.frontmatter,
        knowledgeUpdate: knowledgeUpdate || null,
        gifPath: report.gifPath,
        contactSheetPaths: report.contactSheetPaths,
      };
      return [
        {
          type: 'text',
          text:
            `PASSED validation on attempt ${attemptNumber}/${maxAttempts}. This piece will be ` +
            `committed to the library.\n\n${measurements}`,
        },
        ...sheetBlocks,
      ];
    },
  });
}

module.exports = { createWriteEffectTool };
