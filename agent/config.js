'use strict';

// Config + constants for the creativity agent, and a tiny hand-rolled
// .env loader (no dotenv dependency - a few lines, matches this
// project's pattern of avoiding a dependency for something this small).

const fs = require('fs');
const path = require('path');

function loadEnvFile(envPath) {
  let text;
  try {
    text = fs.readFileSync(envPath, 'utf8');
  } catch {
    return; // no .env file - fine, maybe ANTHROPIC_API_KEY is set some other way
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '..', '.env'));

const REPO_ROOT = path.join(__dirname, '..');

module.exports = {
  MODEL_ID: process.env.AGENT_MODEL || 'claude-opus-5',
  EFFORT: 'high',
  MAX_TOKENS: 64000,
  MAX_ATTEMPTS: 3,
  MAX_ITERATIONS: 16, // outer safety net - generous headroom over MAX_ATTEMPTS for research turns
  WEB_TOOL_MAX_USES: 5,
  // The archive is tiered: every piece contributes its frontmatter,
  // rationale, lineage and contact sheets (the visual channel is the whole
  // point - CLAUDE.md: "the agent should SEE its past work"), but only the
  // newest FULL_SOURCE_PIECES also carry their full source. Source is by
  // far the most expensive part per piece and grows over time (recent
  // pieces run 12-22KB against the seed pieces' 2-4KB), so paying for it
  // only where lineage/technique actually gets copied keeps the same
  // reach for markedly fewer tokens. Raising RECENT_PIECES_LIMIT is now
  // cheap (a catalogue entry costs a fraction of a full-source one) - but
  // note any piece newly pulled into range keeps whatever contact sheets
  // it has on disk, so check they were rendered at the current
  // validate/preview.js UPSCALE before assuming the token cost.
  RECENT_PIECES_LIMIT: 8,
  FULL_SOURCE_PIECES: 4,
  // Contact-sheet artifact count/labeling per piece now lives at
  // validate/epochs.js's EPOCHS - one source of truth instead of two.

  REPO_ROOT,
  EFFECTS_DIR: path.join(REPO_ROOT, 'effects'),
  KNOWLEDGE_DIR: path.join(REPO_ROOT, 'knowledge'),
  INDEX_PATH: path.join(REPO_ROOT, 'index.json'),
  PLAYLIST_PATH: path.join(REPO_ROOT, 'effects', 'playlist.json'),
  VFX_API_PATH: path.join(REPO_ROOT, 'docs', 'VFX_API.md'),
  PRELUDE_PATH: path.join(REPO_ROOT, 'host', 'runtime', 'prelude.js'),
};
