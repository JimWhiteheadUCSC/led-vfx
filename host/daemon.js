#!/usr/bin/env node
'use strict';

// Render loop entry point (build phase 1: no crossfade/watchdog yet —
// those pair naturally with the validation harness in phase 2). Two CLI
// modes:
//
//   node host/daemon.js <effect.js>
//   node host/daemon.js --playlist <playlist.json> [--port 8080]
//
// Playlist JSON is an array of { file, duration? } (duration in seconds,
// defaults to 20). The daemon loops the playlist forever.

const fs = require('fs');
const path = require('path');
const { VfxRuntime } = require('./runtime/vfxRuntime');
const { createDisplay } = require('./display');

const DEFAULT_DURATION_SECONDS = 20;
const DEFAULT_PORT = 8080;

function parseArgs(argv) {
  const args = argv.slice(2);
  let port = DEFAULT_PORT;

  const portIdx = args.indexOf('--port');
  if (portIdx !== -1) {
    port = Number(args[portIdx + 1]);
    if (!Number.isFinite(port)) throw new Error('--port requires a numeric argument');
    args.splice(portIdx, 2);
  }

  if (args[0] === '--playlist') {
    if (!args[1]) throw new Error('Usage: daemon.js --playlist <playlist.json>');
    return { mode: 'playlist', playlistPath: args[1], port };
  }
  if (args[0] && !args[0].startsWith('--')) {
    return { mode: 'single', file: args[0], port };
  }

  throw new Error(
    'Usage:\n' +
      '  node host/daemon.js <effect.js>\n' +
      '  node host/daemon.js --playlist <playlist.json> [--port 8080]'
  );
}

function loadPlaylist(playlistPath) {
  const raw = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`Playlist ${playlistPath} must be a non-empty JSON array`);
  }
  const baseDir = path.dirname(playlistPath);
  return raw.map((entry) => ({
    file: path.resolve(baseDir, entry.file),
    durationSeconds: entry.duration || DEFAULT_DURATION_SECONDS,
  }));
}

function clampFps(fps) {
  if (!fps || typeof fps !== 'number') return 30;
  return Math.max(15, Math.min(60, fps));
}

// Runs one playlist item to completion (its duration elapses, the daemon
// is stopped, or the program errors mid-run) and returns.
async function runProgram(item, display, isStopped) {
  console.log(`[daemon] loading ${item.file}`);
  const source = fs.readFileSync(item.file, 'utf8');

  let runtime;
  try {
    runtime = await VfxRuntime.load(source);
  } catch (err) {
    console.error(`[daemon] failed to load ${item.file}:`, err);
    return;
  }

  console.log(`[daemon] running '${runtime.meta.name || item.file}' (${runtime.mode} mode)`);

  const frameInterval = 1000 / clampFps(runtime.meta.fps);
  const startedAt = Date.now();
  let lastFrameAt = startedAt;

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (isStopped() || Date.now() - startedAt >= item.durationSeconds * 1000) {
        clearInterval(timer);
        resolve();
        return;
      }

      const now = Date.now();
      const t = (now - startedAt) / 1000;
      const dt = (now - lastFrameAt) / 1000;
      lastFrameAt = now;

      try {
        display.pushFrame(runtime.renderFrame(t, dt));
      } catch (err) {
        console.error(`[daemon] frame error in ${item.file}:`, err);
        clearInterval(timer);
        resolve();
      }
    }, frameInterval);
  });

  runtime.dispose();
}

async function main() {
  const config = parseArgs(process.argv);
  const playlist =
    config.mode === 'playlist'
      ? loadPlaylist(config.playlistPath)
      : [{ file: path.resolve(config.file), durationSeconds: Infinity }];

  const display = createDisplay({ kind: 'sim', width: 64, height: 64, port: config.port });
  await display.init();

  let stopped = false;
  process.on('SIGINT', () => {
    console.log('\n[daemon] shutting down...');
    stopped = true;
  });

  let index = 0;
  while (!stopped) {
    const item = playlist[index % playlist.length];
    index++;
    await runProgram(item, display, () => stopped);
  }

  await display.close();
}

main().catch((err) => {
  console.error('[daemon] fatal:', err);
  process.exit(1);
});
