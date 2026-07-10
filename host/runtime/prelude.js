// LED VFX stdlib prelude — injected verbatim into the QuickJS sandbox
// before every effect program. This is the entire host-provided surface:
// colors, drawing primitives, sprites, noise, math helpers, and the
// neutral `input` object. Shared verbatim by the render host, the
// validation harness, and the creativity agent's study materials — see
// docs/VFX_API.md for the documented contract this file implements.

const WIDTH = 64;
const HEIGHT = 64;

// --- math helpers --------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, u) {
  return a + (b - a) * u;
}

function smoothstep(lo, hi, v) {
  const x = clamp((v - lo) / (hi - lo), 0, 1);
  return x * x * (3 - 2 * x);
}

function fract(v) {
  return v - Math.floor(v);
}

// --- simplex noise (2D/3D) ------------------------------------------------
// Standard Gustavson-style simplex noise. The permutation table is built
// from a fixed seed at load time (deterministic mulberry32 shuffle) rather
// than a hand-copied magic table, so every program sees the same noise
// field on every run.

const __grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function __buildPermutation(seed) {
  let s = seed >>> 0;
  function rnd() {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  return { perm, permMod12 };
}

const __noiseTables = __buildPermutation(1337);
const __perm = __noiseTables.perm;
const __permMod12 = __noiseTables.permMod12;

const __F2 = 0.5 * (Math.sqrt(3) - 1);
const __G2 = (3 - Math.sqrt(3)) / 6;

function noise2(xin, yin) {
  let n0, n1, n2;
  const s = (xin + yin) * __F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * __G2;
  const X0 = i - t, Y0 = j - t;
  const x0 = xin - X0, y0 = yin - Y0;
  let i1, j1;
  if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
  const x1 = x0 - i1 + __G2, y1 = y0 - j1 + __G2;
  const x2 = x0 - 1 + 2 * __G2, y2 = y0 - 1 + 2 * __G2;
  const ii = i & 255, jj = j & 255;
  const gi0 = __permMod12[ii + __perm[jj]];
  const gi1 = __permMod12[ii + i1 + __perm[jj + j1]];
  const gi2 = __permMod12[ii + 1 + __perm[jj + 1]];
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 < 0) n0 = 0; else { t0 *= t0; n0 = t0 * t0 * (__grad3[gi0][0] * x0 + __grad3[gi0][1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 < 0) n1 = 0; else { t1 *= t1; n1 = t1 * t1 * (__grad3[gi1][0] * x1 + __grad3[gi1][1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 < 0) n2 = 0; else { t2 *= t2; n2 = t2 * t2 * (__grad3[gi2][0] * x2 + __grad3[gi2][1] * y2); }
  return 70 * (n0 + n1 + n2);
}

const __F3 = 1 / 3;
const __G3 = 1 / 6;

function noise3(xin, yin, zin) {
  let n0, n1, n2, n3;
  const s = (xin + yin + zin) * __F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * __G3;
  const X0 = i - t, Y0 = j - t, Z0 = k - t;
  const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }
  const x1 = x0 - i1 + __G3, y1 = y0 - j1 + __G3, z1 = z0 - k1 + __G3;
  const x2 = x0 - i2 + 2 * __G3, y2 = y0 - j2 + 2 * __G3, z2 = z0 - k2 + 2 * __G3;
  const x3 = x0 - 1 + 3 * __G3, y3 = y0 - 1 + 3 * __G3, z3 = z0 - 1 + 3 * __G3;
  const ii = i & 255, jj = j & 255, kk = k & 255;
  const gi0 = __permMod12[ii + __perm[jj + __perm[kk]]];
  const gi1 = __permMod12[ii + i1 + __perm[jj + j1 + __perm[kk + k1]]];
  const gi2 = __permMod12[ii + i2 + __perm[jj + j2 + __perm[kk + k2]]];
  const gi3 = __permMod12[ii + 1 + __perm[jj + 1 + __perm[kk + 1]]];
  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 < 0) n0 = 0; else { t0 *= t0; n0 = t0 * t0 * (__grad3[gi0][0] * x0 + __grad3[gi0][1] * y0 + __grad3[gi0][2] * z0); }
  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 < 0) n1 = 0; else { t1 *= t1; n1 = t1 * t1 * (__grad3[gi1][0] * x1 + __grad3[gi1][1] * y1 + __grad3[gi1][2] * z1); }
  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 < 0) n2 = 0; else { t2 *= t2; n2 = t2 * t2 * (__grad3[gi2][0] * x2 + __grad3[gi2][1] * y2 + __grad3[gi2][2] * z2); }
  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 < 0) n3 = 0; else { t3 *= t3; n3 = t3 * t3 * (__grad3[gi3][0] * x3 + __grad3[gi3][1] * y3 + __grad3[gi3][2] * z3); }
  return 32 * (n0 + n1 + n2 + n3);
}

// --- colors ---------------------------------------------------------------

function rgb(r, g, b) {
  return ((clamp(r, 0, 255) | 0) << 16) | ((clamp(g, 0, 255) | 0) << 8) | (clamp(b, 0, 255) | 0);
}

function hsv(h, s, v) {
  h = fract(h) * 6;
  s = clamp(s, 0, 1);
  v = clamp(v, 0, 1);
  const i = h | 0;
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return rgb((r * 255) | 0, (g * 255) | 0, (b * 255) | 0);
}

// --- framebuffer + drawing --------------------------------------------------

const __FB = new Uint8Array(WIDTH * HEIGHT * 3);
// The ArrayBuffer backing __FB is what the host reads back after each
// frame call — this is the "one crossing per frame" boundary.
const __FB_BUFFER = __FB.buffer;

function setPixel(x, y, color) {
  x |= 0; y |= 0;
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 3;
  __FB[idx] = (color >> 16) & 255;
  __FB[idx + 1] = (color >> 8) & 255;
  __FB[idx + 2] = color & 255;
}

function getPixel(x, y) {
  x |= 0; y |= 0;
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return 0;
  const idx = (y * WIDTH + x) * 3;
  return (__FB[idx] << 16) | (__FB[idx + 1] << 8) | __FB[idx + 2];
}

function fill(color) {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  for (let i = 0; i < __FB.length; i += 3) {
    __FB[i] = r; __FB[i + 1] = g; __FB[i + 2] = b;
  }
}

function fade(f) {
  for (let i = 0; i < __FB.length; i++) {
    __FB[i] = (__FB[i] * f) | 0;
  }
}

// --- sprites ---------------------------------------------------------------

function sprite(palette, grid) {
  let lines = grid.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = line.match(/^ */);
    if (m[0].length < minIndent) minIndent = m[0].length;
  }
  if (!isFinite(minIndent)) minIndent = 0;
  lines = lines.map((l) => l.slice(minIndent).replace(/\s+$/, ''));

  const h = lines.length;
  let w = 0;
  for (const l of lines) if (l.length > w) w = l.length;

  const pixels = new Int32Array(w * h).fill(-1); // -1 = transparent
  for (let y = 0; y < h; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (color === undefined) continue;
      pixels[y * w + x] = color;
    }
  }
  return { w, h, pixels };
}

function blit(spr, x, y, opts) {
  opts = opts || {};
  const flipX = !!opts.flipX;
  const flipY = !!opts.flipY;
  const brightness = opts.brightness === undefined ? 1 : opts.brightness;
  const tint = opts.tint;
  const tr = tint === undefined ? 1 : ((tint >> 16) & 255) / 255;
  const tg = tint === undefined ? 1 : ((tint >> 8) & 255) / 255;
  const tb = tint === undefined ? 1 : (tint & 255) / 255;
  const ox = x | 0, oy = y | 0;

  for (let sy = 0; sy < spr.h; sy++) {
    const py = oy + sy;
    if (py < 0 || py >= HEIGHT) continue;
    for (let sx = 0; sx < spr.w; sx++) {
      const px = ox + sx;
      if (px < 0 || px >= WIDTH) continue;
      const srcX = flipX ? spr.w - 1 - sx : sx;
      const srcY = flipY ? spr.h - 1 - sy : sy;
      const color = spr.pixels[srcY * spr.w + srcX];
      if (color === -1) continue;
      let r = ((color >> 16) & 255) * brightness * tr;
      let g = ((color >> 8) & 255) * brightness * tg;
      let b = (color & 255) * brightness * tb;
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;
      setPixel(px, py, ((r | 0) << 16) | ((g | 0) << 8) | (b | 0));
    }
  }
}

// --- input (read-only, host-sampled) ---------------------------------------
// Neutral defaults for every group; the host mutates fields in place
// (real sampling lands in build phase 3). Reading `input` is always safe.

let input = {
  audio: { ok: false, level: 0, bass: 0, mid: 0, treble: 0, beat: false },
  button: { down: false, pressed: false, released: false, heldSeconds: 0 },
  clock: { hour: 12, minute: 0, weekday: 0, dayOfYear: 1, daylight: 0.5 },
  env: { ok: false, tempC: 20, cloud: 0, rain: 0 },
};

// --- frame dispatch ---------------------------------------------------------
// Set by the host once after program load ('pixel' | 'buffer'). Kept out
// of the per-frame hot path so mode isn't re-detected every call.
let __mode = null;

function __vfxFrame(t, dt) {
  if (__mode === 'buffer') {
    render(t, dt);
  } else {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        setPixel(x, y, pixel(x, y, t));
      }
    }
  }
  return __FB_BUFFER;
}

// No import/require exist in this sandbox to begin with; eval and the
// Function constructor do, by default, so remove them explicitly.
delete globalThis.eval;
delete globalThis.Function;
