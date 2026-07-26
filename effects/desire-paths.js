/*@vfx
id: fa6dee8c-440e-4ad4-b89e-70646a22f9f5
title: Desire Paths
created: 2026-07-21
artist: Saccade (apprentice name)
lineage:
  - id: 47ef1bb7-0adf-4c82-9640-f94169b62088
    relation: contrast
    note: >-
      While Touching argued with Reas's never-cleared surface: a light
      panel that never clears only saturates to white, I said, so I made
      fading part of the drawing and the picture became a palimpsest of
      the last second of nearness. Desire Paths argues back. A per-cell
      brightness ceiling is the missing piece - with it, a light surface
      CAN accumulate for the whole hour without blowing out, so Reas's
      one-hour drawing becomes possible on light after all. And the mark
      changes: While Touching drew what passes BETWEEN bodies and let it
      fade (the air's short memory); this draws where bodies GO and lets
      it stay (the ground's long one).
influences: [casey-reas]
rationale: |
  Process. A field of Elements, each a walker with a chosen destination
  among a handful of waypoints. Behaviors: move in a straight line toward
  the destination (meandering only slightly); on arrival, choose another;
  and at every step deposit a faint mark on the surface. The surface is
  never cleared - marks accumulate toward a fixed per-cell ceiling - so
  ground crossed often grows bright and ground crossed rarely stays dark.
  No route is designed. Over the hour a network of luminous paths emerges,
  worn by collective habit, drawn by no single walker; the waypoints drift
  slowly, so the map keeps redrawing itself and never quite repeats.

  This is my own While Touching, contradicted. There I argued against
  Reas's never-cleared surface: a light panel that never clears only
  saturates to white and strains the wall, unlike paper, so I let the
  marks fade fast and the picture became the trace of the last second of
  nearness. Here I answer that objection. A per-cell brightness ceiling is
  the piece the argument was missing: clamp each cell and a light surface
  accumulates for the whole hour without ever blowing out - the saturation
  worry dissolves, and the one-hour drawing the Reas dossier describes
  (darkness to a built state, then wiped by the next piece) becomes
  possible on light. Where While Touching drew what passes BETWEEN bodies
  and let it fade, this draws where bodies GO and lets it stay: the air's
  short memory replaced by the ground's long one.

  It keeps Campbell's wager, moved from the second to the hour. No single
  frame holds the picture - freeze it early and you see only a few
  wandering lights and a faint stain - but across minutes the routes
  resolve; the meaning lives in accumulated motion, not the bitmap. Two
  timescales carry it: a bright, short-lived wake makes each walker
  present and keeps the opening alive from the first second (points of warm
  light meandering the dark), while beneath it the slow worn network
  builds. Near-monochrome, warm - worn earth glowing on black. Autonomous:
  emergence wants no conductor.
@vfx*/

// desire_paths - buffer mode, Reas-lineage Process / accumulation.
// Elements (walkers) move between slowly-drifting waypoints, depositing a
// faint mark at every step into a never-cleared surface that decays slowly
// and is CLAMPED to a per-cell ceiling - so heavily-travelled ground grows
// bright and lightly-travelled ground stays dark, and a network of worn
// luminous paths emerges over minutes without ever saturating to a wash.
// A second, short-decay buffer holds each walker's bright wake so the
// opening reads as alive (moving points of light) before the network
// exists. Near-monochrome warm; no inputs (emergence wants autonomy).
//
// Position (see frontmatter): this is my own While Touching contradicted -
// the per-cell ceiling answers that piece's objection that a light surface
// can only saturate, making Reas's one-hour accumulation drawing possible.

const meta = { name: "desire_paths", fps: 30 };

const TAU = Math.PI * 2;

// --- Elements: walkers wearing the ground ----------------------------------
const N_WALK = 22;
const SPD_MIN = 6.0, SPD_MAX = 11.0;   // px/s - the speed of patience
const ARRIVE = 1.8;                    // px: arrival radius -> choose new goal
const WOBBLE = 0.12;                   // slight meander of the approach (rad)

// --- Waypoints: slowly drifting attractors ---------------------------------
const N_WAY = 5;
const WP_INSET = 10;                   // keep routes on-panel
const WP_MINSEP = 22.0;                // spread the hubs so routes read
const WP_DRIFT = 4.5;                  // px drift amplitude (the map migrates)

// --- Surfaces: worn ground (long) + live wake (short) ----------------------
const accL = new Float32Array(WIDTH * HEIGHT);   // worn paths (memory ~1 min)
const accS = new Float32Array(WIDTH * HEIGHT);   // walkers' bright wake (~0.4 s)
const DECAY_L = 0.9994;                // slow: the ground remembers
const DECAY_S = 0.90;                  // fast: a short bright comet tail
const DEP_L = 0.010;                   // faint - only repeated passes brighten
const DEP_S = 1.1;                     // bright presence deposit
const CEIL = 1.0;                      // per-cell ceiling: light CAN accumulate
const SIGMA2_L = 2 * 0.62 * 0.62;      // tight worn line (Campbell diffusion)
const SIGMA2_S = 2 * 0.9 * 0.9;        // softer glow for the live light

// --- palettes: warm worn earth; brighter warm-white for the live wake ------
const PAL_N = 256;
const palL = new Int32Array(PAL_N);
const palS = new Int32Array(PAL_N);
for (let i = 0; i < PAL_N; i++) {
  const u = i / (PAL_N - 1);
  palL[i] = hsv(0.085, lerp(0.34, 0.08, u), u * u);                     // sand -> warm white
  palS[i] = hsv(0.11, lerp(0.22, 0.03, u), (0.35 + 0.65 * u) * u);      // brighter live light
}

// --- state (top-level persists for the program's life) ---------------------
const wbx = new Float64Array(N_WAY), wby = new Float64Array(N_WAY);   // drift base
const wfx = new Float64Array(N_WAY), wfy = new Float64Array(N_WAY);   // drift rate
const wpx = new Float64Array(N_WAY), wpy = new Float64Array(N_WAY);   // live position
const walk = [];
let started = false;

function setup() {
  // Waypoints: spread with a minimum separation (robust - always in-bounds,
  // even if the separation can't be met, the last candidate is used).
  for (let i = 0; i < N_WAY; i++) {
    let bx = 0, by = 0;
    for (let tr = 0; tr < 200; tr++) {
      bx = WP_INSET + Math.random() * (WIDTH - 1 - 2 * WP_INSET);
      by = WP_INSET + Math.random() * (HEIGHT - 1 - 2 * WP_INSET);
      let ok = true;
      for (let j = 0; j < i; j++) {
        const ddx = bx - wbx[j], ddy = by - wby[j];
        if (ddx * ddx + ddy * ddy < WP_MINSEP * WP_MINSEP) { ok = false; break; }
      }
      if (ok) break;
    }
    wbx[i] = bx; wby[i] = by;
    wfx[i] = TAU / (38 + Math.random() * 50);   // slow, incommensurate drift
    wfy[i] = TAU / (38 + Math.random() * 50);
  }
  for (let i = 0; i < N_WALK; i++) {
    walk.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      g: (Math.random() * N_WAY) | 0,
      spd: SPD_MIN + Math.random() * (SPD_MAX - SPD_MIN),
      seed: Math.random() * 1000,
    });
  }
  started = true;
}

// Soft (sub-pixel) splat into a surface - Campbell's diffusion in math.
function splat(acc, px, py, amp, s2) {
  const fx = Math.floor(px), fy = Math.floor(py);
  for (let yy = fy - 1; yy <= fy + 2; yy++) {
    if (yy < 0 || yy >= HEIGHT) continue;
    for (let xx = fx - 1; xx <= fx + 2; xx++) {
      if (xx < 0 || xx >= WIDTH) continue;
      const dx = xx - px, dy = yy - py;
      acc[yy * WIDTH + xx] += amp * Math.exp(-(dx * dx + dy * dy) / s2);
    }
  }
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;   // guard a stall from spiking the integrator

  // Waypoints drift slowly - the network keeps reorganizing over the hour.
  for (let i = 0; i < N_WAY; i++) {
    wpx[i] = wbx[i] + WP_DRIFT * Math.sin(t * wfx[i] + i * 1.7);
    wpy[i] = wby[i] + WP_DRIFT * Math.sin(t * wfy[i] + i * 2.3);
  }

  // Decay both surfaces (the worn ground slowly, the live wake quickly).
  for (let i = 0; i < accL.length; i++) { accL[i] *= DECAY_L; accS[i] *= DECAY_S; }

  // Elements: head toward the goal (meandering), deposit, re-choose on arrival.
  for (let w = 0; w < N_WALK; w++) {
    const e = walk[w];
    const gx = wpx[e.g], gy = wpy[e.g];
    let ang = Math.atan2(gy - e.y, gx - e.x);
    ang += WOBBLE * noise2(e.seed, t * 0.25);   // a little human wander
    const step = e.spd * dt;
    e.x += Math.cos(ang) * step;
    e.y += Math.sin(ang) * step;

    splat(accL, e.x, e.y, DEP_L, SIGMA2_L);     // wear the ground (faint)
    splat(accS, e.x, e.y, DEP_S, SIGMA2_S);     // the bright live wake

    const ddx = gx - e.x, ddy = gy - e.y;
    if (ddx * ddx + ddy * ddy < ARRIVE * ARRIVE) {
      let ng = (Math.random() * N_WAY) | 0;     // pick a new destination
      if (ng === e.g) ng = (ng + 1) % N_WAY;
      e.g = ng;
    }
    if (e.x < 0) e.x = 0; else if (e.x > WIDTH - 1) e.x = WIDTH - 1;
    if (e.y < 0) e.y = 0; else if (e.y > HEIGHT - 1) e.y = HEIGHT - 1;
  }

  // Quantize: the worn network as the base, the live wake as light on top.
  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++, i++) {
      let vL = accL[i];
      if (vL > CEIL) { vL = CEIL; accL[i] = CEIL; }   // enforce the ceiling
      let idx = (vL / CEIL * (PAL_N - 1)) | 0;
      if (idx < 0) idx = 0; else if (idx >= PAL_N) idx = PAL_N - 1;
      let c = palL[idx];

      const vS = accS[i];
      if (vS > 0.01) {
        let si = (vS >= 1 ? 1 : vS) * (PAL_N - 1) | 0;
        if (si < 0) si = 0; else if (si >= PAL_N) si = PAL_N - 1;
        const cs = palS[si];
        // Light sits on top of the worn ground (per-channel max).
        const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;
        const sr = (cs >> 16) & 255, sg = (cs >> 8) & 255, sb = cs & 255;
        c = rgb(cr > sr ? cr : sr, cg > sg ? cg : sg, cb > sb ? cb : sb);
      }
      setPixel(x, y, c);
    }
  }
}