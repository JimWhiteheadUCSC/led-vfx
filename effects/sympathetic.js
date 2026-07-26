/*@vfx
id: dd1dc609-6233-40fb-9f60-c166ad38dac6
title: Sympathetic
created: 2026-07-21
artist: Saccade (apprentice name)
lineage:
  - id: 0f80b326-698d-45a5-8108-80d66f9f39dc
    relation: contrast
    note: >-
      The Sources Are Elsewhere ended "interference wants no conductor":
      a standing-wave field kept autonomous, its sources drifting unseen
      just off-panel - sound's geometry WITHOUT the sound. This takes the
      opposite position in the same medium. The source is no longer
      elsewhere; it is the plate itself, here, and its conductor is the
      room. A Chladni plate resonates in sympathy with whatever the
      microphone hears - sound's geometry WITH the sound. Where Sources
      showed the bright blobs of constructive meeting, this shows the dark
      nodal lines where the sand goes still; where Sources refused a baton,
      this hands it to the room's own voice.
influences: [4k-intro, jim-campbell]
rationale: |
  Bow a violin near a metal plate strewn with sand and the sand flees the
  antinodes and gathers on the nodal lines, drawing the exact geometry of
  the note - Chladni figures, cymatics, the shape of a sound. This panel is
  that plate. One idea, developed only: a single resonating square, its
  standing-wave field rendered as the bright lines where the sand collects,
  morphing as the plate's resonant mode climbs and falls.

  Jim Campbell says a low-resolution moving image is analogous to sound -
  "the more a sound is slowed down, the more abstract it becomes." I take
  him at his word and run it backward: here the sound IS the low-resolution
  moving image. The plate listens. In a quiet room it settles toward its
  lowest modes and breathes slowly - a few broad lines, warm sand on black,
  never quite still because no room is ever truly silent. Let a voice or
  music rise and it is excited into higher modes: more lines, finer figures,
  the field brighter, and each beat lands as a struck-plate glow. Reactivity
  as the plate physically answering the air, not a meter twitching.

  The living move is Molnar's, borrowed across the roster: animate the
  parameter, not the element. A real Chladni figure is frozen - fix the
  frequency and the sand holds. So I never fix it; the resonant mode-number
  breathes continuously (two incommensurate sweeps, guaranteed never equal,
  or the field would collapse to black), and a static physics becomes a slow
  unrepeating morph - cymatics that never settles. This answers the 4K
  form's oldest tension for a silent panel from the side opposite Sources:
  not the visual standing in for absent music, but the room's real sound
  made into the only thing on the wall.
@vfx*/

// sympathetic - pixel mode, 4K-intro/Campbell lineage. Cymatics.
// A Chladni plate: the standing-wave field of a resonating square,
// f(u,v) = cos(a*pi*u)cos(a*pi*v) - cos(b*pi*u)cos(b*pi*v), rendered as
// the bright NODAL LINES (|f| ~ 0) where sand collects. The resonant
// mode-numbers a,b breathe continuously so the figure never settles;
// input.audio excites higher modes + brightness, and each beat is a
// struck-plate glow. Silence -> low modes, slow breath (still alive).
//
// Craft: a=b would zero the whole field (black frame) - b is defined as
// a - delta with delta>0, so they are guaranteed distinct. The two
// documented pixel-mode hoists carry the cost: (1) per-axis cos caches,
// so the outer-product field is 4 reads + 2 mults + a subtract per pixel,
// no trig in the hot loop; (2) a 256-entry colour LUT indexed by |f|, so
// zero per-pixel hsv(). The line VALUE profile is EDGE-independent, so
// only the index scale changes per frame and the LUT rebuild is trivial.

const meta = { name: "sympathetic", fps: 30, inputs: ["audio"] };

const PI = Math.PI;

// --- resonance parameters ---------------------------------------------------
const A_BASE = 4.4, A_SWEEP = 1.5, WA = 2 * PI / 20;   // primary mode, ~20s breath
const D_BASE = 1.5, D_SWEEP = 0.7, WD = 2 * PI / 31;   // mode gap (keeps b<a)
const A_DRIVE = 2.4;      // how far sound pushes modes up
const RESPONSE = 4.0;     // mode smoothing toward target (1/s) - no snapping
const W_BREATH = 2 * PI / 17;   // slow global luminance breath
const LW_PX = 1.4;        // nodal-line half-width scale (px)

// --- palette: warm sand on black -------------------------------------------
const HUE = 0.10, SAT0 = 0.22;

const N = 256;
// Fixed line-value profile: 1 at the node, soft shoulder to 0 (Campbell
// diffusion). Independent of the per-frame line width, so it is built once.
const vprof = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const u = i / (N - 1);
  const ss = u * u * (3 - 2 * u);   // smoothstep(0,1,u)
  vprof[i] = 1 - ss;
}

// Per-frame colour LUT + per-axis cosine caches (rebuilt each frame).
const pal = new Int32Array(N);
const cau = new Float64Array(WIDTH);
const cbu = new Float64Array(WIDTH);
const cav = new Float64Array(HEIGHT);
const cbv = new Float64Array(HEIGHT);

// Smoothed state (top-level persists for the program's life).
let a = A_BASE, b = A_BASE - D_BASE;
let strike = 0;          // decaying struck-plate glow
let lastT = -1;
let IDX_SCALE = 1;
let __cacheT = -1;

function updateFrame(t) {
  let dt = (lastT < 0) ? (1 / 30) : (t - lastT);
  if (dt < 0) dt = 1 / 30; else if (dt > 0.1) dt = 0.1;
  lastT = t;

  // The room is the conductor. Absent a mic, everything reads 0 -> the
  // plate simply breathes its low modes (graceful degradation).
  const au = input.audio;
  const on = au.ok;
  const level = on ? au.level : 0;
  const treble = on ? au.treble : 0;
  const bass = on ? au.bass : 0;
  if (on && au.beat) strike = 1;
  strike *= Math.exp(-dt / 0.22);

  // Louder / brighter sound -> higher resonant modes (more nodal lines);
  // bass skews the mode gap so the figure's asymmetry answers the low end.
  const aTarget = A_BASE + A_SWEEP * Math.sin(t * WA) + A_DRIVE * (level + 0.4 * treble);
  const dTarget = D_BASE + D_SWEEP * Math.sin(t * WD) + 0.6 * bass;
  const bTarget = aTarget - dTarget;

  // Glide toward the target so sound never snaps the geometry (no strobing).
  const k = dt * RESPONSE < 1 ? dt * RESPONSE : 1;
  a += (aTarget - a) * k;
  b += (bTarget - b) * k;
  if (a < 1.2) a = 1.2; else if (a > 8.5) a = 8.5;
  if (b > a - 0.6) b = a - 0.6;   // guarantee a != b: field never collapses
  if (b < 0.6) b = 0.6;

  // Per-axis cosine caches (the hoist: each term depends on one axis only).
  const iw = PI / (WIDTH - 1), ih = PI / (HEIGHT - 1);
  for (let x = 0; x < WIDTH; x++) {
    const ua = a * x * iw, ub = b * x * iw;
    cau[x] = Math.cos(ua); cbu[x] = Math.cos(ub);
  }
  for (let y = 0; y < HEIGHT; y++) {
    const va = a * y * ih, vb = b * y * ih;
    cav[y] = Math.cos(va); cbv[y] = Math.cos(vb);
  }

  // Line width -> field-space EDGE; steeper (higher-mode) fields give thinner
  // lines for a fixed EDGE, so scaling EDGE by the mean mode keeps the sand
  // lines a roughly constant pixel width as the plate climbs.
  const m = 0.5 * (a + b);
  let EDGE = LW_PX * m * PI / (WIDTH - 1);
  if (EDGE < 1e-4) EDGE = 1e-4;
  IDX_SCALE = (N - 1) / EDGE;

  // Global brightness: calm breath + a little audio energy + the strike.
  const breath = 0.5 + 0.5 * Math.sin(t * W_BREATH);
  const GB = 0.80 + 0.14 * breath + 0.30 * level + 0.25 * strike;
  let sat = SAT0 - 0.10 * level;   // louder -> a touch whiter (sand jumping)
  if (sat < 0) sat = 0;

  // Rebuild the colour LUT (256 hsv/frame). v*v perceptual curve baked in.
  for (let i = 0; i < N; i++) {
    let v = GB * vprof[i];
    if (v > 1) v = 1;
    pal[i] = hsv(HUE, sat, v * v);
  }
}

function pixel(x, y, t) {
  if (t !== __cacheT) { updateFrame(t); __cacheT = t; }
  // Standing-wave field via cached per-axis cosines; bright where |f| ~ 0.
  let f = cau[x] * cav[y] - cbu[x] * cbv[y];
  if (f < 0) f = -f;
  let idx = (f * IDX_SCALE) | 0;
  if (idx >= N) idx = N - 1;
  return pal[idx];
}