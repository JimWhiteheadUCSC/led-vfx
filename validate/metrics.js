'use strict';

// Liveliness metrics computed from the neutral pass's captured frame
// buffers (Uint8Array of WIDTH*HEIGHT*3 RGB bytes each), plus frame-timing
// evaluation. Thresholds below are initial, deliberately generous guesses —
// tune them once the harness has run against more than the three seed
// pieces (see validate/index.js's verification notes).

const FRAME_BUDGET_MS = 20;
// Dev-machine timing doesn't match the Pi's, so budget overruns are a soft
// warning except when grossly over — that's the same multiple vfxRuntime.js
// uses for its interrupt-handler crash guard, i.e. clearly pathological.
const FRAME_BUDGET_GROSS_MULTIPLIER = 4;
const OVERRUN_FRACTION_WARN = 0.1;

// Mean absolute per-byte difference between consecutive frames, averaged
// over the run. Below this, the image isn't visibly changing frame to
// frame ("frozen"). Calibrated against the three seed pieces, which range
// 0.44 (plasma_bloom's slow-evolving fields) to 0.65 (koi_pond) — a
// genuinely frozen program (e.g. a render() that draws once and never
// updates state) reads as ~0, so this has ample margin below all three
// while still catching that case.
const FROZEN_TEMPORAL_VARIANCE = 0.15;
// Mean byte value over the whole run. Below this, the panel is
// effectively off ("black"). Calibrated against fireflies (1.47) — sparse
// warm sparks on darkness is a deliberate, documented seed aesthetic, not
// a failure — while a true "rendered nothing" bug holds at exactly 0.
const BLACK_MEAN_BRIGHTNESS = 0.5;
// Per-frame standard deviation of byte values (0-255 scale), averaged over
// the run. Below this, every frame is close to a single solid color
// ("flat") — a true flat fill has std ~0 regardless of what that color is.
// Deliberately NOT brightness-histogram entropy: CLAUDE.md's own aesthetic
// guidance calls for dark backgrounds with bright accents, which skews a
// naive brightness histogram toward one bin even for a lively piece (a
// koi_pond frame with a 4% mean brightness still has std ~21 because the
// koi are much brighter than the pond) — std deviation rewards contrast
// without being biased by how dark the overall image is.
const FLAT_SPATIAL_CONTRAST = 2;

// Soft aesthetic-band warnings (CLAUDE.md's "dark backgrounds + bright
// accents, moderate average brightness" guidance) — generous, not a gate.
const BRIGHTNESS_WARN_LOW = 5;
const BRIGHTNESS_WARN_HIGH = 200;
const CONTRAST_WARN = 6;

function meanAbsDiff(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

function frameStdDev(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i];
  const mean = sum / frame.length;
  let sq = 0;
  for (let i = 0; i < frame.length; i++) {
    const d = frame[i] - mean;
    sq += d * d;
  }
  return Math.sqrt(sq / frame.length);
}

// frames: array of Uint8Array captured over a run. Returns the three raw
// liveliness metrics.
function computeMetrics(frames) {
  let brightnessSum = 0;
  let brightnessCount = 0;
  let contrastSum = 0;
  for (const f of frames) {
    for (let i = 0; i < f.length; i++) brightnessSum += f[i];
    brightnessCount += f.length;
    contrastSum += frameStdDev(f);
  }

  let temporalSum = 0;
  for (let i = 1; i < frames.length; i++) temporalSum += meanAbsDiff(frames[i], frames[i - 1]);

  return {
    temporalVariance: frames.length > 1 ? temporalSum / (frames.length - 1) : 0,
    meanBrightness: brightnessCount > 0 ? brightnessSum / brightnessCount : 0,
    spatialContrast: frames.length > 0 ? contrastSum / frames.length : 0,
  };
}

// Applies the frozen/black/flat hard-fail gate and the aesthetic-band soft
// warnings to a computeMetrics() result.
function evaluateLiveliness(metrics) {
  const failures = [];
  const warnings = [];

  if (metrics.temporalVariance < FROZEN_TEMPORAL_VARIANCE) {
    failures.push(
      `frozen: temporal variance ${metrics.temporalVariance.toFixed(3)} below ${FROZEN_TEMPORAL_VARIANCE}`
    );
  }
  if (metrics.meanBrightness < BLACK_MEAN_BRIGHTNESS) {
    failures.push(
      `black: mean brightness ${metrics.meanBrightness.toFixed(2)} below ${BLACK_MEAN_BRIGHTNESS}`
    );
  }
  if (metrics.spatialContrast < FLAT_SPATIAL_CONTRAST) {
    failures.push(
      `flat: spatial contrast (std dev) ${metrics.spatialContrast.toFixed(2)} below ${FLAT_SPATIAL_CONTRAST}`
    );
  }

  if (metrics.meanBrightness < BRIGHTNESS_WARN_LOW || metrics.meanBrightness > BRIGHTNESS_WARN_HIGH) {
    warnings.push(`mean brightness ${metrics.meanBrightness.toFixed(2)} outside aesthetic band [${BRIGHTNESS_WARN_LOW}, ${BRIGHTNESS_WARN_HIGH}]`);
  }
  if (metrics.spatialContrast < CONTRAST_WARN) {
    warnings.push(`spatial contrast ${metrics.spatialContrast.toFixed(2)} is low (borderline flat)`);
  }

  return { failures, warnings };
}

// frameTimesMs: array of per-frame wall-clock durations (ms) as measured
// by the harness around each renderFrame() call.
function evaluateFrameTiming(frameTimesMs) {
  const meanMs = frameTimesMs.reduce((a, b) => a + b, 0) / frameTimesMs.length;
  const maxMs = Math.max(...frameTimesMs);
  const overruns = frameTimesMs.filter((ms) => ms > FRAME_BUDGET_MS).length;
  const overrunFraction = overruns / frameTimesMs.length;

  const failures = [];
  const warnings = [];

  if (meanMs > FRAME_BUDGET_MS * FRAME_BUDGET_GROSS_MULTIPLIER) {
    failures.push(`grossly over frame budget: mean ${meanMs.toFixed(2)}ms vs ${FRAME_BUDGET_MS}ms budget`);
  } else if (meanMs > FRAME_BUDGET_MS || overrunFraction > OVERRUN_FRACTION_WARN) {
    warnings.push(
      `frame budget: mean ${meanMs.toFixed(2)}ms, ${(overrunFraction * 100).toFixed(1)}% of frames over ${FRAME_BUDGET_MS}ms (dev-machine timing, best-effort only)`
    );
  }

  return { meanMs, maxMs, overrunFraction, failures, warnings };
}

module.exports = {
  computeMetrics,
  evaluateLiveliness,
  evaluateFrameTiming,
  FRAME_BUDGET_MS,
  FRAME_BUDGET_GROSS_MULTIPLIER,
  OVERRUN_FRACTION_WARN,
  FROZEN_TEMPORAL_VARIANCE,
  BLACK_MEAN_BRIGHTNESS,
  FLAT_SPATIAL_CONTRAST,
  BRIGHTNESS_WARN_LOW,
  BRIGHTNESS_WARN_HIGH,
  CONTRAST_WARN,
};
