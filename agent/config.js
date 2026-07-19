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
  MODEL_ID: process.env.AGENT_MODEL || 'claude-opus-4-8',
  EFFORT: 'xhigh',
  MAX_TOKENS: 64000,
  MAX_ATTEMPTS: 3,
  MAX_ITERATIONS: 16, // outer safety net - generous headroom over MAX_ATTEMPTS for research turns
  WEB_TOOL_MAX_USES: 5,
  RECENT_PIECES_LIMIT: 8,
  STILL_COUNT: 3, // stills per piece, evenly spaced across its run

  REPO_ROOT,
  EFFECTS_DIR: path.join(REPO_ROOT, 'effects'),
  KNOWLEDGE_DIR: path.join(REPO_ROOT, 'knowledge'),
  INDEX_PATH: path.join(REPO_ROOT, 'index.json'),
  PLAYLIST_PATH: path.join(REPO_ROOT, 'effects', 'playlist.json'),
  VFX_API_PATH: path.join(REPO_ROOT, 'docs', 'VFX_API.md'),
  PRELUDE_PATH: path.join(REPO_ROOT, 'host', 'runtime', 'prelude.js'),
};
