'use strict';

// Gathers the recent-pieces archive the agent studies before writing:
// reads index.json, loads each piece's source + frontmatter, backfills
// missing epoch contact sheets (see validate/preview.js's
// writeContactSheet - existing seed pieces predate it), and caps to the
// most recent N by frontmatter `created` date. Deliberately no
// summarization/curation beyond the recency cap - see the plan's
// reasoning for why that's premature at this stage.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('./config');
const { REPO_ROOT, INDEX_PATH, RECENT_PIECES_LIMIT } = config;
const { validateProgram } = require('../validate');
const { EPOCHS } = require('../validate/epochs');

const FRONTMATTER_RE = /\/\*@vfx([\s\S]*?)@vfx\*\//;

function parseFrontmatter(source) {
  const match = FRONTMATTER_RE.exec(source);
  if (!match) return null;
  try {
    const fm = yaml.load(match[1]);
    return fm && typeof fm === 'object' ? fm : null;
  } catch {
    return null;
  }
}

function contactSheetPathsFor(effectPath) {
  const base = effectPath.replace(/\.js$/, '');
  return EPOCHS.map((epoch) => `${base}.epoch-${epoch.label}.gif`);
}

// A contact sheet (or preview GIF) as an Anthropic image content block.
// Lives here rather than in prompt.js because both the archive prompt and
// the write_effect tool result hand sheets to the model, and they must
// encode them identically.
function imageBlockFromGif(absPath) {
  const data = fs.readFileSync(absPath).toString('base64');
  return { type: 'image', source: { type: 'base64', media_type: 'image/gif', data } };
}

// Old flat-stills naming (pre-epoch contact sheets), left over on disk for
// any piece created before this scheme existed - deleted opportunistically
// the first time that piece is backfilled under the new scheme, so stale,
// unreferenced files don't linger next to the ones actually in use.
function deleteStaleStills(effectPath) {
  const base = path.basename(effectPath).replace(/\.js$/, '');
  const dir = path.dirname(effectPath);
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  const stalePattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.still-\\d+\\.gif$`);
  for (const entry of entries) {
    if (stalePattern.test(entry)) {
      try {
        fs.unlinkSync(path.join(dir, entry));
      } catch {
        // best-effort cleanup only
      }
    }
  }
}

// Renders missing contact sheets for a piece that predates them - zero
// API cost (headless QuickJS run, same as `npm run validate`),
// self-healing: once written, permanent, same as the existing .gif. Only
// checks whether epoch 0 (the earliest, always-reachable one) exists -
// later epochs can be legitimately, permanently absent for a piece that
// converges or hits the cap early (see validate/index.js's
// MAX_SIM_SECONDS and adaptive early-stop), so requiring ALL epochs to
// exist would re-run validateProgram() on every gatherArchive() call
// forever for such a piece. NOTE: raising MAX_SIM_SECONDS later won't
// retroactively backfill newly-reachable epochs for an already-cached
// piece - delete its .epoch-*.gif files by hand to force regeneration if
// that's ever wanted.
async function ensureContactSheets(effectPath, source) {
  const contactSheetPaths = contactSheetPathsFor(effectPath);
  if (fs.existsSync(contactSheetPaths[0])) {
    return contactSheetPaths.map((p) => (fs.existsSync(p) ? p : null));
  }
  deleteStaleStills(effectPath);
  const report = await validateProgram(source, { filePath: effectPath, contactSheetPaths });
  return report.contactSheetPaths && report.contactSheetPaths.length
    ? report.contactSheetPaths
    : contactSheetPaths.map(() => null);
}

// One piece rendered as Anthropic content blocks: a text header (identity,
// lineage, rationale, and either its source or a note about why not) plus
// one image per epoch contact sheet. Lives here rather than in prompt.js
// for the same reason imageBlockFromGif does: both the initial archive
// prompt and the read_archive_piece tool render pieces to the model, and
// a piece fetched mid-session must look exactly like one that arrived in
// the opening payload.
// includeSource: full-source tier (the newest config.FULL_SOURCE_PIECES,
// and anything explicitly fetched by UUID) vs. catalogue tier. Both tiers
// keep frontmatter, rationale, lineage and contact sheets - only the
// source text is dropped, since that is what costs and what is only
// actually needed for the recent pieces a new one is likely to build
// technique on.
function pieceContentBlocks(piece, { includeSource }) {
  const fm = piece.frontmatter;
  const lineageText = Array.isArray(fm.lineage) && fm.lineage.length
    ? fm.lineage.map((l) => `  - ${l.relation} of ${l.id}: ${l.note || ''}`).join('\n')
    : '  (none)';
  const influencesText = Array.isArray(fm.influences) && fm.influences.length
    ? fm.influences.join(', ')
    : '(none)';

  const header =
    `### "${fm.title || piece.relPath}" (${piece.uuid})\n` +
    `Created: ${fm.created || 'unknown'}  Artist: ${fm.artist || 'unknown'}\n` +
    `Influences: ${influencesText}\n` +
    `Lineage:\n${lineageText}\n` +
    `Rationale: ${fm.rationale || '(none)'}\n\n` +
    (includeSource
      ? `Source (${piece.relPath}):\n${piece.source}`
      : `Source: not included this session (${piece.relPath}) - this piece is in the ` +
        `catalogue tier, so you get its identity, rationale and contact sheets but not ` +
        `its code. Nothing is wrong with it; only the most recent ` +
        `${config.FULL_SOURCE_PIECES} pieces carry source, to keep the archive long ` +
        `without it costing a fortune. You can still cite it in lineage, and you can ` +
        `call read_archive_piece with its UUID to pull its source and images.`);

  const blocks = [{ type: 'text', text: header }];
  piece.contactSheetPaths.forEach((sheetPath, i) => {
    const epoch = EPOCHS[i];
    if (sheetPath) {
      blocks.push({
        type: 'text',
        text: `[t≈${epoch.label}: a 3x3 grid of frames ~0.7s apart, showing motion at this point in the run]`,
      });
      blocks.push(imageBlockFromGif(sheetPath));
    } else {
      blocks.push({
        type: 'text',
        text:
          `[t≈${epoch.label}: not reached - this piece found a stable attractor, or the run hit ` +
          `the validator's simulated-time cap, before this epoch]`,
      });
    }
  });
  return blocks;
}

// The lightweight catalogue row for one piece: everything needed to know
// that a piece EXISTS, cite it (naming.md's grounding rule wants UUID and
// title together), and judge naming.md's lineage gate - without the source
// or images that make a full entry expensive. Cheap enough that every
// piece in the library gets one, however far past RECENT_PIECES_LIMIT the
// archive grows.
function manifestEntry(piece) {
  const fm = piece.frontmatter;
  return {
    uuid: piece.uuid,
    relPath: piece.relPath,
    title: fm.title || piece.relPath,
    created: fm.created || 'unknown',
    artist: fm.artist || 'unknown',
    lineage: (Array.isArray(fm.lineage) ? fm.lineage : []).map((l) => ({
      relation: l.relation,
      id: l.id,
    })),
    influences: Array.isArray(fm.influences) ? fm.influences : [],
  };
}

// Loads any single piece by UUID, whether or not it fell outside the
// recent slice - the read_archive_piece tool's backing call. Returns
// { piece } or { error }, never throws: a bad UUID is something the model
// should be told about and can correct, not a session-ending fault.
async function loadPieceByUuid(uuid) {
  let index;
  try {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (err) {
    return { error: `could not read index.json: ${err.message}` };
  }
  const relPath = index[uuid];
  if (!relPath) {
    return { error: `no piece with UUID "${uuid}" in index.json - check the library manifest for valid UUIDs` };
  }
  const absPath = path.join(REPO_ROOT, relPath);
  let source;
  try {
    source = fs.readFileSync(absPath, 'utf8');
  } catch {
    // index.json still lists it, but the file is gone (the owner pruned a
    // piece they chose not to keep). Same case gatherArchive() skips.
    return { error: `index.json maps "${uuid}" to ${relPath}, but that file no longer exists - the piece was removed from the library` };
  }
  const frontmatter = parseFrontmatter(source) || {};
  const piece = { uuid, relPath, absPath, source, frontmatter };
  piece.contactSheetPaths = await ensureContactSheets(absPath, source);
  return { piece };
}

// Returns { pieces, totalCount, manifest }: pieces is the most recent
// RECENT_PIECES_LIMIT entries (by frontmatter `created`, descending),
// each as { uuid, relPath, absPath, source, frontmatter,
// contactSheetPaths }; totalCount is the size of the WHOLE library
// (every index.json entry with a file still on disk), not just the slice
// shown - naming.md's earned-name gate ("the library holds at least 12
// pieces") is a claim about the whole library, and RECENT_PIECES_LIMIT
// (8, per config.js) is already below that threshold, so a caller that
// only ever sees pieces.length can never correctly evaluate that gate
// once the archive outgrows the slice. manifest is one lightweight row
// per piece in the whole library (see manifestEntry), so the pieces
// outside the slice are at least KNOWN to exist and can be cited or
// fetched by UUID rather than being invisible. See agent/prompt.js.
async function gatherArchive() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const pieces = [];

  for (const [uuid, relPath] of Object.entries(index)) {
    const absPath = path.join(REPO_ROOT, relPath);
    let source;
    try {
      source = fs.readFileSync(absPath, 'utf8');
    } catch {
      continue; // index.json entry with no file on disk - skip defensively
    }
    const frontmatter = parseFrontmatter(source) || {};
    pieces.push({ uuid, relPath, absPath, source, frontmatter });
  }

  pieces.sort((a, b) => String(b.frontmatter.created || '').localeCompare(String(a.frontmatter.created || '')));
  const totalCount = pieces.length;
  const manifest = pieces.map(manifestEntry);
  const recent = pieces.slice(0, RECENT_PIECES_LIMIT);

  for (const piece of recent) {
    piece.contactSheetPaths = await ensureContactSheets(piece.absPath, piece.source);
  }

  return { pieces: recent, totalCount, manifest };
}

module.exports = {
  gatherArchive,
  loadPieceByUuid,
  parseFrontmatter,
  contactSheetPathsFor,
  imageBlockFromGif,
  pieceContentBlocks,
};
