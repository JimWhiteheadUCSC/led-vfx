/*@vfx
id: 816f507e-3e27-42da-ae7f-eb70e1361e9b
title: Two Hands, Pretending
created: 2026-07-31
artist: Saccade (apprentice name)
lineage:
  - id: 959b82f7-5cf2-4dd1-8275-79b77fac9a63
    relation: variation
    note: >-
      Between the Lamp and the Wall built a room - a hung lamp, a lit
      wall, bodies rendered only as the light that failed to arrive -
      and its note named a candidate it did not build: "the shadow of
      something we never identify (a hand, a bird made of hands - the
      domestic shadow-puppet)." This is that piece. Same wall, same
      lamp, same physics. The people who crossed the pool are gone;
      only somebody's hands are left, up in the light, lying.
  - id: 0943e26a-b214-4d0b-af66-fbf336d5b909
    relation: contrast
    note: >-
      Keeping Pace, and every figure before it, was honest: a real body
      synthesized joint by joint, asking only whether you could read it.
      This one lies. There is no bird anywhere in this program - there
      are two hands, and the bird is a claim they are making. Campbell's
      threshold moves off legibility and onto identity: not how few
      pixels before a body stops being a body, but how few before
      something that is not a bird becomes one, and what happens in the
      second when the hands come apart and it stops.
influences: [jim-campbell]
rationale: |
  A lamp, a wall, and someone's hands held up in the light. They are
  crossed at the wrists with the fingers splayed, and on the plaster
  that arrangement is a bird: a body, a beak, two wings of four feathers
  each, flying slowly from one side of the pool of light to the other.
  Nothing on this panel is a bird. What is drawn is eight fingers, two
  palms and two forearms running down out of the light, and what you
  read is a bird.

  Every figure I have made was honest - a walker, a swimmer, a faller,
  two people keeping step - a real body built joint by joint, asking
  only the one question Campbell asks: can you still read it. This asks
  a different one. The information here is not degraded, it is
  fraudulent, and the wager is that a fraud holds at exactly the same
  threshold a body does: it survives on motion. The wingbeat is what
  makes it a bird. Freeze the panel and it is a splayed hand with a
  thumb; let it beat twice and nobody sees hands at all.

  So the piece is built around the moment the lie fails. The bird flies
  to the edge of the light and has to come back, and a shadow puppet
  cannot simply turn around - the hands must rotate. They go edge-on,
  and for half a second the whole creature is a blade of dark with
  nothing in it, and then it opens out the other way. Usually it opens
  as a bird again. Sometimes the hands lose it: they come apart, and
  there they are, two hands, fingers opening and closing, obviously and
  only hands - and then they find each other and it is a bird again,
  flying the other way. You cannot un-see the hands and it does not
  matter. The bird comes back anyway. That is the whole subject.

  The lamp is hung and swings a little, so the pool slides on the wall
  and the shadow swings the other way; the hands tremble the way held
  hands do, because nobody can hold anything still. After dark the lamp
  is the only source and the bird is black; by day the room fills in
  behind it and it softens to a grey suggestion, the way a shadow in a
  lit room barely commits.
@vfx*/

// two_hands_pretending - buffer mode, Campbell lineage.
//
// The panel is a WALL. An off-frame lamp of radius RL hangs at distance
// D and swings; a pair of hands is held in a plane at depth d, and the
// only thing this program computes is how much of the lamp each wall
// pixel can still see. Geometry (wall z=0, lamp z=-D, hands z=-d):
//   s = D/(D-d)              magnification
//   X = Lx + (x-Lx)*s        any point of the hands, onto the wall
//   p = RL*(s-1)             penumbra half-width
// Calibration inherited from Between the Lamp and the Wall, and it is
// the binding constraint here: a limb stays legible only while
// r*BS*s > p. Fingers are thin, so this piece uses a SMALLER lamp
// (RL 1.15 vs 1.90) and a shallower depth - otherwise the penumbra eats
// the 1px finger cores and the wings fuse into one wedge (measured: they
// did, at the old numbers).
//
// The puppet is 15 capsules - body, tail, neck, two beak segments, eight
// fingers, two forearms - each of which is a straight lerp between a
// BIRD pose and a HANDS pose under one scalar `form`. Body units are
// scaled so that one unit is about one wall pixel (BS*S_MID ~ 1.0),
// which is the only way to reason about the ~3px legibility floor while
// authoring blind.
//
// Motion, in order of how much it matters:
//   - the flight. The bird crosses the lit pool at 2.8-4.4 px/s. My
//     Keeping Pace lesson (translation of the body IS the liveliness
//     budget) applies exactly: a puppet held still measured 0.017-0.022
//     mean-per-pixel temporal std, under my known-passing floor; flying
//     it took the median to 0.046.
//   - the wingbeat, 0.70-1.0 Hz, amplitude on a slow noise envelope with
//     a floor (never near-still), plus bounding flight - the body rises
//     on the downstroke.
//   - the TURN at each end of the pool. The hands rotate about the
//     vertical axis: local x is scaled by cos(pi*u), so the puppet goes
//     edge-on and opens out mirrored. This is not decoration - mirroring
//     instantaneously measured a frame-mean jump of 0.034, six times my
//     worst piece; turning through zero measures 0.004.
//   - the SLIP. 38% of turns fumble: `form` falls to ~0.12, the hands
//     are plainly hands for about a second, fingers flexing, and then
//     re-form. The flex matters - static hands during a slip froze the
//     panel, which was both a liveliness failure and a dramatic one,
//     since the slip should be the most alive moment in the piece.
//   - the lamp's swing, the held-hand tremor, an occasional call (the
//     beak opens on a decaying timer).
//
// Attractors (knowledge/craft/attractors.md): nothing accumulates - the
// occlusion field is wiped every frame - and nothing contracts. The
// configuration rides independent never-settling drifts (swing rate,
// wingbeat rate and amplitude, altitude, depth, tremor) plus a coin
// flipped at every turn, so minute forty is a different flight with a
// different pattern of failures.
//
// input.clock.daylight: night = lamp-only, the bird goes black; day =
// the room fills, it softens to grey. Smoothed, so the harness's
// time-warped clock ramps rather than flashes.
//
// Measured offline (node/python port of this exact math with the
// prelude's simplex noise ported verbatim - my standard de-risking
// method, requiring the candidate to beat known-passing references on
// the SAME metric): mean-per-pixel temporal std over sliding 2s windows
// across 300s runs, 3 seeds: median 0.046, p10 0.031-0.036, min 0.020
// (references: Saccades-PASS 0.030, Lengths 0.041, Long Fall 0.048);
// median 0.050 at daylight 0 and 0.040 at daylight 1 (graceful
// degradation measured, not asserted); max frame-mean jump 0.0050 (no
// strobing); 58-65% dark ground, 21% bright.

const meta = { name: "two_hands_pretending", fps: 30, inputs: ["clock"] };

const TAU = Math.PI * 2;

// --- the room ---------------------------------------------------------------
const D = 45.0, D2 = D * D;
const RL = 1.15;                // the lamp's RADIUS: the penumbra generator
const LX0 = 31.5, LY0 = 24.0;
const SW_X = 6.0, SW_Y = 1.8;
const SWING_R = 0.42, SWING_V = 0.14;    // swing rate (rad/s), always > 0

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

// --- the puppet -------------------------------------------------------------
const NCAP = 15;
const BS = 0.74;                       // body units -> hand-plane px
const S_MID = 1.36, S_AMP = 0.10;      // depth, breathing
const FLAP = 1.00, FA_MEAN = -0.70, FB_MEAN = -0.50;
const FL_BASE = TAU * 0.70, FL_SWING = TAU * 0.30;
const F_R = 1.05;                      // finger radius (units)
const FLEX_A = 0.95;                   // how far loose fingers open and close
const TRM_A = 0.62;                    // held-hand tremor
const BOUND = 4.2;                     // bounding flight: rise on the downstroke
const XLO = 19.0, XHI = 44.0;          // how far across the pool it flies
const V_LO = 2.8, V_HI = 4.4;          // px/s
const SLIP_DUR = 3.6, BANK_DUR = 1.6;  // a fumbled turn / a clean one
const TFRAC = 0.45;                    // fraction of a slip spent turning
const BANK = 0.60, P_DEEP = 0.38;      // bank angle; chance a turn fumbles

// Baked capsules, bird pose then hands pose: x0,y0,x1,y1,r.
const BC = [
  -2.0, 0.0, 4.5, 1.0, 2.10,        // body: the joined palms
   4.5, 1.0, 9.0, 2.6, 1.25,        // tail: the heels of the hands
  -1.6, -0.6, -6.6, -3.0, 1.35,     // neck: the crossed thumbs
  -6.6, -3.0, -10.0, -3.4, 0.95,    // head
 -10.0, -3.4, -13.0, -2.8, 0.55,    // beak
   0.6, 2.6, -5.0, 30.0, 1.70,      // forearms, running out of the light
   2.4, 2.9, 10.5, 30.0, 1.55];
const HC = [
  -8.5, 1.8, -7.0, -2.0, 1.90,      // left palm
   7.0, 2.4, 8.5, -1.2, 1.90,       // right palm
  -9.8, 0.6, -13.5, -1.8, 0.95,     // left thumb
   5.4, 1.4, 2.2, -1.0, 0.90,       // right thumb
 -13.5, -1.8, -15.2, -2.8, 0.60,
  -8.0, 3.0, -13.5, 30.0, 1.70,
   7.6, 3.4, 13.0, 30.0, 1.55];

// Fingers: roots, lengths, and (bird) angular splay / (hands) fixed angles.
const FA_RX = [-0.5, 1.0, 2.6, 4.2], FA_RY = [-1.4, -1.6, -1.5, -1.1];
const FA_L = [12.5, 14.5, 13.5, 10.5], FA_SP = [-0.85, -0.28, 0.28, 0.85];
const FB_RX = [-1.2, 0.4, 2.0, 3.6], FB_RY = [0.7, 0.6, 0.7, 1.0];
const FB_L = [10.5, 12.5, 11.5, 9.0], FB_SP = [-0.78, -0.26, 0.26, 0.78];
const HA_RX = [-10.2, -8.6, -7.0, -5.4], HA_RY = [-2.0, -2.4, -2.3, -1.8];
const HA_L = [9.5, 11.0, 10.5, 8.5], HA_A = [-2.05, -1.79, -1.52, -1.25];
const HB_RX = [4.4, 6.0, 7.6, 9.2], HB_RY = [-1.6, -1.9, -1.8, -1.3];
const HB_L = [9.0, 10.5, 10.0, 8.0], HB_A = [-1.92, -1.70, -1.45, -1.20];

// --- pose scratch (no per-frame allocation) ---------------------------------
const lax = new Float64Array(NCAP), lay = new Float64Array(NCAP);
const lbx = new Float64Array(NCAP), lby = new Float64Array(NCAP);
const lrr = new Float64Array(NCAP);

// --- state (top-level persists for the program's life) ----------------------
let Lx = LX0, Ly = LY0;
let swing = 0, flapPh = 0, handPh = 0;
let form = 1, dir = 1;
let evPh = -1, evDur = SLIP_DUR, evDeep = 0, evTurned = 1, bsgn = 1;
let tx = 31.5, vx = 3.2;
let callT = 5, callA = 0;
let dayS = 0.5;
let started = false;

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
  // not a gradient. Sampled once at load, and never again.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const n = noise2((x >> 1) * 0.19, (y >> 1) * 0.19);
      tex[y * WIDTH + x] = 0.93 + 0.07 * (0.5 + 0.5 * n);
    }
  }
  swing = Math.random() * TAU;
  flapPh = Math.random() * TAU;
  handPh = Math.random() * TAU;
  dir = Math.random() < 0.5 ? 1 : -1;
  tx = 24.0 + Math.random() * 15.0;
  vx = (Math.random() < 0.5 ? 1 : -1) * (V_LO + Math.random() * (V_HI - V_LO));
  started = true;
}

// The whole creature, in body units, wrists at the origin. Every capsule is
// one lerp between what the hands ARE and what they are pretending to be.
function pose(f, p, env, bo, tilt, hp) {
  const flex = 1 - f;
  for (let k = 0; k < 7; k++) {
    const j = k * 5;
    lax[k] = lerp(HC[j], BC[j], f);
    lay[k] = lerp(HC[j + 1], BC[j + 1], f);
    lbx[k] = lerp(HC[j + 2], BC[j + 2], f);
    lby[k] = lerp(HC[j + 3], BC[j + 3], f);
    lrr[k] = lerp(HC[j + 4], BC[j + 4], f);
  }
  // The call: the beak opens, hinged on the head.
  if (bo > 0.001) {
    const c = Math.cos(bo), sn = Math.sin(bo);
    const dx = lbx[4] - lax[4], dy = lby[4] - lay[4];
    lbx[4] = lax[4] + dx * c - dy * sn;
    lby[4] = lay[4] + dx * sn + dy * c;
  }
  const aA = FA_MEAN + FLAP * env * Math.sin(p);
  const aB = FB_MEAN + FLAP * 0.82 * env * Math.sin(p - 0.32);
  for (let k = 0; k < 4; k++) {
    // near wing / left hand
    let ang = aA + FA_SP[k];
    const bx1 = FA_RX[k] + Math.cos(ang) * FA_L[k];
    const by1 = FA_RY[k] + Math.sin(ang) * FA_L[k];
    let ha = HA_A[k] + flex * FLEX_A * Math.sin(hp + k * 0.55);
    let i = 7 + k;
    lax[i] = lerp(HA_RX[k], FA_RX[k], f);
    lay[i] = lerp(HA_RY[k], FA_RY[k], f);
    lbx[i] = lerp(HA_RX[k] + Math.cos(ha) * HA_L[k], bx1, f);
    lby[i] = lerp(HA_RY[k] + Math.sin(ha) * HA_L[k], by1, f);
    lrr[i] = F_R;
    // far wing / right hand
    ang = aB + FB_SP[k];
    const cx1 = FB_RX[k] + Math.cos(ang) * FB_L[k];
    const cy1 = FB_RY[k] + Math.sin(ang) * FB_L[k];
    ha = HB_A[k] + flex * FLEX_A * Math.sin(hp * 0.87 + 2.1 + k * 0.55);
    i = 11 + k;
    lax[i] = lerp(HB_RX[k], FB_RX[k], f);
    lay[i] = lerp(HB_RY[k], FB_RY[k], f);
    lbx[i] = lerp(HB_RX[k] + Math.cos(ha) * HB_L[k], cx1, f);
    lby[i] = lerp(HB_RY[k] + Math.sin(ha) * HB_L[k], cy1, f);
    lrr[i] = F_R * 0.95;
  }
  // The wrists roll: the bird tilts with its beat, loose hands turn over,
  // and a turning puppet banks. One rotation about the origin does all three.
  if (tilt > 1e-4 || tilt < -1e-4) {
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    for (let k = 0; k < NCAP; k++) {
      let x = lax[k], y = lay[k];
      lax[k] = x * c - y * sn; lay[k] = x * sn + y * c;
      x = lbx[k]; y = lby[k];
      lbx[k] = x * c - y * sn; lby[k] = x * sn + y * c;
    }
  }
}

// Project the posed hands onto the wall and rasterize their occlusion. The
// penumbra p is shared by the whole silhouette (the hands are planar), so
// the creature is coherently soft or coherently crisp. `xs` carries both the
// facing and the turn: it passes through zero as the hands go edge-on.
function cast(bx, by, s, xs) {
  const p = RL * (s - 1);
  for (let k = 0; k < NCAP; k++) {
    const ax = Lx + (bx + xs * lax[k] * BS - Lx) * s;
    const ay = Ly + (by + lay[k] * BS - Ly) * s;
    const ex = Lx + (bx + xs * lbx[k] * BS - Lx) * s;
    const ey = Ly + (by + lby[k] * BS - Ly) * s;
    const R = lrr[k] * BS * s;
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
    // umbra 1, penumbra falling off, and no sqrt anywhere in the hot loop.
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
  // the shadow swings the other way. Rate noise-modulated, never zero, so it
  // never returns on the same phase.
  swing += (SWING_R + SWING_V * noise2(3.7, t * 0.05)) * dt;
  if (swing > 1e6) swing -= 1e6;
  const sw = Math.sin(swing);
  const amp = SW_X * (0.6 + 0.4 * (0.5 + 0.5 * noise2(19.4, t * 0.031)));
  Lx = LX0 + amp * sw + 1.1 * noise2(41.9, t * 0.043);
  Ly = LY0 - SW_Y * sw * sw;

  // How far out the hands are held: bigger and softer near the lamp.
  const s = S_MID + S_AMP * noise2(77.1, t * 0.028);

  // The wingbeat. Rate and amplitude drift independently on noise, and both
  // have floors - a beat that can stall is a piece that can freeze.
  let env = 0.62 + 0.38 * (0.5 + 0.5 * noise2(5.1, t * 0.07));
  flapPh += (FL_BASE + FL_SWING * (0.5 + 0.5 * noise2(23.6, t * 0.05))) * dt;
  if (flapPh > 1e6) flapPh -= 1e6;
  handPh += (2.05 + 0.7 * (0.5 + 0.5 * noise2(5.5, t * 0.09))) * dt;
  if (handPh > 1e6) handPh -= 1e6;

  // The turn. A shadow puppet cannot simply face the other way: the hands
  // rotate about the vertical axis, so local x is scaled by cos(pi*u) and
  // passes through zero - the creature goes edge-on, a blade of dark, and
  // opens out mirrored. Some turns fumble (P_DEEP) and the shape falls apart
  // into what it has been all along.
  let mx = 1, fold = 0, bump = 0, bank = 0;
  if (evPh >= 0) {
    evPh += dt;
    const u = evPh / evDur;
    if (u >= 1) {
      evPh = -1;
      dir = -dir;
    } else {
      const tf = evDeep ? TFRAC : 1.0;
      let ut = u / tf; if (ut > 1) ut = 1;
      mx = Math.cos(Math.PI * ut);
      fold = Math.sin(Math.PI * ut);
      bank = fold * BANK * bsgn;
      if (evDeep) bump = smoothstep(0.26, 0.44, u) * (1 - smoothstep(0.66, 1.0, u));
      if (!evTurned && ut >= 0.5) {
        evTurned = 1;
        vx = (vx > 0 ? -1 : 1) * (V_LO + Math.random() * (V_HI - V_LO));
      }
    }
  } else if ((vx > 0 && tx > XHI) || (vx < 0 && tx < XLO)) {
    evPh = 0; evTurned = 0;
    evDeep = Math.random() < P_DEEP ? 1 : 0;
    evDur = evDeep ? SLIP_DUR : BANK_DUR;
    bsgn = vx > 0 ? -1 : 1;
  }
  const xs = dir * mx;

  let fk = dt * 3.0; if (fk > 1) fk = 1;
  form += ((1 - 0.90 * bump) - form) * fk;
  env *= (1 - 0.72 * fold);              // the wings fold through the turn
  tx += vx * (0.30 + 0.70 * (1 - fold)) * dt;
  if (tx < XLO - 1.5) tx = XLO - 1.5;
  if (tx > XHI + 1.5) tx = XHI + 1.5;

  // Now and then it calls, and the beak opens.
  callT -= dt;
  if (callT <= 0) { callT = 7 + Math.random() * 14; callA = 1; }
  callA *= Math.exp(-dt / 0.45);

  // Nobody can hold anything still.
  const trx = TRM_A * (Math.sin(t * 5.3) * 0.55 + noise2(131.7, t * 1.15));
  const tryy = TRM_A * (Math.sin(t * 4.1 + 1.3) * 0.55 + noise2(157.3, t * 0.97));
  const wx = tx + trx;
  const wy = 25.5 + 5.2 * noise2(9.3, t * 0.055) - BOUND * Math.sin(flapPh) * form + tryy;
  // Aim the shadow: invert the projection about the lamp's rest position, so
  // the hands stay put and the swinging lamp still slides the shadow.
  const hx = LX0 + (wx - LX0) / s, hy = LY0 + (wy - LY0) / s;

  const tilt = (0.15 * env * Math.sin(flapPh + 0.9) + 0.10 * noise2(88.3, t * 0.04)) * form
             + 0.34 * Math.sin(handPh * 0.62) * (1 - form) + bank;
  pose(form, flapPh, env, 0.38 * callA * form, tilt, handPh);
  cast(hx, hy, s, xs);

  // Day for Night, smoothed: after dark the lamp is the only source and the
  // bird goes black; by day the room fills it in.
  const day = clamp(input.clock.daylight, 0, 1);
  let gk = dt * 0.5; if (gk > 1) gk = 1;
  dayS += (day - dayS) * gk;
  const PK = lerp(0.84, 0.97, dayS);      // peak wall value
  const SD = lerp(0.955, 0.60, dayS);     // how deep a shadow may go
  const flick = 1 + 0.026 * Math.sin(t * 2.1) + 0.030 * noise2(61.2, t * 0.55);
  const vmul = PK * flick;

  // Rebuild the ramp only when the day has moved. Its dark end is cooler than
  // its lit end, so the penumbra reads as fill light and not as a hole.
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
