# LED VFX — an autonomous LED artist

A Raspberry Pi 4 drives a 64×64 HUB75 LED matrix (Adafruit RGB Matrix
Bonnet) that displays generative art around the clock. Once an hour, an
LLM-driven "creativity agent" studies a markdown knowledge base and its
own archive of past works, then writes a new effect program. Over time
the agent is meant to develop a recognizable artistic practice: recurring
motifs, lineage between pieces, an evolving style manifesto. A small
HDMI screen serves as the "wall label," showing the current piece's
title and rationale.

## The contract is law

`docs/VFX_API.md` is the authoritative contract between the render host
and effect programs. Read it before touching anything. Key facts:

- Effect programs are single-file JavaScript, run in a sandboxed QuickJS
  interpreter. No imports, no I/O, no host access beyond documented
  globals.
- Two modes: `pixel(x, y, t)` (shader-style) or `render(t, dt)` (buffer
  mode with `setPixel`/`fill`/`fade`/`sprite`/`blit`).
- Colors are packed 24-bit ints from `rgb()`/`hsv()` — never per-pixel
  arrays (GC pressure).
- A read-only `input` object (audio / button / clock / env) is sampled
  by the host each frame. Programs never touch hardware.
- Every program starts with `/*@vfx ... @vfx*/` YAML frontmatter: UUID
  identity, title, rationale, lineage (variation | inspiration |
  contrast), influences. `index.json` maps UUID → path. Frontmatter that
  fails to parse fails validation, same as code that fails to run.

## Design razor (do not violate)

The API is a canvas and a clock, not a game engine. The host owns
rendering primitives (fast pixel pushing); programs own all semantics.
Collision, rotation, scene graphs, tweening, physics are deliberately
omitted — the spec documents the user-code idiom for each. Before adding
any host feature ask: "does it make the host faster at putting pixels
down, or does it make decisions about what the program means?" Only the
former passes. (Precedent: PICO-8.)

## Architecture

Two loops sharing a library:

1. **Render loop (always on):** host daemon loads current program into
   QuickJS, calls it per frame under a 20 ms budget, pushes frames to
   the display. Watchdog catches exceptions/overruns and falls back to a
   known-good library piece. New programs crossfade in, never blank.
2. **Creativity loop (hourly, systemd timer):** agent reads
   `knowledge/*.md` + `index.json` + recent pieces (including their GIF
   previews — the agent should SEE its past work), writes a new program
   with frontmatter, which must pass the validation harness before
   deployment. Failures feed back for up to 3 retries, then fall back to
   replaying a library piece. Agent may append lessons to the knowledge
   base.

Validation harness (headless): run ~300 frames; check no exceptions,
frame time within budget, liveliness metrics (temporal variance, mean
brightness, spatial entropy — not frozen/black/flat); exercise declared
inputs with synthesized streams (recorded audio, scripted button
presses, time-warped clock sweeping a day in seconds) AND with all
inputs neutral (graceful-degradation check); verify frontmatter parses,
UUID present, lineage refs resolve; render a preview GIF stored beside
the piece.

## Platform strategy

Developed on Windows first, deployed to Raspberry Pi 4 via this git
repo. Therefore:

- **Display abstraction is mandatory.** `Display` interface with
  `MatrixDisplay` (uses the `rpi-led-matrix` npm package — N-API
  bindings to hzeller/rpi-rgb-led-matrix; native compile is skipped
  with a warning on non-Pi machines, so it can stay a normal dependency
  but must be lazily imported) and `SimDisplay` (local web server
  streaming frames over WebSocket to a browser-canvas page drawing
  chunky LED-style pixels — later doubles as a remote mirror of the
  live panel). Config flag selects. Everything except MatrixDisplay
  must run on Windows.
- Host language: Node.js 20+ LTS everywhere (official ARM64 builds run
  on the Pi); single language across host, stdlib, effects, harness,
  and agent. TypeScript welcome.
- Sandbox: `quickjs-emscripten` (QuickJS compiled to WASM) — memory
  limits + interrupt handler, identical on Windows and Pi, pure npm
  install. NEVER use `node:vm` for effect programs (not a security
  boundary). Critical design rule: ONE sandbox boundary crossing per
  frame — the entire stdlib (setPixel/fill/fade/sprite/blit/rgb/hsv/
  noise2/noise3/clamp/lerp/smoothstep/fract, and the pixel-mode
  per-pixel loop) lives inside the sandbox as an injected `prelude.js`;
  the host calls a single renderFrame(t, dt, input) and reads back the
  12 KB RGB buffer. The prelude is shared verbatim by host, validator,
  and the agent's study materials. Real simplex noise in the prelude
  (port or vendor one), NOT the sin-hash stub from early prototypes.
- Supporting packages: `@anthropic-ai/sdk` (agent), `js-yaml`
  (frontmatter), `gifenc` (previews), `suncalc` (daylight), built-in
  fetch (weather). Audio capture is the known rough edge in Node: on
  the Pi, spawn `arecord` and read PCM from stdout, band-split with
  `fft.js`; in the sim, fake audio or drive it from the sim page.
- Pi deploy notes (hardware bring-up checklist): 64×64 needs the E
  address-line jumper soldered on the bonnet; GPIO4→GPIO18 jumper mod
  for flicker-free PWM; `--led-slowdown-gpio=2` or higher on Pi 4;
  blacklist `snd_bcm2835` (audio conflicts with PWM); `isolcpus=3` in
  cmdline.txt; Raspberry Pi OS Lite 64-bit, headless; audio input via
  USB mic (HUB75 eats the GPIO header). Wall label: separate small
  HDMI screen, serve title/rationale from current piece's frontmatter.

## Repo layout

- `docs/VFX_API.md` — the contract (also the agent's primary study text)
- `effects/` — seed exemplar programs (uniform frontmatter; koi_pond
  demonstrates lineage citation)
- `index.json` — UUID → path map for the archive
- `knowledge/` — (to create) craft notes, artist dossiers (start with
  Jim Campbell, Vera Molnár, Kim Asendorf, demoscene), agent's lessons-learned and style manifesto
- `host/` — render daemon, display backends, input sampling, QuickJS
  runtime with the stdlib globals, wall-label server (`host/wallLabel/`)
- `validate/` — (to create) headless harness as described above
- `agent/` — (to create) hourly creativity session script (Anthropic
  API)

## Build phases

1. Host runtime on SimDisplay: quickjs-emscripten embedding with the
   full stdlib prelude injected in-sandbox, one-crossing-per-frame
   loop, browser-canvas sim page, all three seed effects rendering in
   the browser on Windows.
2. Validation harness (reuses the runtime headless) + GIF preview
   rendering + frontmatter/lineage checks + neutral-input sweep.
3. Input sampling: clock (real, suncalc for daylight), audio (arecord
   pipe + fft.js on Pi; sim-page fake on Windows), button, env
   (weather fetch, cached, `ok:false` on failure).
4. Creativity agent session + library/index management + knowledge seed
   docs.
5. Pi bring-up: MatrixDisplay backend, systemd units (render daemon,
   hourly agent timer), wall-label display server.

## Conventions

- Effects are self-contained single files; frontmatter travels with
  code. The file IS the prompt for any future artist agent.
- The knowledge base is written FOR the agent — when a design decision
  teaches an idiom (like the deliberate omissions), document the idiom
  where the agent will read it.
- Aesthetic ground rules live in the spec's guidance section: dark
  backgrounds + bright accents, v*v perceptual curve, constrained
  palettes, motion within 2 s / no full repeat under ~30 s, no
  full-frame strobing, reactive pieces must look intentional in
  silence.
