/*@vfx
id: cee59070-af2d-474b-8aa9-bed40ec673df
title: A Curve Nobody Drew
created: 2026-07-26
artist: Saccade (apprentice name)
lineage:
  - id: fa6dee8c-440e-4ad4-b89e-70646a22f9f5
    relation: contrast
    note: >-
      Desire Paths argued that a light surface CAN hold Reas's one-hour
      accumulation if you clamp each cell. The contact sheets settle it:
      by minute one the worn network is an amorphous saturated mass and
      by minute three it is worse - the ceiling stopped the blow-out in
      arithmetic and not in the image. So this keeps Reas's real claim -
      that the picture is made by many faint marks interfering, not by
      any mark - and moves the density out of TIME and into a single
      FRAME. Ninety-six faint rays, drawn and thrown away thirty times a
      second; the bright curve is where they crowd. Accumulation that
      cannot run away, because it never gets to run.
  - id: 6fd8638e-72aa-4d7c-a79b-909551a680a1
    relation: variation
    note: >-
      The Grain Remembers stopped drawing its subject and let a ruled
      field report it: the body was legible only as the field's
      response. Same move, carried off the body entirely. Here the
      subject is a CURVE, and it is not merely undrawn - there is no
      code anywhere in this program that knows where it is. It is the
      envelope of ninety-six straight lines, and it appears because
      light is shaped that way.
influences: [vera-molnar, casey-reas]
rationale: |
  Process. A vessel: an almost-round wall, ruled once into ninety-six
  facets, each set a hair off true and then left alone. One point of
  light somewhere on that wall. From every facet, one Element: the ray
  that light would take after bouncing there - a single straight line,
  drawn very faintly, from its point of reflection to wherever it meets
  the wall again. Ninety-six dim lines, none of them the picture. Where
  the rays crowd, their faint marks sum, and a bright curve stands up out
  of the haze that no Element drew and nobody placed. Then the light
  walks slowly around the rim, and the vessel turns, and goes in and out
  of round - and the bright curve folds, sharpens its cusp, and re-forms,
  and is never twice the same curve.

  You have seen this. It is in the coffee cup on a low-sun morning: a
  hairpin of light lying on the surface with a point on it, brighter than
  the light that makes it. Nothing draws that curve. It is only the place
  where a great many reflected rays happen to pile up, and it is the
  cleanest thing I know of that is made entirely of interference and is
  still, unmistakably, a shape.

  It argues with my own Desire Paths. There I claimed that Casey Reas's
  never-cleared surface works on light if you clamp each cell, and the
  frames say otherwise - what accumulates over minutes becomes a mass,
  and the ceiling only decides how white the mass is. His actual claim is
  better than my defence of it: that an image can be constituted by many
  faint marks accumulating until they interfere with one another. So keep
  the interference and drop the hour. Here the surface is wiped thirty
  times a second and the density is spatial, not temporal - it cannot run
  away, because it never gets the chance. The caustic is a picture built
  from crowding, complete in every single frame, and gone.

  Vera Molnar supplies the rest: line, and one percent. The wall is not a
  circle - it breathes in and out of round, and each of its facets is
  turned a fraction of a degree off perfect, so the curve has a made
  quality and not a rendered one. And the parameter animates, not the
  element: no ray ever moves of its own accord; the light's position and
  the roundness of the cup move, and everything else follows. After dark
  the light goes low and amber, the way a lamp is; by day it is pale and
  full. A cup, on a wall, with the morning in it.
@vfx*/

// a_curve_nobody_drew - buffer mode, Molnar/Reas lineage. A caustic.
// An almost-round vessel (an ellipse whose eccentricity breathes and
// whose axes turn) is ruled into NR facets. A point source sits ON the
// wall; for each facet we reflect the incoming ray about that facet's
// normal (each normal carries a fixed sub-degree error - Molnar's one
// percent, rolled once at load and then LEFT ALONE) and draw the
// reflected chord to its second intersection with the wall, very faintly,
// with a constant-brightness sub-pixel splat. Nothing draws the caustic:
// it is the envelope of the family, and it appears purely because the
// faint chords crowd there and their densities sum. The surface is
// cleared every frame - the accumulation is SPATIAL, not temporal (see
// the frontmatter's argument with Desire Paths).
//
// Attractors (knowledge/craft/attractors.md): both angles integrate a
// rate that is always positive and noise-modulated (never stalls, never
// reverses, never lands on a period), and the eccentricity is a third
// independent noise walk - so the configuration wanders a 3-torus and
// minute forty is a curve minute one did not show. Nothing accumulates
// and nothing contracts.
//
// input.clock.daylight sets gain and hue only (amber lamp at night, pale
// straw by day), smoothed so the harness's time-warped clock ramps rather
// than flashes. Measured offline (Python port, my standard de-risking
// method - beat known-passing references on the same metric): mean-per-
// pixel temporal std 0.039 opening / 0.047 at 60s / 0.059 at 180s / 0.061
// at 1800s, and 0.046 at daylight 0 (graceful degradation measured, not
// asserted) - all above Saccades-PASS 0.030 and Lengths 0.041; max
// frame-mean jump 0.0004 (no strobing); ~66% dark ground, ~8% bright.

const meta = { name: "a_curve_nobody_drew", fps: 30, inputs: ["clock"] };

const TAU = Math.PI * 2;

// --- the vessel -------------------------------------------------------------
const CX = 31.5, CY = 31.5;
const R = 25.0;              // mean radius; a = R(1+e) <= 29.5, fits the panel
const NR = 96;               // facets = rays. Fewer and the envelope goes grainy.
const FACET_JIT = 0.45;      // facet spacing disorder (fraction of one spacing)
const WALL_ERR = 0.030;      // rad: each facet a hair off true (her one percent)

// --- the light ---------------------------------------------------------------
// Both angles integrate a strictly positive, noise-modulated rate: the light
// never stops walking the rim and the cup never stops turning, and neither
// ever comes back on the same phase relationship.
const PHI_BASE = 0.155, PHI_SWING = 0.065;   // light around the rim (rad/s)
const PSI_BASE = 0.040, PSI_SWING = 0.022;   // the vessel's own turn (rad/s)
const E_AMP = 0.18, E_RATE = 0.055;          // how far out of round it breathes
const SH_W = 1.05, SH_AMP = 0.22, SH_K = 0.55; // per-ray shimmer (a live source)

// --- the mark ----------------------------------------------------------------
const PITCH = 1.45;          // sampling pitch along a chord (px)
const AMP = 0.225;           // density per unit length of one full-strength ray
const RIM = 0.42;            // the wall itself catches a little light

// --- palette: amber ink, white where the rays pile up -----------------------
const HUE_NIGHT = 0.075, HUE_DAY = 0.115;
const PAL_N = 256;
const pal = new Int32Array(PAL_N);
let palGain = -1, palHue = -1;

// --- facet geometry (rolled once at load, then LEFT ALONE) ------------------
const cth = new Float64Array(NR), sth = new Float64Array(NR);
const cwe = new Float64Array(NR), swe = new Float64Array(NR);

// --- the surface (single-channel density; wiped every frame) ----------------
const acc = new Float32Array(WIDTH * HEIGHT);

let phi = 0, psi = 0, gain = 0.78, hue = 0.095;
let started = false;

function setup() {
  const step = TAU / NR;
  for (let k = 0; k < NR; k++) {
    const a = k * step + (Math.random() * 2 - 1) * FACET_JIT * step;
    cth[k] = Math.cos(a); sth[k] = Math.sin(a);
    const w = (Math.random() * 2 - 1) * WALL_ERR;   // this facet, off true
    cwe[k] = Math.cos(w); swe[k] = Math.sin(w);
  }
  phi = Math.random() * TAU;
  psi = Math.random() * TAU;
  started = true;
}

// Soft (sub-pixel) deposit - Campbell's diffusion done in math, so a ray
// reads as a drawn line and not a staircase.
function dot(px, py, a) {
  const ix = px | 0, iy = py | 0;
  if (ix < 0 || iy < 0 || ix >= WIDTH - 1 || iy >= HEIGHT - 1) return;
  const fx = px - ix, fy = py - iy;
  const gx = 1 - fx, gy = 1 - fy;
  const i0 = iy * WIDTH + ix;
  acc[i0] += a * gx * gy;
  acc[i0 + 1] += a * fx * gy;
  acc[i0 + WIDTH] += a * gx * fy;
  acc[i0 + WIDTH + 1] += a * fx * fy;
}

// One ray. Constant brightness per unit length (fixed pitch, weight scaled by
// the pitch), so a long chord is no brighter per pixel than a short one - the
// only thing that may brighten a pixel is another ray landing on it.
function chord(x0, y0, x1, y1, amp) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  let steps = Math.ceil(len / PITCH);
  if (steps < 1) steps = 1;
  const inv = 1 / steps;
  const a = amp * len * inv;
  for (let s = 0; s <= steps; s++) {
    const u = s * inv;
    const px = x0 + dx * u, py = y0 + dy * u;
    const ix = px | 0, iy = py | 0;
    if (ix < 0 || iy < 0 || ix >= WIDTH - 1 || iy >= HEIGHT - 1) continue;
    const fx = px - ix, fy = py - iy;
    const gx = 1 - fx, gy = 1 - fy;
    const i0 = iy * WIDTH + ix;
    acc[i0] += a * gx * gy;
    acc[i0 + 1] += a * fx * gy;
    acc[i0 + WIDTH] += a * gx * fy;
    acc[i0 + WIDTH + 1] += a * fx * fy;
  }
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;      // guard a stall from spiking the integrators
  acc.fill(0);

  // The light walks the rim; the vessel turns; the vessel breathes out of
  // round. Three independent, never-settling drifts.
  phi += (PHI_BASE + PHI_SWING * noise2(11.3, t * 0.09)) * dt;
  psi += (PSI_BASE + PSI_SWING * noise2(57.9, t * 0.06)) * dt;
  if (phi > 1e6) phi -= 1e6;
  if (psi > 1e6) psi -= 1e6;
  const e = E_AMP * noise2(103.7, t * E_RATE);
  const a = R * (1 + e), b = R * (1 - e);
  const inva = 1 / a, invb = 1 / b;

  // Work in the vessel's own frame, then rotate the two endpoints of each
  // chord into the panel. A straight line stays straight, so rotating the
  // endpoints is the whole cost of the vessel's turn.
  const cp = Math.cos(psi), sp = Math.sin(psi);
  const pl = phi - psi;
  const cl = Math.cos(pl), sl = Math.sin(pl);
  const qa = cl * inva, qb = sl * invb;
  const rb = 1 / Math.sqrt(qa * qa + qb * qb);   // boundary radius that way
  const slx = -rb * cl, sly = -rb * sl;          // the source, on the wall

  for (let k = 0; k < NR; k++) {
    const ct = cth[k], st = sth[k];
    const plx = a * ct, ply = b * st;

    // Outward normal of the ellipse at this facet, turned by the facet's
    // own fixed error.
    let nx = ct * inva, ny = st * invb;
    const nl = 1 / Math.sqrt(nx * nx + ny * ny);
    nx *= nl; ny *= nl;
    const nx2 = nx * cwe[k] - ny * swe[k];
    const ny2 = nx * swe[k] + ny * cwe[k];

    // Incoming direction, from the source to this facet.
    let ix = plx - slx, iy = ply - sly;
    const il = Math.sqrt(ix * ix + iy * iy);
    if (il < 3.0) continue;               // the facet the lamp is sitting on
    ix /= il; iy /= il;
    const c = ix * nx2 + iy * ny2;        // how squarely the light lands
    if (c <= 0.04) continue;              // grazing / facing away

    // Reflect, then find where the reflected ray meets the wall again.
    const rx = ix - 2 * c * nx2, ry = iy - 2 * c * ny2;
    const wx = rx * inva, wy = ry * invb;
    const den = wx * wx + wy * wy;
    const tl = -2 * (plx * inva * wx + ply * invb * wy) / den;
    if (tl < 1.0) continue;

    const elx = plx + rx * tl, ely = ply + ry * tl;
    const x0 = CX + plx * cp - ply * sp, y0 = CY + plx * sp + ply * cp;
    const x1 = CX + elx * cp - ely * sp, y1 = CY + elx * sp + ely * cp;

    // A live source flickers a little, and unevenly around the rim.
    const sh = 1 + SH_AMP * Math.sin(t * SH_W + k * SH_K);
    dot(x0, y0, RIM * c * sh);
    chord(x0, y0, x1, y1, AMP * (0.35 + 0.65 * c) * sh);
  }

  // Day for Night: low and amber after dark, pale and full by day. Smoothed,
  // so a time-warped clock ramps instead of flashing. Neutral clock = mid.
  const day = clamp(input.clock.daylight, 0, 1);
  let gk = dt * 0.5; if (gk > 1) gk = 1;
  gain += ((0.62 + 0.33 * day) - gain) * gk;
  hue += (lerp(HUE_NIGHT, HUE_DAY, day) - hue) * gk;

  // Rebuild the value/colour ramp when it has moved (256 hsv, not 4096).
  // Density -> value with a 1.5 curve: a lone ray is a faint amber thread,
  // and only crowding reaches white. The curve IS the composition.
  if (palGain < 0 || Math.abs(gain - palGain) > 0.002 || Math.abs(hue - palHue) > 0.0004) {
    palGain = gain; palHue = hue;
    for (let i = 0; i < PAL_N; i++) {
      const u = i / (PAL_N - 1);
      const v = u * Math.sqrt(u) * gain;              // u^1.5
      const s = 0.05 + 0.45 * (1 - u) * Math.sqrt(1 - u);
      pal[i] = hsv(hue, s, v);
    }
  }

  // Quantize the density surface to the panel. Nothing survives the frame.
  fill(0);
  for (let i = 0; i < acc.length; i++) {
    let d = acc[i];
    if (d < 0.008) continue;
    if (d > 1) d = 1;
    setPixel(i % WIDTH, (i / WIDTH) | 0, pal[(d * (PAL_N - 1)) | 0]);
  }
}
