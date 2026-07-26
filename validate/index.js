#!/usr/bin/env node
'use strict';

// Headless validation harness (build phase 2). Runs a VFX program through
// VfxRuntime the same way the daemon does, but off-screen, and checks it
// against every gate docs/VFX_API.md's validation-harness section
// specifies: no exceptions, frame budget, liveliness (not frozen/black/
// flat), long-run collapse (not settling into a boring attractor before
// the run ends), frontmatter/lineage, and a neutral-vs-synthesized input
// sweep. Exports validateProgram() for programmatic use (the phase-4
// creativity agent calls this directly to decide deploy vs. retry) and
// doubles as a CLI:
//
//   node validate/index.js <effect.js>
//   node validate/index.js --all        # every entry in index.json

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { VfxRuntime } = require('../host/runtime/vfxRuntime');
const { validateFrontmatter } = require('./frontmatter');
const { INPUT_GROUPS, NEUTRAL_INPUT, synthesizeFrame } = require('./inputScenarios');
const {
  evaluateLiveliness,
  evaluateFrameTiming,
  frameStats,
  WindowAccumulator,
  EDGE_BAND_PX,
} = require('./metrics');
const { evaluateCollapse } = require('./collapseGates');
const { writePreviewGif, writeContactSheet } = require('./preview');
const { EPOCHS } = require('./epochs');

const WIDTH = 64;
const HEIGHT = 64;
const INDEX_PATH = path.join(__dirname, '..', 'index.json');

// A short, fixed-length pass for exception-checking only (the synthesized-
// input sweep) - deliberately NOT extended to the long horizon below, so
// this feature's Pi-cost multiplier is bounded to "old cost + one longer
// neutral pass", not 2x. Nothing reads liveliness/collapse metrics from
// this pass, only whether it threw.
const SHORT_PASS_FRAMES = 300;

// The neutral pass's horizon: simulated time is cheap (headless, no
// wall-clock binding), but the creativity agent runs this validator ON
// THE PI itself, hourly, inside a 30-minute systemd timeout, competing
// with the always-on render daemon - and this project has already been
// burned once by dev-machine timing not holding on real Pi hardware
// (vfxRuntime.js's INTERRUPT_BUDGET_MS was widened 4x->15x after
// profiling) and once by a related feature (meta.pacing: 'hour') being
// rejected outright over the same wall-clock concern. So: ship
// conservatively by default, override via env once real Pi timing is in
// hand (see HANDOFF.md's verification notes for the benchmark command).
const MAX_SIM_SECONDS = Number(process.env.VALIDATE_MAX_SIM_SECONDS) || 240;
const WINDOW_SECONDS = 15;
// 120s floor: desire-paths.js's own knowledge-base attempt note measured
// its worn-path accumulator "stabilized by ~2min" - never declare victory
// (stop early) before the run has had at least that long to prove it
// hasn't settled.
const MIN_WINDOWS_BEFORE_STOP = Math.ceil(120 / WINDOW_SECONDS);
// Relative change below this, on ALL THREE of temporalVariance/spread/
// edgeMass, for CONVERGENCE_STREAK consecutive window-pairs, means the
// piece has found its attractor - no need to keep simulating just to
// re-confirm the same number. All three, not just one or two: murmuration's
// failure shape is merge-first (temporal/spread flatten) THEN pool-later
// (edgeMass keeps creeping toward the wall after the flock has already
// stopped changing shape) - stopping on temporal/spread alone would miss
// the boundary-pileup still in progress.
const CONVERGENCE_EPS = 0.08;
const CONVERGENCE_STREAK = 3;

const GIF_CAPTURE_SECONDS = 10; // matches the old TOTAL_FRAMES=300 @ 30fps exactly
const CONTACT_GRID_SIZE = 3;
const CONTACT_FRAMES_PER_EPOCH = CONTACT_GRID_SIZE * CONTACT_GRID_SIZE;
const CONTACT_FRAME_GAP_SECONDS = 0.7; // ~0.7s apart so motion reads across the grid

function clampFps(fps) {
  if (!fps || typeof fps !== 'number') return 30;
  return Math.max(15, Math.min(60, fps));
}

function relativeChange(a, b) {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1e-6);
  return Math.abs(a - b) / denom;
}

// Precomputes, for a given dt, which frame indices need to be captured for
// the GIF preview and which for each epoch's contact sheet - so the main
// loop below can capture only what it needs (never buffering the whole
// run) with a single indexed lookup per frame.
function buildCapturePlan(dt) {
  const gifFrameCount = Math.round(GIF_CAPTURE_SECONDS / dt);
  const gifIndices = new Set();
  for (let i = 0; i < gifFrameCount; i++) gifIndices.add(i);

  // epochSlots[e] = array of CONTACT_FRAMES_PER_EPOCH frame indices (may
  // repeat/collide with other epochs at very low dt, which is harmless).
  const epochSlots = EPOCHS.map((epoch) => {
    const indices = [];
    for (let s = 0; s < CONTACT_FRAMES_PER_EPOCH; s++) {
      indices.push(Math.round((epoch.seconds + s * CONTACT_FRAME_GAP_SECONDS) / dt));
    }
    return indices;
  });

  // frameIndex -> [{epoch, slot}] reverse lookup for the hot loop.
  const contactTargets = new Map();
  epochSlots.forEach((indices, epochIdx) => {
    indices.forEach((frameIndex, slot) => {
      if (!contactTargets.has(frameIndex)) contactTargets.set(frameIndex, []);
      contactTargets.get(frameIndex).push({ epochIdx, slot });
    });
  });

  return { gifFrameCount, gifIndices, epochSlots, contactTargets };
}

// Runs the neutral pass with a fixed dt (no wall-clock jitter - this is a
// headless, deterministic test), streaming frames through per-window
// metrics accumulators instead of buffering the whole run. Captures only
// the small number of individual frames the GIF preview and epoch contact
// sheets actually need. Stops at MAX_SIM_SECONDS, or earlier once the
// piece's own dynamics have visibly converged (see CONVERGENCE_* above).
function runNeutralPassStreaming(runtime, dt) {
  const plan = buildCapturePlan(dt);
  const framesPerWindow = Math.max(1, Math.round(WINDOW_SECONDS / dt));
  const maxFrames = Math.round(MAX_SIM_SECONDS / dt);

  const gifFrames = [];
  const contactFrames = plan.epochSlots.map(() => new Array(CONTACT_FRAMES_PER_EPOCH).fill(null));
  const frameTimesMs = [];
  const windows = [];

  const wholeRunAcc = new WindowAccumulator();
  let windowAcc = new WindowAccumulator();
  let windowStartSeconds = 0;
  let windowFrameCount = 0;
  let prevWindowFinal = null;
  let convergeStreak = 0;
  let stoppedEarly = false;

  let prevBuf = null;
  let t = 0;
  let error = null;

  try {
    for (let i = 0; i < maxFrames; i++) {
      const start = performance.now();
      const buf = runtime.renderFrame(t, dt);
      frameTimesMs.push(performance.now() - start);

      if (plan.gifIndices.has(i)) gifFrames.push(buf);
      const targets = plan.contactTargets.get(i);
      if (targets) for (const { epochIdx, slot } of targets) contactFrames[epochIdx][slot] = buf;

      const stats = frameStats(buf, prevBuf, WIDTH, HEIGHT, EDGE_BAND_PX);
      wholeRunAcc.add(stats);
      windowAcc.add(stats);
      windowFrameCount++;
      prevBuf = buf;

      if (windowFrameCount >= framesPerWindow) {
        const finalWindow = windowAcc.finalize(windowStartSeconds, windowStartSeconds + WINDOW_SECONDS);
        windows.push(finalWindow);

        if (windows.length >= MIN_WINDOWS_BEFORE_STOP && prevWindowFinal) {
          const converged =
            relativeChange(finalWindow.temporalVariance, prevWindowFinal.temporalVariance) < CONVERGENCE_EPS &&
            relativeChange(finalWindow.spread, prevWindowFinal.spread) < CONVERGENCE_EPS &&
            relativeChange(finalWindow.edgeMass, prevWindowFinal.edgeMass) < CONVERGENCE_EPS;
          convergeStreak = converged ? convergeStreak + 1 : 0;
          if (convergeStreak >= CONVERGENCE_STREAK) {
            stoppedEarly = true;
            t += dt;
            break;
          }
        }

        prevWindowFinal = finalWindow;
        windowAcc = new WindowAccumulator();
        windowStartSeconds += WINDOW_SECONDS;
        windowFrameCount = 0;
      }

      t += dt;
    }
  } catch (err) {
    error = err;
  }

  return {
    metrics: wholeRunAcc.finalize(0, t),
    windows,
    stoppedEarly,
    gifFrames,
    contactFrames,
    frameTimesMs,
    error,
  };
}

// Short, fixed-length pass used only for exception-checking (the
// synthesized-input sweep) - frames are never retained, since nothing
// downstream needs them.
function runShortPass(runtime, totalFrames, dt, onFrame) {
  let t = 0;
  try {
    for (let i = 0; i < totalFrames; i++) {
      if (onFrame) onFrame(i, t, dt);
      runtime.renderFrame(t, dt);
      t += dt;
    }
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

// source: full program text. opts.filePath (optional): if given, the GIF
// preview is written beside it (`foo.js` -> `foo.gif`).
async function validateProgram(source, opts = {}) {
  const errors = [];
  const warnings = [];
  const checks = {};

  const fm = validateFrontmatter(source);
  checks.frontmatter = fm.ok;
  errors.push(...fm.failures.map((f) => `frontmatter: ${f}`));
  warnings.push(...fm.warnings.map((w) => `frontmatter: ${w}`));

  let runtime;
  try {
    runtime = await VfxRuntime.load(source);
  } catch (err) {
    errors.push(`load failed: ${err.message}`);
    return {
      pass: false,
      checks,
      metrics: null,
      collapse: null,
      warnings,
      errors,
      gifPath: null,
      contactSheetPaths: [],
      frontmatter: fm.frontmatter,
    };
  }

  const declaredInputs = Array.isArray(runtime.meta.inputs)
    ? runtime.meta.inputs.filter((g) => {
        const known = INPUT_GROUPS.includes(g);
        if (!known) warnings.push(`meta.inputs declares unknown group "${g}" (ignored)`);
        return known;
      })
    : [];
  const fps = clampFps(runtime.meta.fps);
  const dt = 1 / fps;

  if (runtime.meta.quality === 'half' && runtime.mode !== 'pixel') {
    warnings.push('meta.quality has no effect in buffer mode (pixel mode only); ignored');
  }

  // Neutral pass: also the source of liveliness/collapse metrics, frame
  // timing, and the GIF preview + epoch contact sheets.
  runtime.setInput(NEUTRAL_INPUT);
  const neutral = runNeutralPassStreaming(runtime, dt);
  checks.noExceptionsNeutral = !neutral.error;
  if (neutral.error) errors.push(`exception during neutral pass: ${neutral.error.message}`);

  let metrics = null;
  if (neutral.metrics && neutral.metrics.frameCount >= 2) {
    metrics = neutral.metrics;
    const live = evaluateLiveliness(metrics);
    checks.liveliness = live.failures.length === 0;
    errors.push(...live.failures.map((f) => `liveliness: ${f}`));
    warnings.push(...live.warnings.map((w) => `liveliness: ${w}`));
  } else {
    checks.liveliness = false;
    if (!neutral.error) errors.push('liveliness: not enough frames captured to evaluate');
  }

  const collapse = evaluateCollapse(neutral.windows);
  checks.collapse = collapse.skipped || collapse.failures.length === 0;
  errors.push(...collapse.failures.map((f) => `collapse: ${f}`));
  warnings.push(...collapse.warnings.map((w) => `collapse: ${w}`));

  if (neutral.frameTimesMs.length > 0) {
    const timing = evaluateFrameTiming(neutral.frameTimesMs);
    checks.frameBudget = timing.failures.length === 0;
    errors.push(...timing.failures.map((f) => `frame budget: ${f}`));
    warnings.push(...timing.warnings.map((w) => `frame budget: ${w}`));
  }

  let gifPath = null;
  if (neutral.gifFrames.length >= 2 && opts.filePath) {
    try {
      gifPath = writePreviewGif({
        frames: neutral.gifFrames,
        width: WIDTH,
        height: HEIGHT,
        fps,
        outputPath: opts.filePath.replace(/\.js$/, '.gif'),
      });
    } catch (err) {
      warnings.push(`preview GIF generation failed: ${err.message}`);
    }
  }

  // Epoch contact sheets (not the animated GIF) for the creativity agent's
  // vision context - see writeContactSheet for why a single still doesn't
  // work. Only rendered when the caller asks (opts.contactSheetPaths),
  // one per EPOCHS entry, positional; an epoch the run never reached (cap
  // hit, or converged early) gets null at that index rather than an
  // omitted entry - itself meaningful, not an error.
  let contactSheetPaths = [];
  if (opts.contactSheetPaths && opts.contactSheetPaths.length > 0) {
    contactSheetPaths = opts.contactSheetPaths.map(() => null);
    for (let e = 0; e < EPOCHS.length && e < opts.contactSheetPaths.length; e++) {
      const frames = neutral.contactFrames[e];
      const reached = frames.some((f) => f !== null);
      if (!reached) continue;
      try {
        contactSheetPaths[e] = writeContactSheet({
          frames,
          width: WIDTH,
          height: HEIGHT,
          gridSize: CONTACT_GRID_SIZE,
          outputPath: opts.contactSheetPaths[e],
        });
      } catch (err) {
        warnings.push(`contact sheet generation failed for epoch ${EPOCHS[e].label}: ${err.message}`);
      }
    }
  }

  runtime.dispose();

  // Synthesized pass: fresh sandbox so state doesn't carry over from the
  // neutral run, only exercised when the program declares reactive input
  // groups (nothing to synthesize otherwise). Deliberately short (see
  // SHORT_PASS_FRAMES) - exception-checking only, no metrics read from it.
  if (declaredInputs.length > 0) {
    let synthRuntime;
    let synthError;
    try {
      synthRuntime = await VfxRuntime.load(source);
      const result = runShortPass(synthRuntime, SHORT_PASS_FRAMES, dt, (i, t, frameDt) => {
        synthRuntime.setInput(synthesizeFrame(declaredInputs, i, t, frameDt, SHORT_PASS_FRAMES));
      });
      synthError = result.error;
    } catch (err) {
      synthError = err;
    } finally {
      if (synthRuntime) synthRuntime.dispose();
    }
    checks.noExceptionsSynthesized = !synthError;
    if (synthError) errors.push(`exception during synthesized pass: ${synthError.message}`);
  } else {
    checks.noExceptionsSynthesized = true;
  }

  return {
    pass: errors.length === 0,
    checks,
    metrics,
    collapse: { windows: neutral.windows, stoppedEarly: neutral.stoppedEarly, details: collapse.details },
    warnings,
    errors,
    gifPath,
    contactSheetPaths,
    frontmatter: fm.frontmatter,
    declaredInputs,
  };
}

function formatReport(label, report) {
  const lines = [];
  lines.push(`${report.pass ? 'PASS' : 'FAIL'}  ${label}`);
  for (const [name, ok] of Object.entries(report.checks)) {
    lines.push(`  [${ok ? 'x' : ' '}] ${name}`);
  }
  if (report.metrics) {
    const m = report.metrics;
    lines.push(
      `  metrics: temporalVariance=${m.temporalVariance.toFixed(3)} meanBrightness=${m.meanBrightness.toFixed(2)} spatialContrast=${m.spatialContrast.toFixed(2)}`
    );
  }
  if (report.collapse && report.collapse.details) {
    const d = report.collapse.details;
    const horizon = report.collapse.windows.length
      ? `${Math.round(report.collapse.windows[report.collapse.windows.length - 1].endSeconds)}s`
      : '0s';
    lines.push(
      `  collapse: horizon=${horizon}${report.collapse.stoppedEarly ? ' (converged early)' : ''} ` +
        `temporalRatio=${d.temporalRatio.toFixed(2)} spreadRatio=${d.spreadRatio.toFixed(2)} ` +
        `motionSpreadRatio=${d.motionSpreadRatio.toFixed(2)} minLateEdgeMass=${d.minLateEdgeMass.toFixed(2)}`
    );
  }
  if (report.declaredInputs && report.declaredInputs.length) {
    lines.push(`  declared inputs: ${report.declaredInputs.join(', ')}`);
  }
  if (report.gifPath) lines.push(`  preview: ${report.gifPath}`);
  if (report.contactSheetPaths && report.contactSheetPaths.length) {
    lines.push(`  contact sheets: ${report.contactSheetPaths.map((p) => p || '(not reached)').join(', ')}`);
  }
  for (const w of report.warnings) lines.push(`  warning: ${w}`);
  for (const e of report.errors) lines.push(`  error: ${e}`);
  return lines.join('\n');
}

async function validateFile(filePath) {
  const resolved = path.resolve(filePath);
  const source = fs.readFileSync(resolved, 'utf8');
  return validateProgram(source, { filePath: resolved });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage:\n  node validate/index.js <effect.js>\n  node validate/index.js --all');
    process.exit(1);
  }

  let allPass = true;

  if (args[0] === '--all') {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    for (const [id, relPath] of Object.entries(index)) {
      const filePath = path.join(__dirname, '..', relPath);
      const report = await validateFile(filePath);
      console.log(formatReport(`${relPath} (${id})`, report));
      console.log('');
      if (!report.pass) allPass = false;
    }
  } else {
    const report = await validateFile(args[0]);
    console.log(formatReport(args[0], report));
    allPass = report.pass;
  }

  process.exit(allPass ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[validate] fatal:', err);
    process.exit(1);
  });
}

module.exports = { validateProgram, validateFile };
