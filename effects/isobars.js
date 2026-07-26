/*@vfx
id: ba92f871-53da-47e9-a7e9-64c5e313510f
title: Isobars
created: 2026-07-20
artist: Saccade (apprentice name)
lineage:
  - id: d2c57303-5cf6-4e2b-99e9-0d587b2e01c2
    relation: variation
    note: >-
      Another realization of Molnar's living-parameter method, taken from
      (Des)Ordres instead of Saccades. There the BREAKS breathed and the
      lines held still; here the whole LINE breathes, trembles, and drifts.
      Same wager - animate the parameter, not the element - carried a step
      deeper: the deviation is no longer placed once, it is continuously lived.
influences: [vera-molnar]
rationale: |
  Vera Molnar's (Des)Ordres are nested squares, each drawn a little
  differently - the order still legible through the tremor, her one-percent
  disorder set against a rigid rule. On paper that tremble was frozen at plot
  time. But this panel is light, and light keeps no grain to hold a still
  mark: a perfectly motionless line reads as switched-off, not as drawn. So
  here the line is never still. A constant sub-pixel hand-tremor keeps every
  edge alive (her "Lettres a ma mere" warmth), a slow breath carries the whole
  nest between order and disorder, and a soft luminance pulse travels inward
  through the rings. The outermost square is the calm frame; the disorder
  concentrates toward the core, where the heart of the figure trembles most.

  I read the nest as isobars - concentric contours around a center of pressure
  - and I let the actual weather do the disturbing. input.env is the pressure
  gradient: a clear, high-pressure day lets the squares settle nearly true;
  cloud and rain buckle them and tinge the cool ink toward violet, and the
  center of pressure slowly drifts the way a weather system crosses a map.
  With no station reporting, it breathes on its own - the room's barometer
  written into a lattice. Where my Saccades let the BREAKS breathe, here the
  whole LINE breathes: Molnar's one percent relocated from space into time, a
  disturbance that passes rather than a deviation placed once and fixed.
@vfx*/

// isobars - buffer mode, Molnar-lineage (Des)Ordres.
// A single nest of concentric squares, each ring an 8-point closed contour
// (4 corners + 4 edge-mids) jittered by noise into a trembling line and
// sub-pixel-splatted onto black. A base hand-tremor is always present (a
// still line reads as off); a breathing disorder scalar, a per-ring
// luminance pulse, a gentle scale breath, and a slowly wandering center
// keep it alive. input.env (cloud + rain) raises the disorder - the weather
// warps the contours; at neutral it breathes autonomously.

const meta = { name: "isobars", fps: 30, inputs: ["env"] };

const CX0 = 31.5, CY0 = 31.5;
const NSQ = 6, HS0 = 4, HSTEP = 5;        // half-sides 4,9,14,19,24,29

const BASE_TREMOR = 0.35;                 // constant hand-tremble, always on (px)
const DIS_AMP = 1.9;                      // extra corner displacement at full disorder (px)
const J_SPEED = 0.28;                     // how fast the tremor wanders

const W_BREATH = 2 * Math.PI / 17;        // order<->disorder breathing (~17s)
const W_SHIM = 2 * Math.PI / 6;           // luminance pulse period (~6s)
const BREATH_MID = 0.68, BREATH_AMP = 0.32; // pulse depth (v multiplier 0.36..1.0)
const PHASE_STEP = 1.1;                   // per-ring phase -> the pulse travels
const W_SCALE = 2 * Math.PI / 13;         // gentle whole-nest scale breath
const SCALE_AMP = 0.03;
const WANDER_R = 4.0;                      // the pressure center drifts (px)
const WC1 = 2 * Math.PI / 37, WC2 = 2 * Math.PI / 29;

const HUE_CALM = 0.60, HUE_DIS = 0.72;    // disturbance colours the line
const SAT_CALM = 0.10, SAT_DIS = 0.34;
const VAL = 0.85;

// Eight boundary points per square (unit offsets * half-side): corners + edge mids.
const BX = [-1, 0, 1, 1, 1, 0, -1, -1];
const BY = [-1, -1, -1, 0, 1, 1, 1, 0];

// Float RGB accumulation surface: clean anti-aliased summation, quantized once.
const fr = new Float32Array(WIDTH * HEIGHT);
const fg = new Float32Array(WIDTH * HEIGHT);
const fb = new Float32Array(WIDTH * HEIGHT);

// Reused per-ring point buffers (no per-frame allocation).
const ptx = new Float64Array(8);
const pty = new Float64Array(8);

function addPix(x, y, r, g, b) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const i = y * WIDTH + x;
  fr[i] += r; fg[i] += g; fb[i] += b;
}

// Bilinear (sub-pixel) deposit - Campbell diffusion, so the line reads smooth.
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

function seg(x0, y0, x1, y1, r, g, b) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  const inv = 1 / steps;
  for (let k = 0; k <= steps; k++) {
    const u = k * inv;
    splat(x0 + dx * u, y0 + dy * u, r, g, b);
  }
}

function render(t, dt) {
  fr.fill(0); fg.fill(0); fb.fill(0);

  // Weather is the pressure that warps the contours. env off -> calm (neutral).
  const env = input.env;
  const envD = env.ok ? clamp(0.55 * env.rain + 0.45 * env.cloud, 0, 1) : 0;
  const dCenter = lerp(0.30, 0.85, envD);
  const D = clamp(dCenter + 0.25 * Math.sin(t * W_BREATH), 0, 1);

  const gscale = 1 + SCALE_AMP * Math.sin(t * W_SCALE);
  const cx = CX0 + WANDER_R * Math.sin(t * WC1);            // the system drifts
  const cy = CY0 + WANDER_R * 0.7 * Math.sin(t * WC2 + 1.3);

  for (let k = 0; k < NSQ; k++) {
    const hs = (HS0 + k * HSTEP) * gscale;
    // The frame holds; the core trembles: disorder grows toward the centre.
    const innerness = 1 - k / (NSQ - 1);
    const factor = lerp(0.45, 1.15, innerness);
    const amp = BASE_TREMOR + DIS_AMP * D * factor;

    // A slow luminance pulse, phase-shifted per ring so it travels the nest.
    const breath = BREATH_MID + BREATH_AMP * Math.sin(t * W_SHIM + k * PHASE_STEP);
    const localDis = clamp(D * factor, 0, 1);
    const v = VAL * breath;
    const c = hsv(lerp(HUE_CALM, HUE_DIS, localDis),
                  lerp(SAT_CALM, SAT_DIS, localDis),
                  v * v);                                    // perceptual curve
    const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;

    // Eight jittered boundary points -> a trembling closed contour.
    for (let p = 0; p < 8; p++) {
      const nx = noise2(k * 13.1 + p * 3.7, t * J_SPEED);
      const ny = noise2(k * 13.1 + p * 3.7 + 64.5, t * J_SPEED);
      ptx[p] = cx + BX[p] * hs + nx * amp;
      pty[p] = cy + BY[p] * hs + ny * amp;
    }
    for (let p = 0; p < 8; p++) {
      const q = (p + 1) & 7;
      seg(ptx[p], pty[p], ptx[q], pty[q], cr, cg, cb);
    }
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
