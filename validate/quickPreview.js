'use strict';

// A cheap, no-attempt-cost way for the creativity agent to actually SEE a
// draft mid-development, before spending one of its write_effect attempts.
// Unlike validateProgram() (the full harness: up to MAX_SIM_SECONDS,
// liveliness/collapse gates, frontmatter checks, GIF + full epoch contact
// sheets), this only renders ONE contact sheet at a model-chosen simulated
// time and returns it, plus the same per-window stats the real harness
// computes (via the same WindowAccumulator, so the numbers are directly
// comparable) - no gating, no pass/fail verdict, just a look. CLAUDE.md
// already treats contact sheets as existing "for the creativity agent's
// own vision to judge what numeric gates can't" - this makes that
// available before submission too, not only after it (see the
// one-tile-off-register.thinking.md session where the agent, mid-draft,
// resorted to hand-simulating pixel values because it had no way to
// actually render anything until it called write_effect for real).

const { VfxRuntime } = require('../host/runtime/vfxRuntime');
const { NEUTRAL_INPUT } = require('./inputScenarios');
const { frameStats, WindowAccumulator, EDGE_BAND_PX } = require('./metrics');
const { writeContactSheet } = require('./preview');

const WIDTH = 64;
const HEIGHT = 64;
const GRID_SIZE = 3;
const FRAME_GAP_SECONDS = 0.7; // matches validate/index.js's epoch contact sheets

// Bounds how far into a piece a preview can look. A piece's long-run
// attractor behavior is exactly what the real validator's collapse gate
// (knowledge/craft/attractors.md) exists to judge over its full horizon -
// this tool is for iterating on early-piece correctness (does the tile
// line up, does the defect read, is the color balance right) cheaply,
// not for previewing the same collapse judgement for free.
const MAX_PREVIEW_T_SECONDS = 90;

function clampFps(fps) {
  if (!fps || typeof fps !== 'number') return 30;
  return Math.max(15, Math.min(60, fps));
}

// { source, t, outputPath } -> { contactSheetPath, stats, framesReached,
// clamped, error }. Simulates from t=0 (programs carry state across
// frames, so there's no way to jump straight to the middle) up through
// one grid's worth of frames past the requested t, capturing only the
// GRID_SIZE*GRID_SIZE frames the contact sheet needs.
async function renderQuickPreview(source, { t = 0, outputPath }) {
  const requested = typeof t === 'number' && Number.isFinite(t) ? t : 0;
  const targetSeconds = Math.max(0, Math.min(requested, MAX_PREVIEW_T_SECONDS));
  const clamped = targetSeconds !== requested;

  let runtime;
  try {
    runtime = await VfxRuntime.load(source);
  } catch (err) {
    return { error: `load failed: ${err.message}`, clamped, targetSeconds };
  }

  const dt = 1 / clampFps(runtime.meta.fps);
  const startFrame = Math.round(targetSeconds / dt);
  const captureEvery = Math.max(1, Math.round(FRAME_GAP_SECONDS / dt));
  const totalFrames = startFrame + (GRID_SIZE * GRID_SIZE - 1) * captureEvery + 1;

  runtime.setInput(NEUTRAL_INPUT);

  const frames = new Array(GRID_SIZE * GRID_SIZE).fill(null);
  const acc = new WindowAccumulator();
  let prevBuf = null;
  let error = null;
  let framesReached = 0;

  try {
    let tt = 0;
    for (let i = 0; i < totalFrames; i++) {
      const buf = runtime.renderFrame(tt, dt);
      if (i >= startFrame) {
        acc.add(frameStats(buf, prevBuf, WIDTH, HEIGHT, EDGE_BAND_PX));
        framesReached++;
        if ((i - startFrame) % captureEvery === 0) {
          const slot = (i - startFrame) / captureEvery;
          if (slot < frames.length) frames[slot] = buf.slice();
        }
      }
      prevBuf = buf;
      tt += dt;
    }
  } catch (err) {
    error = err.message;
  } finally {
    runtime.dispose();
  }

  let contactSheetPath = null;
  if (frames.some((f) => f !== null)) {
    try {
      contactSheetPath = writeContactSheet({
        frames,
        width: WIDTH,
        height: HEIGHT,
        gridSize: GRID_SIZE,
        outputPath,
      });
    } catch (err) {
      error = error || `contact sheet generation failed: ${err.message}`;
    }
  }

  const stats = framesReached > 0 ? acc.finalize(targetSeconds, targetSeconds + framesReached * dt) : null;

  return { contactSheetPath, stats, framesReached, clamped, targetSeconds, error };
}

module.exports = { renderQuickPreview, MAX_PREVIEW_T_SECONDS };
