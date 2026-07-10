#!/usr/bin/env node
'use strict';

// Render loop entry point (build phase 1: no crossfade/watchdog yet —
// still a deliberate gap, see HANDOFF.md). Two CLI modes:
//
//   node host/daemon.js <effect.js> [--lat .. --lon .. --audio ..]
//   node host/daemon.js --playlist <playlist.json> [--port 8080] [--lat ..] [--lon ..] [--audio ..]
//
// Playlist JSON is an array of { file, duration? } (duration in seconds,
// defaults to 20). The daemon loops the playlist forever. --lat/--lon
// (default Santa Cruz, CA) drive clock daylight and weather sampling;
// --audio picks the audio input source ('synthetic' default, or
// 'arecord' for real mic input on the Pi) — see host/input/.

const fs = require('fs');
const path = require('path');
const { VfxRuntime } = require('./runtime/vfxRuntime');
const { createDisplay } = require('./display');
const { createInputSampler } = require('./input');

const DEFAULT_DURATION_SECONDS = 20;
const DEFAULT_PORT = 8080;
// Santa Cruz, CA — override with --lat/--lon for the real install site.
const DEFAULT_LAT = 36.97;
const DEFAULT_LON = -122.03;
const DEFAULT_AUDIO_SOURCE = 'synthetic';

function parseArgs(argv) {
  const args = argv.slice(2);
  let port = DEFAULT_PORT;
  let lat = DEFAULT_LAT;
  let lon = DEFAULT_LON;
  let audioSource = DEFAULT_AUDIO_SOURCE;

  const portIdx = args.indexOf('--port');
  if (portIdx !== -1) {
    port = Number(args[portIdx + 1]);
    if (!Number.isFinite(port)) throw new Error('--port requires a numeric argument');
    args.splice(portIdx, 2);
  }

  const latIdx = args.indexOf('--lat');
  if (latIdx !== -1) {
    lat = Number(args[latIdx + 1]);
    if (!Number.isFinite(lat)) throw new Error('--lat requires a numeric argument');
    args.splice(latIdx, 2);
  }

  const lonIdx = args.indexOf('--lon');
  if (lonIdx !== -1) {
    lon = Number(args[lonIdx + 1]);
    if (!Number.isFinite(lon)) throw new Error('--lon requires a numeric argument');
    args.splice(lonIdx, 2);
  }

  const audioIdx = args.indexOf('--audio');
  if (audioIdx !== -1) {
    audioSource = args[audioIdx + 1];
    if (audioSource !== 'synthetic' && audioSource !== 'arecord') {
      throw new Error("--audio must be 'synthetic' or 'arecord'");
    }
    args.splice(audioIdx, 2);
  }

  if (args[0] === '--playlist') {
    if (!args[1]) throw new Error('Usage: daemon.js --playlist <playlist.json>');
    return { mode: 'playlist', playlistPath: args[1], port, lat, lon, audioSource };
  }
  if (args[0] && !args[0].startsWith('--')) {
    return { mode: 'single', file: args[0], port, lat, lon, audioSource };
  }

  throw new Error(
    'Usage:\n' +
      '  node host/daemon.js <effect.js> [--lat 36.97 --lon -122.03 --audio synthetic]\n' +
      '  node host/daemon.js --playlist <playlist.json> [--port 8080] [--lat ..] [--lon ..] [--audio ..]'
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
async function runProgram(item, display, sampler, isStopped) {
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
        runtime.setInput(sampler.sample(dt));
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

  const sampler = createInputSampler({ lat: config.lat, lon: config.lon, audioSource: config.audioSource });
  await sampler.init();
  display.onButtonEvent((down) => sampler.handleButtonEvent(down));

  let stopped = false;
  process.on('SIGINT', () => {
    console.log('\n[daemon] shutting down...');
    stopped = true;
  });

  let index = 0;
  while (!stopped) {
    const item = playlist[index % playlist.length];
    index++;
    await runProgram(item, display, sampler, () => stopped);
  }

  sampler.close();
  await display.close();
}

main().catch((err) => {
  console.error('[daemon] fatal:', err);
  process.exit(1);
});
