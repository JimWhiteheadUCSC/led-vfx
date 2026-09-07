'use strict';

// Commits a validated piece to the live library: writes the .js file,
// registers it in index.json, and puts it into the running rotation via
// playlist.json - deliberately automatic (see CLAUDE.md phase 4: "writes
// a new program... which must pass... before deployment" means validated
// pieces go live, not sit validated-but-dormant).

const fs = require('fs');
const path = require('path');
const { EFFECTS_DIR, FAILED_SESSIONS_DIR, INDEX_PATH, PLAYLIST_PATH } = require('./config');
const { appendKnowledgeNote } = require('./knowledge');
const { contactSheetPathsFor } = require('./archive');

const DIACRITIC_MARKS_RE = /[̀-ͯ]/g;

function slugify(title) {
  const slug = String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(DIACRITIC_MARKS_RE, '') // strip diacritics (NFKD decomposes e.g. e-acute -> e + combining mark)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'untitled';
}

// playlist.json's existing style is one `{ "key": val, ... }` object per
// line (spaced, not JSON.stringify's compact form), not JSON.stringify(arr,
// null, 2)'s default of expanding every nested object onto its own lines -
// preserve it so appending one entry doesn't reformat the whole file into a
// much noisier diff.
function formatPlaylistEntry(entry) {
  const parts = Object.entries(entry).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`);
  return `{ ${parts.join(', ')} }`;
}
function serializePlaylist(playlist) {
  const lines = playlist.map((entry) => `  ${formatPlaylistEntry(entry)}`);
  return `[\n${lines.join(',\n')}\n]\n`;
}

// Write-then-rename (atomic on POSIX, same filesystem) rather than a
// direct write - host/daemon.js now re-reads playlist.json on every
// rotation (see host/daemon.js), so a reader could otherwise land mid-
// write and see a truncated/partial file. Same idiom already used for
// the wall-label's run/current-piece.json handoff.
function atomicWriteFileSync(filePath, content) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, content);
  fs.renameSync(tmpPath, filePath);
}

// effects/<slug>.js if free; else effects/<slug>-<uuid's first 8 chars>.js.
function resolveCollisionFreePath(slug, uuid) {
  const primary = path.join(EFFECTS_DIR, `${slug}.js`);
  if (!fs.existsSync(primary)) return primary;
  return path.join(EFFECTS_DIR, `${slug}-${uuid.slice(0, 8)}.js`);
}

// Renames a temp-named preview GIF and its epoch contact sheets (written
// during a validation attempt, before the final slugified filename was
// known) to match the just-committed effect's basename. Best-effort: a
// rename failure is a warning-worthy cosmetic loss (the piece is already
// committed), not something worth failing the whole commit over. `null`
// holes (an epoch the run never reached) are skipped, not renamed.
function renamePreviewArtifacts(effectPath, previewGifPath, previewContactSheetPaths) {
  const finalGifPath = effectPath.replace(/\.js$/, '.gif');
  const finalContactSheetPaths = contactSheetPathsFor(effectPath);
  const renames = [
    [previewGifPath, finalGifPath],
    ...(previewContactSheetPaths || []).map((p, i) => [p, finalContactSheetPaths[i]]),
  ];
  for (const [from, to] of renames) {
    if (!from || !to) continue;
    try {
      fs.renameSync(from, to);
    } catch {
      // best-effort - see comment above
    }
  }
}

// thinkingLog: agent/session.js's array of { turn, text } - the model's
// full extended-thinking text for every turn of the session (not just
// the winning attempt), never truncated. Kept in memory the whole
// session and written once here, so - unlike the preview GIF/contact
// sheets, which validateProgram() writes to a scratch path per attempt
// and this function only renames - there is never an orphaned scratch
// file to clean up if an attempt fails; nothing is written to disk
// until commit.
function formatThinkingLog({ title, uuid, thinkingLog }) {
  const header = `# Thinking log — ${title}\n\n${uuid}, committed ${new Date().toISOString().slice(0, 10)}\n\n`;
  const body = thinkingLog.map(({ turn, text }) => `## Turn ${turn}\n\n${text}`).join('\n\n---\n\n');
  return `${header}${body}\n`;
}

// A session that exhausted every attempt without a passing piece leaves
// nothing in the live library, but the reasoning and the validator's
// actual complaints at each attempt are exactly what explains *why* -
// and per CLAUDE.md's validation harness section, failures here are
// meant to be data-driven, not just a verdict. Interleaves attempts.history
// (agent/tool.js: {attemptNumber, pass, errors, warnings} per call) with
// the matching thinking turns so a reader can see what the model tried,
// what the validator said back, and what it did next - the same shape
// as formatThinkingLog above, plus the errors a committed piece never
// needed recording.
function formatFailedSessionLog({ uuid, attempts, thinkingLog }) {
  const date = new Date().toISOString().slice(0, 10);
  const header =
    `# Failed session — no piece committed\n\n` +
    `${uuid}, ${date}, ${attempts.count} attempt(s) used\n\n`;

  const attemptSections = attempts.history.map((a) => {
    const errors = a.errors && a.errors.length ? a.errors.map((e) => `  - ${e}`).join('\n') : '  (none)';
    const warnings = a.warnings && a.warnings.length ? a.warnings.map((w) => `  - ${w}`).join('\n') : null;
    return (
      `### Attempt ${a.attemptNumber} — ${a.pass ? 'PASSED' : 'FAILED'}\n\n` +
      `Errors:\n${errors}\n` +
      (warnings ? `\nWarnings:\n${warnings}\n` : '')
    );
  });

  const thinkingSections = thinkingLog.map(({ turn, text }) => `## Turn ${turn}\n\n${text}`);

  return (
    header +
    `## Validation attempts\n\n${attemptSections.join('\n')}\n---\n\n` +
    `## Full thinking log\n\n${thinkingSections.join('\n\n---\n\n')}\n`
  );
}

// Called from session.js only after the attempt budget is exhausted with
// no passing piece - the mirror image of commitNewPiece's thinkingPath,
// for the run that never got a committed piece to write it beside.
function writeFailedSessionLog({ uuid, attempts, thinkingLog }) {
  if (!thinkingLog || thinkingLog.length === 0) return null;
  fs.mkdirSync(FAILED_SESSIONS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const logPath = path.join(FAILED_SESSIONS_DIR, `${date}-${uuid}.thinking.md`);
  fs.writeFileSync(logPath, formatFailedSessionLog({ uuid, attempts, thinkingLog }));
  return logPath;
}

// { uuid, title, source, knowledgeUpdate?, previewGifPath?, previewContactSheetPaths?, thinkingLog? }
// -> writes the effect, updates index.json + playlist.json, renames any
// preview artifacts from the validating attempt's scratch name to the
// final one, writes the full thinking log (if given) beside it, and (if
// given) delegates the knowledge-base note. Only ever called after
// validateProgram() has returned pass:true for this exact source - see
// agent/tool.js.
function commitNewPiece({
  uuid,
  title,
  source,
  knowledgeUpdate,
  previewGifPath,
  previewContactSheetPaths,
  thinkingLog,
}) {
  const slug = slugify(title);
  const effectPath = resolveCollisionFreePath(slug, uuid);
  fs.writeFileSync(effectPath, source);
  renamePreviewArtifacts(effectPath, previewGifPath, previewContactSheetPaths);

  let thinkingPath = null;
  if (thinkingLog && thinkingLog.length > 0) {
    thinkingPath = effectPath.replace(/\.js$/, '.thinking.md');
    fs.writeFileSync(thinkingPath, formatThinkingLog({ title, uuid, thinkingLog }));
  }

  const basename = path.basename(effectPath);
  const relPath = `effects/${basename}`;

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  index[uuid] = relPath;
  atomicWriteFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  const playlist = JSON.parse(fs.readFileSync(PLAYLIST_PATH, 'utf8'));
  playlist.push({ file: basename });
  atomicWriteFileSync(PLAYLIST_PATH, serializePlaylist(playlist));

  let knowledgePath = null;
  let knowledgeError = null;
  if (knowledgeUpdate && knowledgeUpdate.file && knowledgeUpdate.note) {
    // The piece above is already committed by this point - a malformed
    // knowledgeUpdate.file (e.g. the model echoing a "knowledge/" prefix
    // resolveKnowledgeFile() doesn't want) must not crash the whole
    // session and masquerade as a failed run when the actual artwork
    // landed fine. Report it instead of throwing.
    try {
      knowledgePath = appendKnowledgeNote({
        file: knowledgeUpdate.file,
        note: knowledgeUpdate.note,
        uuid,
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      knowledgeError = err.message;
    }
  }

  return { effectPath, relPath, knowledgePath, knowledgeError, thinkingPath };
}

module.exports = { slugify, resolveCollisionFreePath, commitNewPiece, writeFailedSessionLog };
