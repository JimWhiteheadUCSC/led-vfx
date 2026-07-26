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

// Width of the border ring "edge-mass" (below) treats as "against the
// wall" — see validate/collapseGates.js for why this needs to sit well
// above this ring's own geometric share of the panel's area.
const EDGE_BAND_PX = 6;

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

// Per-frame stats for the streaming/windowed collapse gates (see
// validate/collapseGates.js), computed in one pixel pass so a long run
// (minutes, not the old 10s) never needs a second pass over stored frames.
// `prevFrame` is null for a run's very first frame (or right after a
// runtime reload) - temporal is null in that case, not 0, so callers don't
// silently count a missing comparison as "no change".
//
// Luminance here is a plain per-pixel channel average (r+g+b)/3, not a
// perceptual weighting - this is an internal collapse/spread signal, not
// a display value, so the extra complexity of real luminance weights
// buys nothing.
//
// spread: luminance-weighted standard distance from the frame's own
// luminance centroid, via the parallel-axis trick (sumLx2/sumL - cx²) so
// the centroid and spread come out of the same single pass. Collapses
// toward 0 as content gathers into one knot/clump - the same number
// catches both a merged flock and a converged central blob, since both
// are "distributed brightness got less distributed", not two different
// failure shapes needing two different detectors.
//
// edgeMass: fraction of total luminance within `edgeBandPx` of the panel
// border. For a 64x64 panel and the default 6px band, that ring is
// (4096 - 52*52)/4096 ≈ 0.34 of pixel *area* - so a meaningful "pooling
// at the boundary" gate threshold must sit well above 0.34 (uniform
// brightness alone would already read ~0.34), not near it.
//
// motionSpread: the SAME standard-distance-from-centroid computation as
// spread, but weighted by per-pixel frame-to-frame CHANGE instead of raw
// luminance. Both weights are SQUARED (L*L, D*D), not linear - the same
// perceptual-curve idiom this codebase already uses for display (v*v) -
// so a few genuinely bright/active pixels dominate the average over many
// faintly-changing ones.
//
// Both spread and motionSpread reliably catch murmuration.js's failure
// (spatial collapse - many flocks merging into one: spreadRatio/
// motionSpreadRatio both fall well below 1 as the birds consolidate,
// confirmed against real measured runs). Neither reliably catches
// desire-paths.js's failure, tried with both linear and squared weights:
// its walkers fly in from random start positions to a small FIXED set of
// waypoints within the first ~30s, and after that transient, position/
// motion spread simply stays constant (ratio ~1.0) - because the failure
// there isn't a late collapse in space, it's an early arrival at a small
// fixed repertoire that then repeats unchanged for the rest of the run.
// That's a real, different failure shape (bounded novelty over time, not
// spatial concentration) that these two spatial statistics structurally
// can't see - it needs the complementary mechanism this project already
// has for exactly this gap: the creativity agent's own eyes, via the
// epoch contact sheets (see validate/preview.js's writeContactSheet) -
// "metrics catch collapse; they can't catch boring." See
// knowledge/craft/attractors.md for the fuller writeup.
function frameStats(frame, prevFrame, width, height, edgeBandPx) {
  const n = frame.length;
  let byteSum = 0;
  let byteSumSq = 0;
  let sumL = 0;
  let sumLx = 0;
  let sumLy = 0;
  let sumLx2 = 0;
  let sumLy2 = 0;
  let edgeL = 0;
  let sumAbsDelta = 0;
  let sumD = 0;
  let sumDx = 0;
  let sumDy = 0;
  let sumDx2 = 0;
  let sumDy2 = 0;
  const hasPrev = !!prevFrame;

  for (let y = 0; y < height; y++) {
    const nearEdgeY = y < edgeBandPx || y >= height - edgeBandPx;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const r = frame[idx];
      const g = frame[idx + 1];
      const b = frame[idx + 2];
      byteSum += r + g + b;
      byteSumSq += r * r + g * g + b * b;
      const L = (r + g + b) / 3;
      const Lw = L * L; // squared weight - see the function doc comment
      sumL += Lw;
      sumLx += Lw * x;
      sumLy += Lw * y;
      sumLx2 += Lw * x * x;
      sumLy2 += Lw * y * y;
      if (nearEdgeY || x < edgeBandPx || x >= width - edgeBandPx) edgeL += Lw;

      if (hasPrev) {
        const dr = Math.abs(r - prevFrame[idx]);
        const dg = Math.abs(g - prevFrame[idx + 1]);
        const db = Math.abs(b - prevFrame[idx + 2]);
        sumAbsDelta += dr + dg + db;
        const D = (dr + dg + db) / 3;
        const Dw = D * D; // squared weight - see the function doc comment
        sumD += Dw;
        sumDx += Dw * x;
        sumDy += Dw * y;
        sumDx2 += Dw * x * x;
        sumDy2 += Dw * y * y;
      }
    }
  }

  const meanByte = byteSum / n;
  const stdDev = Math.sqrt(Math.max(0, byteSumSq / n - meanByte * meanByte));

  let spread = 0;
  let edgeMass = 0;
  if (sumL > 1e-6) {
    const cx = sumLx / sumL;
    const cy = sumLy / sumL;
    const varX = Math.max(0, sumLx2 / sumL - cx * cx);
    const varY = Math.max(0, sumLy2 / sumL - cy * cy);
    spread = Math.sqrt(varX + varY);
    edgeMass = edgeL / sumL;
  }

  let temporal = null;
  let motionSpread = null;
  if (hasPrev) {
    temporal = sumAbsDelta / n; // same formula as meanAbsDiff(frame, prevFrame), computed inline
    if (sumD > 1e-6) {
      const mcx = sumDx / sumD;
      const mcy = sumDy / sumD;
      const mVarX = Math.max(0, sumDx2 / sumD - mcx * mcx);
      const mVarY = Math.max(0, sumDy2 / sumD - mcy * mcy);
      motionSpread = Math.sqrt(mVarX + mVarY);
    } else {
      motionSpread = 0; // literally nothing changed this frame
    }
  }

  return {
    n,
    byteSum,
    stdDev,
    spread,
    edgeMass,
    temporal,
    motionSpread,
  };
}

// Accumulates frameStats() results and reduces them to the same shape
// computeMetrics() below returns, plus the two new spatial statistics -
// used twice per run: once per WINDOW_SECONDS window (reset each window,
// feeds validate/collapseGates.js's early-vs-late comparison) and once
// never-reset across the whole run (feeds evaluateLiveliness() below,
// numerically equivalent to the old buffer-everything computeMetrics()
// since it's the same formulas over the same data, just accumulated
// incrementally instead of from a stored frames array).
class WindowAccumulator {
  constructor() {
    this.frameCount = 0;
    this.byteSum = 0;
    this.byteCount = 0;
    this.stdDevSum = 0;
    this.spreadSum = 0;
    this.edgeMassSum = 0;
    this.temporalSum = 0;
    this.temporalCount = 0;
    this.motionSpreadSum = 0;
    this.motionSpreadCount = 0;
  }

  add(stats) {
    this.frameCount++;
    this.byteSum += stats.byteSum;
    this.byteCount += stats.n;
    this.stdDevSum += stats.stdDev;
    this.spreadSum += stats.spread;
    this.edgeMassSum += stats.edgeMass;
    if (stats.temporal !== null) {
      this.temporalSum += stats.temporal;
      this.temporalCount++;
    }
    if (stats.motionSpread !== null) {
      this.motionSpreadSum += stats.motionSpread;
      this.motionSpreadCount++;
    }
  }

  finalize(startSeconds, endSeconds) {
    return {
      startSeconds,
      endSeconds,
      frameCount: this.frameCount,
      temporalVariance: this.temporalCount > 0 ? this.temporalSum / this.temporalCount : 0,
      meanBrightness: this.byteCount > 0 ? this.byteSum / this.byteCount : 0,
      spatialContrast: this.frameCount > 0 ? this.stdDevSum / this.frameCount : 0,
      spread: this.frameCount > 0 ? this.spreadSum / this.frameCount : 0,
      edgeMass: this.frameCount > 0 ? this.edgeMassSum / this.frameCount : 0,
      motionSpread: this.motionSpreadCount > 0 ? this.motionSpreadSum / this.motionSpreadCount : 0,
    };
  }
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
  frameStats,
  WindowAccumulator,
  FRAME_BUDGET_MS,
  FRAME_BUDGET_GROSS_MULTIPLIER,
  OVERRUN_FRACTION_WARN,
  FROZEN_TEMPORAL_VARIANCE,
  BLACK_MEAN_BRIGHTNESS,
  FLAT_SPATIAL_CONTRAST,
  BRIGHTNESS_WARN_LOW,
  BRIGHTNESS_WARN_HIGH,
  CONTRAST_WARN,
  EDGE_BAND_PX,
};
