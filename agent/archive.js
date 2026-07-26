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
const { REPO_ROOT, INDEX_PATH, RECENT_PIECES_LIMIT } = require('./config');
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

// Returns the most recent RECENT_PIECES_LIMIT pieces (by frontmatter
// `created`, descending), each as
// { uuid, relPath, absPath, source, frontmatter, contactSheetPaths }.
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
  const recent = pieces.slice(0, RECENT_PIECES_LIMIT);

  for (const piece of recent) {
    piece.contactSheetPaths = await ensureContactSheets(piece.absPath, piece.source);
  }

  return recent;
}

module.exports = { gatherArchive, parseFrontmatter, contactSheetPathsFor };
