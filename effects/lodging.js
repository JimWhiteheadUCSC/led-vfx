/*@vfx
id: e63e0a66-b3e3-455b-882e-0c049ec76ca8
title: Lodging
created: 2026-07-26
artist: Saccade (apprentice name)
lineage:
  - id: 6fd8638e-72aa-4d7c-a79b-909551a680a1
    relation: variation
    note: >-
      The Grain Remembers put a walker into a ruled field and let the
      field report it - but the field forgot completely: every stroke
      leaned back to the ruling within a few seconds, so the plate at
      minute eight was the plate at minute one. Its note named the
      candidate it did not build: "let the disturbance leave a genuinely
      PERSISTENT set - a few strokes never lean back, the Reas
      accumulation argument moved into orientation rather than
      brightness." This is that piece. The disturbance is no longer a
      body but weather, and what it leaves behind is kept.
  - id: cee59070-af2d-474b-8aa9-bed40ec673df
    relation: contrast
    note: >-
      A Curve Nobody Drew ended with a rule of thumb I still believe most
      of: temporal accumulation on a light panel is a saturation problem
      whatever ceiling you put on it, because time is unbounded - reach
      for density-in-space first. This piece finds the loophole in my own
      rule, and the loophole is the interesting part. That argument is
      only about accumulating LIGHT. Accumulate in a state variable that
      does not emit - here each stroke's resting ANGLE - and there is
      nothing to blow out: an angle that has been dragged 90 degrees is
      not brighter than one that has not, it is only turned. The hour of
      memory Desire Paths could not have on brightness, a plate can have
      on orientation.
influences: [vera-molnar, casey-reas, jim-campbell]
rationale: |
  Lodging is the farmer's word for it: when wind and rain lay a standing
  crop flat and it does not get back up. The field afterwards is a record
  of the weather that crossed it - swirls where a gust turned, long combed
  streaks where it ran straight, seams where two of them met.

  Process. A hundred and sixty-nine short strokes on a square lattice, all
  leaning one way with a little disorder in them, decided once - Vera
  Molnar's hatch. A breeze runs over them continuously, so each stroke
  leans partway toward the wind where it stands and catches the light when
  it lies along it; waves of that sheen travel the field, because the wind
  is a moving thing and never the same in two places. That is all the
  motion the piece needs. Then gusts arrive - blobs of stronger wind,
  crossing from an edge, some running straight and some turning as they
  go. A gust does something the breeze cannot: it changes where a stroke
  RESTS. When it has passed, the strokes it hit do not lean back to the
  ruling. They stand up in a new direction and stay there, and only over
  minutes creep home.

  So the plate accumulates. Nothing here is ever drawn twice into the same
  pixel - the surface is wiped and redrawn every frame, thirty times a
  second, and the total ink is a constant. What accumulates is orientation:
  a memory that lives in the angles and emits no light at all. This is the
  argument with my own last piece, which concluded that a light panel
  cannot hold an hour of accumulation because brightness has nowhere to go
  but up. True - of brightness. An angle has no maximum to run into. Keep
  the ink fixed and let the ARRANGEMENT be the thing that remembers, and
  Casey Reas's hour-long drawing becomes possible on light after all, from
  a direction I did not see until the contact sheets forced me to look for
  one.

  And the wind is never drawn. You read it from what the field does, the
  way you read it from a wheat field from a train window: a dark plate,
  straw-coloured strokes, a shiver of light running across, and something
  crossing it that is nowhere on the panel. Weather nudges it if the house
  knows any - rain and cloud make the gusts come oftener and harder - and
  the whole field dims a little after dark, and keeps being blown through.
@vfx*/

// lodging - buffer mode, Molnar/Reas/Campbell lineage.
//
// A 13x13 lattice of ~3.7px strokes shares one slowly-turning ruling
// angle plus a fixed per-cell deviation (Molnar's one percent, rolled
// once at load and then LEFT ALONE). Two mechanisms act on it, and the
// split between them is the whole design:
//
//   BREEZE (always, everywhere) - a spatially varying, advecting wind
//   direction field (2 noise2 samples per cell). Each stroke leans
//   partway toward it (AMB_BEND) and brightens when it lies ALONG it
//   (SHEEN). This is pure motion: it changes ang[], never rest[]. It
//   guarantees whole-field liveliness independent of event luck - the
//   lesson my Saccades note paid for, generalized.
//
//   GUSTS (rare, local, asymmetric) - moving blobs with a travel
//   direction and a signed curl; strokes inside swing hard toward the
//   local flow and flare. Above LODGE_MIN a gust also drags the stroke's
//   RESTING angle rest[] - the lodging. rest[] creeps back toward the
//   ruling with a ~110s time constant, so the plate carries minutes of
//   weather history in its angles.
//
// The accumulator is therefore NON-LUMINOUS: total ink per frame is
// constant (each stroke deposits its own colour once, constant-brightness
// sub-pixel sampling), the surface is wiped every frame, and the memory
// lives in rest[] where there is no ceiling to hit. See the frontmatter's
// contrast with A Curve Nobody Drew.
//
// Attractors (knowledge/craft/attractors.md): the breeze is external
// forcing that never repeats (noise advected at an ever-advancing t), the
// gusts are the recommended rare/sharp/asymmetric antagonist events, and
// the ruling angle takes a small random step whenever a gust leaves the
// panel, so the plate being blown is never the plate before. Nothing
// contracts; nothing settles.
//
// Measured offline (Python port of this exact math with the prelude's
// simplex noise ported verbatim - my standard de-risking method, requiring
// the candidate to beat known-passing references on the SAME metric):
// mean-per-pixel temporal std over 2s windows = 0.038-0.045 in the opening
// across 5 seeds, 0.036-0.052 at t=30s, 0.031-0.051 at t=180s, 0.035-0.047
// at t=480s (references: Saccades-PASS 0.030, Lengths 0.041); max
// frame-mean jump 0.0016 (no strobing); 0.042 at daylight 0 and 0.045 at
// daylight 1 (graceful degradation measured, not asserted); ~61-64% dark
// ground, 1.3-3.3% bright.

const meta = { name: "lodging", fps: 30, inputs: ["env", "clock"] };

const TAU = Math.PI * 2;
const PI = Math.PI;

// --- the ruled field --------------------------------------------------------
const COLS = 13, ROWS = 13, CELL = 4.85;   // centres 2.4 .. 60.6
const NC = COLS * ROWS;
const HALF = 1.85;          // half stroke length (~3.7px): short enough that
                            // aligned neighbours do not fuse into long lines
const JIT = 0.45;           // per-cell position jitter, rolled once, then still
const SPREAD = 0.20;        // her one percent: fixed per-cell angle deviation

// --- the breeze (motion; never touches the resting angles) ------------------
const AMB_BEND = 0.55;      // how far the standing nap leans toward the wind
const AMB_SWIRL = 1.30;     // spatial variation of wind direction (rad)
const SWAY = 2.20;          // rad/s: how fast a stroke follows the breeze
const SHEEN = 0.56;         // brightness gained by lying along the wind
const WD_BASE = 0.085, WD_SWING = 0.055;   // the wind veers; rate stays > 0

// --- the gusts (memory; these change where a stroke rests) ------------------
const MAXG = 4;
const TURN = 7.0;           // how fast a gusted stroke swings
const KEEP = 0.70;          // how fast its RESTING angle is dragged
const LODGE_MIN = 0.28;     // only a strong gust lays the nap down
const RESTORE = 1 / 110;    // s^-1: the crop standing back up (~2 min)
const GLOW_T = 1.0;         // s: flare of being hit
const GLOW_LIFT = 1.20;
const MEM_LIFT = 0.32;      // lodged strokes keep a little sheen (bounded)

// --- palette: dry straw on black, near-white where it lies to the light -----
const HUE = 0.135, SAT_REST = 0.30, SAT_LIT = 0.09;
const V_REST = 0.55;
// Shallow travelling luminance wave (my Plotter lesson: on a DENSE field a
// deep pulse eats the composition - keep it shallow, buy life from events).
const BR_MID = 0.84, BR_AMP = 0.16, W_BREATH = TAU / 6.5;

// --- cell state (top-level persists for the program's life) -----------------
const ccx = new Float64Array(NC), ccy = new Float64Array(NC);
const dev = new Float64Array(NC);      // fixed per-cell deviation
const jtx = new Float64Array(NC), jty = new Float64Array(NC);
const rest = new Float64Array(NC);     // where this stroke currently RESTS
const ang = new Float64Array(NC);      // where it is pointing right now
const glow = new Float64Array(NC);     // hit-ness, decaying

// --- gust state -------------------------------------------------------------
const gx = new Float64Array(MAXG), gy = new Float64Array(MAXG);
const gvx = new Float64Array(MAXG), gvy = new Float64Array(MAXG);
const grd = new Float64Array(MAXG), gr2 = new Float64Array(MAXG);
const gst = new Float64Array(MAXG), gcl = new Float64Array(MAXG);
let NG = 0;

let wdir, ruling, spawnT, gain = 0.92;
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

// Bilinear (sub-pixel) deposit - Campbell's diffusion, done in math.
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

// Constant-brightness stroke: fixed 0.5px pitch, weight 0.5, so a stroke's
// peak accumulation is its colour regardless of orientation. The total ink
// laid down per frame is therefore a constant - the piece cannot saturate.
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

// Strokes are symmetric: angles live mod PI, so always take the short arc,
// or the field snaps 180 degrees at random and reads as sparkle.
function arc(d) {
  return d - PI * Math.round(d / PI);
}

// How gusty the weather is: an autonomous slow walk, biased by the house's
// actual weather when it has any (rain and cloud make gusts come oftener
// and harder). Read only at spawn time, so a swept input never snaps the
// geometry; at neutral (env.ok false) the walk runs on its own.
function character(t) {
  let ch = 0.5 + 0.5 * noise2(7.7, t * 0.013);
  const en = input.env;
  if (en.ok) {
    const wx = clamp(0.35 * en.cloud + 0.65 * en.rain, 0, 1);
    ch = clamp(0.55 * ch + 0.45 * wx, 0, 1);
  }
  return ch;
}

// A gust: enters from an edge, aimed roughly across the panel, with a
// signed curl so some run straight and some turn as they go.
function spawnGust(t, opening) {
  if (NG >= MAXG) return;
  const k = NG++;
  const ch = character(t);
  let R = 10.0 + Math.random() * 12.0;
  const spd = 11.0 + Math.random() * 14.0 * (0.4 + 0.6 * ch);
  let curl = (Math.random() * 2 - 1) * (0.15 + 0.8 * ch);
  const S = 0.70 + 0.30 * Math.random();
  let px, py, a;
  if (opening === 1) {
    px = 20.0; py = 30.0; a = 0.25;
  } else if (opening === 2) {
    px = 46.0; py = 44.0; a = 2.3; R = 16.0; curl = 0.6;
  } else {
    const side = (Math.random() * 4) | 0;
    const m = R + 4;
    if (side === 0) { px = -m; py = Math.random() * HEIGHT; a = (Math.random() - 0.5) * 1.4; }
    else if (side === 1) { px = WIDTH + m; py = Math.random() * HEIGHT; a = PI + (Math.random() - 0.5) * 1.4; }
    else if (side === 2) { px = Math.random() * WIDTH; py = -m; a = PI * 0.5 + (Math.random() - 0.5) * 1.4; }
    else { px = Math.random() * WIDTH; py = HEIGHT + m; a = -PI * 0.5 + (Math.random() - 0.5) * 1.4; }
  }
  gx[k] = px; gy[k] = py;
  gvx[k] = Math.cos(a) * spd; gvy[k] = Math.sin(a) * spd;
  grd[k] = R; gr2[k] = R * R; gst[k] = S; gcl[k] = curl;
  spawnT = (3.4 - 2.0 * ch) * (0.5 + 0.9 * Math.random());
}

function setup() {
  for (let iy = 0; iy < ROWS; iy++) {
    for (let ix = 0; ix < COLS; ix++) {
      const i = iy * COLS + ix;
      ccx[i] = ix * CELL + CELL * 0.5;
      ccy[i] = iy * CELL + CELL * 0.5;
    }
  }
  ruling = PI * 0.28;
  for (let i = 0; i < NC; i++) {
    dev[i] = SPREAD * (Math.random() * 2 - 1);
    jtx[i] = (Math.random() * 2 - 1) * JIT;
    jty[i] = (Math.random() * 2 - 1) * JIT;
    // The plate has already been weathered before we arrive: a smooth
    // pre-existing lodging, so the opening second is a field with a
    // history in it rather than a fresh ruling.
    rest[i] = ruling + dev[i] + 0.55 * noise2(ccx[i] * 0.055, ccy[i] * 0.055);
    ang[i] = rest[i];
    glow[i] = 0;
  }
  wdir = Math.random() * TAU;
  NG = 0; spawnT = 1.0;
  spawnGust(0, 1);      // two gusts already crossing at t=0
  spawnGust(0, 2);
  started = true;
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;      // guard a stall from spiking the integrators
  fr.fill(0); fg.fill(0); fb.fill(0);

  // The wind veers - a strictly positive, noise-modulated rate, so it never
  // stalls and never comes back on the same phase.
  wdir += (WD_BASE + WD_SWING * noise2(31.3, t * 0.05)) * dt;
  if (wdir > 1e6) wdir -= 1e6;

  // Move the gusts; retire the ones that have left, and step the ruling
  // angle each time one does (Molnar's serial sweep, laid across the hour).
  let n = 0;
  for (let k = 0; k < NG; k++) {
    gx[k] += gvx[k] * dt; gy[k] += gvy[k] * dt;
    const m = grd[k] + 10;
    if (gx[k] > -m && gx[k] < WIDTH + m && gy[k] > -m && gy[k] < HEIGHT + m) {
      if (n !== k) {
        gx[n] = gx[k]; gy[n] = gy[k]; gvx[n] = gvx[k]; gvy[n] = gvy[k];
        grd[n] = grd[k]; gr2[n] = gr2[k]; gst[n] = gst[k]; gcl[n] = gcl[k];
      }
      n++;
    } else {
      ruling += (Math.random() - 0.5) * 0.24;
    }
  }
  NG = n;
  spawnT -= dt;
  if (spawnT <= 0) spawnGust(t, 0);

  // Day for Night: the field dims a little after dark (Campbell). Smoothed,
  // so the harness's time-warped clock ramps instead of flashing.
  const day = clamp(input.clock.daylight, 0, 1);
  let gk = dt * 0.5; if (gk > 1) gk = 1;
  gain += ((0.85 + 0.15 * day) - gain) * gk;

  const decay = Math.exp(-dt / GLOW_T);
  let ksway = dt * SWAY; if (ksway > 1) ksway = 1;
  let krest = dt * RESTORE; if (krest > 1) krest = 1;
  const wbase = t * W_BREATH;
  const invLodge = 1 / (1 - LODGE_MIN);

  for (let i = 0; i < NC; i++) {
    const cx = ccx[i], cy = ccy[i];

    // The breeze here, now: a large slow field plus a faster ripple, both
    // advected, so waves of wind visibly run across the lattice.
    const amb = wdir
      + AMB_SWIRL * noise2(cx * 0.05 + t * 0.28, cy * 0.05 - t * 0.16)
      + 0.45 * noise2(cx * 0.115 - t * 0.42, cy * 0.115 + t * 0.31);

    // Strongest gust over this cell, and the flow direction it imposes:
    // its travel direction blended with a tangential swirl by its curl.
    let bw = 0, tgt = 0;
    for (let k = 0; k < NG; k++) {
      const dx = cx - gx[k], dy = cy - gy[k];
      const d2 = dx * dx + dy * dy;
      if (d2 < gr2[k]) {
        let w = 1 - d2 / gr2[k];
        w = w * w * gst[k];
        if (w > bw) {
          bw = w;
          const c = gcl[k], ac = c < 0 ? -c : c;
          const vl = Math.sqrt(gvx[k] * gvx[k] + gvy[k] * gvy[k]);
          const ux = gvx[k] / vl, uy = gvy[k] / vl;
          const dn = d2 > 1 ? Math.sqrt(d2) : 1;
          tgt = Math.atan2(uy * (1 - ac) + (dx / dn) * c,
                           ux * (1 - ac) + (-dy / dn) * c);
        }
      }
    }

    let a = ang[i], r = rest[i];
    if (bw > 0.004) {
      let k1 = dt * TURN * bw; if (k1 > 1) k1 = 1;
      a += arc(tgt - a) * k1;                 // the stroke is thrown over
      const lodge = bw - LODGE_MIN;
      if (lodge > 0) {                        // ...and, if hard enough, KEPT
        let k2 = dt * KEEP * lodge * invLodge; if (k2 > 1) k2 = 1;
        r += arc(tgt - r) * k2;
      }
      if (bw > glow[i]) glow[i] = bw;
    }

    // The standing nap leans toward the breeze; the stroke follows that
    // lean. Suppressed while a gust owns the cell.
    const lean = r + arc(amb - r) * AMB_BEND;
    a += arc(lean - a) * ksway * (1 - bw);
    // ...and the crop slowly stands back up toward the ruling.
    r += arc((ruling + dev[i]) - r) * krest;
    ang[i] = a; rest[i] = r;
    glow[i] *= decay;

    // Light: a stroke lying ALONG the wind catches it (travelling sheen);
    // a stroke still lodged out of true keeps a little of that shine
    // (bounded - this is the accumulator, and it cannot run away).
    let sh = 1 - Math.abs(arc(a - amb)) / (PI * 0.5);
    if (sh < 0) sh = 0;
    let mem = Math.abs(arc(r - (ruling + dev[i]))) / (PI * 0.5);
    if (mem > 1) mem = 1;
    const g = glow[i];
    const breath = BR_MID + BR_AMP * Math.sin(wbase + (i % COLS) * 0.34 + ((i / COLS) | 0) * 0.26);
    let v = V_REST * breath * (1 + GLOW_LIFT * g + MEM_LIFT * mem + SHEEN * sh);
    if (v > 1) v = 1;
    let lit = g + 0.4 * mem; if (lit > 1) lit = 1;
    const c = hsv(HUE, lerp(SAT_REST, SAT_LIT, lit), v * v * gain);
    const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;

    const ex = Math.cos(a) * HALF, ey = Math.sin(a) * HALF;
    const px = cx + jtx[i], py = cy + jty[i];
    seg(px - ex, py - ey, px + ex, py + ey, cr, cg, cb);
  }

  // Quantize the surface to the panel. Nothing survives the frame; the only
  // thing that persists is the angles.
  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++, i++) {
      const r = fr[i], g = fg[i], b = fb[i];
      if (r < 1 && g < 1 && b < 1) { setPixel(x, y, 0); continue; }
      setPixel(x, y, rgb(r, g, b));
    }
  }
}
