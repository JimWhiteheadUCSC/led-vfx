'use strict';

// File-based handoff between the render daemon and the wall-label
// server: two independent processes (see host/wallLabel/server.js and
// the writeCurrentPiece call in host/daemon.js) so a problem in either
// one can't take down the other. Deliberately not an in-process call or
// a socket - a plain JSON file is the whole mechanism.

const fs = require('fs');
const path = require('path');

const RUN_DIR = path.join(__dirname, '..', '..', 'run');
const CURRENT_PIECE_PATH = path.join(RUN_DIR, 'current-piece.json');
const CURRENT_PIECE_FILENAME = path.basename(CURRENT_PIECE_PATH);
const WATCH_DEBOUNCE_MS = 50;

function ensureRunDir() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
}

// Write-then-rename (atomic on POSIX, same filesystem) rather than
// writing CURRENT_PIECE_PATH directly - see watchCurrentPiece for why
// this matters beyond just avoiding torn reads.
function writeCurrentPiece(piece) {
  ensureRunDir();
  const tmpPath = `${CURRENT_PIECE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ ...piece, updatedAt: new Date().toISOString() }, null, 2));
  fs.renameSync(tmpPath, CURRENT_PIECE_PATH);
}

function readCurrentPiece() {
  try {
    return JSON.parse(fs.readFileSync(CURRENT_PIECE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

// Watches the containing directory, not CURRENT_PIECE_PATH itself.
// fs.watch on a *file* binds to that file's inode; writeCurrentPiece's
// rename-over-path replaces the inode on every write, which silently
// orphans a file-level watch after the very first update. A directory
// watch, filtered by filename, is unaffected by children being renamed
// in and out. Debounced since one rename can still fire more than one
// directory event. Returns an unwatch() function.
function watchCurrentPiece(onChange) {
  ensureRunDir();
  let timer = null;
  const watcher = fs.watch(RUN_DIR, (eventType, filename) => {
    if (filename !== CURRENT_PIECE_FILENAME) return;
    clearTimeout(timer);
    timer = setTimeout(() => onChange(readCurrentPiece()), WATCH_DEBOUNCE_MS);
  });
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

module.exports = { CURRENT_PIECE_PATH, writeCurrentPiece, readCurrentPiece, watchCurrentPiece };
