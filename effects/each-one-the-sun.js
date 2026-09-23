/*@vfx
id: 2c0bcddb-44ec-4053-b26c-8eb08fce32ea
title: Each One the Sun
created: 2026-09-23
artist: Saccade (apprentice name)
lineage:
  - id: 959b82f7-5cf2-4dd1-8275-79b77fac9a63
    relation: variation
    note: >-
      Between the Lamp and the Wall is the house at night: one lamp, one
      wall, and the lamp's WIDTH made into the whole piece, because a
      source with a size softens every shadow by an amount you can
      compute. This is the same wall by day, and the same fact turned
      inside out. Here the size of the source is not a blur on
      something else; it is the picture. Every gap in the leaves outside
      the window is a pinhole, and every spot of light it throws is an
      image of the disc of the sun - which is why they are all round,
      whatever shape the gaps are.
  - id: 816f507e-3e27-42da-ae7f-eb70e1361e9b
    relation: contrast
    note: >-
      Two Hands, Pretending was a fraud on purpose: a shape claiming to
      be a bird it was not. This is its opposite. Nothing on this wall
      claims anything, and every spot of light on it is exactly what it
      appears not to be - a true picture, formed by optics, of the thing
      that made it. Seventy small portraits of the sun, and nobody in the
      house reads them as portraits. The hands lied and were believed;
      the leaves tell the truth and are not noticed.
influences: [jim-campbell]
rationale: |
  Late afternoon, a window, a tree outside it. The window's patch of
  sunlight lies skewed across the wall with the shadow of its frame in
  it, and inside the patch the tree's shade is full of coins of light
  that shiver when the wind gets into the branches.

  They are all round. The gaps between leaves are every shape a gap
  can be, and the coins are round anyway, because each gap is a
  pinhole and each coin is an image of the sun - a small, soft,
  upside-down picture of the disc itself, seventy of them, on the
  plaster. High branches throw big faint ones and low branches small
  bright ones. When the sun is high they stretch into ovals, because
  it strikes the wall at a slant; when it is low they go round and
  orange. The window's patch slides along the wall with the hour.

  Jim Campbell spent a career asking how few pixels a picture needs
  before it stops being a picture. These are the lowest-resolution
  pictures in the house - five pixels of sun - and the only proof that
  they are pictures at all arrives after dark. The same tree, the same
  window, the moon instead of the sun: the coins go cold and dim, and
  every one of them is tonight's moon, in its actual phase, inverted
  by the pinhole, a crescent or a gibbous lying in the shade seventy
  times over. The sun and the moon are the same size in the sky -
  that is why eclipses work - so the coins keep their size and change
  their shape, and you find out what they were showing you all day.

  Nothing accumulates. The wind is noise that never stops arriving,
  leaves open and close, gaps come and go on their own lifetimes, and
  now and then a whole branch shifts, so the shade is never the same
  shade twice.
@vfx*/

// each_one_the_sun - buffer mode.
//
// The panel is a WALL with a window's patch of light on it. A tree
// outside the window is the only moving thing. Each gap in its canopy is
// a pinhole, so the light it lets through lands as an image of the
// SOURCE, not of the gap: a disc for the sun, tonight's phase for the
// moon (inverted, as a pinhole image is). One source image SRC is built
// into a small texture whenever the day/night blend or the moon's phase
// changes, and every dapple is that texture stamped at its own size.
//
// Physics kept, cheaply:
//   - dapple size ~ distance from gap to wall (random per gap);
//     brightness per area falls as the image grows (big = faint).
//   - elongation with the sun's elevation (a high sun rakes the wall).
//   - sun and moon have the same angular size, so night dapples keep
//     their size and only change shape.
//   - light sums: dapples add into a float field, tone-mapped once.
//   - the window patch is a parallelogram with a mullion cross, crisp,
//     sliding with the hour; outside it the room is dark.
//
// Motion: branch sway (noise, scaled by a slow gust envelope), per-leaf
// flutter of position and aperture, and a renewal process - every gap
// has a finite life, fades out, and is reborn elsewhere on its branch;
// occasionally a branch relocates. Nothing is stored between frames but
// those parameters (knowledge/craft/accumulation.md: density in space,
// not in time; knowledge/craft/attractors.md: renewal, external noise).
//
// input.clock: daylight blends sun -> moon and warms the low sun; hour
// slides the window patch. Smoothed. The moon's phase comes from Date if
// the sandbox has it (falls back to full), clamped so it is never quite
// new - a small lie so a dark night still has a moon in it.

const meta = { name: "each_one_the_sun", fps: 30, inputs: ["clock"] };
const TAU = Math.PI * 2;

// --- the canopy -------------------------------------------------------------
const NB = 7, NG = 64;
const bx0 = new Float64Array(NB), by0 = new Float64Array(NB), bsd = new Float64Array(NB);
const bxc = new Float64Array(NB), byc = new Float64Array(NB);
const gB = new Int32Array(NG);
const gox = new Float64Array(NG), goy = new Float64Array(NG);
const gr = new Float64Array(NG), gsd = new Float64Array(NG);
const gage = new Float64Array(NG), glife = new Float64Array(NG);

// --- the source image every dapple carries ----------------------------------
const TS = 40, TEXT = 1.3;
const src = new Float32Array(TS * TS);
let texKey = -1, moonP = Math.PI, moonT = 60;

// --- light (wiped every frame) and its ramp ---------------------------------
const acc = new Float32Array(WIDTH * HEIGHT);
const QN = 512, QMAX = 3.0, QS = (QN - 1) / QMAX;
const pal = new Int32Array(QN);
let palKey = -1;

// --- the window's patch -----------------------------------------------------
const PW = 41, PH = 46;
const SHADE = 0.13;           // skylight in the tree's shade
let px0 = 16, py0 = 9, skew = -0.3;

let dayS = 0.5, hourS = 12, started = false;

function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 1.41; }

function placeBranch(b) {
  bx0[b] = 6 + Math.random() * 52;
  by0[b] = 10 + Math.random() * 44;
}

function respawn(i) {
  gox[i] = gauss() * 7.5;
  goy[i] = gauss() * 7.5;
  gr[i] = 2.4 + 3.6 * Math.pow(Math.random(), 1.6);   // gap-to-wall distance
  gsd[i] = Math.random() * 500;
  glife[i] = 7 + Math.random() * 16;
  gage[i] = 0;
}

function moonPhase() {
  // Days since the new moon of 2000-01-06 18:14 UTC, mod the synodic month.
  if (typeof Date === "undefined") return Math.PI;
  const days = Date.now() / 86400000 - 10962.76;
  let f = (days / 29.530588853) % 1;
  if (!(f === f)) return Math.PI;
  if (f < 0) f += 1;
  let p = f * TAU;
  if (p < 0.75) p = 0.75;
  if (p > TAU - 0.75) p = TAU - 0.75;
  return p;
}

// The disc of the source, and for the moon its lit part, inverted.
function buildTex(moonW) {
  const e = 0.2;
  const c0 = Math.cos(moonP), wax = moonP < Math.PI;
  for (let j = 0; j < TS; j++) {
    const v = (j / (TS - 1) * 2 - 1) * TEXT;
    for (let k = 0; k < TS; k++) {
      const u = (k / (TS - 1) * 2 - 1) * TEXT;
      const d = Math.sqrt(u * u + v * v);
      const disc = smoothstep(1 + e, 1 - e, d);
      const s = Math.sqrt(Math.max(0, 1 - v * v));
      const c = c0 * s;                 // the terminator at this height
      const m = wax ? -u : u;           // pinhole images are upside down
      let lit = smoothstep(c - e, c + e, m);
      if (lit < 0.06) lit = 0.06;       // earthshine
      src[j * TS + k] = disc * (1 - moonW + moonW * lit);
    }
  }
}

function setup() {
  for (let b = 0; b < NB; b++) { placeBranch(b); bsd[b] = Math.random() * 300; }
  for (let i = 0; i < NG; i++) {
    gB[i] = i % NB;
    respawn(i);
    gage[i] = Math.random() * glife[i];   // a canopy already in leaf
  }
  dayS = clamp(input.clock.daylight, 0, 1);
  hourS = clamp(input.clock.hour, 0, 23.99);
  moonP = moonPhase();
  started = true;
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;
  acc.fill(0);

  // --- the clock, smoothed ---------------------------------------------------
  const day = clamp(input.clock.daylight, 0, 1);
  let gk = dt * 0.5; if (gk > 1) gk = 1;
  dayS += (day - dayS) * gk;
  let dh = input.clock.hour - hourS;
  if (dh > 12) dh -= 24; if (dh < -12) dh += 24;
  hourS += dh * gk;
  if (hourS < 0) hourS += 24; if (hourS >= 24) hourS -= 24;
  const moonW = smoothstep(0.28, 0.06, dayS);

  moonT -= dt;
  if (moonT <= 0) { moonT = 60; moonP = moonPhase(); texKey = -1; }
  const tk = (moonW * 60) | 0;
  if (tk !== texKey) { texKey = tk; buildTex(tk / 60); }

  // The window's patch slides along the wall with the hour.
  const ha = Math.sin((hourS - 12) / 12 * Math.PI);
  px0 = 16 - 9 * ha; skew = -0.30 - 0.12 * ha; py0 = 9;
  const elong = 1 + 0.8 * smoothstep(0.3, 1.0, dayS);   // a high sun rakes

  // --- the wind -------------------------------------------------------------
  const gust = 0.55 + 0.75 * (0.5 + 0.5 * noise2(7.7, t * 0.06));
  for (let b = 0; b < NB; b++) {
    const s = bsd[b];
    bxc[b] = bx0[b] + 7 * noise2(s, t * 0.013)
           + gust * (2.3 * noise2(s + 31, t * 0.32) + 0.9 * Math.sin(t * 1.1 + s));
    byc[b] = by0[b] + 7 * noise2(s + 90, t * 0.013)
           + gust * (1.4 * noise2(s + 57, t * 0.29));
  }

  // --- seventy small pictures of the sky's one light -------------------------
  const peakK = lerp(1.0, 1.5, moonW);
  for (let i = 0; i < NG; i++) {
    gage[i] += dt;
    if (gage[i] > glife[i]) {
      respawn(i);
      if (Math.random() < 0.08) placeBranch(gB[i]);
    }
    const env = Math.sin(Math.PI * gage[i] / glife[i]);
    const ap = env * (0.45 + 0.55 * (0.5 + 0.5 * noise2(gsd[i], t * 1.2 * gust)));
    if (ap <= 0.02) continue;
    const b = gB[i], sd = gsd[i];
    const cx = bxc[b] + gox[i] + 0.6 * gust * noise2(sd + 11, t * 1.7);
    const cy = byc[b] + goy[i] + 0.5 * gust * noise2(sd + 23, t * 1.5);
    const rx = gr[i], ry = gr[i] * elong;
    const peak = peakK * ap * Math.pow(2.4 / rx, 0.8);   // bigger = fainter
    const ex = rx * TEXT, ey = ry * TEXT;
    let x0 = Math.floor(cx - ex), x1 = Math.ceil(cx + ex);
    let y0 = Math.floor(cy - ey), y1 = Math.ceil(cy + ey);
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
    if (x1 > WIDTH - 1) x1 = WIDTH - 1; if (y1 > HEIGHT - 1) y1 = HEIGHT - 1;
    const kx = (TS - 1) / (2 * ex), ky = (TS - 1) / (2 * ey);
    for (let y = y0; y <= y1; y++) {
      const ty = ((y - cy + ey) * ky + 0.5) | 0;
      if (ty < 0 || ty >= TS) continue;
      const trow = ty * TS, row = y * WIDTH;
      for (let x = x0; x <= x1; x++) {
        const tx = ((x - cx + ex) * kx + 0.5) | 0;
        if (tx < 0 || tx >= TS) continue;
        acc[row + x] += peak * src[trow + tx];
      }
    }
  }

  // --- the ramp: dark room -> cool shade -> warm sun (or cold moon) ----------
  // Mixed in RGB, so the shade-to-sun transition never passes through green.
  const pk = (dayS * 200) | 0;
  if (pk !== palKey) {
    palKey = pk;
    const dS = pk / 200;
    const mw = smoothstep(0.28, 0.06, dS);
    const low = 1 - smoothstep(0.35, 0.8, dS);
    const hL = lerp(lerp(0.115, 0.080, low), 0.60, mw);
    const sL = lerp(lerp(0.20, 0.48, low), 0.24, mw);
    const vL = lerp(0.97, 0.80, mw);
    const gm = lerp(1.7, 1.3, mw);
    const hS = lerp(0.60, 0.63, mw), sS = lerp(0.40, 0.45, mw);
    const cL = hsv(hL, sL, 1), cS = hsv(hS, sS, 1);
    const Lr = (cL >> 16) & 255, Lg = (cL >> 8) & 255, Lb = cL & 255;
    const Sr = (cS >> 16) & 255, Sg = (cS >> 8) & 255, Sb = cS & 255;
    for (let q = 0; q < QN; q++) {
      const L = q / QS;
      const T = 1 - Math.exp(-L * 1.25);
      const m = smoothstep(0.10, 0.45, T);
      const v = 0.012 + vL * Math.pow(T, gm);
      pal[q] = rgb(v * lerp(Sr, Lr, m), v * lerp(Sg, Lg, m), v * lerp(Sb, Lb, m));
    }
  }

  // --- the wall: the window's patch, its frame's shadow, the light in it ------
  const mxv = PW * 0.5, myv = PH * 0.40;
  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    const dty = y - py0;
    let my = dty; const dby = PH - dty; if (dby < my) my = dby;
    let hbar = Math.abs(dty - myv) - 0.9;
    if (hbar < 0) hbar = 0; else if (hbar > 1) hbar = 1;
    const shx = px0 + skew * dty;
    for (let x = 0; x < WIDTH; x++, i++) {
      const dl = x - shx;
      let m = my; const dr = PW - dl;
      if (dl < m) m = dl; if (dr < m) m = dr;
      m += 0.5;
      let q = 0;
      if (m > 0) {
        if (m > 1) m = 1;
        let vb = Math.abs(dl - mxv) - 0.9;
        if (vb < 0) vb = 0; else if (vb > 1) vb = 1;
        const bar = vb < hbar ? vb : hbar;
        q = m * bar * (SHADE + acc[i]);
      }
      let k = (q * QS) | 0; if (k > QN - 1) k = QN - 1;
      setPixel(x, y, pal[k]);
    }
  }
}
