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

// Writes `content` verbatim as a whole new knowledge file. The note path
// above exists for evidence - a dated, UUID-stamped bullet appended to a
// dossier - and stamping the same prefix onto a document would make the
// agent's own manifesto a bullet point of a file that has no list. So a
// document is written as written, with provenance moved to a footer
// instead of a prefix.
//
// CREATE-ONLY, deliberately. Verbatim content plus overwrite would let
// one session flatten a curated dossier (or its own earlier manifesto)
// with no way back, and nothing here is version-controlled by the agent.
// Revising an existing document is therefore the note path's job -
// appending to it - or the owner's, by hand.
//
// The footer's date matters beyond bookkeeping: naming.md asks a draft to
// record when it was made so the ratifying session can count the pieces
// since, and the host is the only party here that reliably knows today's
// date.
function writeKnowledgeDocument({ file, content, uuid, date }) {
  const resolved = resolveKnowledgeFile(file);
  if (fs.existsSync(resolved)) {
    throw new Error(
      `knowledgeUpdate mode "document" only ever creates a new file, and ${file} already ` +
        'exists - use mode "note" to add to a file that is already there'
    );
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('knowledgeUpdate.note must be non-empty prose to write as a document');
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const footer = `\n\n---\n\n*Written ${date}, in the session that produced ${uuid}.*\n`;
  fs.writeFileSync(resolved, `${content.replace(/\s+$/, '')}${footer}`);
  return resolved;
}

// The one entry point agent/library.js commits a knowledgeUpdate through:
// 'note' (the default) appends dated evidence to a dossier, 'document'
// creates a whole new file. Throws on anything invalid - the caller
// treats that as a rejected update, not a session-ending error.
function applyKnowledgeUpdate({ file, note, mode = 'note', uuid, date }) {
  if (mode === 'document') return writeKnowledgeDocument({ file, content: note, uuid, date });
  if (mode !== 'note') {
    throw new Error(`knowledgeUpdate.mode must be "note" or "document", got "${mode}"`);
  }
  return appendKnowledgeNote({ file, note, uuid, date });
}

module.exports = { readKnowledgeBaseText, applyKnowledgeUpdate, resolveKnowledgeFile };
