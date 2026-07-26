/*@vfx
id: c4743581-c157-4a2e-9d30-2b1b82b181a5
title: The Plotter Comes Back
created: 2026-07-26
artist: Saccade (apprentice name)
lineage:
  - id: d2c57303-5cf6-4e2b-99e9-0d587b2e01c2
    relation: variation
    note: >-
      Saccades, After Molnar ended its note with a candidate it never
      built: "a discrete saccade JUMP variant - hold, then leap to a
      re-rolled configuration - closer to the eye movement the title
      names." This is that piece, moved from her Saccades to her
      Interruptions: the marks hold, and change only when something
      passes over them.
  - id: ba92f871-53da-47e9-a7e9-64c5e313510f
    relation: contrast
    note: >-
      Isobars argued that on light a motionless line reads as switched
      off, so it kept every edge permanently trembling - the deviation
      "continuously lived." I now think that solved the problem by
      giving up what the plotter had: a mark that is DECIDED, and then
      stands. Here the strokes rest, dead still, and motion is not a
      condition of the line but an EVENT that arrives - a band of
      re-drawing crossing the plate, each stroke lifted, re-rolled, set
      down hot, and left to cool. Tremor replaced by punctuation.
influences: [vera-molnar]
rationale: |
  A lattice of one hundred and forty-four short strokes, all leaning the
  same way, some missing - Vera Molnar's Interruptions, one plate of it.
  Then something crosses the plate. A band sweeps the field, and every
  stroke it reaches is lifted, re-rolled against the dice, and set down
  again at a new angle or not at all; the fresh mark burns warm and cools
  to cream over a second or two behind the band. The band itself is never
  drawn. You see only where the marks have just changed, and infer the
  pen from the wake of its decisions.

  When the band leaves the far edge the plate is complete and holds for a
  breath - and then the pen comes back, from another edge, with the dice
  set slightly differently. Angle spread and omission rate each take one
  small step per pass and the ruling angle turns a little, so plate
  follows plate as near-variation: her serial parameter sweep, which hung
  side by side on a gallery wall, laid instead across the hour, one plate
  every ten seconds, four hundred of them before the piece is swapped
  out. No two are the same and none is the last.

  This argues with my own Isobars. There I said light keeps no grain, so a
  still line reads as switched off, and I made every edge tremble forever.
  That bought life by surrendering the thing the plotter actually had: a
  decision, made once, that then stands. So here the strokes are still -
  truly still, no hand-tremor at all - and the life comes from the event
  of redrawing instead, plus a slow luminance wave travelling the lattice
  the way her ink would have caught a raking light. Her one percent stays
  where she put it, in the angles; what I have added is not more disorder
  but a moment at which disorder is decided. "It's not me, the genius, who
  has to make the decisions; it's the roll of the dice." You can watch the
  dice being rolled, ten strokes a second, forever.
@vfx*/

// the_plotter_comes_back - buffer mode, Molnar-lineage Interruptions.
// A 12x12 lattice of short strokes sharing one ruling angle (plus her
// one-percent deviation) with stochastic omission: one plate of
// Interruptions. A wavefront sweeps the panel; each stroke it reaches
// CONTRACTS TO A POINT AND RE-EXTENDS at a freshly rolled angle (or
// vanishes), burning warm and cooling to cream behind the front. The
// front is never drawn - only its consequences. At the far edge the pass
// ends, the plate holds briefly, and a new pass begins from a random edge
// with the parameters (angle spread, omission rate, ruling angle) each
// taken one mean-reverting random step: a serial sweep laid across the
// hour, ~400 plates, none repeated (see knowledge/craft/attractors.md -
// this is a renewal process, not a system winding down).
//
// input.clock.daylight biases where the parameter walk is centred (night
// sits near the ordered end, day disturbs the grid - the dossier's own
// suggested pairing). Applied only at pass boundaries, so a swept clock
// can never snap the geometry. At neutral it simply walks mid-range.

const meta = { name: "the_plotter_comes_back", fps: 30, inputs: ["clock"] };

const TAU = Math.PI * 2;

// --- the lattice ------------------------------------------------------------
const COLS = 12, ROWS = 12, CELL = 5.0, ORG = 2.0;   // centres 4.5 .. 59.5
const NC = COLS * ROWS;
const HALF = 2.5;              // half stroke length (~5 px) - reads at 64x64
const JIT = 0.35;              // per-cell position jitter (px): her tremble,
                               // placed once per stroke and then LEFT ALONE

// --- the pass ---------------------------------------------------------------
const SWEEP_V = 7.5;           // px/s -> ~9.5 s to cross, ~10 s per plate
const PAUSE = 0.7;             // s the finished plate is allowed to stand
const JUMP_DUR = 0.18;         // s: pen up, pen down (the stroke re-drawn)
const COOL = 1.7;              // s: a fresh mark cools to resting ink

// --- palette: a hot fresh mark cooling to cream ink, on black ---------------
//const H_HOT = 0.035, S_HOT = 0.62, V_HOT = 1.00;  // original values from Saccade
const H_HOT = 0.005, S_HOT = 0.95, V_HOT = 1.00;    // values modified by patron (Jim) to emphasize red and more closely match intent of the piece
const H_REST = 0.105, S_REST = 0.12, V_REST = 0.82;
// A slow luminance wave travels the lattice (my Saccades lesson: give the
// WHOLE field a breath, not only the deviating region). Shallow on purpose -
// deeper and half the plate visibly vanishes, which costs the composition.
const W_BREATH = TAU / 6.5, BR_MID = 0.80, BR_AMP = 0.20;

// --- cell state (top-level persists for the program's life) -----------------
const ccx = new Float64Array(NC), ccy = new Float64Array(NC);
for (let iy = 0; iy < ROWS; iy++) {
  for (let ix = 0; ix < COLS; ix++) {
    const i = iy * COLS + ix;
    ccx[i] = ORG + ix * CELL + CELL * 0.5;
    ccy[i] = ORG + iy * CELL + CELL * 0.5;
  }
}
const cAng = new Float64Array(NC), oAng = new Float64Array(NC);
const cPres = new Uint8Array(NC), oPres = new Uint8Array(NC);
const jx = new Float64Array(NC), jy = new Float64Array(NC);
const jmp = new Float64Array(NC);      // 1 -> 0 across the re-draw
const hot = new Float64Array(NC);      // fresh-mark glow, cooling
const rolled = new Uint8Array(NC);     // has this pass reached the cell yet

// --- pass state -------------------------------------------------------------
let axis, sgn, front, passActive, pauseT;
let spread, omit, base;
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

// Bilinear (sub-pixel) deposit - Campbell's diffusion, so a 5 px stroke
// reads as a drawn mark rather than a staircase.
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

// Sample at a fixed 0.5 px pitch with a 0.5 weight, so a stroke's peak
// accumulation is its colour independent of how long it currently is.
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

// Lift the pen, roll the dice, set it down again.
function roll(i) {
  oAng[i] = cAng[i]; oPres[i] = cPres[i];
  cAng[i] = base + spread * (Math.random() * 2 - 1);
  cPres[i] = Math.random() < omit ? 0 : 1;
  jx[i] = (Math.random() * 2 - 1) * JIT;
  jy[i] = (Math.random() * 2 - 1) * JIT;
  jmp[i] = 1; hot[i] = 1; rolled[i] = 1;
}

// A new plate: fresh edge, and one mean-reverting step for each parameter.
// Mean-reverting (not a free walk) so the sweep never parks on a bound and
// never stops exploring - minute forty is still finding new plates.
function newPass() {
  axis = Math.random() < 0.5 ? 0 : 1;
  sgn = Math.random() < 0.5 ? 1 : -1;
  const day = clamp(input.clock.daylight, 0, 1);
  const sc = lerp(0.18, 0.55, day);      // night: near the ordered end
  spread = clamp(spread + (sc - spread) * 0.35 + (Math.random() - 0.5) * 0.35, 0.04, 1.0);
  const oc = lerp(0.06, 0.32, day);      // the day opens more gaps
  omit = clamp(omit + (oc - omit) * 0.35 + (Math.random() - 0.5) * 0.10, 0, 0.36);
  base += (Math.random() - 0.5) * 0.8;   // the ruling angle slowly turns
  front = -4; passActive = true;
  for (let i = 0; i < NC; i++) rolled[i] = 0;
}

function setup() {
  spread = 0.25; omit = 0.10; base = Math.PI * 0.25;
  for (let i = 0; i < NC; i++) {
    cAng[i] = base + spread * (Math.random() * 2 - 1);
    oAng[i] = cAng[i];
    cPres[i] = Math.random() < omit ? 0 : 1;
    oPres[i] = cPres[i];
    jx[i] = (Math.random() * 2 - 1) * JIT;
    jy[i] = (Math.random() * 2 - 1) * JIT;
    jmp[i] = 0; hot[i] = 0; rolled[i] = 0;
  }
  // A finished plate is already standing at t=0 and the pen is just
  // entering it - the opening reads as alive from the first second.
  axis = 0; sgn = 1; front = 4.0; passActive = true; pauseT = 0;
  started = true;
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;      // guard a stall from spiking the sweep
  fr.fill(0); fg.fill(0); fb.fill(0);

  // Advance the front; every cell it reaches is re-drawn.
  if (passActive) {
    front += SWEEP_V * dt;
    for (let i = 0; i < NC; i++) {
      if (rolled[i]) continue;
      const coord = axis === 0 ? ccx[i] : ccy[i];
      const f = sgn > 0 ? coord : (HEIGHT - 1 - coord);
      if (f <= front) roll(i);
    }
    if (front > 70) { passActive = false; pauseT = PAUSE; }
  } else {
    pauseT -= dt;
    if (pauseT <= 0) newPass();
  }

  const cool = Math.exp(-dt / COOL);
  const jstep = dt / JUMP_DUR;

  for (let i = 0; i < NC; i++) {
    if (jmp[i] > 0) { jmp[i] -= jstep; if (jmp[i] < 0) jmp[i] = 0; }
    hot[i] *= cool;

    // The re-draw: the old stroke contracts to a point (j: 1 -> 0.5) and the
    // new one extends out of it (0.5 -> 0). Pen up, pen down.
    const j = jmp[i];
    let ang, pres, lenf;
    if (j > 0.5) { ang = oAng[i]; pres = oPres[i]; lenf = (j - 0.5) * 2; }
    else { ang = cAng[i]; pres = cPres[i]; lenf = 1 - j * 2; }
    if (!pres || lenf <= 0.03) continue;

    const h = hot[i];
    const ix = i % COLS, iy = (i / COLS) | 0;
    const breath = BR_MID + BR_AMP * Math.sin(t * W_BREATH + ix * 0.34 + iy * 0.26);
    const vr = V_REST * breath;
    let v = vr + (V_HOT - vr) * h;          // fresh marks burn, then cool
    if (v > 1) v = 1;
    const c = hsv(lerp(H_REST, H_HOT, h), lerp(S_REST, S_HOT, h), v * v);
    const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;

    const L = HALF * lenf;
    const ex = Math.cos(ang) * L, ey = Math.sin(ang) * L;
    const px = ccx[i] + jx[i], py = ccy[i] + jy[i];
    seg(px - ex, py - ey, px + ex, py + ey, cr, cg, cb);
  }

  // Quantize the accumulation surface to the panel (cream ink on black).
  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++, i++) {
      const r = fr[i], g = fg[i], b = fb[i];
      if (r < 1 && g < 1 && b < 1) { setPixel(x, y, 0); continue; }
      setPixel(x, y, rgb(r, g, b));
    }
  }
}
