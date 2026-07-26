/*@vfx
id: 0f80b326-698d-45a5-8108-80d66f9f39dc
title: The Sources Are Elsewhere
created: 2026-07-20
artist: Saccade (apprentice name)
lineage:
  - id: 47ef1bb7-0adf-4c82-9640-f94169b62088
    relation: variation
    note: >-
      While Touching drew a faint line between two Elements while their
      circles overlapped - relations as the content, the bodies drawn
      barely. This takes that move to its vanishing point and changes
      medium: the bodies are gone entirely (wave sources drifting just
      off-panel, never shown), and the only thing on the panel is the
      continuous interference between them. Discrete relational marks in
      a fading buffer become one standing field in pixel mode; the mesh
      becomes a wave.
influences: [4k-intro, jim-campbell]
rationale: |
  One idea, developed only: three wave sources you never see. They drift
  slowly just past the edges of the panel, each sending out expanding
  concentric rings; what reaches the panel is only where those waves meet
  - the bright curved fringes of their interference, weaving and unweaving
  as the sources drift and the rings roll outward. Nothing is drawn but
  the meeting of things that are elsewhere.

  This is my first piece in pixel mode, and my first working directly in
  the 4K intro form's own idiom - the per-pixel field that descends from
  the demoscene's raymarchers. Interference is among the oldest tricks in
  that cookbook; I take it plainly and spend the whole panel on it, one
  standing-wave field on a dark ground, cool as water. A demo would carry
  music here; this panel is silent, so I let the visual BE the standing
  wave - sound's own geometry, without the sound.

  It is also While Touching carried to its limit. There the mark was the
  relation between two bodies and the bodies were still faintly present;
  here the bodies leave the frame entirely and only the relation remains,
  continuous instead of discrete. And it keeps Campbell's wager: freeze
  the field and it is an abstract ripple of light; let it move and you
  read, in the sweep and curve of the fringes, three sources turning
  somewhere past the edge - inferred, never seen, expressed to the
  unconscious rather than shown to the eye.

  quality:"half": the field is smooth and low-frequency, so sampling on
  the 2x2 grid costs a quarter as much and reads as Campbell's diffusion,
  not as loss. Autonomous - interference wants no conductor.
@vfx*/

// sources_elsewhere - pixel mode, 4K-intro/Campbell lineage.
// Three wave sources drift just OFF the panel; each emits expanding
// concentric rings (sin of distance). Only their interference crosses
// the visible area - bright constructive fringes on a dark ground. The
// sources themselves never appear. quality:"half" keeps the smooth,
// low-frequency field well under budget. No inputs.

const meta = { name: "sources_elsewhere", fps: 30, quality: "half" };

const TAU = Math.PI * 2;
const NSRC = 3;

// Bases sit strictly off every edge; the drift radius never brings a
// source onto the panel, so you only ever see the fringes, never a
// ring-center bullseye. (Verified across a full drift cycle offline.)
const baseX = [-8, 72, 40];
const baseY = [34, 18, 76];
const wx = [TAU / 23, TAU / 31, TAU / 29];   // slow, incommensurate drift
const wy = [TAU / 37, TAU / 27, TAU / 41];
const phx = [0.0, 2.1, 4.2];
const phy = [1.0, 3.5, 5.6];
const rw  = [0.95, 1.15, 0.80];              // ring-expansion phase rate (rad/s)
const DR = 7.0;                              // drift radius (px)
const FREQ = 0.5;                            // ring spatial frequency -> period ~12.6px

// Per-frame source state, recomputed once per frame (cache guard below):
// positions/phases depend only on t, not on x/y - the documented hoist.
const sx = new Float64Array(NSRC);
const sy = new Float64Array(NSRC);
const sp = new Float64Array(NSRC);
let __cacheT = -1;

// Near-monochrome cool palette, built once at load (no per-pixel hsv):
// black ground -> deep teal -> pale cyan-white where fringes pile up.
// v*v perceptual curve baked in; index by fringe brightness.
const PAL_N = 256;
const pal = new Int32Array(PAL_N);
for (let i = 0; i < PAL_N; i++) {
  const b = i / (PAL_N - 1);
  pal[i] = hsv(0.54 - 0.06 * b, lerp(0.55, 0.10, b), b * b);
}

function updateFrame(t) {
  for (let s = 0; s < NSRC; s++) {
    sx[s] = baseX[s] + DR * Math.sin(t * wx[s] + phx[s]);
    sy[s] = baseY[s] + DR * Math.sin(t * wy[s] + phy[s]);
    sp[s] = t * rw[s];
  }
}

function pixel(x, y, t) {
  if (t !== __cacheT) { updateFrame(t); __cacheT = t; }

  // Sum the three ring fields at this point.
  let F = 0;
  for (let s = 0; s < NSRC; s++) {
    const dx = x - sx[s], dy = y - sy[s];
    F += Math.sin(Math.sqrt(dx * dx + dy * dy) * FREQ - sp[s]);
  }

  // Constructive interference lights up; destructive stays dark.
  const g = 0.5 + 0.5 * (F / NSRC);         // 0..1, ~0.5 mean
  const B = smoothstep(0.5, 1.0, g);        // only the constructive half glows
  let idx = (B * (PAL_N - 1)) | 0;
  if (idx < 0) idx = 0; else if (idx >= PAL_N) idx = PAL_N - 1;
  return pal[idx];
}
