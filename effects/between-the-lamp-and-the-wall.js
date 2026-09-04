/*@vfx
id: 959b82f7-5cf2-4dd1-8275-79b77fac9a63
title: Between the Lamp and the Wall
created: 2026-07-27
artist: Saccade (apprentice name)
lineage:
  - id: e47f033d-ebdb-48bd-8a08-7b7f03ddff6f
    relation: contrast
    note: >-
      Passerby, and every figure piece since it, drew the body as points
      of light on a black field - light ADDED to nothing until a person
      appeared. This inverts the polarity. The ground is lit here: a wall
      with a lamp on it, and the body is the one thing in the room that
      emits nothing. It can only be a subtraction - a hole travelling
      across the light - and we know it is there because some of the light
      stopped. It is also, unlike five pieces of mine, how bodies are
      actually rendered in a house at night.
  - id: 6fd8638e-72aa-4d7c-a79b-909551a680a1
    relation: variation
    note: >-
      The Grain Remembers made a figure legible only through a medium's
      response to it, and Lodging and A Curve Nobody Drew carried that
      into a ruled lattice of strokes for three pieces running. Same
      conviction - the subject is not drawn - but the lattice is retired.
      The medium here is a continuous field of lamplight and the response
      is the oldest one there is: it is blocked. And it brings a physical
      reason for Campbell's diffusion, which the lattice never could: a
      lamp has a WIDTH, so a shadow's edge softens with distance from the
      wall, and legibility becomes depth.
influences: [jim-campbell]
rationale: |
  A wall, a lamp with a shade somewhere above the frame, and people
  passing between the two. Nothing on this panel is a figure. What is
  drawn is a pool of warm light on plaster; what you read is the light
  that failed to arrive.

  Everything I have made until now added light to blackness until a body
  appeared - eleven bright joints, a swimmer, a faller, two walkers
  keeping step. This is the same wager from the other side. The ground is
  lit and the body emits nothing, so it can only be a subtraction, and I
  only noticed late that this is how people are actually rendered in a
  house at night: nobody in a living room is self-luminous; a lamp is on,
  and we are the dark shapes that cross it.

  The lamp has a width, and that width is the whole piece. A point source
  would cut hard-edged silhouettes; a real lamp casts a penumbra whose
  softness grows with the distance between the body and the wall. So depth
  IS legibility here. Someone walking close to the plaster throws a small
  crisp shadow you can read stride by stride; someone out near the lamp
  throws a larger vague one in which the head and torso survive and the
  limbs dissolve. Two of them cross at once at different depths and one is
  legible and the other is not. Jim Campbell hung diffusers in front of
  his grids, tilted, so that legibility visibly changed across the work;
  here the diffusion is not a material in front of the panel but a fact
  about lamps, and it changes from body to body.

  The lamp is hung, so it swings - slowly, unevenly, the way a thing on a
  cord does when a room has been walked through - and the whole geometry
  answers: the pool slides on the plaster and every shadow swings the
  other way, the near ones more than the far. Nothing accumulates and
  nothing settles; each crossing re-rolls its depth, direction, pace and
  cadence, so the fortieth minute is other people. After dark the lamp is
  the only source and the shadows go to black; by day the room fills in
  and they soften to a grey suggestion, the way shadows in a lit room
  barely commit.
@vfx*/

// between_the_lamp_and_the_wall - buffer mode, Campbell lineage.
//
// The panel is a WALL. An off-frame lamp of finite radius RL hangs at
// distance D in front of it and swings slowly. Five bodies walk in planes
// parallel to the wall at depths d, and the only thing this program
// computes is how much of the lamp each wall pixel can still see.
//
// Geometry (wall at z=0, lamp at z=-D, body plane at z=-d):
//   s = D / (D - d)             projection magnification
//   X = Lx + (x - Lx) * s       any body point, onto the wall
//   R = r * s                   and its radius
//   p = RL * (s - 1)            penumbra half-width   <- the whole piece
// A body near the wall (s -> 1) casts a small hard shadow; one near the
// lamp casts a larger soft one. Legibility is depth.
//
// The silhouette is 8 capsules (head, torso, 2 thighs, 2 shins, 2 arms)
// posed by the stance-fraction gait I have used since Keeping Pace - the
// planted foot translating backward at exactly the body's own speed, so
// nothing skates - then projected and rasterized into an occlusion field
// by MAX-union, which is the physically right operator: overlapping
// umbras do not get darker. The raster is bbox-limited and has no
// function calls in its hot loop; measured 3372 pixel visits per frame,
// well under the cost of my recent lattice pieces.
//
// The wall's illumination is one LUT - inverse-square falloff times the
// soft edge of the shade's beam, both functions of squared distance alone
// - so a pixel costs an add, two multiplies and two indexed reads: no
// divide, no sqrt, no trig. Composite is light * (1 - occlusion * depth),
// through a 256-entry ramp whose dark end is cooler than its lit end, so
// a penumbra reads as ambient fill and not as a hole punched in the wall.
//
// Attractors (knowledge/craft/attractors.md): a renewal process. Every
// crossing re-rolls depth band, direction, pace, cadence, size and
// height; the swing's rate and amplitude are noise-modulated and the rate
// never reaches zero, so the lamp never comes back on the same phase;
// nothing accumulates anywhere (the occlusion field is wiped every
// frame). Minute forty is other people, at other depths.
//
// input.clock.daylight: night = lamp-only, shadows to black, amber; day =
// the room fills, shadows soften to grey, light paler. Smoothed, so the
// harness's time-warped clock ramps instead of flashing; a neutral clock
// sits at mid-evening.
//
// Measured offline (node port of this exact math with the prelude's noise
// ported verbatim - my standard de-risking method, requiring the
// candidate to beat known-passing references on the SAME metric):
// mean-per-pixel temporal std over 2s windows 0.047-0.067 across 12
// epochs from t=0 to t=2700s and 8 seeds (references: Saccades-PASS
// 0.030, Lengths 0.041, Long Fall 0.048); 0.047-0.062 at daylight 0 and
// 1 (graceful degradation measured, not asserted); max frame-mean jump
// 0.0055, and 0.0065 under a clock swept a full day in 20s with jittered
// dt (no strobing); 65-77% dark ground, 8-22% bright; 2 or 3 shadows on
// the lit pool 75% of the time and the pool never bare for more than
// 2.6s in ten minutes.

const meta = { name: "between_the_lamp_and_the_wall", fps: 30, inputs: ["clock"] };

const TAU = Math.PI * 2;

// --- the room ---------------------------------------------------------------
const D = 45.0;                 // lamp distance from the wall
const D2 = D * D;
const RL = 1.90;                // the lamp's RADIUS: the penumbra generator
const LX0 = 31.0, LY0 = 24.0;   // where it hangs (wall-plane coords)
const SW_X = 9.0, SW_Y = 2.4;   // how far it swings, and how far it rises
const SWING_R = 0.62, SWING_V = 0.18;   // swing rate (rad/s), always > 0

// --- the bodies -------------------------------------------------------------
const NB = 5;
const NCAP = 8;
const SF = 0.62;                // stance fraction -> ~24% double support
const FOOT = 1.9;               // foot lift at mid-swing (body units)
const BOB = 1.15;               // body rise at mid-stance
// depth bands: 0 = out near the lamp (larger, soft), 1 = near the wall (crisp)
const S_NEAR_LO = 1.62, S_NEAR_HI = 2.02;
const S_FAR_LO = 1.07, S_FAR_HI = 1.32;

// --- the light --------------------------------------------------------------
const LN = 1024, Q2MAX = 6400.0;
const YSQ = 1.55;               // the shade throws a pool wider than it is tall
const RIN = 15.0, ROUT = 28.5;  // the beam's soft edge (elliptical radius, px)
const QS = (LN - 1) / Q2MAX;
const LT = new Float32Array(LN);
const dxq = new Float64Array(WIDTH), dyq = new Float64Array(HEIGHT);
const tex = new Float32Array(WIDTH * HEIGHT);

// --- palette: warm plaster, cooler fill inside the penumbra -----------------
const PAL_N = 256;
const pal = new Int32Array(PAL_N);
let palKey = -1;

// --- the occlusion field (wiped every frame; nothing accumulates) -----------
const occ = new Float32Array(WIDTH * HEIGHT);

// --- pose scratch (no per-frame allocation) ---------------------------------
const lax = new Float64Array(NCAP), lay = new Float64Array(NCAP);
const lbx = new Float64Array(NCAP), lby = new Float64Array(NCAP);
const lrr = new Float64Array(NCAP);

const bodies = [];
let Lx = LX0, Ly = LY0;
let dayS = 0.5, swing = 0, started = false;

function setup() {
  // The wall's illumination: inverse-square falloff times the soft edge of
  // the shade's beam. Both are functions of squared distance alone, so the
  // whole field is one LUT.
  const in2 = RIN * RIN, out2 = ROUT * ROUT;
  for (let k = 0; k < LN; k++) {
    const q2 = k / QS;
    const r2 = D2 / (q2 + D2);
    LT[k] = r2 * Math.sqrt(r2) * (1 - smoothstep(in2, out2, q2));
  }
  // Plaster: a static, nearly invisible tooth, so the pool is a surface and
  // not a gradient. Sampled on a 32x32 grid at load, and never again.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const n = noise2((x >> 1) * 0.19, (y >> 1) * 0.19);
      tex[y * WIDTH + x] = 0.93 + 0.07 * (0.5 + 0.5 * n);
    }
  }
  for (let i = 0; i < NB; i++) {
    bodies.push({ band: 1, s: 1.3, bs: 0.9, dir: 1, bx: 0,
                  vb: 8, cad: 4.3, ph: 0, R: 3, hipY: 30, marg: 13 });
  }
  swing = Math.random() * TAU;
  for (let i = 0; i < NB; i++) newPass(i);
  // The opening second is five crossings already in progress, spread across
  // the wall - not an empty wall waiting for someone to arrive.
  const START = [6.0, 21.0, 34.0, 47.0, 60.0];
  for (let i = 0; i < NB; i++) place(bodies[i], START[i]);
  started = true;
}

// Where a body's shadow currently sits on the wall.
function wallX(j) {
  const b = bodies[j];
  return Lx + (b.bx - Lx) * b.s;
}

// Put a body where its shadow's centre lands on wall-x X.
function place(b, X) {
  b.bx = Lx + (X - Lx) / b.s;
}

// A fresh crossing. At most ONE body may walk in the near band, so the wall
// never holds two large soft masses at once.
function newPass(i) {
  const b = bodies[i];
  let nearTaken = false;
  for (let j = 0; j < bodies.length; j++) {
    if (j !== i && bodies[j].band === 0) nearTaken = true;
  }
  const band = nearTaken ? 1 : (Math.random() < 0.45 ? 0 : 1);
  b.band = band;
  if (band === 0) {
    b.s = S_NEAR_LO + Math.random() * (S_NEAR_HI - S_NEAR_LO);
    b.bs = 0.76 + Math.random() * 0.14;
  } else {
    b.s = S_FAR_LO + Math.random() * (S_FAR_HI - S_FAR_LO);
    b.bs = 0.86 + Math.random() * 0.19;
  }
  const vs = (band === 0 ? 14.0 : 12.0) + Math.random() * 7.0;  // shadow px/s
  b.vb = vs / b.s;                                              // body px/s
  b.cad = TAU * (0.62 + Math.random() * 0.26);                  // unhurried
  b.R = clamp(1.95 * b.vb / b.cad, 1.7, 4.7);   // stride from speed: no skating
  b.ph = Math.random() * TAU;
  const Yc = (band === 0 ? 27.0 : 25.0) + Math.random() * 10.0;
  b.hipY = Ly + (Yc - Ly) / b.s + 1.15 * b.bs;  // aim the shadow at the pool
  b.marg = 6.5 * b.bs * b.s + 5.0;

  // Come in from whichever side of the wall is emptier, and if someone is
  // already standing near that door, start further back down the corridor.
  // Without this the crossings bunch - a body that leaves at the right and
  // re-rolls leftward re-enters exactly where it left - and measurably so:
  // bunched epochs left the lit pool bare for seconds at a time.
  let nl = 0, nr = 0;
  for (let j = 0; j < bodies.length; j++) {
    if (j === i) continue;
    if (wallX(j) < WIDTH * 0.5) nl++; else nr++;
  }
  const fromLeft = nl < nr ? true : (nr < nl ? false : Math.random() < 0.5);
  b.dir = fromLeft ? 1 : -1;
  let X0 = fromLeft ? -b.marg : WIDTH + b.marg;
  for (let g = 0; g < 4; g++) {
    let close = false;
    for (let j = 0; j < bodies.length; j++) {
      if (j === i) continue;
      const d = wallX(j) - X0;
      if (d < 20 && d > -20) { close = true; break; }
    }
    if (!close) break;
    X0 -= b.dir * 15.0;
  }
  place(b, X0);
}

// One limb at cycle position u: planted and translating backward at exactly
// the body's own speed through the stance, then a cosine swing forward.
let _fx = 0, _lf = 0;
function limb(u, R, L) {
  if (u < SF) { _fx = R - 2 * R * (u / SF); _lf = 0; }
  else {
    const s = (u - SF) / (1 - SF);
    _fx = -R * Math.cos(Math.PI * s);
    _lf = L * Math.sin(Math.PI * s);
  }
}

// The silhouette as 8 capsules, in body units, hip at the origin.
function pose(b) {
  const R = b.R, ph = b.ph;
  const u0 = fract(ph / TAU), u1 = fract(ph / TAU + 0.5);
  const hy = -BOB * (0.5 - 0.5 * Math.cos(2 * ph));   // rises twice a cycle
  const shy = hy - 7.2;

  limb(u0, R, FOOT);
  const k0x = _fx * 0.55, k0y = hy + 4.9 - _lf * 0.45, f0x = _fx, f0y = hy + 9.8 - _lf;
  limb(u1, R, FOOT);
  const k1x = _fx * 0.55, k1y = hy + 4.9 - _lf * 0.45, f1x = _fx, f1y = hy + 9.8 - _lf;
  limb(u1, R * 1.15, 0); const a1x = _fx;     // arms oppose their leg
  limb(u0, R * 1.15, 0); const a0x = _fx;

  lax[0] = 1.0; lay[0] = shy - 4.7; lbx[0] = 1.0; lby[0] = shy - 3.9; lrr[0] = 2.15;
  lax[1] = 0.0; lay[1] = hy;        lbx[1] = 0.3; lby[1] = shy;       lrr[1] = 2.90;
  lax[2] = 0.0; lay[2] = hy;   lbx[2] = k0x; lby[2] = k0y; lrr[2] = 1.85;
  lax[3] = k0x; lay[3] = k0y;  lbx[3] = f0x; lby[3] = f0y; lrr[3] = 1.45;
  lax[4] = 0.0; lay[4] = hy;   lbx[4] = k1x; lby[4] = k1y; lrr[4] = 1.85;
  lax[5] = k1x; lay[5] = k1y;  lbx[5] = f1x; lby[5] = f1y; lrr[5] = 1.45;
  lax[6] = 0.3; lay[6] = shy;  lbx[6] = a1x; lby[6] = shy + 4.8; lrr[6] = 1.42;
  lax[7] = 0.3; lay[7] = shy;  lbx[7] = a0x; lby[7] = shy + 4.8; lrr[7] = 1.42;
}

// Project the posed body onto the wall and rasterize its occlusion. The
// penumbra p is shared by the whole silhouette (the body is planar), which
// is why a shadow reads as one coherently soft or coherently crisp thing.
function cast(b) {
  pose(b);
  const s = b.s, bs = b.bs, d = b.dir, bx = b.bx, hipY = b.hipY;
  const p = RL * (s - 1);
  for (let k = 0; k < NCAP; k++) {
    const ax = Lx + (bx + d * lax[k] * bs - Lx) * s;
    const ay = Ly + (hipY + lay[k] * bs - Ly) * s;
    const ex = Lx + (bx + d * lbx[k] * bs - Lx) * s;
    const ey = Ly + (hipY + lby[k] * bs - Ly) * s;
    const R = lrr[k] * bs * s;
    const out = R + p;
    const inr = R > p ? R - p : 0;
    const out2 = out * out, in2 = inr * inr;
    const span = out2 - in2;
    if (span < 1e-6) continue;
    const inv = 1 / span;

    let x0 = Math.floor((ax < ex ? ax : ex) - out);
    let x1 = Math.ceil((ax > ex ? ax : ex) + out);
    let y0 = Math.floor((ay < ey ? ay : ey) - out);
    let y1 = Math.ceil((ay > ey ? ay : ey) + out);
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > WIDTH - 1) x1 = WIDTH - 1;
    if (y1 > HEIGHT - 1) y1 = HEIGHT - 1;
    if (x1 < x0 || y1 < y0) continue;

    const sx = ex - ax, sy = ey - ay;
    let l2 = sx * sx + sy * sy;
    if (l2 < 1e-6) l2 = 1e-6;
    const invl2 = 1 / l2;

    // Squared-distance-to-segment, soft-thresholded between (R-p) and (R+p):
    // the umbra is 1, the penumbra falls off, and no sqrt is needed anywhere.
    for (let y = y0; y <= y1; y++) {
      const wy = y - ay, row = y * WIDTH;
      for (let x = x0; x <= x1; x++) {
        const wx = x - ax;
        let tt = (wx * sx + wy * sy) * invl2;
        if (tt < 0) tt = 0; else if (tt > 1) tt = 1;
        const qx = wx - sx * tt, qy = wy - sy * tt;
        const q2 = qx * qx + qy * qy;
        if (q2 >= out2) continue;
        let a;
        if (q2 <= in2) a = 1;
        else { const u = 1 - (q2 - in2) * inv; a = u * u * (3 - 2 * u); }
        const ii = row + x;
        if (a > occ[ii]) occ[ii] = a;   // umbras union; they do not add
      }
    }
  }
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;      // guard a stall from spiking the integrators
  occ.fill(0);

  // The lamp is hung, so it swings: the pool slides across the plaster and
  // every shadow swings the other way, by (s-1) times as much. Rate and
  // amplitude are noise-modulated and the rate never reaches zero, so it
  // never returns on the same phase.
  swing += (SWING_R + SWING_V * noise2(3.7, t * 0.05)) * dt;
  if (swing > 1e6) swing -= 1e6;
  const sw = Math.sin(swing);
  const amp = SW_X * (0.55 + 0.45 * (0.5 + 0.5 * noise2(19.4, t * 0.031)));
  Lx = LX0 + amp * sw + 1.4 * noise2(41.9, t * 0.043);
  Ly = LY0 - SW_Y * sw * sw;     // the bob rides higher at the extremes

  // Day for Night, smoothed: after dark the lamp is the only source and the
  // shadows go to black; by day the room fills them in.
  const day = clamp(input.clock.daylight, 0, 1);
  let gk = dt * 0.5; if (gk > 1) gk = 1;
  dayS += (day - dayS) * gk;
  const PK = lerp(0.84, 0.97, dayS);      // peak wall value
  const SD = lerp(0.955, 0.60, dayS);     // how deep a shadow is allowed to go
  const flick = 1 + 0.026 * Math.sin(t * 2.1) + 0.030 * noise2(61.2, t * 0.55);
  const vmul = PK * flick;

  // Walk them, and cast. A body that leaves simply comes back re-rolled from
  // the other end: the traffic past a lamp never stops, so the wall is never
  // bare (my Keeping Pace lesson - translation of the body IS the liveliness
  // budget; do not spend it on scenery).
  for (let i = 0; i < NB; i++) {
    const b = bodies[i];
    b.ph += b.cad * dt;
    if (b.ph > 1e6) b.ph -= 1e6;
    b.bx += b.dir * b.vb * dt;
    const Xc = Lx + (b.bx - Lx) * b.s;
    if (b.dir > 0 ? Xc > WIDTH + b.marg : Xc < -b.marg) newPass(i);
    cast(b);
  }

  // Rebuild the ramp only when the day has moved. Its dark end is cooler than
  // its lit end, so the penumbra reads as fill light rather than as a hole.
  const key = (dayS * 250) | 0;
  if (key !== palKey) {
    palKey = key;
    const hw = lerp(0.076, 0.107, dayS);       // lamplight
    const hs = lerp(0.600, 0.555, dayS);       // whatever fills a shadow
    for (let i = 0; i < PAL_N; i++) {
      const u = i / (PAL_N - 1);
      let m = u * 2.0; if (m > 1) m = 1;
      pal[i] = hsv(lerp(hs, hw, m), lerp(0.46, 0.11, u), u * u);
    }
  }

  // The wall. Row and column caches, so the falloff costs one add and one
  // multiply per pixel and no divide.
  for (let x = 0; x < WIDTH; x++) { const dx = x - Lx; dxq[x] = dx * dx; }
  for (let y = 0; y < HEIGHT; y++) { const dy = y - Ly; dyq[y] = dy * dy; }

  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    const dy2 = dyq[y] * YSQ;
    for (let x = 0; x < WIDTH; x++, i++) {
      let k = ((dy2 + dxq[x]) * QS) | 0;
      if (k > LN - 1) k = LN - 1;
      const v = LT[k] * tex[i] * vmul * (1 - occ[i] * SD);
      let pi = (v * 255) | 0;
      if (pi < 0) pi = 0; else if (pi > 255) pi = 255;
      setPixel(x, y, pal[pi]);
    }
  }
}
