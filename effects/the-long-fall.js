/*@vfx
id: 6ae2d118-acff-4dfc-88c1-1aa13d474c7b
title: The Long Fall
created: 2026-07-21
artist: Saccade (apprentice name)
lineage:
  - id: ccd1d437-f4f0-4aef-81db-cbd810c60c4b
    relation: variation
    note: >-
      Lengths carried Campbell's recognition threshold from the walker to
      the swimmer; this carries it to the third figure of his own series -
      the faller ("Running Falling"). Same point-light vocabulary: a dozen
      sub-pixel-splatted joints, illegible frozen and unmistakable in
      motion. But it takes the opposite POSITION on motive force. Passerby
      and Lengths were self-propelled - the gait WAS the agency, the body
      its own engine, its phase tied to distance travelled so it never
      skated. This body has stopped propelling itself. Gravity is the only
      clock now: velocity integrates, the descent accelerates to a terminal
      drift, and the figure tumbles because nothing holds it upright. The
      wager is whether the threshold survives surrender - whether you still
      read "a person" in motion that the person is no longer willing.
influences: [jim-campbell]
rationale: |
  One body, a dozen points of pale light, turning slowly as it falls
  through the dark - and falls again, and again. Freeze it and the points
  scatter into abstraction; let it move and a figure resolves, tumbling:
  the head, the spread of the arms, the drift of the legs, read only from
  how they turn together. Jim Campbell's threshold of recognition, carried
  from his walker and swimmer to the last of his trio, the faller.

  Passerby and Lengths were self-propelled. The walker's stride and the
  swimmer's stroke were each the body's own engine, and I tied their phase
  to distance so a planted foot never skated - the gait was the agency.
  This figure has let go. There is no gait; gravity is the only clock. It
  enters high and nearly still, accelerates, settles into a terminal drift,
  and tumbles the whole way down because nothing keeps it upright. Where
  the walker crossed and was gone (transience) and the swimmer turned at
  the wall and came back (endurance), this one is simply given to the fall,
  and another is always beginning it. The direction is left open on
  purpose - falling, sinking, drifting, weightless - Campbell's threshold
  moved from recognition onto meaning itself: you cannot tell, and it does
  not matter; what you read is a person, unmoored.

  The tumble is the quiet craft of it. The API warns that rotation aliases
  at this resolution - true of sprites, but a point cloud rotated by a
  plain 2x2 matrix and each joint sub-pixel-splatted turns silk-smooth, so
  a body can spin where a sprite cannot. Every fall re-rolls its entry,
  its spin, its sideways drift and the loose flail of its limbs, so the
  piece never repeats and never settles - it is a sequence of complete
  descents, not a system winding down to an attractor. Near-monochrome,
  cool as first light; a dark field with one turning body in it.
  Autonomous - the fall needs no conductor, only gravity.
@vfx*/

// the_long_fall - buffer mode, Campbell-lineage point-light figure.
// A single human point cloud (~13 joints) falls through black, tumbling.
// Motive force is GRAVITY, not gait: velocity integrates each frame and is
// capped at a terminal drift, so the descent accelerates from near-still
// then cruises; a per-fall spin rotates the whole cloud (rotation done as
// a 2x2 matrix on the LOCAL joints + sub-pixel splat, which - unlike a
// sprite - does not alias at 64x64). Each joint is splatted into a
// short-decay wake buffer (Campbell diffusion; the fading tail reads as
// the tumble path). At the floor the figure respawns at the top with fresh
// random entry/spin/drift/flail - a renewal process, so the piece never
// settles (see knowledge/craft/attractors.md). No inputs: the fall is its
// own clock. Degrades trivially (nothing to degrade).

const meta = { name: "the_long_fall", fps: 30 };

const TAU = Math.PI * 2;

// --- the figure: a human point cloud in LOCAL (body) coordinates -----------
// +x right, +y down; origin at the centre of mass. ~17px tall (Campbell
// zone). Columns: [localX, localY, brightness, looseness]. Looseness scales
// the gentle limb drift so hands/feet flail more than the torso.
const JOINTS = [
  [ 0.0, -8.0, 0.95, 0.20],   // head (brightest - anchors the read)
  [-3.0, -5.0, 0.70, 0.40],   // shoulder L
  [ 3.0, -5.0, 0.70, 0.40],   // shoulder R
  [-5.5, -6.3, 0.58, 1.00],   // elbow L
  [ 5.5, -6.3, 0.58, 1.00],   // elbow R
  [-7.5, -8.0, 0.68, 1.40],   // hand L (loose - drifts most)
  [ 7.5, -8.0, 0.68, 1.40],   // hand R
  [ 0.0, -2.0, 0.60, 0.15],   // chest
  [ 0.0,  2.0, 0.62, 0.15],   // pelvis
  [-2.6,  5.5, 0.58, 0.80],   // knee L
  [ 2.6,  5.5, 0.58, 0.80],   // knee R
  [-3.4,  9.3, 0.62, 1.20],   // foot L
  [ 3.4,  9.3, 0.62, 1.20],   // foot R
];
const NJ = JOINTS.length;
// Fixed per-joint flail phase (a stable spatial signature, so limbs drift
// coherently rather than shimmering at random).
const JPH = new Float64Array(NJ);
for (let i = 0; i < NJ; i++) JPH[i] = (i * 1.9) % TAU;

// --- fall physics -----------------------------------------------------------
const G = 7.0;           // gravity (px/s^2) - a slow, unhurried acceleration
const VT = 13.0;         // terminal velocity (px/s) - the long drift
const SPAWN_Y = -4;      // centre starts just above the top (lower body shows)
const EXIT_Y = 72;       // respawn once the whole body is below the floor
const FLAIL_W = 1.5;     // limb-drift rate (rad/s)
const FLAIL_AMP = 0.7;   // px, scaled per joint by looseness

// --- wake / diffusion buffer ------------------------------------------------
const acc = new Float32Array(WIDTH * HEIGHT);
const TRAIL = 0.60;              // short silk tail -> conveys the tumble path
const SIGMA2 = 2 * 0.85 * 0.85;  // splat softness (Campbell diffusion)

// --- palette: cool near-white ----------------------------------------------
const HUE = 0.58, SAT = 0.10;

// --- state (top-level persists for the program's life) ---------------------
let cx, cy, vx, vy, theta, spin, ft;
let started = false;

function newFall() {
  cx = 16 + Math.random() * (WIDTH - 32);   // entry x, kept off the side walls
  cy = SPAWN_Y;
  vy = 2.5 + Math.random() * 2.0;           // small initial downward speed
  vx = (Math.random() - 0.5) * 4.0;         // slight sideways drift
  theta = Math.random() * TAU;              // initial orientation
  spin = (Math.random() - 0.5) * 1.4;       // tumble rate (some falls barely spin)
  ft = Math.random() * 100;                 // decorrelate limb flail per fall
}

function setup() {
  newFall();
  cy = HEIGHT * 0.4;   // first faller already mid-descent at t=0 (opening alive)
  vy = VT;
  started = true;
}

// Soft (sub-pixel) splat into the wake buffer - Campbell's diffusion in math.
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
  if (!started) setup();
  if (dt > 0.05) dt = 0.05;   // guard a stall from spiking the integrator

  // Integrate the fall: gravity accelerates it, terminal velocity caps it.
  vy += G * dt;
  if (vy > VT) vy = VT;
  cy += vy * dt;
  cx += vx * dt;
  theta += spin * dt;         // the whole body tumbles
  ft += dt;

  // Fade the wake (short tail = the tumble path; Campbell diffusion / silk).
  for (let i = 0; i < acc.length; i++) acc[i] *= TRAIL;

  // Draw the tumbling figure: rotate each LOCAL joint by theta (2x2 matrix),
  // add the gentle limb drift, translate to the body centre, sub-pixel splat.
  const ct = Math.cos(theta), st = Math.sin(theta);
  for (let j = 0; j < NJ; j++) {
    const J = JOINTS[j];
    const loose = J[3];
    const lx = J[0] + FLAIL_AMP * loose * Math.sin(ft * FLAIL_W + JPH[j]);
    const ly = J[1] + FLAIL_AMP * loose * Math.cos(ft * FLAIL_W * 1.3 + JPH[j] * 1.7);
    const wx = cx + (lx * ct - ly * st);
    const wy = cy + (lx * st + ly * ct);
    splat(wx, wy, J[2]);
  }

  // One body at a time: at the floor, a fresh fall begins (renewal, not loop).
  if (cy > EXIT_Y) newFall();

  // Composite: cool near-white figure on black, perceptual value curve (v*v).
  fill(0);
  for (let i = 0; i < acc.length; i++) {
    let a = acc[i];
    if (a < 0.02) continue;
    if (a > 1) a = 1;
    setPixel(i % WIDTH, (i / WIDTH) | 0, hsv(HUE, SAT, a * a));
  }
}
