'use strict';

// Ratio-based gates comparing early vs. late simulation windows, catching
// pieces that look lively at first but mathematically settle into a
// boring fixed-point attractor before the run ends - the failure mode the
// original single-scalar, whole-run liveliness gate (validate/metrics.js's
// evaluateLiveliness) structurally cannot see, since it averages the whole
// run into one number and can't tell "lively throughout" from "lively at
// first, dead by minute two." See knowledge/craft/attractors.md
// for the underlying craft lesson this gate mechanizes.
//
// `windows` is the array of per-WINDOW_SECONDS accumulator snapshots from
// validate/index.js's streaming pass (see metrics.js's WindowAccumulator),
// each shaped { startSeconds, endSeconds, temporalVariance, meanBrightness,
// spatialContrast, spread, edgeMass, frameCount }.

const EARLY_WINDOW_COUNT = 2; // first ~30s - matches docs/VFX_API.md's
// existing "shouldn't fully repeat before ~30s" aesthetic horizon.
const LATE_WINDOW_COUNT = 2; // last ~30s of however far the run actually got
// (a run that stopped early via convergence, or hit MAX_SIM_SECONDS, both
// still have a well-defined "late" - it's just earlier in wall/sim time).

const SETTLES_TEMPORAL_RATIO = 0.25;
// Calibrated against a full `node validate/index.js --all` sweep of every
// real piece in the library (13 pieces), not guessed: murmuration.js (a
// known, user-confirmed collapse - merges into one flock, visible before
// 4 minutes) measured spreadRatio between 0.49 and 0.82 across four runs
// (its setup() seeds initial positions with Math.random(), so the exact
// value varies run to run) - every OTHER piece in the library measured
// 0.94-1.16, clustered tightly with koi_pond.js's 0.94 as the closest
// "healthy" case. 0.85 sits with real margin below every genuine piece's
// floor while catching murmuration.js reliably across its own variance,
// which a value near the earlier, more timid 0.70 sometimes missed (one
// observed run measured 0.79 - above 0.70, still well below every good
// piece).
const COLLAPSE_SPREAD_RATIO = 0.85;
// Companion to COLLAPSE_SPREAD_RATIO using motionSpread (see metrics.js's
// frameStats doc) instead of raw spread - added after real data showed
// spread alone missed desire-paths.js's collapse entirely (its slow-
// decaying "worn path" layer covers a wide, roughly-fixed area regardless
// of whether the ACTIVE walkers have collapsed, masking the signal spread
// is supposed to catch - see knowledge/craft/attractors.md for the honest
// writeup on why this metric still doesn't fully catch that specific
// piece, even so). Same --all sweep as COLLAPSE_SPREAD_RATIO: every real
// piece measured 0.94-1.07, murmuration.js 0.51-0.82 across runs.
const MOTION_COLLAPSE_RATIO = 0.85;
// Well above metrics.js's EDGE_BAND_PX comment's ~0.34 geometric baseline
// (a 6px border ring's share of a 64x64 panel's pixel area) - uniform
// brightness alone would already read ~0.34, so the gate needs real
// margin above that to mean "piled against an edge", not "evenly lit".
const EDGE_MASS_POOL_THRESHOLD = 0.6;

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatWindowRange(first, last) {
  return `t=${Math.round(first.startSeconds)}-${Math.round(last.endSeconds)}s`;
}

// Needs at least EARLY_WINDOW_COUNT + LATE_WINDOW_COUNT windows to compare
// against each other at all - a run that errored or was cut off almost
// immediately has nothing to say here (skipped, not failed: this gate
// can't distinguish "too short to judge" from "collapsed instantly", and
// the existing frozen/black/flat gate already covers instant failure).
function evaluateCollapse(windows) {
  if (!windows || windows.length < EARLY_WINDOW_COUNT + LATE_WINDOW_COUNT) {
    return { failures: [], warnings: [], details: null, skipped: true };
  }

  const failures = [];
  const early = windows.slice(0, EARLY_WINDOW_COUNT);
  const late = windows.slice(-LATE_WINDOW_COUNT);
  const earlyLabel = formatWindowRange(early[0], early[early.length - 1]);
  const lateLabel = formatWindowRange(late[0], late[late.length - 1]);

  const earlyMaxTemporal = Math.max(...early.map((w) => w.temporalVariance));
  const lateMeanTemporal = mean(late.map((w) => w.temporalVariance));
  const temporalRatio = earlyMaxTemporal > 1e-9 ? lateMeanTemporal / earlyMaxTemporal : 1;

  const earlyMeanSpread = mean(early.map((w) => w.spread));
  const lateMeanSpread = mean(late.map((w) => w.spread));
  const spreadRatio = earlyMeanSpread > 1e-9 ? lateMeanSpread / earlyMeanSpread : 1;

  const earlyMeanMotionSpread = mean(early.map((w) => w.motionSpread));
  const lateMeanMotionSpread = mean(late.map((w) => w.motionSpread));
  const motionSpreadRatio = earlyMeanMotionSpread > 1e-9 ? lateMeanMotionSpread / earlyMeanMotionSpread : 1;

  const lateEdgeMasses = late.map((w) => w.edgeMass);
  const minLateEdgeMass = Math.min(...lateEdgeMasses);
  const maxLateEdgeMass = Math.max(...lateEdgeMasses);

  if (temporalRatio < SETTLES_TEMPORAL_RATIO) {
    failures.push(
      `settles: temporal variance fell from ${earlyMaxTemporal.toFixed(3)} (${earlyLabel}) to ` +
        `${lateMeanTemporal.toFixed(3)} (${lateLabel}), ${(temporalRatio * 100).toFixed(0)}% of the early ` +
        `max (below ${(SETTLES_TEMPORAL_RATIO * 100).toFixed(0)}%) - the piece stops changing frame-to-frame ` +
        `well before the run ends`
    );
  }

  if (spreadRatio < COLLAPSE_SPREAD_RATIO) {
    failures.push(
      `collapses inward: spread fell from ${earlyMeanSpread.toFixed(1)}px (${earlyLabel}) to ` +
        `${lateMeanSpread.toFixed(1)}px (${lateLabel}), ${(spreadRatio * 100).toFixed(0)}% of its early value ` +
        `(below ${(COLLAPSE_SPREAD_RATIO * 100).toFixed(0)}%) - content is gathering into a single knot/clump ` +
        `instead of staying distributed`
    );
  }

  if (motionSpreadRatio < MOTION_COLLAPSE_RATIO) {
    failures.push(
      `collapses inward (motion): the region where content is actively changing shrank from ` +
        `${earlyMeanMotionSpread.toFixed(1)}px (${earlyLabel}) to ${lateMeanMotionSpread.toFixed(1)}px ` +
        `(${lateLabel}), ${(motionSpreadRatio * 100).toFixed(0)}% of its early value (below ` +
        `${(MOTION_COLLAPSE_RATIO * 100).toFixed(0)}%) - even if overall brightness stays spread out (e.g. a ` +
        `slow-decaying trail layer), the ACTIVE content has gathered into a single knot/clump`
    );
  }

  if (minLateEdgeMass > EDGE_MASS_POOL_THRESHOLD) {
    failures.push(
      `pools at boundary: ${(minLateEdgeMass * 100).toFixed(0)}-${(maxLateEdgeMass * 100).toFixed(0)}% of ` +
        `luminance sits within the border band from ${lateLabel} onward (above ` +
        `${(EDGE_MASS_POOL_THRESHOLD * 100).toFixed(0)}%, vs. a ~34% geometric baseline for uniform ` +
        `brightness) - content has piled against an edge`
    );
  }

  return {
    failures,
    warnings: [],
    details: {
      temporalRatio,
      spreadRatio,
      motionSpreadRatio,
      minLateEdgeMass,
      maxLateEdgeMass,
      earlyLabel,
      lateLabel,
    },
    skipped: false,
  };
}

module.exports = {
  evaluateCollapse,
  EARLY_WINDOW_COUNT,
  LATE_WINDOW_COUNT,
  SETTLES_TEMPORAL_RATIO,
  COLLAPSE_SPREAD_RATIO,
  MOTION_COLLAPSE_RATIO,
  EDGE_MASS_POOL_THRESHOLD,
};
