'use strict';

// Builds the two input scenarios the harness drives a program with, per
// docs/VFX_API.md's validation-harness spec: synthesized streams for
// declared input groups, and an explicit neutral baseline. Values here are
// plausible synthetic waveforms, not simulations of real hardware — real
// sampling (audio FFT, suncalc, weather fetch) lands in build phase 3.

const INPUT_GROUPS = ['audio', 'button', 'clock', 'env'];

// Matches the sandbox's own defaults in host/runtime/prelude.js. The
// neutral pass sets this explicitly rather than relying on a freshly
// loaded sandbox happening to already be neutral, so the check doesn't
// silently depend on prelude internals never drifting.
const NEUTRAL_INPUT = {
  audio: { ok: false, level: 0, bass: 0, mid: 0, treble: 0, beat: false },
  button: { down: false, pressed: false, released: false, heldSeconds: 0 },
  clock: { hour: 12, minute: 0, weekday: 0, dayOfYear: 1, daylight: 0.5 },
  env: { ok: false, tempC: 20, cloud: 0, rain: 0 },
};

// Each synthesizer takes (frameIndex, t, dt, totalFrames) and returns a
// full patch for its group (see docs/VFX_API.md's Inputs section for the
// field shapes each group must produce).

function synthAudio(frameIndex, t) {
  const level = (Math.sin(t * 3) + 1) / 2;
  const bass = (Math.sin(t * 2 + 0.5) + 1) / 2;
  const mid = (Math.sin(t * 2.7 + 1) + 1) / 2;
  const treble = (Math.sin(t * 4 + 2) + 1) / 2;
  // One-frame beat pulse roughly every 0.6s (~18 frames @ 30fps).
  const beat = frameIndex % 18 === 0;
  return { ok: true, level, bass, mid, treble, beat };
}

// Press-hold-release schedule expressed as fractions of the run so it
// scales with whatever totalFrames the harness uses.
function synthButton(frameIndex, t, dt, totalFrames) {
  const downStart = Math.floor(totalFrames * 0.1);
  const downEnd = Math.floor(totalFrames * 0.3);
  const down = frameIndex >= downStart && frameIndex < downEnd;
  return {
    down,
    pressed: frameIndex === downStart,
    released: frameIndex === downEnd,
    heldSeconds: down ? (frameIndex - downStart) * dt : 0,
  };
}

// Sweeps a full day across the run, with a synthetic daylight curve
// (0 at midnight, 1 at noon) rather than a real suncalc computation.
function synthClock(frameIndex, t, dt, totalFrames) {
  const hour = (frameIndex / totalFrames) * 24;
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  return {
    hour,
    minute: Math.floor((hour % 1) * 60),
    weekday: 2,
    dayOfYear: 180,
    daylight,
  };
}

function synthEnv(frameIndex, t) {
  const tempC = 18 + 6 * Math.sin(t * 0.05);
  const cloud = (Math.sin(t * 0.03) + 1) / 2;
  const rain = Math.max(0, Math.sin(t * 0.02) - 0.5) * 2;
  return { ok: true, tempC, cloud, rain };
}

const SYNTHESIZERS = {
  audio: synthAudio,
  button: synthButton,
  clock: synthClock,
  env: synthEnv,
};

// Returns a patch object covering only `groups` (the program's declared
// meta.inputs) for the given frame — undeclared groups are omitted so the
// caller leaves them at neutral.
function synthesizeFrame(groups, frameIndex, t, dt, totalFrames) {
  const patch = {};
  for (const group of groups) {
    const fn = SYNTHESIZERS[group];
    if (fn) patch[group] = fn(frameIndex, t, dt, totalFrames);
  }
  return patch;
}

module.exports = { INPUT_GROUPS, NEUTRAL_INPUT, synthesizeFrame };
