# LED VFX Program Contract (v1)

This document defines the contract between the render host and a VFX
program. It is written to be read by both humans and the creativity
agent. A VFX program is a single self-contained JavaScript file executed
in a sandboxed QuickJS interpreter. It has no access to the filesystem,
network, timers, or any host API beyond what is documented here.

## Lifecycle

1. The host loads the script once. Top-level code runs at load time, so
   top-level `let`/`const` variables persist for the lifetime of the
   program and are the standard place to keep state.
2. If a `setup()` function is defined, the host calls it once after load.
3. The host then calls the frame function repeatedly until the program
   is swapped out (typically about an hour later). There is no teardown
   hook; programs must not assume they run forever.

A program must define exactly one frame function, which determines its
mode:

## Mode A — pixel (shader style)

```js
function pixel(x, y, t) -> color
```

Called once per pixel per frame. `x` and `y` are integers in
`[0, WIDTH-1]` / `[0, HEIGHT-1]`, `t` is elapsed seconds (float,
monotonic, starts near 0). Return a packed color int (see Colors).
The function must be pure computation: no drawing calls, no I/O.
Use this mode for plasma, noise fields, tunnels, radial/geometric
patterns — anything expressible as f(x, y, t).

## Mode B — buffer (stateful drawing)

```js
function render(t, dt)
```

Called once per frame. `dt` is seconds since the previous frame (float,
typically ~0.033). The program draws into the frame using the drawing
API below. The buffer is NOT cleared between frames — call `fill(0)` to
clear, or exploit persistence for trails via `fade()`. Use this mode
for particles, cellular automata, physics, boids, sand, fire.

## Optional metadata

```js
const meta = { name: "my_effect", fps: 30, inputs: ["audio"] };
```

`fps` is a request (15–60); the host may clamp it. `inputs` declares
which input groups the program reacts to (see Inputs) — used by the
validation harness to know what to exercise, and by the library for
categorization. Omitted fields default sensibly.

## Global environment

Constants:
- `WIDTH`, `HEIGHT` — panel dimensions (currently 64 × 64).

Colors (packed 24-bit int, `0xRRGGBB`):
- `rgb(r, g, b)` — channels 0–255.
- `hsv(h, s, v)` — all params 0–1; `h` wraps, so it is safe to pass
  `t * 0.02` directly for slow hue drift.

Drawing (buffer mode only):
- `setPixel(x, y, color)` — integer coords; out-of-bounds is ignored.
- `getPixel(x, y) -> color`
- `fill(color)` — flood the whole frame.
- `fade(f)` — multiply every channel by `f` (0–1). `fade(0.9)` per
  frame produces smooth motion trails.
- `sprite(palette, grid)` — define a sprite from inline text. Call at
  top level (parsed once at load, never per frame). `palette` maps
  single characters to packed colors; `grid` is a template string, one
  row per line, `.` meaning transparent. Rows may have different
  lengths; width is the longest row. Returns an opaque sprite handle
  with `.w` and `.h`.
- `blit(spr, x, y, opts?)` — draw a sprite with its top-left corner at
  integer `(x, y)` (floored; off-panel parts are clipped). `opts`:
  - `flipX`, `flipY` — booleans, mirror the sprite.
  - `brightness` — 0–1 multiplier on all channels (default 1).
  - `tint` — packed color multiplied per-channel; e.g.
    `hsv(h, 0.6, 1)` recolors a white/gray sprite.

Sprite example:

```js
const MOTH = sprite(
  { w: rgb(230, 220, 200), a: rgb(140, 110, 70) },
  `
  w...w
  wwaww
  .waw.
  `
);
// per frame:  blit(MOTH, mx, my, { flipX: vx < 0, brightness: glow })
```

Sprite guidance: keep them small (4–16 px per side) and low-color
(2–4 palette entries) — at 64×64 a 16 px sprite is already a quarter
of the panel. Animate by defining several sprites and indexing an
array by time: `blit(frames[(t * 8 | 0) % frames.length], x, y)`.

Math (available in both modes):
- All of standard `Math` (sin, cos, hypot, atan2, random, ...).
- `noise2(x, y)`, `noise3(x, y, z)` — simplex noise, returns −1..1.
  Feed it small coordinates (multiply pixel coords by ~0.02–0.1) and
  use a `t`-driven third argument for evolving fields.
- `clamp(v, lo, hi)`, `lerp(a, b, u)`, `smoothstep(lo, hi, v)`,
  `fract(v)`.

## Inputs (read-only, host-sampled)

A global `input` object is refreshed by the host before every frame.
Programs never touch hardware; they read normalized values. Every
group always exists — when a sensor is absent, values sit at neutral
defaults — so reading `input` is always safe. Groups:

- `input.audio` — `{ ok, level, bass, mid, treble, beat }`.
  `ok` is false when no microphone is present. `level` is smoothed
  RMS loudness 0–1; `bass`/`mid`/`treble` are band energies 0–1
  (host does the FFT); `beat` is true only on the frame a beat is
  detected. Defaults to silence.
- `input.button` — `{ down, pressed, released, heldSeconds }`.
  `pressed`/`released` are one-frame edge flags. Defaults to
  untouched.
- `input.clock` — `{ hour, minute, weekday, dayOfYear, daylight }`.
  `hour` is 0–24 as a float (14.5 = 2:30pm); `weekday` 0–6 starting
  Monday; `daylight` is 0–1 (0 = deep night, 1 = midday), computed
  from actual local sun times, so it tracks the seasons. Always
  available.
- `input.env` — `{ ok, tempC, cloud, rain }`. Host-fetched local
  weather; `cloud` and `rain` are 0–1. `ok` is false if the last
  fetch failed (values then hold neutral defaults).

Example: `const glow = 0.3 + 0.7 * input.audio.level * input.audio.level;`

Reactive rules:
- **Degrade gracefully.** A piece must look intentional when its
  inputs are quiet — silence, no button, `env` unavailable. Reactivity
  should feel like the piece noticing the world, not like a VU meter.
- Declare what you react to in `meta.inputs` (e.g. `["audio",
  "clock"]`). The validation harness exercises declared inputs with
  synthesized streams — recorded audio, scripted button presses, and a
  time-warped clock that sweeps a full day in seconds — and also runs
  the piece with all inputs at neutral to check graceful degradation.

## Provenance frontmatter

Every program begins with a frontmatter comment carrying its identity,
design thinking, and lineage. The host ignores it; the library index,
the wall-label display, and future artists read it. Format: YAML
between `/*@vfx` and `@vfx*/`:

```js
/*@vfx
id: 5b1c9c6e-2a1f-4a63-9e0b-3f47d1c2a901
title: The Week It Wouldn't Stop Raining
created: 2026-07-07
artist: creativity-agent v1
lineage:
  - id: 0f8e2d4a-77b1-4c15-8a92-6d3e5f1b2c40
    relation: contrast        # variation | inspiration | contrast
    note: rejected its warm palette; kept the drifting-field motion
influences: [jim-campbell]
rationale: |
  Free prose: what this piece attempts, why now, what it keeps or
  refuses from its antecedents. Written for the next artist.
@vfx*/
```

Rules:
- `id` is a UUID assigned at creation and never changed; it is the
  piece's permanent identity. Resolution from id to file is the
  library's job (`index.json` maps id → path), so references survive
  the library moving hosts. URLs may appear as hints, never as
  identity.
- `lineage` cites antecedent pieces by id. `relation` says how:
  `variation` (direct riff), `inspiration` (looser borrowing),
  `contrast` (deliberate rejection). The `note` says what was kept
  or refused. Seed pieces may have no lineage.
- `influences` names entries from the knowledge base's artist
  dossiers.
- `title` and `rationale` are shown to viewers on the label display.
  Title the piece as an artist would, not as a filename.

## Deliberately omitted (and the idiom to use instead)

The API is a canvas and a clock, not a game engine. The host owns
rendering primitives; programs own all semantics. The following are
intentionally absent — implement them in program code:

- **Collision / proximity** — plain distance checks. With a few dozen
  entities, O(n²) `(dx*dx + dy*dy < r*r)` tests cost microseconds.
- **Rotation** — arbitrary rotation aliases badly at this resolution.
  Use the pixel-art idiom: draw the orientations you need as separate
  sprite frames, or use `flipX`/`flipY` for the four cheap cases.
- **Entities / scene graph** — top-level arrays of plain objects,
  updated in `render()`. Draw order is z-order.
- **Tweening / easing** — `lerp` and `smoothstep` are the whole story.
- **Physics** — integrate velocity yourself: `x += vx * dt`.

## Hard constraints (enforced by the host)

- Frame compute budget: 20 ms. Over-budget frames drop the effective
  frame rate; repeated gross overruns cause the host to swap in a
  fallback program.
- Memory limit: 16 MB. Allocation-heavy per-frame code (building arrays
  of `[r,g,b]` triples, string concatenation in loops) causes GC stutter
  — prefer packed color ints and preallocated typed arrays.
- No `import`, `require`, `eval`, `Function` constructor, or async.
  Runaway loops are interrupted and count as a crash.

## Aesthetic guidance for a 64×64 LED matrix

- Detail below ~3 px reads as noise at viewing distance; favor bold
  shapes, smooth gradients, and motion over fine texture.
- LEDs have a huge dynamic range and no true gray: dark backgrounds
  with bright accents look far better than washed full-field color.
  Keep average brightness moderate — full-field white also strains the
  power supply.
- Perceived brightness is nonlinear; squaring the value channel
  (`v * v`) before `hsv()` gives more natural fades.
- Motion should be visible within 2 seconds but the piece should not
  fully repeat for at least ~30 seconds. Slow evolution reads as alive;
  strobing reads as broken. Avoid full-frame flashes faster than 3 Hz.
- Constrained palettes (2–3 related hues) look intentional; full
  rainbow cycling is the "default settings" look — use it knowingly
  or not at all.
