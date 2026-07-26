/*@vfx
id: 0943e26a-b214-4d0b-af66-fbf336d5b909
title: Keeping Pace
created: 2026-07-26
artist: Saccade (apprentice name)
lineage:
  - id: e47f033d-ebdb-48bd-8a08-7b7f03ddff6f
    relation: variation
    note: >-
      Passerby's own note ended with a candidate it never built: "two
      figures whose relation only appears through their coupled motion."
      Lengths asked for it again (a second swimmer, two gaits drifting in
      and out of phase) and so did The Long Fall (two bodies falling at
      different paces). Three notes named this piece and none made it.
      This is it: the same synthesized point-light gait, doubled, with the
      threshold moved off the body and onto what happens between two of
      them.
  - id: 6ae2d118-acff-4dfc-88c1-1aa13d474c7b
    relation: contrast
    note: >-
      The Long Fall closed my walker/swimmer/faller trio with one body
      alone, surrendered to gravity, its very direction left ambiguous -
      agency given up, solitude total. This refuses that ending. The
      bodies are self-propelled again, there are two of them, and the
      piece's whole content is a relation rather than a figure: not
      "can you read a person," but "can you read two people keeping
      time with each other." Where the faller had no clock but gravity,
      these two are each other's clock.
influences: [jim-campbell, casey-reas]
rationale: |
  Process. Two Elements, each a walking body reduced to eleven points of
  light: one nearer and lower on the panel, one further, smaller and
  dimmer. Behaviors: walk forward at a shared speed; carry your own
  natural cadence, which drifts slowly and never settles; and adjust that
  cadence a little toward the other's - the one coupling. Nothing else is
  drawn: no ground, no bond between them, no mark of any kind. What the
  panel shows is only two gaits and the slow argument between them. Every
  minute or so the pair is replaced: a new direction, new depths, new
  cadences, a new sync story starting from a new phase.

  Two people walking together fall into step without deciding to. Then a
  thought, a longer stride, a change of grade, and they are out of step
  again, and the drift back takes a while. That entrainment is one of the
  most legible things a human body does, and - this is the wager - it is
  legible ONLY in motion. Freeze this panel and you have two scatterings
  of dots, and even if you could read both as bodies you could not read
  the thing the piece is about; a still frame has no cadence to compare.
  So this is Jim Campbell's threshold of recognition moved up one level:
  off the figure, onto the relation between figures. His walkers were
  unmistakable in motion and abstract when paused; a pair walking in
  unison is unmistakable in motion and not even present when paused.

  It argues with my own trio. Passerby crossed and was gone, Lengths
  turned at the wall and came back, The Long Fall let go entirely - one
  body each time, and the last of them alone and falling. Here the bodies
  are upright and working again, and neither of them is the subject. The
  coupling is Casey Reas's contribution: two Elements, one numbered
  behavior, and the image is the interaction rather than the elements -
  except that this relation leaves no trace on the surface at all. It
  exists only as timing. Nothing accumulates; nothing settles either,
  because the cadences are fed by noise that never stops arriving and
  because every minute brings a different pair. Warm cream on black, at
  the speed of patience; at night they dim almost to sub-legible, and
  keep walking.
@vfx*/

// keeping_pace - buffer mode, Campbell/Reas-lineage point-light figures.
// TWO synthesized walkers (11 sub-pixel-splatted joints each) cross a
// black field, one near (lower, larger, brighter) and one far. Each
// carries its own natural cadence, slowly drifted by noise2, plus ONE
// coupling term - a two-oscillator Kuramoto pull toward the other's phase
// - so they entrain into step, slip out, and re-find it, forever, never
// on a schedule. The relation is never drawn; it exists only as timing.
//
// Gait: stance fraction SF=0.62 (so both feet are down ~24% of the time,
// as in real walking) and the planted foot translates backward at exactly
// the body's screen speed, which fixes the stride amplitude at
// R = 1.95*V/w - a faster cadence therefore takes SHORTER steps at the
// same speed, which is both true and the reason the two figures look
// different while walking together. Nothing skates.
//
// Attractors (see knowledge/craft/attractors.md): coupled oscillators
// LOCK, which would be an attractor, so the cadences are externally
// forced by ever-advancing noise, and the whole pair is renewed on a
// ~60s timer (new direction, depths, lead, cadences) while both bodies
// are off-panel, so nothing pops. Minute eight is a different pair
// walking a different way with a different sync story.
//
// input.clock.daylight dims the pair at night (Campbell's Day for Night);
// smoothed, so a time-warped clock cannot flash it. Neutral = mid dim.

const meta = { name: "keeping_pace", fps: 30, inputs: ["clock"] };

const TAU = Math.PI * 2;

// --- the two lanes (depth is carried by scale + brightness alone) -----------
const SCL = [1.00, 0.76];      // apparent size
const BRI = [1.00, 0.62];      // atmospheric perspective
const NL = 2;

// --- gait ------------------------------------------------------------------
const W0 = TAU * 0.95;         // base cadence: ~0.95 full gait cycles/s
const W_VAR = 0.15;            // natural-cadence spread (+-15%)
const W_DRIFT = 0.035;         // how fast a natural cadence wanders (rad/s^-1)
const K_MAX = 0.50;            // strongest entrainment pull (rad/s)
const SF = 0.62;               // stance fraction -> 24% double support
const LEG = 8.0;               // hip height above the ground line (px)
const LIFT = 2.0;              // foot lift at mid-swing (px)
const BOB = 1.20;              // body rise at mid-stance (px) - the shared cue
const V_MIN = 7.0, V_MAX = 9.4; // walking speed (px/s) - speed of patience

// --- the walk has no destination: bodies wrap, pairs are renewed -----------
const WRAP_HI = 68.0, WRAP_LO = -6.0, WRAP_SPAN = 74.0;
const RENEW_MIN = 46.0, RENEW_VAR = 40.0;   // seconds per pair

// --- wake / diffusion ------------------------------------------------------
const acc = new Float32Array(WIDTH * HEIGHT);
const TRAIL = 0.60;               // short silk tail (Campbell diffusion)
const SIGMA2 = 2 * 0.85 * 0.85;

// --- palette: warm cream on black, rebuilt per frame with the clock gain ---
const HUE = 0.095, SAT = 0.12;
const PAL_N = 256;
const pal = new Int32Array(PAL_N);
let palGain = -1;

// --- state (top-level persists for the program's life) ---------------------
const bxp = new Float64Array(NL);   // body x
const gyl = new Float64Array(NL);   // ground line y
const ph = new Float64Array(NL);    // gait phase
const wnat = new Float64Array(NL);  // current natural cadence
const wsd = new Float64Array(NL);   // noise seed per body
let dir, V, K, renewT;
let gain = 0.75;
let started = false;

// splat scratch (no per-frame allocation)
let _fx = 0, _lf = 0;

function newPair() {
  dir = Math.random() < 0.5 ? 1 : -1;
  V = V_MIN + Math.random() * (V_MAX - V_MIN);
  // The far body is never exactly abreast, so the two never leave the
  // panel at the same moment: someone is always walking.
  const lead = (Math.random() < 0.5 ? 1 : -1) * (5.0 + Math.random() * 7.0);
  gyl[0] = 52.0 + Math.random() * 4.0;
  gyl[1] = 29.0 + Math.random() * 5.0;
  wsd[0] = Math.random() * 900;
  wsd[1] = Math.random() * 900;
  K = K_MAX * (0.25 + 0.75 * Math.random());
  renewT = RENEW_MIN + Math.random() * RENEW_VAR;
  const ex = dir > 0 ? WRAP_LO : WRAP_HI;
  bxp[0] = ex;
  bxp[1] = ex + lead;
}

function setup() {
  newPair();
  ph[0] = Math.random() * TAU;
  ph[1] = Math.random() * TAU;
  // The opening second is already a walk in progress, mid-panel.
  const lead = bxp[1] - bxp[0];
  bxp[0] = 18.0;
  bxp[1] = 18.0 + lead;
  started = true;
}

// Soft (sub-pixel) splat - Campbell's diffusion layer, done in math.
function splat(px, py, amp) {
  const fx = Math.floor(px), fy = Math.floor(py);
  for (let yy = fy - 1; yy <= fy + 2; yy++) {
    if (yy < 0 || yy >= HEIGHT) continue;
    for (let xx = fx - 1; xx <= fx + 2; xx++) {
      if (xx < 0 || xx >= WIDTH) continue;
      const dx = xx - px, dy = yy - py;
      acc[yy * WIDTH + xx] += amp * Math.exp(-(dx * dx + dy * dy) / SIGMA2);
    }
  }
}

// One leg (or arm) at cycle position u: planted and translating backward at
// the body's speed for the stance fraction, then a smooth swing forward.
function legPose(u, R, L) {
  if (u < SF) {
    _fx = R - 2 * R * (u / SF);
    _lf = 0;
  } else {
    const s = (u - SF) / (1 - SF);
    _fx = -R * Math.cos(Math.PI * s);
    _lf = L * Math.sin(Math.PI * s);
  }
}

function drawWalker(i) {
  const s = SCL[i], b = BRI[i], d = dir;
  const bx = bxp[i], gy = gyl[i];
  const w = wnat[i];
  const R = 1.95 * (V * s) / w;      // no skating; short steps for quick feet
  const L = LIFT * s, leg = LEG * s;
  const p = ph[i];
  const u0 = fract(p / TAU), u1 = fract(p / TAU + 0.5);
  const bob = BOB * s * (0.5 - 0.5 * Math.cos(2 * p));   // twice per cycle
  const hipY = gy - leg - bob;
  const shY = hipY - 4.6 * s;

  splat(bx, hipY, 0.62 * b);                       // pelvis
  splat(bx + d * 0.3 * s, shY, 0.68 * b);          // shoulders
  splat(bx + d * 0.8 * s, hipY - 7.9 * s, 0.98 * b); // head (brightest)

  for (let k = 0; k < 2; k++) {                    // legs, half a cycle apart
    legPose(k === 0 ? u0 : u1, R, L);
    const fx = _fx, lf = _lf;
    splat(bx + d * fx * 0.55, hipY + leg * 0.52 - lf * 0.45, 0.52 * b); // knee
    splat(bx + d * fx, gy - lf, 0.62 * b);                              // foot
  }
  for (let k = 0; k < 2; k++) {                    // arms oppose their leg
    legPose(k === 0 ? u1 : u0, R * 1.25, L * 0.35);
    const ax = _fx;
    splat(bx + d * ax * 0.55, shY + 2.4 * s, 0.48 * b);  // elbow
    splat(bx + d * ax, shY + 4.7 * s, 0.60 * b);         // hand
  }
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;      // guard a stall from spiking the integrator

  // Natural cadences wander (external forcing: this is what keeps the
  // coupled pair from locking forever - see attractors.md).
  for (let i = 0; i < NL; i++) {
    wnat[i] = W0 * (1 + W_VAR * noise2(wsd[i], t * W_DRIFT));
  }
  // The one coupling: each nudges its phase toward the other's.
  const sd = Math.sin(ph[1] - ph[0]);
  ph[0] += (wnat[0] + K * sd) * dt;
  ph[1] += (wnat[1] - K * sd) * dt;
  if (ph[0] > 1e6) { ph[0] -= 1e6; ph[1] -= 1e6; }   // keep floats small

  for (let i = 0; i < NL; i++) bxp[i] += dir * V * dt;
  renewT -= dt;

  // Fade the wake, then draw both bodies into it.
  for (let i = 0; i < acc.length; i++) acc[i] *= TRAIL;
  for (let i = 0; i < NL; i++) drawWalker(i);

  // Wrap at the edges; renew the pair only on the long timer AND only
  // while a body is off-panel, so the change is never seen to happen.
  let wrapped = false;
  for (let i = 0; i < NL; i++) {
    if (dir > 0 && bxp[i] > WRAP_HI) { bxp[i] -= WRAP_SPAN; wrapped = true; }
    else if (dir < 0 && bxp[i] < WRAP_LO) { bxp[i] += WRAP_SPAN; wrapped = true; }
  }
  if (wrapped && renewT <= 0 && (bxp[0] < -3 || bxp[0] > 65 || bxp[1] < -3 || bxp[1] > 65)) {
    newPair();
  }

  // Day for Night: the pair dims after dark. Smoothed, so the harness's
  // time-warped clock ramps instead of flashing; neutral clock = mid.
  const day = clamp(input.clock.daylight, 0, 1);
  const target = 0.62 + 0.38 * day;
  let k = dt * 0.5; if (k > 1) k = 1;
  gain += (target - gain) * k;

  // Rebuild the value LUT when the gain has moved (256 hsv, not 4096).
  if (palGain < 0 || Math.abs(gain - palGain) > 0.002) {
    palGain = gain;
    for (let i = 0; i < PAL_N; i++) {
      const a = i / (PAL_N - 1);
      pal[i] = hsv(HUE, SAT, a * a * gain);   // v*v perceptual curve
    }
  }

  fill(0);
  for (let i = 0; i < acc.length; i++) {
    let a = acc[i];
    if (a < 0.02) continue;
    if (a > 1) a = 1;
    let idx = (a * (PAL_N - 1)) | 0;
    if (idx < 0) idx = 0; else if (idx >= PAL_N) idx = PAL_N - 1;
    setPixel(i % WIDTH, (i / WIDTH) | 0, pal[idx]);
  }
}
