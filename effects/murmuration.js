/*@vfx
id: 9cad665f-332e-477f-a0f3-9348281524c6
title: Murmuration
created: 2026-07-10
artist: Saccade (apprentice name)
lineage:
  - id: 2bba4eb5-cd9b-4f2a-bb27-b5929bd67d43
    relation: variation
    note: >-
      Kept Fireflies' warm-points-on-black swarm, but changed what steers
      it. Fireflies drives each spark independently along a noise field,
      so the swarm is a texture that means nothing collectively and looks
      fine paused. Here the sparks couple to their neighbours
      (separation / alignment / cohesion), and the swarm stops being many
      things and becomes one thing - a flock, legible only by how it
      wheels.
  - id: e47f033d-ebdb-48bd-8a08-7b7f03ddff6f
    relation: inspiration
    note: >-
      Same Campbell wager as Passerby - recognition lives in the motion,
      not the frame - moved from one body to the body of a crowd. Passerby
      put the threshold in a single figure; this argues the threshold can
      live in a collective, where no single dot is a bird and the flock
      is the figure.
influences: [jim-campbell, casey-reas]
rationale: |
  A murmuration is the plainest proof of Campbell's thesis I know: freeze
  a wheeling cloud of starlings and it is a meaningless smudge of dots;
  let it turn and it is unmistakably alive, one body breathing. So this
  is Passerby's wager relocated - recognition carried entirely by motion -
  but the figure is now a crowd, and no single point is ever a bird. That
  relocation is also where Reas enters: the flock is not drawn, it is
  GROWN, from three tiny per-neighbour Behaviours (steer apart when too
  close, match your neighbours' heading, drift toward their centre) plus a
  slow reversing wind. Sixty-four Elements on a sixty-four-square panel -
  the shape-shifting knot, the density that thickens and thins, the way it
  banks as one - none of it is authored frame by frame; it emerges and
  never repeats.

  The one detail I did author is the shimmer. Each bird's brightness is
  its heading dotted against a slowly turning light: birds banking toward
  the sun flash pale, birds turning away go dark, so as a wave of turning
  ripples through the flock a wave of light ripples with it - the real
  murmuration's silver flicker, and here the piece's only "sound." The
  panel is silent where a demo would have music; a murmuration is the
  right subject for that silence, because its name means both the flock
  and a low sound just under hearing. Near-monochrome on black: warm gold
  by day, and by clock it drifts the long way round the wheel - through
  rose and violet, never through green - to a cool dusk silver at night,
  dimming to a presence you sense more than read (Campbell's Day for
  Night). Untouched, at neutral clock, it is a rose-violet flock turning
  at dusk.
@vfx*/

// murmuration — buffer mode, Campbell/Reas lineage.
// ~64 boids (separation/alignment/cohesion) + a slow reversing swirl and
// soft containment, splatted sub-pixel on black with short trails. Each
// bird's brightness is a "banking flash": heading dotted against a slowly
// rotating light, so a wave of turning becomes a wave of shimmer. The
// flock is grown, not drawn; no single dot reads as a bird. input.clock
// sets a dusk-to-day mood; everything else is autonomous emergence.

const meta = { name: "murmuration", fps: 30, inputs: ["clock"] };

const N = 64;
const CX = 31.5, CY = 31.5;

// Behaviour tuning (px, seconds).
const R_NEIGH = 10.0, R2 = R_NEIGH * R_NEIGH; // perception radius
const R_SEP = 4.5;                             // personal space
const COH = 0.85;    // drift toward neighbours' centre
const ALI = 1.4;     // match neighbours' heading
const SEP = 10.0;    // steer apart when too close
const SWIRL_AMP = 0.14, SWIRL_W = 0.5; // slow reversing wind (~6s each way)
const WALL = 4.5, MARGIN = 12.0;       // soft containment near the edges
const MAXV = 18.0, MINV = 10.0;        // always moving (a flock never stops)

// State (top-level, persists for the program's life).
const bx = new Float32Array(N), by = new Float32Array(N);
const bvx = new Float32Array(N), bvy = new Float32Array(N);
// Per-frame steering accumulators (reused, not reallocated).
const cohx = new Float32Array(N), cohy = new Float32Array(N);
const alx = new Float32Array(N), aly = new Float32Array(N);
const sepx = new Float32Array(N), sepy = new Float32Array(N);
const cnt = new Int32Array(N);

let started = false;

function setup() {
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = MINV + Math.random() * (MAXV - MINV);
    // Start already gathered near centre so the opening slice reads as a
    // moving flock immediately (not a scatter that has to converge).
    bx[i] = CX + (Math.random() - 0.5) * 20;
    by[i] = CY + (Math.random() - 0.5) * 20;
    bvx[i] = Math.cos(a) * sp;
    bvy[i] = Math.sin(a) * sp;
  }
  started = true;
}

// Additive sub-pixel splat (Campbell diffusion): overlapping light sums,
// so where the flock crowds it flashes. rgb() clamps for us.
function addPix(x, y, r, g, b) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const c = getPixel(x, y);
  setPixel(x, y, rgb(((c >> 16) & 255) + r, ((c >> 8) & 255) + g, (c & 255) + b));
}
function splat(px, py, r, g, b) {
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const fx = px - x0, fy = py - y0;
  addPix(x0, y0, r * (1 - fx) * (1 - fy), g * (1 - fx) * (1 - fy), b * (1 - fx) * (1 - fy));
  addPix(x0 + 1, y0, r * fx * (1 - fy), g * fx * (1 - fy), b * fx * (1 - fy));
  addPix(x0, y0 + 1, r * (1 - fx) * fy, g * (1 - fx) * fy, b * (1 - fx) * fy);
  addPix(x0 + 1, y0 + 1, r * fx * fy, g * fx * fy, b * fx * fy);
}

function render(t, dt) {
  if (!started) setup();
  if (dt > 0.05) dt = 0.05; // guard against a stall spiking the integrator

  // --- flocking: three Behaviours, computed once per pair -----------------
  for (let i = 0; i < N; i++) {
    cohx[i] = 0; cohy[i] = 0; alx[i] = 0; aly[i] = 0;
    sepx[i] = 0; sepy[i] = 0; cnt[i] = 0;
  }
  for (let i = 0; i < N; i++) {
    const xi = bx[i], yi = by[i], vxi = bvx[i], vyi = bvy[i];
    for (let j = i + 1; j < N; j++) {
      const dx = bx[j] - xi, dy = by[j] - yi;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R2 || d2 < 1e-6) continue;
      // cohesion + alignment (symmetric, applied to both)
      cohx[i] += bx[j]; cohy[i] += by[j]; cnt[i]++;
      cohx[j] += xi;    cohy[j] += yi;    cnt[j]++;
      alx[i] += bvx[j]; aly[i] += bvy[j];
      alx[j] += vxi;    aly[j] += vyi;
      if (d2 < R_SEP * R_SEP) {
        const d = Math.sqrt(d2);
        const f = (R_SEP - d) / (R_SEP * d); // push apart, softer with distance
        const sfx = -dx * f, sfy = -dy * f;
        sepx[i] += sfx; sepy[i] += sfy;
        sepx[j] -= sfx; sepy[j] -= sfy;
      }
    }
  }

  const sw = SWIRL_AMP * Math.sin(t * SWIRL_W); // the reversing wind
  for (let i = 0; i < N; i++) {
    const x = bx[i], y = by[i];
    let vx = bvx[i], vy = bvy[i];
    let ax = 0, ay = 0;
    if (cnt[i] > 0) {
      const inv = 1 / cnt[i];
      ax += (cohx[i] * inv - x) * COH;
      ay += (cohy[i] * inv - y) * COH;
      ax += (alx[i] * inv - vx) * ALI;
      ay += (aly[i] * inv - vy) * ALI;
    }
    ax += sepx[i] * SEP; ay += sepy[i] * SEP;
    // slow whole-flock rotation (wheels one way, then the other)
    ax += -(y - CY) * sw; ay += (x - CX) * sw;
    // soft containment: turn back before the edge, so it wheels in-frame
    if (x < MARGIN) ax += WALL * (MARGIN - x);
    else if (x > WIDTH - MARGIN) ax -= WALL * (x - (WIDTH - MARGIN));
    if (y < MARGIN) ay += WALL * (MARGIN - y);
    else if (y > HEIGHT - MARGIN) ay -= WALL * (y - (HEIGHT - MARGIN));

    vx += ax * dt; vy += ay * dt;
    let sp = Math.hypot(vx, vy);
    if (sp > MAXV) { const s = MAXV / sp; vx *= s; vy *= s; }
    else if (sp < MINV) {
      if (sp > 1e-4) { const s = MINV / sp; vx *= s; vy *= s; }
      else { const a = Math.random() * Math.PI * 2; vx = Math.cos(a) * MINV; vy = Math.sin(a) * MINV; }
    }
    bvx[i] = vx; bvy[i] = vy;
    bx[i] = x + vx * dt; by[i] = y + vy * dt;
  }

  // --- render: short trails, then the banking-flash flock -----------------
  fade(0.7);

  const daylight = clamp(input.clock.daylight, 0, 1);
  // Dusk-to-day palette, taken the long way round the wheel (through rose
  // and violet, never green): cool silver at night -> warm gold by day.
  const hue = lerp(-0.40, 0.09, daylight); // hsv() wraps -0.40 -> 0.60
  const sat = lerp(0.22, 0.12, daylight);
  const bright = lerp(0.55, 1.0, daylight); // Day for Night: dim, not gone

  const Lx = Math.cos(t * 0.05), Ly = Math.sin(t * 0.05); // the turning light
  for (let i = 0; i < N; i++) {
    const vx = bvx[i], vy = bvy[i];
    const sp = Math.hypot(vx, vy) + 1e-6;
    const dot = (vx * Lx + vy * Ly) / sp;   // -1 (away) .. 1 (toward light)
    const flash = 0.5 + 0.5 * dot;
    let v = (0.22 + 0.78 * flash) * bright;
    v = v * v; // perceptual value curve
    const c = hsv(hue, sat, v);
    splat(bx[i], by[i], (c >> 16) & 255, (c >> 8) & 255, c & 255);
  }
}
