'use strict';

// Commits a validated piece to the live library: writes the .js file,
// registers it in index.json, and puts it into the running rotation via
// playlist.json - deliberately automatic (see CLAUDE.md phase 4: "writes
// a new program... which must pass... before deployment" means validated
// pieces go live, not sit validated-but-dormant).

const fs = require('fs');
const path = require('path');
const { EFFECTS_DIR, INDEX_PATH, PLAYLIST_PATH } = require('./config');
const { appendKnowledgeNote } = require('./knowledge');
const { stillPathsFor } = require('./archive');

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

// Renames a temp-named preview GIF and its stills (written during a
// validation attempt, before the final slugified filename was known) to
// match the just-committed effect's basename. Best-effort: a rename
// failure is a warning-worthy cosmetic loss (the piece is already
// committed), not something worth failing the whole commit over.
function renamePreviewArtifacts(effectPath, previewGifPath, previewStillPaths) {
  const finalGifPath = effectPath.replace(/\.js$/, '.gif');
  const finalStillPaths = stillPathsFor(effectPath);
  const renames = [[previewGifPath, finalGifPath], ...(previewStillPaths || []).map((p, i) => [p, finalStillPaths[i]])];
  for (const [from, to] of renames) {
    if (!from || !to) continue;
    try {
      fs.renameSync(from, to);
    } catch {
      // best-effort - see comment above
    }
  }
}

// { uuid, title, source, knowledgeUpdate?, previewGifPath?, previewStillPaths? }
// -> writes the effect, updates index.json + playlist.json, renames any
// preview artifacts from the validating attempt's scratch name to the
// final one, and (if given) delegates the knowledge-base note. Only ever
// called after validateProgram() has returned pass:true for this exact
// source - see agent/tool.js.
function commitNewPiece({ uuid, title, source, knowledgeUpdate, previewGifPath, previewStillPaths }) {
  const slug = slugify(title);
  const effectPath = resolveCollisionFreePath(slug, uuid);
  fs.writeFileSync(effectPath, source);
  renamePreviewArtifacts(effectPath, previewGifPath, previewStillPaths);

  const basename = path.basename(effectPath);
  const relPath = `effects/${basename}`;

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  index[uuid] = relPath;
  atomicWriteFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  const playlist = JSON.parse(fs.readFileSync(PLAYLIST_PATH, 'utf8'));
  playlist.push({ file: basename });
  atomicWriteFileSync(PLAYLIST_PATH, serializePlaylist(playlist));

  let knowledgePath = null;
  if (knowledgeUpdate && knowledgeUpdate.file && knowledgeUpdate.note) {
    knowledgePath = appendKnowledgeNote({
      file: knowledgeUpdate.file,
      note: knowledgeUpdate.note,
      uuid,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  return { effectPath, relPath, knowledgePath };
}

module.exports = { slugify, resolveCollisionFreePath, commitNewPiece };
