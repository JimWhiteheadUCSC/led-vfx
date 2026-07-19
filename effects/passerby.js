/*@vfx
id: e47f033d-ebdb-48bd-8a08-7b7f03ddff6f
title: Passerby
created: 2026-07-10
artist: Saccade (apprentice name)
lineage:
  - id: 2bba4eb5-cd9b-4f2a-bb27-b5929bd67d43
    relation: contrast
    note: kept the soft warm points on black, refused their anonymity —
      Fireflies is a swarm that means nothing and looks fine paused; this
      gathers the same vocabulary into one body, illegible frozen and
      unmistakable walking.
influences: [jim-campbell]
rationale: |
  A single figure crosses the dark, drawn only as a dozen soft points of
  warm light — head, shoulders, hips, knees, ankles, wrists. Freeze any
  instant and it collapses into scattered dots; let it move and a person
  walks, unmistakably, out of almost nothing. This is Jim Campbell's
  threshold of recognition and Johansson's point-light walker: the
  information lives in the gait, not the bitmap. The gait is synthesized,
  not filmed — sinusoidal hip and knee swing, arms in opposite phase,
  phase tied to distance travelled so the feet don't skate, each dot
  sub-pixel splatted for Campbell's diffusion. It keeps to a stroll; the
  street is often empty, then someone passes. By day the figure is fully
  lit; at night it dims to a presence you sense more than read
  (Campbell's "Day for Night" logic, on input.clock.daylight).
@vfx*/

// passerby — buffer mode, Campbell-lineage point-light walker.
// A side-view figure reduced to ~11 joints, each drawn as a soft
// sub-pixel-splatted dot on black. Legible only in motion; abstract
// when paused. Gait is procedural (sinusoidal limbs, knee flex peaking
// mid-swing), and its phase advances with distance so planted feet stay
// planted. One figure crosses at a time; when it leaves, another comes.

const meta = { name: "passerby", fps: 30, inputs: ["clock"] };

const TAU = Math.PI * 2;

// Figure proportions (pixels). ~20 px tall keeps it in the Campbell zone.
const TORSO = 7;      // hip-centre -> shoulder-centre
const HEAD_UP = 3.5;  // shoulder-centre -> head
const THIGH = 5, SHIN = 5;
const UARM = 4.5, FARM = 3.5;
const A_THIGH = 0.55; // hip swing amplitude (rad)
const A_KNEE = 1.0;   // peak knee flex, mid-swing (rad)
const A_ARM = 0.45;   // shoulder swing (rad)
const A_ELBOW = 0.28; // base elbow bend (rad)

// Diffusion buffer: soft dots accumulate here, decay a little each frame
// for a short afterimage, then quantize to the panel.
const acc = new Float32Array(WIDTH * HEIGHT);
const TRAIL = 0.30;
const SIGMA2 = 2 * 0.85 * 0.85;

let walker = null;

function newPass() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = 6 + Math.random() * 3.5;   // px/s — an unhurried stroll
  const y = 27 + Math.random() * 10;       // hip-centre height
  const stride = 18 + Math.random() * 4;   // px advanced per full gait cycle
  const startX = dir > 0 ? -14 : WIDTH + 14;
  walker = { x: startX, y, dir, speed, stride, phase: Math.random() * TAU };
}

function setup() {
  newPass();
  walker.x = WIDTH * 0.22; // first passer already on-screen at t=0
}

function splat(px, py, amp) {
  const fx = Math.floor(px), fy = Math.floor(py);
  for (let yy = fy - 1; yy <= fy + 2; yy++) {
    if (yy < 0 || yy >= HEIGHT) continue;
    for (let xx = fx - 1; xx <= fx + 2; xx++) {
      if (xx < 0 || xx >= WIDTH) continue;
      const dx = xx - px, dy = yy - py;
      acc[yy * WIDTH + xx] += amp * Math.exp(-(dx * dx + dy * dy) / SIGMA2);
    }
  }
}

function render(t, dt) {
  if (!walker) newPass();

  const daylight = clamp(input.clock.daylight, 0, 1);
  const bright = lerp(0.4, 1.0, daylight);      // dim at night, full by day
  const speedScale = lerp(0.8, 1.05, daylight); // and a touch slower at night

  // Advance the figure; tie gait phase to distance so feet don't skate.
  const dx = walker.dir * walker.speed * speedScale * dt;
  walker.x += dx;
  walker.phase += TAU * Math.abs(dx) / walker.stride;

  const dir = walker.dir;
  const ph = walker.phase;
  const cx = walker.x;
  const bob = 0.9 * Math.cos(2 * ph);           // vertical bob, twice per stride
  const hipY = walker.y + bob;
  const shY = hipY - TORSO;
  const headY = shY - HEAD_UP;

  // Decay the afterimage.
  for (let i = 0; i < acc.length; i++) acc[i] *= TRAIL;

  // Torso axis.
  splat(cx, headY, 0.85);
  splat(cx, shY, 0.75);
  splat(cx, hipY, 0.75);

  // Legs: right = ph, left = ph + PI. Knee flex peaks mid-swing.
  for (let s = 0; s < 2; s++) {
    const p = ph + s * Math.PI;
    const th = A_THIGH * Math.sin(p);
    const flex = A_KNEE * Math.max(0, Math.cos(p));
    const sh = th - flex;
    const kx = cx + dir * THIGH * Math.sin(th);
    const ky = hipY + THIGH * Math.cos(th);
    const ax = kx + dir * SHIN * Math.sin(sh);
    const ay = ky + SHIN * Math.cos(sh);
    splat(kx, ky, 0.70);
    splat(ax, ay, 0.80);
  }

  // Arms swing opposite to the same-side leg.
  for (let s = 0; s < 2; s++) {
    const p = ph + Math.PI + s * Math.PI; // right arm = ph+PI, left arm = ph
    const ua = A_ARM * Math.sin(p);
    const eb = A_ELBOW + 0.30 * Math.max(0, Math.sin(p));
    const fa = ua - eb;
    const ex = cx + dir * UARM * Math.sin(ua);
    const ey = shY + UARM * Math.cos(ua);
    const wx = ex + dir * FARM * Math.sin(fa);
    const wy = ey + FARM * Math.cos(fa);
    splat(ex, ey, 0.60);
    splat(wx, wy, 0.70);
  }

  // Paint: warm-white on black, perceptual value curve (v*v).
  fill(0);
  for (let i = 0; i < acc.length; i++) {
    const a = acc[i];
    if (a < 0.02) continue;
    const base = a > 1 ? 1 : a;
    const v = base * base * bright;
    setPixel(i % WIDTH, (i / WIDTH) | 0, hsv(0.09, 0.16, v));
  }

  // One passer at a time.
  if ((dir > 0 && walker.x > WIDTH + 14) || (dir < 0 && walker.x < -14)) newPass();
}