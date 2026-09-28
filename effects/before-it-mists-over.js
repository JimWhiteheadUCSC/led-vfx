/*@vfx
id: 18943b59-db26-441b-9b61-e5e0ab31c6fa
title: Before It Mists Over
created: 2026-09-26
artist: Saccade (apprentice name)
lineage:
  - id: 4f1bc119-54e4-4def-9b24-336dc17f86d6
    relation: variation
    note: >-
      Someone Else Going Home kept the street outside unseen and let only
      its light into the room, laid on a ceiling. Same window, same night,
      same street, but now we are at the glass and the glass has misted:
      the lamp, the lit rooms across the road and the cars going by are
      only glows in the condensation - until someone wipes a line through
      it, and there, for the width of a finger, is the street.
  - id: e47f033d-ebdb-48bd-8a08-7b7f03ddff6f
    relation: contrast
    note: >-
      Passerby started this practice on Campbell's wager: a point-light
      walker that cannot be read when it stands still and can be read
      the moment it moves. The stick figure a finger draws on a misted
      window is the opposite case. Five strokes, and nobody has ever
      failed to read it, moving or not, because it is a sign and not a
      picture. So the motion here is not what makes the figure legible.
      It is the drawing of it: you watch a hand you never see make a
      person out of nothing, and then watch the glass take it back.
influences: [jim-campbell]
rationale: |
  A window at night, misted over from the inside. Out past the glass
  there is a street: a sodium lamp, a couple of lit rooms across the
  road, one of them blue with a television, cars going by now and then.
  Through the condensation all of it is soft glows, amber and blue,
  slurred into the grey of the mist.

  Somebody is at the window. You never see them. You see their finger:
  a clear line opening in the mist, and through the line the street,
  sharp. A heart. A face. A house with a door. A stick man. Four
  strokes and one across, counting something. Sometimes the side of a
  hand scrubbing a round hole to look out through, nearly always where
  the lamp is. The water the finger has pushed aside gathers and, a
  little later, runs down from the bottom of the strokes, and the
  mist closes back over all of it, patchily, the way it does, in about
  half a minute. Then they draw something else.

  Jim Campbell put diffusers in front of his LEDs, because blur makes
  a low-resolution image easier to read. Here the diffuser is already
  there - it is the room's breath on the glass - and the picture is
  made by taking it away. What the clear line shows is harder to read
  than the mist around it: a few hard points of light where the glow
  was. The drawing is the legible part, and it lasts only until the
  glass forgets.

  Nothing accumulates. The mist always comes back, the drawings are
  re-rolled from a small repertoire of things people draw on windows,
  in new places and sizes, the cars and the television keep changing
  the light behind them. On a cold or rainy day (when the weather is
  known) the glass mists faster and more drops run. By day the room
  is bright and the window goes pale, and someone still draws on it.
@vfx*/

// before_it_mists_over - buffer mode, Campbell lineage.
//
// The panel is a misted WINDOW. Behind it, a static street (lamp, lit
// rooms, far points) is baked at load into two images: the SHARP view
// and the MISTED view (two gaussian blurs of the sharp one, a near halo
// and a wide glow). Passing cars and a television are added per frame
// in both forms. A per-pixel fog density g in [0,1] mixes them:
//     light = g * (room light scattered by mist + misted view)
//           + (1-g) * (night sky + sharp view)
// so the glass is a soft grey-amber glow, and anywhere it has been
// wiped you see a dark line with pinpoints of street in it.
//
// Fog is a NON-LUMINOUS memory (knowledge/craft/accumulation.md): it is
// bounded by construction, its rest state is "full", events only clear
// it, and it creeps back toward a mottled ceiling fmax with a per-pixel
// rate (~30s), so the glass carries half a minute of history as
// structure and can never saturate.
//
// Events that clear it: an unseen finger tracing polylines from a small
// repertoire (heart, face, house, sun, tally, spiral, stick figure,
// noughts and crosses) at hand speed with a tremor, or the side of a
// hand scrubbing a peephole near the lamp; and drops that stick-and-slip
// down the glass, some of them the water the finger pushed aside,
// released from the bottom of the strokes a few seconds after.
//
// Attractors: the equilibrium (a fully misted pane) is only ever
// approached; the finger returns every 4-13s with a re-rolled drawing,
// cars arrive on a renewal process, the TV cuts between shots.
//
// input.clock.daylight: lights on at dusk and night; by day the mist
// glows pale. input.env (if ok): colder = faster misting, rain = more
// drops. At neutral it is an autumn evening. Smoothed.

const meta = { name: "before_it_mists_over", fps: 30, inputs: ["clock", "env"] };
const TAU = Math.PI * 2;
const W = WIDTH, N = WIDTH * HEIGHT;
const SILL = 59;

// --- the glass ---------------------------------------------------------------
const fog = new Float32Array(N), fmax = new Float32Array(N), frate = new Float32Array(N);

// --- the street: sharp and misted, static and per-frame ----------------------
const SR = new Float32Array(N), SG = new Float32Array(N), SB = new Float32Array(N);
const BR = new Float32Array(N), BG = new Float32Array(N), BB = new Float32Array(N);
const TS = new Float32Array(N), TB = new Float32Array(N);       // the television's window
const cSR = new Float32Array(N), cSG = new Float32Array(N), cSB = new Float32Array(N);
const cBR = new Float32Array(N), cBG = new Float32Array(N), cBB = new Float32Array(N);
const DR = new Float32Array(N);                                  // drops on the glass
const skyR = new Float32Array(HEIGHT), skyG = new Float32Array(HEIGHT), skyB = new Float32Array(HEIGHT);

const TN = 1024, TMAX = 4.0, TQ = (TN - 1) / TMAX;
const tone = new Uint8Array(TN);
for (let k = 0; k < TN; k++) tone[k] = Math.round(255 * Math.pow(1 - Math.exp(-1.7 * k / TQ), 1.25));

const GN = 256, GD2 = 324, GQ = (GN - 1) / GD2, GSIG = 5.5;
const gl = new Float32Array(GN);
for (let k = 0; k < GN; k++) gl[k] = Math.exp(-(k / GQ) / (2 * GSIG * GSIG));

function addDisc(A, B, C, cx, cy, rad, r, g, b) {
  for (let y = Math.floor(cy - rad - 1); y <= Math.ceil(cy + rad + 1); y++) {
    if (y < 0 || y >= HEIGHT) continue;
    for (let x = Math.floor(cx - rad - 1); x <= Math.ceil(cx + rad + 1); x++) {
      if (x < 0 || x >= W) continue;
      const d = Math.hypot(x - cx, y - cy);
      const m = clamp(rad + 0.5 - d, 0, 1);
      const i = y * W + x;
      A[i] += r * m; B[i] += g * m; C[i] += b * m;
    }
  }
}
function addRect(A, B, C, x0, y0, x1, y1, r, g, b) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x; A[i] += r; B[i] += g; C[i] += b;
  }
}
const tmpA = new Float32Array(N), tmpB = new Float32Array(N);
function boxH(s, d, r) {
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let k = -r; k <= r; k++) { let xx = x + k; if (xx < 0) xx = 0; if (xx > W - 1) xx = W - 1; a += s[y * W + xx]; }
    d[y * W + x] = a / (2 * r + 1);
  }
}
function boxV(s, d, r) {
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let k = -r; k <= r; k++) { let yy = y + k; if (yy < 0) yy = 0; if (yy > HEIGHT - 1) yy = HEIGHT - 1; a += s[yy * W + x]; }
    d[y * W + x] = a / (2 * r + 1);
  }
}
// What mist does to a view: a near halo plus a wide glow (3x box = gaussian).
function mist(src, dst, g1, g2) {
  tmpA.set(src);
  for (let p = 0; p < 3; p++) { boxH(tmpA, tmpB, 4); boxV(tmpB, tmpA, 4); }
  for (let i = 0; i < N; i++) dst[i] += g1 * tmpA[i];
  tmpA.set(src);
  for (let p = 0; p < 3; p++) { boxH(tmpA, tmpB, 10); boxV(tmpB, tmpA, 10); }
  for (let i = 0; i < N; i++) dst[i] += g2 * tmpA[i];
}

// --- things people draw on a misted window -------------------------------------
function arc(cx, cy, rx, ry, a0, a1, n) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
  return p;
}
const GLYPHS = [];
(function () {
  const heart = [];
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * TAU, s = Math.sin(a);
    heart.push(16 * s * s * s / 17, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 + 0.12);
  }
  GLYPHS.push({ w: 3, polys: [heart] });
  GLYPHS.push({ w: 2, polys: [arc(0, 0, 1, 1, -Math.PI / 2, 1.5 * Math.PI, 36),
    [-0.36, -0.42, -0.36, -0.2], [0.36, -0.42, 0.36, -0.2], arc(0, 0.02, 0.55, 0.5, 0.18 * Math.PI, 0.82 * Math.PI, 12)] });
  GLYPHS.push({ w: 2, polys: [[-0.7, 1, -0.7, -0.1, 0, -0.85, 0.7, -0.1, 0.7, 1, -0.7, 1], [-0.16, 1, -0.16, 0.42, 0.18, 0.42, 0.18, 1]] });
  const sun = [arc(0, 0, 0.42, 0.42, -Math.PI / 2, 1.5 * Math.PI, 24)];
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; sun.push([0.64 * Math.cos(a), 0.64 * Math.sin(a), 0.98 * Math.cos(a), 0.98 * Math.sin(a)]); }
  GLYPHS.push({ w: 1.5, polys: sun });
  GLYPHS.push({ w: 1.5, polys: [[-0.6, -0.8, -0.6, 0.8], [-0.2, -0.8, -0.2, 0.8], [0.2, -0.8, 0.2, 0.8], [0.6, -0.8, 0.6, 0.8], [-0.95, 0.55, 0.95, -0.5]] });
  const sp = [];
  for (let i = 0; i <= 60; i++) { const s = i / 60, a = s * 2.6 * TAU, r = 0.08 + 0.9 * s; sp.push(r * Math.cos(a), r * Math.sin(a)); }
  GLYPHS.push({ w: 1, polys: [sp] });
  GLYPHS.push({ w: 1.5, polys: [arc(0, -0.72, 0.24, 0.24, -Math.PI / 2, 1.5 * Math.PI, 14), [0, -0.48, 0, 0.3],
    [-0.55, -0.02, 0, -0.28, 0.55, -0.02], [-0.42, 0.98, 0, 0.3, 0.42, 0.98]] });
  GLYPHS.push({ w: 1, polys: [[-0.35, -0.95, -0.35, 0.95], [0.35, -0.95, 0.35, 0.95], [-0.95, -0.33, 0.95, -0.33], [-0.95, 0.33, 0.95, 0.33],
    [-0.85, -0.85, -0.5, -0.5], [-0.5, -0.85, -0.85, -0.5], arc(0, 0, 0.19, 0.19, 0, TAU, 12)] });
  const peep = [];
  for (let k = 0; k < 8; k++) {
    const yy = -0.86 + k * 0.245, h = Math.sqrt(Math.max(0, 1 - yy * yy));
    if (k & 1) peep.push(h, yy, -h, yy); else peep.push(-h, yy, h, yy);
  }
  GLYPHS.push({ w: 3, polys: [peep], peep: true });
})();
let GW = 0; for (const g of GLYPHS) GW += g.w;

// --- state -------------------------------------------------------------------
const LAMPX = 13.5, LAMPY = 10.5;
const drops = [], pending = [], cars = [];
let fg = { mode: 0, timer: 1.2, polys: null, pi: 0, si: 0, st: 0, R: 1.5, speed: 16, lift: 0, last: -1 };
let tremX = 0, tremY = 0, carT = 1.0, dropT = 2.5, dayS = 0.5, started = false;
let tvT = 0, tvTgt = 0.7, tvCur = 0.7;

// Wipe the glass: a soft-edged disc of clearing, min-combined (a wiped
// place cannot be wiped "more" than clear).
function stamp(cx, cy, R) {
  const e = R + 1;
  let x0 = Math.floor(cx - e), x1 = Math.ceil(cx + e), y0 = Math.floor(cy - e), y1 = Math.ceil(cy + e);
  if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > SILL - 1) y1 = SILL - 1;
  const lo = R - 0.7, inv = 1 / 1.4;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      let u = (Math.sqrt(dx * dx + dy * dy) - lo) * inv;
      if (u >= 1) continue;
      if (u < 0) u = 0;
      const c = u * u * (3 - 2 * u);
      const i = y * W + x;
      if (c < fog[i]) fog[i] = c;
    }
  }
}

function pickGlyph() {
  let r = Math.random() * GW, k = 0;
  for (; k < GLYPHS.length - 1; k++) { r -= GLYPHS[k].w; if (r <= 0) break; }
  if (k === fg.last) k = (k + 1 + ((Math.random() * (GLYPHS.length - 1)) | 0)) % GLYPHS.length;
  fg.last = k;
  return GLYPHS[k];
}

function layGlyph(G, cx, cy, s, rot) {
  const c = Math.cos(rot), sn = Math.sin(rot), out = [];
  for (const P of G.polys) {
    const Q = new Float64Array(P.length);
    for (let j = 0; j < P.length; j += 2) {
      Q[j] = cx + s * (P[j] * c - P[j + 1] * sn);
      Q[j + 1] = cy + s * (P[j] * sn + P[j + 1] * c);
    }
    out.push(Q);
  }
  return out;
}

function startGlyph() {
  const G = pickGlyph();
  let s, cx, cy;
  if (G.peep) {
    // A hole to look out through - nearly always where the light is.
    s = 7.5 + Math.random() * 3;
    const tgt = Math.random() < 0.5 ? [LAMPX + 3, LAMPY + 4] : [42, 29];
    cx = clamp(tgt[0] + (Math.random() - 0.5) * 8, s + 2, 57 - s);
    cy = clamp(tgt[1] + (Math.random() - 0.5) * 8, s + 2, SILL - 3 - s);
    fg.R = 2.3; fg.speed = 34 + Math.random() * 10;
  } else {
    s = 10 + Math.random() * 4;
    cx = s + 3 + Math.random() * (W - 2 * s - 6);
    cy = s + 3 + Math.random() * (SILL - 4 - 2 * s - 3);
    fg.R = 1.45; fg.speed = 16 + Math.random() * 7;
  }
  fg.polys = layGlyph(G, cx, cy, s, (Math.random() - 0.5) * 0.3);
  fg.mode = 1; fg.pi = 0; fg.si = 0; fg.st = 0;
}

function finishGlyph() {
  fg.mode = 0; fg.timer = 4 + Math.random() * 9;
  // The water the finger pushed aside runs, a little later, from the strokes.
  const n = 1 + ((Math.random() * 3) | 0);
  for (let k = 0; k < n; k++) {
    const P = fg.polys[(Math.random() * fg.polys.length) | 0];
    let best = 0;
    for (let j = 0; j < P.length; j += 2) if (P[j + 1] > P[best + 1] && Math.random() < 0.7) best = j;
    pending.push({ x: P[best], y: P[best + 1], d: 1.5 + Math.random() * 6 });
  }
}

function fingerStep(dt) {
  if (fg.mode === 0) { fg.timer -= dt; if (fg.timer <= 0) startGlyph(); return; }
  if (fg.mode === 2) { fg.lift -= dt; if (fg.lift <= 0) fg.mode = 1; return; }
  let dist = fg.speed * (0.8 + 0.4 * (0.5 + 0.5 * noise2(3.3, fg.timer + fg.pi * 1.7 + fg.si * 0.3))) * dt;
  while (dist > 0 && fg.mode === 1) {
    const P = fg.polys[fg.pi], n = P.length >> 1;
    if (fg.si === 0 && fg.st === 0) stamp(P[0] + tremX, P[1] + tremY, fg.R);
    if (fg.si >= n - 1) {
      fg.pi++; fg.si = 0; fg.st = 0;
      if (fg.pi >= fg.polys.length) { finishGlyph(); return; }
      fg.mode = 2; fg.lift = 0.2 + Math.random() * 0.25;   // finger lifts between strokes
      return;
    }
    const j = fg.si * 2, ax = P[j], ay = P[j + 1], bx = P[j + 2], by = P[j + 3];
    const L = Math.hypot(bx - ax, by - ay) + 1e-9;
    const step = Math.min(dist, L - fg.st);
    const k = Math.max(1, Math.ceil(step / 0.45));
    for (let q = 1; q <= k; q++) {
      const u = (fg.st + step * q / k) / L;
      stamp(ax + (bx - ax) * u + tremX, ay + (by - ay) * u + tremY, fg.R);
    }
    fg.st += step; dist -= step;
    if (fg.st >= L - 1e-6) { fg.si++; fg.st = 0; }
  }
}

function newDrop(x, y, m) {
  if (drops.length >= 20) return;
  drops.push({ x: x, y: y, m: m, sd: Math.random() * 100, age: 0 });
}

function setup() {
  for (let y = 0; y < HEIGHT; y++) {
    const v = y / (HEIGHT - 1);
    skyR[y] = lerp(0.012, 0.008, v); skyG[y] = lerp(0.018, 0.010, v); skyB[y] = lerp(0.045, 0.016, v);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      fmax[i] = clamp(0.80 + 0.17 * v + 0.07 * noise2(x * 0.09 + 5, y * 0.09), 0, 1);
      frate[i] = 0.55 + 0.9 * (0.5 + 0.5 * noise2(x * 0.13 + 21, y * 0.13 - 4));
      fog[i] = fmax[i];
    }
  }
  // The street: a sodium lamp and its pole, lit rooms across the road, the
  // far end of the street, and one room with the television on.
  addDisc(SR, SG, SB, LAMPX, LAMPY, 1.3, 3.2, 1.7, 0.5);
  for (let y = LAMPY + 2; y < 46; y++) { const i = y * W + (LAMPX | 0); SR[i] += 0.07; SG[i] += 0.045; SB[i] += 0.025; }
  addRect(SR, SG, SB, 33, 24, 36, 28, 0.85, 0.55, 0.24);
  addRect(SR, SG, SB, 41, 24, 44, 28, 0.55, 0.36, 0.16);
  addRect(SR, SG, SB, 33, 32, 36, 35, 0.35, 0.22, 0.10);
  addRect(TS, TS, TS, 49, 31, 52, 35, 1, 1, 1);
  const far = [[24, 39, 0.5, 0.35, 0.15], [29, 40, 0.3, 0.3, 0.32], [58, 38, 0.6, 0.4, 0.2], [5, 41, 0.35, 0.28, 0.2]];
  for (const f of far) addDisc(SR, SG, SB, f[0], f[1], 0.5, f[2], f[3], f[4]);
  mist(SR, BR, 5.5, 5.0); mist(SG, BG, 5.5, 5.0); mist(SB, BB, 5.5, 5.0);
  mist(TS, TB, 6.0, 6.0);
  let pk = 0;
  for (let i = 0; i < N; i++) { const l = (BR[i] + BG[i] + BB[i]) / 3; if (l > pk) pk = l; }
  const sc = 0.55 / pk;
  for (let i = 0; i < N; i++) { BR[i] *= sc; BG[i] *= sc; BB[i] *= sc; TB[i] *= sc; }
  // Somebody was here earlier: a heart, already half misted over.
  fg.polys = layGlyph(GLYPHS[0], 40, 20, 11, 0.1);
  for (const P of fg.polys) for (let j = 0; j + 3 < P.length; j += 2) {
    const L = Math.hypot(P[j + 2] - P[j], P[j + 3] - P[j + 1]), k = Math.ceil(L / 0.45);
    for (let q = 0; q <= k; q++) stamp(P[j] + (P[j + 2] - P[j]) * q / k, P[j + 1] + (P[j + 3] - P[j + 1]) * q / k, 1.45);
  }
  for (let i = 0; i < N; i++) fog[i] = lerp(fog[i], fmax[i], 0.35);
  fg.polys = null; fg.last = 0;
  newDrop(20, 12, 0.8);
  dayS = clamp(input.clock.daylight, 0, 1);
  started = true;
}

// A car's lamp: a gaussian glow in the misted view, a splatted point in the sharp.
function carLight(x, y, I, r, g, b) {
  const e = 18;
  let x0 = Math.floor(x - e), x1 = Math.ceil(x + e), y0 = Math.floor(y - e), y1 = Math.ceil(y + e);
  if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > HEIGHT - 1) y1 = HEIGHT - 1;
  const gI = I * 0.8;
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy - y, row = yy * W;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx - x, d2 = dx * dx + dy * dy;
      if (d2 >= GD2) continue;
      const w = gI * gl[(d2 * GQ) | 0], i = row + xx;
      cBR[i] += r * w; cBG[i] += g * w; cBB[i] += b * w;
    }
  }
  const fx = Math.floor(x), fy = Math.floor(y), ax = x - fx, ay = y - fy;
  const ws = [(1 - ax) * (1 - ay), ax * (1 - ay), (1 - ax) * ay, ax * ay];
  for (let k = 0; k < 4; k++) {
    const px = fx + (k & 1), py = fy + (k >> 1);
    if (px < 0 || px >= W || py < 0 || py >= HEIGHT) continue;
    const i = py * W + px, w = I * 2.2 * ws[k];
    cSR[i] += r * w; cSG[i] += g * w; cSB[i] += b * w;
  }
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;

  const day = clamp(input.clock.daylight, 0, 1);
  let gk = dt * 0.5; if (gk > 1) gk = 1;
  dayS += (day - dayS) * gk;
  const env = input.env;
  const wet = env.ok ? clamp(env.rain, 0, 1) : 0;
  const cold = env.ok ? clamp((12 - env.tempC) / 14, 0, 1) : 0.4;

  // --- the finger nobody sees ---------------------------------------------------
  tremX = 0.35 * noise2(77.7, t * 2.3); tremY = 0.35 * noise2(91.1, t * 2.1);
  fingerStep(dt);

  // --- the glass mists back over, patchily -----------------------------------
  const k = dt / lerp(34, 24, cold);
  for (let i = 0; i < SILL * W; i++) fog[i] += (fmax[i] - fog[i]) * k * frate[i];

  // --- drops: they hesitate, then run -----------------------------------------
  dropT -= dt * (1 + 2.5 * wet);
  if (dropT <= 0) {
    dropT = 3 + Math.random() * 6;
    newDrop(2 + Math.random() * 60, 2 + Math.random() * 34, 0.4 + Math.random() * 0.5);
  }
  for (let q = pending.length - 1; q >= 0; q--) {
    pending[q].d -= dt;
    if (pending[q].d <= 0) { newDrop(pending[q].x, pending[q].y + 1, 0.7 + Math.random() * 0.3); pending.splice(q, 1); }
  }
  DR.fill(0);
  for (let q = drops.length - 1; q >= 0; q--) {
    const d = drops[q];
    d.age += dt;
    const go = smoothstep(-0.35, 0.25, noise2(d.sd, t * 0.9));
    const v = (2.5 + 11 * d.m) * go;
    d.y += v * dt;
    d.x += (0.9 * noise2(d.sd + 40, t * 0.6) + 0.25 * noise2(d.sd + 7, d.y * 0.4)) * dt * (0.3 + go);
    d.m -= dt * 0.05 * go;
    stamp(d.x, d.y, 0.5 + 0.35 * d.m);
    if (d.y >= SILL - 1.5 || d.m < 0.12) { drops.splice(q, 1); continue; }
    const fx = Math.floor(d.x), fy = Math.floor(d.y), ax = d.x - fx, ay = d.y - fy;
    const br = 0.5 + 0.5 * d.m;
    for (let c = 0; c < 4; c++) {
      const px = fx + (c & 1), py = fy + (c >> 1);
      if (px < 0 || px >= W || py < 0 || py >= SILL) continue;
      DR[py * W + px] += br * ((c & 1) ? ax : 1 - ax) * ((c >> 1) ? ay : 1 - ay);
    }
  }

  // --- cars in the street below --------------------------------------------------
  carT -= dt;
  if (carT <= 0 && cars.length < 3) {
    carT = 3 + Math.random() * 7;
    const dir = Math.random() < 0.5 ? 1 : -1, near = Math.random() < 0.6;
    cars.push({ dir: dir, x: dir > 0 ? -22 : W + 22, y: near ? 47 : 43, v: (near ? 11 : 7) + Math.random() * 5,
      I: near ? 1.0 : 0.55, led: Math.random() < 0.5 });
  }
  cSR.fill(0); cSG.fill(0); cSB.fill(0); cBR.fill(0); cBG.fill(0); cBB.fill(0);
  for (let q = cars.length - 1; q >= 0; q--) {
    const c = cars[q];
    c.x += c.dir * c.v * dt;
    if (c.dir * c.x > W + 24) { cars.splice(q, 1); continue; }
    const hr = c.led ? 0.8 : 1.0, hg = c.led ? 0.88 : 0.82, hb = c.led ? 1.0 : 0.6;
    carLight(c.x, c.y, c.I, hr, hg, hb);
    carLight(c.x - c.dir * 7, c.y, c.I * 0.45, 1.0, 0.08, 0.03);
  }

  // --- the television across the road cuts between shots -----------------------
  tvT -= dt;
  if (tvT <= 0) { tvT = 0.8 + Math.random() * 3.5; tvTgt = 0.3 + Math.random() * 0.6; }
  let tk = dt * 10; if (tk > 1) tk = 1;
  tvCur += (tvTgt - tvCur) * tk;

  const dk = smoothstep(0.3, 0.9, dayS);
  const on = smoothstep(0.8, 0.35, dayS);
  const lamp = on * (1 + 0.03 * noise2(5.5, t * 0.7));
  const tv = on * tvCur * (0.85 + 0.15 * noise2(12.1, t * 4.0));
  const tvr = 0.42 * tv, tvg = 0.55 * tv, tvb = 0.85 * tv;
  const aR = lerp(0.052, 0.30, dk), aG = lerp(0.058, 0.32, dk), aB = lerp(0.075, 0.36, dk);
  const dayR = 0.22 * dk, dayG = 0.28 * dk, dayB = 0.36 * dk;

  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    if (y >= SILL) {                             // the sill, faintly lit from the room
      const v = 0.035 + 0.06 * dk + (y === SILL ? 0.03 : 0);
      const c = (tone[(v * 1.0 * TQ) | 0] << 16) | (tone[(v * 0.7 * TQ) | 0] << 8) | tone[(v * 0.45 * TQ) | 0];
      for (let x = 0; x < W; x++, i++) setPixel(x, y, c);
      continue;
    }
    const kr = skyR[y] + dayR * (1 - y / 80), kg = skyG[y] + dayG * (1 - y / 80), kb = skyB[y] + dayB * (1 - y / 80);
    for (let x = 0; x < W; x++, i++) {
      const g = fog[i], h = 1 - g;
      const br = BR[i] * lamp + TB[i] * tvr + cBR[i];
      const bg = BG[i] * lamp + TB[i] * tvg + cBG[i];
      const bb = BB[i] * lamp + TB[i] * tvb + cBB[i];
      const dd = DR[i];
      let r = g * (aR + br) + h * (kr + SR[i] * lamp + TS[i] * tvr + cSR[i]) + dd * (0.10 + 1.6 * br);
      let gg = g * (aG + bg) + h * (kg + SG[i] * lamp + TS[i] * tvg + cSG[i]) + dd * (0.11 + 1.6 * bg);
      let b = g * (aB + bb) + h * (kb + SB[i] * lamp + TS[i] * tvb + cSB[i]) + dd * (0.13 + 1.6 * bb);
      let ir = (r * TQ) | 0; if (ir > TN - 1) ir = TN - 1;
      let ig = (gg * TQ) | 0; if (ig > TN - 1) ig = TN - 1;
      let ib = (b * TQ) | 0; if (ib > TN - 1) ib = TN - 1;
      setPixel(x, y, (tone[ir] << 16) | (tone[ig] << 8) | tone[ib]);
    }
  }
}
