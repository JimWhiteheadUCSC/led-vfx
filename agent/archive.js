'use strict';

// Gathers the recent-pieces archive the agent studies before writing:
// reads index.json, loads each piece's source + frontmatter, backfills
// missing preview stills (see validate/preview.js's writePreviewStills -
// existing seed pieces predate it), and caps to the most recent N by
// frontmatter `created` date. Deliberately no summarization/curation
// beyond the recency cap - see the plan's reasoning for why that's
// premature at this stage.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { REPO_ROOT, INDEX_PATH, RECENT_PIECES_LIMIT, STILL_COUNT } = require('./config');
const { validateProgram } = require('../validate');

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

function stillPathsFor(effectPath) {
  const base = effectPath.replace(/\.js$/, '');
  const paths = [];
  for (let i = 1; i <= STILL_COUNT; i++) paths.push(`${base}.still-${i}.gif`);
  return paths;
}

// Renders missing stills for a piece that predates writePreviewStills -
// zero API cost (headless QuickJS run, same as `npm run validate`),
// self-healing: once written, permanent, same as the existing .gif.
async function ensureStills(effectPath, source) {
  const stillPaths = stillPathsFor(effectPath);
  if (stillPaths.every((p) => fs.existsSync(p))) return stillPaths;
  const report = await validateProgram(source, { filePath: effectPath, stillPaths });
  return report.stillPaths && report.stillPaths.length ? report.stillPaths : [];
}

// Returns the most recent RECENT_PIECES_LIMIT pieces (by frontmatter
// `created`, descending), each as
// { uuid, relPath, absPath, source, frontmatter, stillPaths }.
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
    piece.stillPaths = await ensureStills(piece.absPath, piece.source);
  }

  return recent;
}

module.exports = { gatherArchive, parseFrontmatter, stillPathsFor };
