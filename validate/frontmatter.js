'use strict';

// Parses and validates the /*@vfx ... @vfx*/ provenance frontmatter
// documented in docs/VFX_API.md. Frontmatter that fails to parse fails
// validation, same as code that fails to run.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const FRONTMATTER_RE = /\/\*@vfx([\s\S]*?)@vfx\*\//;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_RELATIONS = new Set(['variation', 'inspiration', 'contrast']);
const INDEX_PATH = path.join(__dirname, '..', 'index.json');

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return {};
  }
}

// source: full program text (frontmatter is a plain block comment, so this
// works on the raw file — no sandbox involved). Returns
// { ok, frontmatter, failures, warnings }.
function validateFrontmatter(source) {
  const failures = [];
  const warnings = [];

  const match = FRONTMATTER_RE.exec(source);
  if (!match) {
    return { ok: false, frontmatter: null, failures: ['no /*@vfx ... @vfx*/ frontmatter block found'], warnings };
  }

  let frontmatter;
  try {
    frontmatter = yaml.load(match[1]);
  } catch (err) {
    return { ok: false, frontmatter: null, failures: [`frontmatter YAML failed to parse: ${err.message}`], warnings };
  }

  if (!frontmatter || typeof frontmatter !== 'object') {
    return { ok: false, frontmatter: null, failures: ['frontmatter did not parse to an object'], warnings };
  }

  if (!frontmatter.id || typeof frontmatter.id !== 'string' || !UUID_RE.test(frontmatter.id)) {
    failures.push(`id missing or not a UUID: ${JSON.stringify(frontmatter.id)}`);
  }
  if (!frontmatter.title || typeof frontmatter.title !== 'string' || !frontmatter.title.trim()) {
    failures.push('title missing or empty');
  }
  if (!frontmatter.rationale || typeof frontmatter.rationale !== 'string' || !frontmatter.rationale.trim()) {
    failures.push('rationale missing or empty');
  }

  const lineage = frontmatter.lineage;
  if (lineage !== undefined) {
    if (!Array.isArray(lineage)) {
      failures.push('lineage must be an array (empty array if none)');
    } else {
      const index = loadIndex();
      for (const [i, entry] of lineage.entries()) {
        if (!entry || typeof entry !== 'object') {
          failures.push(`lineage[${i}] is not an object`);
          continue;
        }
        if (!entry.id || typeof entry.id !== 'string' || !UUID_RE.test(entry.id)) {
          failures.push(`lineage[${i}].id missing or not a UUID`);
        } else if (!(entry.id in index)) {
          failures.push(`lineage[${i}].id ${entry.id} does not resolve in index.json`);
        }
        if (!VALID_RELATIONS.has(entry.relation)) {
          failures.push(`lineage[${i}].relation must be one of variation|inspiration|contrast, got ${JSON.stringify(entry.relation)}`);
        }
      }
    }
  }

  if (frontmatter.influences !== undefined && !Array.isArray(frontmatter.influences)) {
    failures.push('influences must be an array');
  }

  return { ok: failures.length === 0, frontmatter, failures, warnings };
}

module.exports = { validateFrontmatter, UUID_RE };
