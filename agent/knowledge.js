'use strict';

// Reads the knowledge base for the system prompt, and lets the agent
// append to it (gated by validateProgram() success - see agent/tool.js).
// See knowledge/README.md for the craft/artists split this respects.

const fs = require('fs');
const path = require('path');
const { KNOWLEDGE_DIR } = require('./config');

const ATTEMPT_NOTES_HEADING = '## Attempt notes (agent-appended)';
const REJECTED_CRAFT_FILE = path.join(KNOWLEDGE_DIR, 'craft', 'effect-bestiary.md');

function listMdFiles(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((n) => n.endsWith('.md')).sort().map((n) => path.join(dir, n));
}

// Every top-level knowledge/*.md file (README.md, naming.md, and
// whatever else gets added later - no hardcoded filenames, so a new
// top-level doc is picked up with zero code changes) plus artists/*.md
// and craft/*.md, concatenated with clear file-path delimiters so the
// agent can address a specific file back via knowledgeUpdate.file.
function readKnowledgeBaseText() {
  const files = [
    ...listMdFiles(KNOWLEDGE_DIR),
    ...listMdFiles(path.join(KNOWLEDGE_DIR, 'artists')),
    ...listMdFiles(path.join(KNOWLEDGE_DIR, 'craft')),
  ];
  return files
    .map((f) => {
      const rel = path.relative(KNOWLEDGE_DIR, f);
      const text = fs.readFileSync(f, 'utf8');
      return `--- knowledge/${rel} ---\n\n${text}`;
    })
    .join('\n\n');
}

// Resolves knowledgeUpdate.file (given relative to knowledge/, e.g.
// "artists/jim-campbell.md" or "artists/solyanka.md") to an absolute
// path, enforcing the allowlist: must stay under knowledge/artists/ or
// knowledge/craft/ directly (no nesting, no traversal), must be .md.
// Throws on any violation - callers should treat that as a rejected
// knowledgeUpdate, not a session-ending error.
function resolveKnowledgeFile(file) {
  if (typeof file !== 'string' || !file) throw new Error('knowledgeUpdate.file must be a non-empty string');
  const resolved = path.resolve(KNOWLEDGE_DIR, file);
  if (!resolved.startsWith(KNOWLEDGE_DIR + path.sep)) {
    throw new Error('knowledgeUpdate.file must stay under knowledge/');
  }
  if (path.extname(resolved) !== '.md') {
    throw new Error('knowledgeUpdate.file must be a .md file');
  }
  const parent = path.dirname(resolved);
  const allowed = [path.join(KNOWLEDGE_DIR, 'artists'), path.join(KNOWLEDGE_DIR, 'craft')];
  if (!allowed.includes(parent)) {
    throw new Error('knowledgeUpdate.file must be directly under knowledge/artists/ or knowledge/craft/ (no nesting)');
  }
  if (resolved === REJECTED_CRAFT_FILE) {
    throw new Error(
      'effect-bestiary.md is curated technique reference, not editable in place - ' +
        'if practice contradicts it, create a new craft file instead (knowledge/README.md: ' +
        '"there can be many books about effective LED visual effects")'
    );
  }
  return resolved;
}

function insertUnderAttemptNotes(text, noteLine) {
  const idx = text.indexOf(ATTEMPT_NOTES_HEADING);
  if (idx === -1) return null; // fail closed - caller decides what to do
  const nextHeadingIdx = text.indexOf('\n## ', idx + ATTEMPT_NOTES_HEADING.length);
  const insertAt = nextHeadingIdx === -1 ? text.length : nextHeadingIdx;
  return `${text.slice(0, insertAt)}\n${noteLine}\n${text.slice(insertAt)}`;
}

// { file, note, uuid, date } -> writes the note to the resolved file.
// The host stamps date/uuid (see the frontmatter contract's "attempt
// notes... with UUIDs as evidence"); the agent supplies only prose.
// Only ever called after validateProgram() has already passed for this
// exact piece - see agent/tool.js.
function appendKnowledgeNote({ file, note, uuid, date }) {
  const resolved = resolveKnowledgeFile(file);
  const noteLine = `- **${date}** (${uuid}): ${note}`;

  let existing = null;
  try {
    existing = fs.readFileSync(resolved, 'utf8');
  } catch {
    // doesn't exist yet - the agent's own new file (manifesto, lessons, new cookbook)
  }

  if (existing === null) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${noteLine}\n`);
    return resolved;
  }

  const inserted = insertUnderAttemptNotes(existing, noteLine);
  if (inserted !== null) {
    fs.writeFileSync(resolved, inserted);
  } else {
    // Existing file without the dossier heading structure (the agent's
    // own earlier file, most likely) - safe to append at the end.
    fs.writeFileSync(resolved, `${existing.replace(/\s+$/, '')}\n\n${noteLine}\n`);
  }
  return resolved;
}

module.exports = { readKnowledgeBaseText, appendKnowledgeNote, resolveKnowledgeFile };
