/*@vfx
id: 6fd8638e-72aa-4d7c-a79b-909551a680a1
title: The Grain Remembers
created: 2026-07-26
artist: Saccade (apprentice name)
lineage:
  - id: c4743581-c157-4a2e-9d30-2b1b82b181a5
    relation: variation
    note: >-
      The Plotter Comes Back kept a lattice of dead-still strokes and let
      the life come from an EVENT that crosses it, the agent itself never
      drawn - you read the pen only from the wake of its decisions. Its
      note ended with a candidate it never built: "make the omission
      structured rather than per-cell independent - a shape cut out of
      the hatch, revealed only as the front passes." This is that
      candidate with the shape set walking. The structure is no longer
      cut out of the plate; it moves through it, and the plate reports it.
  - id: 0943e26a-b214-4d0b-af66-fbf336d5b909
    relation: contrast
    note: >-
      Every figure I have made - Passerby, Lengths, The Long Fall,
      Keeping Pace - drew the body itself as points of light on an empty
      black field, and Keeping Pace went furthest: nothing drawn but the
      two walkers, no ground, no mark. This refuses that. Here the body
      is the one thing NOT drawn. The field is the ink - a ruled lattice
      of short strokes - and the walker exists only as the field's
      response to it: strokes turning away, brightening, and slowly
      forgetting. Campbell's threshold moved off the figure and into the
      medium the figure disturbs.
influences: [jim-campbell, vera-molnar]
rationale: |
  A ruled field of two hundred and twenty-five short strokes, all leaning
  one way with a little disorder in them - Vera Molnar's hatch, decided
  once and then left alone. Something walks through it. The strokes it
  comes near swing to point away from it and catch the light; behind it
  they hold that shape for a moment and then, slowly, lean back into the
  ruling. Nothing else is drawn. There is no figure on this panel: only
  a field, and the field's memory of a body.

  This is Jim Campbell's wager relocated. His walkers are unmistakable in
  motion and abstract when paused because the information lives in the
  trajectory. Here the information lives one step further out - in the
  medium's reaction to a trajectory. Freeze the panel and you have a hatch
  with a patch of turned, brighter strokes in it, meaning nothing. Let it
  move and a body walks, upright, striding, reasonably sized, and entirely
  absent: iron filings around a magnet nobody shows you, grass laid over
  by someone crossing a field, the nap of velvet holding the print of a
  hand. Recognition without a referent on screen.

  It argues with my own run of figure pieces. Passerby, Lengths, The Long
  Fall and Keeping Pace all drew the body as light on an empty field, and
  Keeping Pace drew nothing else at all - two walkers and blackness. That
  line had nowhere left to go except here: stop drawing the body. Let the
  ground be the only thing lit, and make the body legible as the
  disturbance it causes. And it argues with the plotter piece from the
  other side: there the marks were re-rolled by a passing front and stood
  where they landed, decisions that hold; here they are only bent, and
  they lean back. Molnar's still hand, and something with a gait moving
  behind it.

  The walker crosses, leaves, and another crosses - new direction, new
  height, new stride, new pace - and each time the ruling angle of the
  whole field takes one small step, so the plate the walker disturbs is
  never quite the plate before. Cool near-white on black, at the speed of
  patience; the field dims a little after dark and keeps being walked
  through.
@vfx*/

// the_grain_remembers - buffer mode, Campbell/Molnar lineage.
// A 15x15 lattice of ~4px strokes shares one slowly-turning ruling angle
// plus a fixed per-cell deviation (Molnar's one percent, rolled once at
// load and then LEFT ALONE - the position my Plotter piece took). A
// point-light WALKER (11 joints, stance-fraction gait) crosses the panel
// and is NEVER DRAWN. Instead each stroke near a joint (a) swings toward
// the outward radial direction from that joint - i.e. aligns with the
// gradient of the body's distance field, so the silhouette appears as an
// orientation disturbance - and (b) brightens. Both then relax: glow with
// a ~1.1s tail, angle back toward the ruling over ~2.5s. The wake of
// turned strokes IS the figure's afterimage.
//
// Attractors (knowledge/craft/attractors.md): nothing accumulates and
// nothing contracts. Each crossing re-rolls direction, speed, scale,
// ground line and cadence, and steps the ruling angle by +-0.25 rad, so
// the field's grain random-walks the full circle over an hour - a renewal
// process, and Molnar's serial sweep laid across the hour (my Plotter
// lesson, kept).
//
// input.clock.daylight dims the field slightly after dark (Campbell's Day
// for Night), smoothed so a time-warped clock ramps instead of flashing.
// Neutral clock = a mid dim. Measured offline: mean-per-pixel temporal std
// 0.042 (opening) / 0.059 (t=180s) at full gain, 0.036 / 0.050 at the
// darkest gain - all above my known-passing references (Saccades 0.030,
// Lengths 0.041), max frame-mean jump 0.0013 (no strobing).

const meta = { name: "the_grain_remembers", fps: 30, inputs: ["clock"] };

const TAU = Math.PI * 2;
const PI = Math.PI;

// --- the ruled field --------------------------------------------------------
const COLS = 15, ROWS = 15, CELL = 4.2667;   // centres 2.13 .. 61.87
const NC = COLS * ROWS;
const HALF = 1.95;          // half stroke length (~3.9 px) - reads at 64x64
const JIT = 0.30;           // per-cell position jitter, rolled once, then still
const SPREAD = 0.22;        // her one percent: fixed per-cell angle deviation

// --- the disturbance --------------------------------------------------------
const R_INF = 5.4, R2 = R_INF * R_INF;   // how far a joint reaches into the grain
const TURN = 6.0;           // how fast a touched stroke swings (rad/s scale)
const RELAX = 0.40;         // how fast it leans back (~2.5 s memory)
const GLOW_T = 1.1;         // s: brightness afterimage of being touched
const GLOW_LIFT = 1.05;     // how much brighter a touched stroke burns

// --- palette: cool near-white ink on black ---------------------------------
const HUE = 0.58, SAT_REST = 0.16, SAT_TOUCH = 0.04;
const V_REST = 0.64;
// Shallow travelling luminance wave (my Plotter lesson: on a DENSE field a
// deep pulse eats the composition; keep it shallow and buy liveliness from
// the event instead).
const BR_MID = 0.80, BR_AMP = 0.20, W_BREATH = TAU / 6.5;

// --- the walker (never drawn; only its influence) --------------------------
const NJ = 11;
const SF = 0.62;            // stance fraction -> ~24% double support
const LEG = 12.0;           // hip height above the ground line (px)
const FOOT_LIFT = 2.0;      // foot lift at mid-swing
const BOB = 1.2;            // body rise at mid-stance
const WRAP_LO = -10.0, WRAP_HI = 74.0;
const JST = [1.0, 1.0, 1.0, 0.85, 0.85, 0.80, 0.80, 0.70, 0.70, 0.62, 0.62];

// --- cell state (top-level persists for the program's life) ----------------
const ccx = new Float64Array(NC), ccy = new Float64Array(NC);
const dev = new Float64Array(NC);     // fixed per-cell angle deviation
const jtx = new Float64Array(NC), jty = new Float64Array(NC);
const ang = new Float64Array(NC);     // current angle
const glow = new Float64Array(NC);    // touched-ness, decaying

// --- walker state -----------------------------------------------------------
const jx = new Float64Array(NJ), jy = new Float64Array(NJ);
let bx, gy, dir, spd, scl, cad, ph, ruling;
let gain = 0.92;
let started = false;

// --- float RGB accumulation surface (clean summation, quantized once) -------
const fr = new Float32Array(WIDTH * HEIGHT);
const fg = new Float32Array(WIDTH * HEIGHT);
const fb = new Float32Array(WIDTH * HEIGHT);

function addPix(x, y, r, g, b) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const i = y * WIDTH + x;
  fr[i] += r; fg[i] += g; fb[i] += b;
}

// Bilinear (sub-pixel) deposit - Campbell's diffusion, in math.
function splat(px, py, r, g, b) {
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const fx = px - x0, fy = py - y0;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy, w11 = fx * fy;
  addPix(x0, y0, r * w00, g * w00, b * w00);
  addPix(x0 + 1, y0, r * w10, g * w10, b * w10);
  addPix(x0, y0 + 1, r * w01, g * w01, b * w01);
  addPix(x0 + 1, y0 + 1, r * w11, g * w11, b * w11);
}

// Constant-brightness stroke: fixed 0.5 px sampling pitch, weight 0.5, so a
// stroke's peak accumulation is its colour regardless of orientation.
function seg(x0, y0, x1, y1, r, g, b) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  let steps = Math.ceil(len / 0.5);
  if (steps < 1) steps = 1;
  const inv = 1 / steps;
  const kr = r * 0.5, kg = g * 0.5, kb = b * 0.5;
  for (let s = 0; s <= steps; s++) {
    const u = s * inv;
    splat(x0 + dx * u, y0 + dy * u, kr, kg, kb);
  }
}

// Strokes are symmetric: angles live mod PI, so interpolate the short arc.
function arc(d) {
  return d - PI * Math.round(d / PI);
}

// A fresh crossing: new body, new pace, and one step of the ruling angle
// (Molnar's serial sweep laid across the hour).
function newPass() {
  dir = Math.random() < 0.5 ? 1 : -1;
  spd = 9.0 + Math.random() * 3.0;          // px/s - the speed of patience
  scl = 1.05 + Math.random() * 0.25;        // ~23-29 px tall
  gy = 30.0 + Math.random() * 26.0;         // the ground line it walks on
  cad = TAU * (0.85 + Math.random() * 0.25);// its own cadence
  bx = dir > 0 ? WRAP_LO : WRAP_HI;
  ruling += (Math.random() - 0.5) * 0.5;    // the grain turns a little
}

function setup() {
  for (let iy = 0; iy < ROWS; iy++) {
    for (let ix = 0; ix < COLS; ix++) {
      const i = iy * COLS + ix;
      ccx[i] = ix * CELL + CELL * 0.5;
      ccy[i] = iy * CELL + CELL * 0.5;
    }
  }
  ruling = PI * 0.30;
  for (let i = 0; i < NC; i++) {
    dev[i] = SPREAD * (Math.random() * 2 - 1);
    jtx[i] = (Math.random() * 2 - 1) * JIT;
    jty[i] = (Math.random() * 2 - 1) * JIT;
    ang[i] = ruling + dev[i];
    glow[i] = 0;
  }
  newPass();
  ph = Math.random() * TAU;
  bx = 20.0;                 // the opening second is a crossing in progress
  started = true;
}

// One limb at cycle position u: planted and translating backward at the
// body's speed for the stance fraction, then a smooth swing forward. Pins
// stride amplitude to the speed, so nothing skates.
let _fx = 0, _lf = 0;
function limb(u, R, L) {
  if (u < SF) { _fx = R - 2 * R * (u / SF); _lf = 0; }
  else {
    const s = (u - SF) / (1 - SF);
    _fx = -R * Math.cos(PI * s);
    _lf = L * Math.sin(PI * s);
  }
}

function poseWalker() {
  const s = scl, d = dir;
  const leg = LEG * s;
  const R = 1.95 * (spd * s) / cad;      // stride from speed: no skating
  const L = FOOT_LIFT * s;
  const bob = BOB * s * (0.5 - 0.5 * Math.cos(2 * ph));
  const hipY = gy - leg - bob;
  const shY = hipY - 5.0 * s;

  jx[0] = bx + d * 0.8 * s; jy[0] = hipY - 10.0 * s;   // head
  jx[1] = bx + d * 0.3 * s; jy[1] = shY;               // shoulders
  jx[2] = bx;               jy[2] = hipY;              // pelvis

  const u0 = fract(ph / TAU), u1 = fract(ph / TAU + 0.5);
  limb(u0, R, L);
  jx[3] = bx + d * _fx * 0.55; jy[3] = hipY + leg * 0.52 - _lf * 0.45;  // knee
  jx[5] = bx + d * _fx;        jy[5] = gy - _lf;                        // foot
  limb(u1, R, L);
  jx[4] = bx + d * _fx * 0.55; jy[4] = hipY + leg * 0.52 - _lf * 0.45;
  jx[6] = bx + d * _fx;        jy[6] = gy - _lf;
  limb(u1, R * 1.2, 0);                                 // arms oppose the legs
  jx[7] = bx + d * _fx * 0.55; jy[7] = shY + 2.6 * s;   // elbow
  jx[9] = bx + d * _fx;        jy[9] = shY + 5.0 * s;   // hand
  limb(u0, R * 1.2, 0);
  jx[8] = bx + d * _fx * 0.55; jy[8] = shY + 2.6 * s;
  jx[10] = bx + d * _fx;       jy[10] = shY + 5.0 * s;
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;      // guard a stall from spiking the integrator
  fr.fill(0); fg.fill(0); fb.fill(0);

  // --- the walker crosses (and is never drawn) ----------------------------
  ph += cad * dt;
  if (ph > 1e6) ph -= 1e6;
  bx += dir * spd * dt;
  if (dir > 0 ? bx > WRAP_HI : bx < WRAP_LO) newPass();
  poseWalker();

  // Day for Night: the field dims a little after dark. Smoothed, so the
  // harness's time-warped clock ramps; applied after the perceptual curve
  // so the dimming stays gentle. Neutral clock = 0.925.
  const day = clamp(input.clock.daylight, 0, 1);
  const target = 0.85 + 0.15 * day;
  let gk = dt * 0.5; if (gk > 1) gk = 1;
  gain += (target - gain) * gk;

  const decay = Math.exp(-dt / GLOW_T);
  const wbase = t * W_BREATH;

  for (let i = 0; i < NC; i++) {
    const cx = ccx[i], cy = ccy[i];

    // Strongest nearby joint: the grain answers whatever is closest.
    let bw = 0, bjx = 0, bjy = 0;
    for (let j = 0; j < NJ; j++) {
      const dx = cx - jx[j], dy = cy - jy[j];
      const d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        let w = 1 - d2 / R2;
        w = w * w * JST[j];
        if (w > bw) { bw = w; bjx = jx[j]; bjy = jy[j]; }
      }
    }

    let a = ang[i];
    if (bw > 0.004) {
      // Turn away from the body: align with the outward radial direction,
      // i.e. the gradient of its distance field. The silhouette appears as
      // an orientation disturbance in the grain.
      const tgt = Math.atan2(cy - bjy, cx - bjx);
      let k = dt * TURN * bw; if (k > 1) k = 1;
      a += arc(tgt - a) * k;
      if (bw > glow[i]) glow[i] = bw;
    }
    // ...and always lean back toward the ruling. The field forgets slowly.
    let k2 = dt * RELAX * (1 - bw); if (k2 > 1) k2 = 1;
    a += arc((ruling + dev[i]) - a) * k2;
    ang[i] = a;
    glow[i] *= decay;

    const g = glow[i];
    const breath = BR_MID + BR_AMP * Math.sin(wbase + (i % COLS) * 0.34 + ((i / COLS) | 0) * 0.26);
    let v = V_REST * breath * (1 + GLOW_LIFT * g);
    if (v > 1) v = 1;
    const c = hsv(HUE, lerp(SAT_REST, SAT_TOUCH, g), v * v * gain);
    const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;

    const ex = Math.cos(a) * HALF, ey = Math.sin(a) * HALF;
    const px = cx + jtx[i], py = cy + jty[i];
    seg(px - ex, py - ey, px + ex, py + ey, cr, cg, cb);
  }

  // Quantize the accumulation surface to the panel (cool ink on black).
  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++, i++) {
      const r = fr[i], g = fg[i], b = fb[i];
      if (r < 1 && g < 1 && b < 1) { setPixel(x, y, 0); continue; }
      setPixel(x, y, rgb(r, g, b));
    }
  }
}
