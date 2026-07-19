/*@vfx
id: 47ef1bb7-0adf-4c82-9640-f94169b62088
title: While Touching
created: 2026-07-10
artist: Saccade (apprentice name)
lineage:
  - id: 2bba4eb5-cd9b-4f2a-bb27-b5929bd67d43
    relation: contrast
    note: >-
      Fireflies makes the point the content - a swarm that is
      self-sufficient paused and means nothing. This refuses that from
      the side opposite to Passerby; the points are drawn barely, and the
      picture is made only of the LINES drawn between two of them while
      they touch. Objects vanish; relations are the drawing.
influences: [casey-reas]
rationale: |
  Process. ~34 Elements, each a point moving in a straight line at
  constant speed and constrained to the surface (reflecting at the
  edges). Behavior: while two Elements are touching - their small circles
  overlapping - draw a faint line between their centres, brighter the
  deeper the overlap. The surface is never drawn on directly; it holds
  these relational marks and lets them fade slowly, so the image is the
  trace of the last few seconds of every nearness in the field - a soft
  cool-gray mesh that thickens where the field crowds and thins where it
  opens, never twice the same. Near-monochrome: value carries the
  drawing, and where marks pile into one another the light burns toward
  white.

  This is Reas's relational drawing - the mark is the relation, not the
  object - realized on light. I argue with his never-cleared surface: paper
  holds a mark forever, but a light panel that never clears only saturates
  to white and strains the wall, so I make fading part of the Behavior. The
  picture becomes recent relation rather than all history, and gains the
  motion the paper never had. The Element cores are splatted sub-pixel
  (Campbell's diffusion, carried over from Passerby) so the mesh is silk,
  not stipple. Against Fireflies from the side opposite Passerby: there,
  one body drawn out of the anonymous swarm; here the swarm kept anonymous
  and made to mean only through what passes between its members.
@vfx*/

// while_touching - buffer mode, Reas-lineage relational drawing.
// A field of point Elements move in straight lines and reflect off the
// edges. While any two touch (their small circles overlap) a faint line
// is drawn between them into an accumulation surface that fades slowly -
// so the picture is the trace of recent nearness, a soft cool mesh on
// black. The Elements themselves are drawn barely. No inputs: emergence
// wants autonomy (Reas dossier).

const meta = { name: "while_touching", fps: 30 };

const N = 34;
const R_MIN = 4.0, R_MAX = 6.0;       // Element radii (px); touch = circles overlap
const SPD_MIN = 7.0, SPD_MAX = 15.0;  // px/s - motion at the speed of patience
const MARGIN = 1;
const DECAY = 0.965;                  // per-frame fade of the mark surface
const LINE_INC = 0.14;                // deposit per covered pixel at full overlap
const POINT_V = 0.30;                 // faint Element core brightness

const acc = new Float32Array(WIDTH * HEIGHT);
let els = [];

function setup() {
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = SPD_MIN + Math.random() * (SPD_MAX - SPD_MIN);
    els.push({
      x: MARGIN + Math.random() * (WIDTH - 1 - 2 * MARGIN),
      y: MARGIN + Math.random() * (HEIGHT - 1 - 2 * MARGIN),
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: R_MIN + Math.random() * (R_MAX - R_MIN),
    });
  }
}

function blendMax(a, b) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return rgb(ar > br ? ar : br, ag > bg ? ag : bg, ab > bb ? ab : bb);
}

function addAcc(x, y, a) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  acc[y * WIDTH + x] += a;
}

// Bilinear (sub-pixel) deposit - Campbell diffusion, so lines read smooth.
function splatAcc(px, py, amp) {
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const fx = px - x0, fy = py - y0;
  addAcc(x0, y0, amp * (1 - fx) * (1 - fy));
  addAcc(x0 + 1, y0, amp * fx * (1 - fy));
  addAcc(x0, y0 + 1, amp * (1 - fx) * fy);
  addAcc(x0 + 1, y0 + 1, amp * fx * fy);
}

function drawLine(x0, y0, x1, y1, amp) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  const inv = 1 / steps;
  for (let k = 0; k <= steps; k++) {
    const u = k * inv;
    splatAcc(x0 + dx * u, y0 + dy * u, amp);
  }
}

function render(t, dt) {
  if (els.length === 0) setup();

  // Marks fade: the surface is the trace of recent nearness, not a
  // permanent accumulation (light cannot hold a mark like paper).
  for (let i = 0; i < acc.length; i++) acc[i] *= DECAY;

  // Elements move in straight lines; constrain to the surface (reflect).
  const hiX = WIDTH - 1 - MARGIN, hiY = HEIGHT - 1 - MARGIN;
  for (const e of els) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.x < MARGIN) { e.x = MARGIN; e.vx = -e.vx; }
    else if (e.x > hiX) { e.x = hiX; e.vx = -e.vx; }
    if (e.y < MARGIN) { e.y = MARGIN; e.vy = -e.vy; }
    else if (e.y > hiY) { e.y = hiY; e.vy = -e.vy; }
  }

  // Relations draw the picture: a faint line between every touching pair,
  // brighter the deeper the overlap. O(n^2) proximity in plain code.
  for (let i = 0; i < N; i++) {
    const a = els[i];
    for (let j = i + 1; j < N; j++) {
      const b = els[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2);
      const closeness = 1 - d / rr;             // 0 at first touch -> 1 as they merge
      drawLine(a.x, a.y, b.x, b.y, LINE_INC * closeness);
    }
  }

  // Quantize the surface: near-monochrome cool gray on black, and where
  // marks pile up the light desaturates toward white.
  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++, i++) {
      let v = acc[i];
      if (v > 1) v = 1;
      const disp = v * v;                        // perceptual value curve
      if (disp < 0.003) { setPixel(x, y, 0); continue; }
      const sat = 0.16 * (1 - 0.7 * v);
      setPixel(x, y, hsv(0.60, sat, disp));
    }
  }

  // The Elements themselves, drawn barely - a faint cool core where a
  // body is, so you sense what the relations connect.
  for (const e of els) {
    const px = e.x, py = e.y;
    const x0 = Math.floor(px), y0 = Math.floor(py);
    for (let yy = y0 - 1; yy <= y0 + 1; yy++) {
      if (yy < 0 || yy >= HEIGHT) continue;
      for (let xx = x0 - 1; xx <= x0 + 1; xx++) {
        if (xx < 0 || xx >= WIDTH) continue;
        const ddx = xx - px, ddy = yy - py;
        const w = Math.exp(-(ddx * ddx + ddy * ddy) / 0.9);
        if (w < 0.05) continue;
        const c = hsv(0.60, 0.06, POINT_V * w);
        setPixel(xx, yy, blendMax(getPixel(xx, yy), c));
      }
    }
  }
}
