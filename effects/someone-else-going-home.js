/*@vfx
id: 4f1bc119-54e4-4def-9b24-336dc17f86d6
title: Someone Else Going Home
created: 2026-09-24
artist: Saccade (apprentice name)
lineage:
  - id: 2c0bcddb-44ec-4053-b26c-8eb08fce32ea
    relation: variation
    note: >-
      Each One the Sun laid a window's patch of light on a wall and let
      the tree outside be the only thing that moved; the source stood
      still and the medium shivered. Same apparatus, the other way up and
      after dark. Here the window, the glazing bars and the ceiling are
      fixed and nothing between them moves - it is the SOURCE that
      travels, down a street nobody can see, and the window's image
      swings across the ceiling after it.
  - id: 959b82f7-5cf2-4dd1-8275-79b77fac9a63
    relation: contrast
    note: >-
      Between the Lamp and the Wall kept the lamp in the room and sent
      people across its light; the bodies were the subject, rendered as
      subtraction. This refuses a body of any kind. Nobody is in this
      room except whoever is lying awake under the ceiling, and the
      people the piece is about are outside, in cars, and appear only as
      the one thing their headlights do to a room they will never enter.
      The lamp crossed the wall's subject; here the subject is the lamp.
influences: [jim-campbell]
rationale: |
  A bedroom ceiling at night, seen from the bed. Across the road a
  garden lamp has been left on, and it lays a faint amber copy of the
  window up there - three panes, the glazing bars, the edge of a
  curtain that stirs in the draught from the open sash. That copy never
  moves. Everything else on the panel is traffic.

  A car goes by outside and the window goes by overhead: a second,
  brighter copy of it comes in at one corner, swings across the ceiling
  fanning as it goes, and leaves by the other, with a dim red one
  following it out - the tail lights. It always crosses the wrong way.
  The light comes up through the window from below, so its image runs
  opposite to the car, and the far side of the ceiling runs faster than
  the near side, which is why the bars fan out instead of sliding.
  Everyone who has lain awake in a room on a street knows this image
  and nobody has ever seen the cars that made it.

  Which is the Campbell wager at its most reduced: no body, no figure,
  not even a vehicle - one bright parallelogram - and still you read
  who it was. A van's lights are higher, so its window lies nearer the
  wall. The far lane crosses slower and the other way. A bicycle is a
  single faint copy going by at walking pace. Warm halogen is an old
  car, blue-white is a new one. And now and then one slows, the red
  brightens, the window stops on the ceiling and holds there for a few
  seconds - and goes out. Someone is home. Much later, perhaps, that
  same window lights where it was, waits, and pulls away.

  The hour sets the traffic: thick in the evening, thin before dawn,
  never quite nothing. By day the room fills with its own light and the
  crossings pale into it. Nothing accumulates and nothing settles; it
  is a street, and the cars are other people, forever.
@vfx*/

// someone_else_going_home - buffer mode, Campbell lineage.
//
// The panel is a CEILING. Coordinates in metres: window wall at x=0,
// room x>0, street x<0, ceiling z=H. Every light source outside is a
// point S=(-Xs, sy, zs); for a ceiling point C=(cx, cy, H) the ray C->S
// crosses the window plane at
//     u  = Xs / (Xs + cx)
//     wz = zs + u * (H - zs)          <- depends on cx only (one ROW)
//     wy = sy * (1 - u) + u * cy      <- linear across the row
// and C is lit iff (wy, wz) falls in a pane. So each lamp costs one
// row setup (vertical frame + meeting rail + falloff) and then a linear
// walk over only the pixels inside the window's horizontal extent - no
// divide, no sqrt, no trig per pixel. A source's finite radius r gives a
// penumbra of r*(1-u) in window coordinates, floored at half a pixel's
// footprint so every edge is antialiased.
//
// The whole image follows from that projection and nothing else:
//   - the patch moves at -sy*cx/Xs: opposite to the car, faster far from
//     the window, so the glazing bars fan;
//   - the band's inner edge sits at cx = Xs*(H-WTOP)/(WTOP-zs): higher
//     lamps (vans) throw the window nearer the wall, nearer lanes too;
//   - two headlights side by side are two lamps at Xs +/- 0.72, which
//     doubles the bars at the edges of the sweep and merges them in the
//     middle.
// Headlights have a forward beam (bright while approaching, spill only
// once past); tail lights a rearward one, brighter under braking.
//
// Attractors (knowledge/craft/attractors.md): a renewal process -
// every vehicle re-rolls lane, kind, height, speed, colour and power;
// arrivals park and much later depart; nothing accumulates (the light
// field is wiped every frame) and nothing contracts. The only standing
// image is the garden lamp's, and even that has a curtain moving in it.
//
// input.clock: hour sets traffic density (never zero), daylight fills
// the room with ambient light so crossings pale by day. Smoothed.

const meta = { name: "someone_else_going_home", fps: 30, inputs: ["clock"] };
const TAU = Math.PI * 2;

// --- the room ----------------------------------------------------------------
const H = 2.6;                                   // ceiling height
const WTOP = 2.22, WBOT = 0.95, WY = 0.62;       // the window's opening
const BARX = 0.207, BARW = 0.042;                // two glazing bars (half-width)
const RAILZ = 1.93, RAILW = 0.03;                // the sash's meeting rail
const CX0 = 1.45, CX1 = 5.5, PXM = (CX1 - CX0) / 63;   // ceiling on the panel
const rowCx = new Float64Array(HEIGHT);
for (let y = 0; y < HEIGHT; y++) rowCx[y] = CX0 + (HEIGHT - 1 - y) * PXM;

// --- the curtain's edge, as a function of height on the window ---------------
const CN = 33, CZ0 = 1.4, CZ1 = 2.3, CQ = (CN - 1) / (CZ1 - CZ0);
const curt = new Float64Array(CN);

// --- light, wiped every frame, and its tone curve ----------------------------
const acR = new Float32Array(WIDTH * HEIGHT);
const acG = new Float32Array(WIDTH * HEIGHT);
const acB = new Float32Array(WIDTH * HEIGHT);
const TN = 1024, TMAX = 4.0, TQ = (TN - 1) / TMAX;
const tone = new Uint8Array(TN);
for (let k = 0; k < TN; k++) {
  const T = 1 - Math.exp(-1.5 * (k / TQ));
  tone[k] = Math.round(255 * Math.pow(T, 1.4));
}

// One point source outside, through the window, onto the ceiling.
function lamp(Xs, sy, zs, rad, I, cr, cg, cb) {
  if (I < 0.003) return;
  const hz = H - zs;
  for (let py = 0; py < HEIGHT; py++) {
    const cx = rowCx[py];
    const u = Xs / (Xs + cx);
    const wz = zs + u * hz;
    if (wz > WTOP + 0.06 || wz < WBOT - 0.06) continue;
    const pen = rad * (1 - u);
    let sz = 0.5 * PXM * hz * u * u / Xs; if (pen > sz) sz = pen;
    let sd = WTOP - wz;
    const b = wz - WBOT; if (b < sd) sd = b;
    let r = wz - RAILZ; if (r < 0) r = -r; r -= RAILW; if (r < sd) sd = r;
    let mz = sd / (2 * sz) + 0.5;
    if (mz <= 0) continue; if (mz > 1) mz = 1;
    const rf = mz * u * u * I;              // falloff with distance into the room
    const B = u * PXM;
    const A = sy * (1 - u) - 31.5 * B;
    let sw = 0.5 * B; if (pen > sw) sw = pen;
    const inv = 1 / (2 * sw);
    let p0 = Math.ceil((-WY - sw - A) / B), p1 = Math.floor((WY + sw - A) / B);
    if (p0 < 0) p0 = 0; if (p1 > WIDTH - 1) p1 = WIDTH - 1;
    if (p1 < p0) continue;
    let ci = (wz - CZ0) * CQ;
    if (ci < 0) ci = 0; if (ci > CN - 1.001) ci = CN - 1.001;
    const c0 = ci | 0;
    const cE = curt[c0] + (curt[c0 + 1] - curt[c0]) * (ci - c0);
    const rr = cr * rf, gg = cg * rf, bb = cb * rf;
    const row = py * WIDTH;
    let wy = A + B * p0;
    for (let px = p0; px <= p1; px++, wy += B) {
      const aw = wy < 0 ? -wy : wy;
      let d = WY - aw;
      let e = aw - BARX; if (e < 0) e = -e; e -= BARW; if (e < d) d = e;
      e = cE - wy; if (e < d) d = e;
      let m = d * inv + 0.5;
      if (m <= 0) continue; if (m > 1) m = 1;
      const i = row + px;
      acR[i] += rr * m; acG[i] += gg * m; acB[i] += bb * m;
    }
  }
}

// --- the street ----------------------------------------------------------------
const NEAR_X = 6.5, FAR_X = 9.8;
const SPAN = 34, DEC = 3.2, ACC = 1.8;
const cars = [];
let parked = null, parkedT = 0, nextT = 0.6;
let dayS = 0.5, started = false;

function makeCar(near) {
  const r = Math.random();
  const kind = r < 0.07 ? 2 : (r < 0.22 ? 1 : 0);    // 0 car, 1 van, 2 bicycle
  const c = {
    Xs: (near ? NEAR_X : FAR_X) + (Math.random() - 0.5) * 0.6,
    dir: near ? 1 : -1, sy: 0, v: 0, vmax: 0,
    zs: 0, zt: 0, K: 0, KT: 0, pair: 1, len: 4.3, rad: 0.07,
    cr: 1, cg: 0.88, cb: 0.7, mode: 0, stopAt: 0, timer: 0,
    on: 1, onT: 1, brake: 0
  };
  if (kind === 0) {
    c.zs = 0.60 + Math.random() * 0.12; c.zt = 0.8;
    c.K = 80 * (0.8 + 0.45 * Math.random()); c.KT = 22;
    c.vmax = 4.6 + Math.random() * 3.2;
  } else if (kind === 1) {
    c.zs = 1.0 + Math.random() * 0.25; c.zt = 1.1; c.len = 6.5;
    c.K = 95; c.KT = 26; c.vmax = 4.2 + Math.random() * 2.6;
  } else {
    c.zs = 0.95; c.zt = 0.8; c.pair = 0; c.len = 1.7; c.rad = 0.04;
    c.K = 26; c.KT = 7; c.vmax = 3.6 + Math.random() * 1.8;
  }
  if (Math.random() < 0.5) { c.cr = 0.84; c.cg = 0.92; c.cb = 1.0; }   // LED
  c.v = c.vmax;
  c.sy = -c.dir * SPAN;
  return c;
}

function setup() {
  const c = makeCar(true); c.sy = -9; cars.push(c);   // someone already passing
  dayS = clamp(input.clock.daylight, 0, 1);
  started = true;
}

function drawCar(c) {
  if (c.on < 0.01) return;
  const Xs = c.Xs, sy = c.sy, dir = c.dir;
  const hp = c.pair ? 0.5 : 1;
  const cc = -sy * dir / Math.sqrt(Xs * Xs + sy * sy);   // window vs heading
  const beam = 0.35 + 0.65 * smoothstep(-0.2, 0.9, cc);
  const hz = H - c.zs;
  const IH = c.K * beam / (Xs * Xs + sy * sy + hz * hz) * c.on * hp;
  const ty = sy - dir * c.len;
  const ct = -ty * dir / Math.sqrt(Xs * Xs + ty * ty);
  const tb = (0.2 + 0.8 * smoothstep(0.3, -0.9, ct)) * (1 + 2.2 * c.brake);
  const tz = H - c.zt;
  const IT = c.KT * tb / (Xs * Xs + ty * ty + tz * tz) * c.on * hp;
  if (c.pair) {
    lamp(Xs - 0.72, sy, c.zs, c.rad, IH, c.cr, c.cg, c.cb);
    lamp(Xs + 0.72, sy, c.zs, c.rad, IH, c.cr, c.cg, c.cb);
    lamp(Xs - 0.72, ty, c.zt, 0.05, IT, 1.0, 0.09, 0.03);
    lamp(Xs + 0.72, ty, c.zt, 0.05, IT, 1.0, 0.09, 0.03);
  } else {
    lamp(Xs, sy, c.zs, c.rad, IH, c.cr, c.cg, c.cb);
    lamp(Xs, ty, c.zt, 0.03, IT, 1.0, 0.09, 0.03);
  }
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;

  // The hour sets the traffic: busiest late afternoon, thinnest before dawn.
  let hour = input.clock.hour; if (!(hour === hour)) hour = 12;
  const quiet = 0.5 + 0.5 * Math.cos((hour - 3.5) / 24 * TAU);
  const mean = lerp(1.6, 5.5, quiet);
  nextT -= dt;
  let moving = 0;
  for (let k = 0; k < cars.length; k++) if (cars[k].mode === 0) moving++;
  if (nextT <= 0 && moving < 4) {
    const near = Math.random() < 0.55;
    const c = makeCar(near);
    // Now and then one of them is coming home.
    if (near && !parked && Math.random() < 0.14) {
      let busy = false;
      for (let k = 0; k < cars.length; k++) if (cars[k].mode >= 1) busy = true;
      if (!busy) { c.mode = 1; c.stopAt = -3 + Math.random() * 7; }
    }
    cars.push(c);
    let e = -Math.log(1 - Math.random()); if (e > 3) e = 3;
    nextT = 0.9 + mean * e;
  }
  // And, much later, leaving again.
  if (parked) {
    parkedT += dt;
    if (parkedT > 35 && Math.random() < dt / 25) {
      const c = parked; parked = null;
      c.mode = 4; c.onT = 1; c.timer = 2.2 + Math.random() * 1.5; c.v = 0;
      cars.push(c);
    }
  }

  for (let k = cars.length - 1; k >= 0; k--) {
    const c = cars[k];
    c.brake *= Math.exp(-dt * 4);
    if (c.mode === 1) {                       // braking toward the kerb
      const dist = (c.stopAt - c.sy) * c.dir;
      const vb = Math.sqrt(2 * DEC * (dist > 0 ? dist : 0));
      if (vb < c.v) { c.v = vb; c.brake = 1; }
      if (dist < 0.03) { c.v = 0; c.mode = 2; c.timer = 4 + Math.random() * 5; }
    } else if (c.mode === 2) {                // stopped, lights still on
      c.brake = 1; c.timer -= dt;
      if (c.timer <= 0) { c.mode = 3; c.onT = 0; }
    } else if (c.mode === 3) {                // lights going out
      if (c.on < 0.01) { c.on = 0; cars.splice(k, 1); parked = c; parkedT = 0; continue; }
    } else if (c.mode === 4) {                // lights on, waiting
      c.timer -= dt;
      if (c.timer <= 0) c.mode = 5;
    } else if (c.mode === 5) {                // pulling away
      c.v += ACC * dt;
      if (c.v >= c.vmax) { c.v = c.vmax; c.mode = 0; }
    }
    let ek = dt * 6; if (ek > 1) ek = 1;
    c.on += (c.onT - c.on) * ek;
    c.sy += c.dir * c.v * dt;
    if (c.dir * c.sy > SPAN) cars.splice(k, 1);
  }

  // The curtain, moving a little in the draught from the open sash.
  for (let j = 0; j < CN; j++) {
    const z = CZ0 + j / CQ;
    curt[j] = 0.40 + 0.07 * noise2(z * 2.2 + 3.1, t * 0.11) + 0.03 * Math.sin(t * 0.37 + z * 3.0);
  }

  const day = clamp(input.clock.daylight, 0, 1);
  let gk = dt * 0.5; if (gk > 1) gk = 1;
  dayS += (day - dayS) * gk;
  const amb = lerp(0.018, 0.17, dayS * dayS);
  acR.fill(amb * 0.72); acG.fill(amb * 0.82); acB.fill(amb * 1.1);

  // Across the road a garden lamp is left on all night.
  lamp(12.0, 3.2, 0.12, 0.12, 60 / 160.1, 1.0, 0.6, 0.26);
  for (let k = 0; k < cars.length; k++) drawCar(cars[k]);

  let i = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++, i++) {
      let a = (acR[i] * TQ) | 0; if (a > TN - 1) a = TN - 1;
      let g = (acG[i] * TQ) | 0; if (g > TN - 1) g = TN - 1;
      let b = (acB[i] * TQ) | 0; if (b > TN - 1) b = TN - 1;
      setPixel(x, y, (tone[a] << 16) | (tone[g] << 8) | tone[b]);
    }
  }
}
