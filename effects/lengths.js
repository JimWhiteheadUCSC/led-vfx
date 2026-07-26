/*@vfx
id: ccd1d437-f4f0-4aef-81db-cbd810c60c4b
title: Lengths
created: 2026-07-21
artist: Saccade (apprentice name)
lineage:
  - id: e47f033d-ebdb-48bd-8a08-7b7f03ddff6f
    relation: variation
    note: >-
      Passerby's synthesized-gait threshold, carried from the walker to
      the swimmer - Campbell's own pairing (walkers, swimmers, birds).
      Same vocabulary: a dozen sub-pixel-splatted joints, illegible frozen
      and unmistakable in motion, the gait grown from sines not filmed.
      But it takes the opposite POSITION on presence. Passerby was about
      transience: one figure crosses the empty street and is gone, and
      mostly the street is empty. Here the figure never leaves. The pool
      has walls; the body turns and comes back. Absence becomes endurance;
      the single crossing becomes the length repeated.
influences: [jim-campbell]
rationale: |
  One body, reduced to a dozen points of cool light, doing lengths in a
  dark pool. Freeze it and the points scatter into abstraction; let it
  move and a swimmer resolves - the crawl's windmilling arms, the flutter
  kick, the head lifting to breathe - recognizable only in motion. Jim
  Campbell's threshold, carried from the walker to the water: the
  information lives in the stroke, not the bitmap. The gait is synthesized,
  not filmed - two arms windmilling a half-cycle apart, a faster flutter
  behind, the stroke phase tied to distance travelled so it never skates,
  every joint sub-pixel-splatted for his diffusion.

  Passerby was about transience - a figure crosses the empty street and is
  gone, and mostly the street is empty. This is its opposite, in the same
  vocabulary: the swimmer never leaves. The pool has walls; at each end the
  body stretches into a streamline, turns, and comes back. Absence becomes
  endurance, the single crossing becomes the length repeated - a domestic,
  meditative motion at the speed of patience, virtuosic only in that a
  person keeps coming out of almost nothing. The one place the piece
  breathes wide is the water: a faint undulating line of light across the
  whole panel, so the field is never dead and the swimmer is always
  somewhere - at a surface, at night.
@vfx*/

// lengths - buffer mode, Campbell-lineage synthesized-gait figure.
// A single point-light swimmer (front crawl) does lengths of a dark pool:
// windmilling arms (two, a half-cycle apart), a faster flutter kick, a
// head that lifts to breathe. At each wall it stretches into a streamline,
// turns, and swims back - so it is always present, always moving. Each
// joint is a soft sub-pixel splat into a slowly-fading wake buffer
// (Campbell diffusion). A faint undulating waterline crosses the whole
// panel so the field breathes even where the figure is not. Autonomous;
// no inputs (the lap, the stroke, and the breath are its only clocks).

const meta = { name: "lengths", fps: 30 };

const TAU = Math.PI * 2;

// --- figure + pool geometry (local frame: +x = forward, +y = down) ---------
const CY = 33;                     // the waterline the swimmer travels along
const TURN_HI = 48, TURN_LO = 16;  // body centre turns near each wall
const CRUISE = 8.5;                // px/s along the length
const STROKE_DIST = 9.0;           // px advanced per full arm cycle -> stroke rate
const KICK_RATIO = 2.5;            // flutter kick is faster than the arm stroke
const R_ARM = 6.0;                 // arm windmill radius from the shoulder
const KICK_AMP = 2.0;              // flutter amplitude at the feet
const UND = 0.7;                   // gentle body undulation
const TURN_DUR = 0.95;             // seconds for the streamline turn at a wall
const PACE_W = 0.05;               // the swimmer's pace breathes slowly (rad/s)

// --- wake / diffusion buffer ------------------------------------------------
const acc = new Float32Array(WIDTH * HEIGHT);
const TRAIL = 0.82;                // per-frame fade -> a short silky wake
const SIGMA2 = 2 * 0.85 * 0.85;    // splat softness (Campbell diffusion)

// --- palette ----------------------------------------------------------------
const F_HUE = 0.55, F_SAT = 0.15;  // cool near-white swimmer
const S_HUE = 0.57, S_SAT = 0.55;  // deeper, dim water surface
const S_PEAK = 0.12;               // faint - a presence, never a bar

// --- state (top-level persists for the program's life) ----------------------
let cx, cy, dir, strokePhase;
let turning, turnT, flipped;
let started = false;

function setup() {
  cx = 24; cy = CY; dir = 1; strokePhase = 0;
  turning = false; turnT = 0; flipped = false;
  started = true;
}

// Bilinear-ish soft (sub-pixel) splat into the wake buffer.
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

// Place a local joint: mirror by travel direction, translate to (cx,cy).
function joint(lx, ly, amp) {
  splat(cx + dir * lx, cy + ly, amp);
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;   // guard a stall from spiking the integrator

  // --- update motion / wall-turn state ------------------------------------
  let gliding = 0, speedMul = 1;
  if (turning) {
    turnT += dt;
    let u = turnT / TURN_DUR;
    if (u > 1) u = 1;
    gliding = Math.sin(Math.PI * u);      // 0 -> 1 (streamline at wall) -> 0
    speedMul = 1 - 0.95 * gliding;        // decelerate into the wall, push off
    if (!flipped && u >= 0.5) { dir = -dir; flipped = true; }  // turn around
    if (u >= 1) turning = false;
  }

  const cruise = CRUISE * (0.9 + 0.15 * Math.sin(t * PACE_W)); // pace breathes
  const ddx = dir * cruise * speedMul * dt;
  cx += ddx;
  strokePhase += TAU * Math.abs(ddx) / STROKE_DIST;  // stroke tied to distance

  if (!turning) {
    if ((dir > 0 && cx >= TURN_HI) || (dir < 0 && cx <= TURN_LO)) {
      turning = true; turnT = 0; flipped = false;
    }
  }

  // --- water surface: a faint undulating line across the whole width ------
  fill(0);
  for (let x = 0; x < WIDTH; x++) {
    const sh = 0.5 + 0.5 * noise2(x * 0.09 + t * 0.15, t * 0.05);
    const yc = CY + 1.2 * Math.sin(x * 0.15 + t * 0.4);     // the line undulates
    for (let y = CY - 4; y <= CY + 4; y++) {
      if (y < 0 || y >= HEIGHT) continue;
      let band = 1 - Math.abs(y - yc) / 5;
      if (band <= 0) continue;
      const v = S_PEAK * band * (0.35 + 0.65 * sh);
      if (v <= 0.004) continue;
      setPixel(x, y, hsv(S_HUE, S_SAT, v * v));             // perceptual curve
    }
  }

  // --- fade the wake, then draw the swimmer into it -----------------------
  for (let i = 0; i < acc.length; i++) acc[i] *= TRAIL;

  const sp = strokePhase;
  const kick = sp * KICK_RATIO;
  const und = UND * Math.sin(2 * sp);
  const breath = (1 - gliding) * 1.2 * Math.max(0, Math.sin(sp * 0.33));

  // torso axis (head is the brightest point; it anchors the figure)
  joint(8, -1 + und * 0.3 - breath, 0.95);   // head (lifts a touch to breathe)
  joint(3, und * 0.6, 0.72);                  // shoulder
  joint(-1, und * 0.8, 0.62);                 // sternum
  joint(-6, und * 0.5, 0.70);                 // hip

  // arms: two windmills a half-cycle apart, blended toward a forward
  // streamline as the body glides through the turn.
  for (let aI = 0; aI < 2; aI++) {
    const phi = sp + aI * Math.PI;
    const c = Math.cos(phi), s = Math.sin(phi);
    const hx = lerp(3 + R_ARM * c, 3 + R_ARM, gliding);
    const hy = lerp(R_ARM * s, 0, gliding);
    const ex = lerp(3 + 0.5 * R_ARM * c, 3 + 0.5 * R_ARM, gliding);
    const ey = lerp(0.5 * R_ARM * s, 0, gliding);
    joint(ex, ey, 0.55);   // elbow
    joint(hx, hy, 0.80);   // hand (catches the light)
  }

  // legs: flutter kick, straightening into the streamline at the turn.
  for (let lI = 0; lI < 2; lI++) {
    const kp = kick + lI * Math.PI;
    const kv = KICK_AMP * Math.sin(kp) * (1 - gliding);
    joint(-9, kv * 0.5, 0.50);   // knee
    joint(-12, kv, 0.60);        // foot
  }

  // --- composite the wake/figure additively over the water ----------------
  for (let i = 0; i < acc.length; i++) {
    let a = acc[i];
    if (a < 0.02) continue;
    if (a > 1) a = 1;
    const v = a * a;                         // perceptual value curve
    const c = hsv(F_HUE, F_SAT, v);
    const x = i % WIDTH, y = (i / WIDTH) | 0;
    const p = getPixel(x, y);
    setPixel(x, y, rgb(
      ((p >> 16) & 255) + ((c >> 16) & 255),
      ((p >> 8) & 255) + ((c >> 8) & 255),
      (p & 255) + (c & 255)
    ));
  }
}
