# Handoff note — 2026-07-10

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: Build phase 3 complete

## What's done

- **`host/input/`** — real input sampling, composed rather than a single
  polymorphic backend (see `C:\Users\Jim\.claude\plans\glistening-sparking-fiddle.md`
  for the full design writeup):
  - `clock.js` — real hour/minute/weekday(Monday=0)/dayOfYear from `Date`;
    `daylight` from `suncalc`'s solar altitude (this suncalc build
    returns **degrees**, not radians — tripped me up initially),
    smoothstepped across a -6°..10° twilight band into 0..1.
  - `env.js` — `EnvSampler` polls Open-Meteo (free, no key) every 15 min,
    caches the result, `ok:false` + neutral defaults on any fetch
    failure. Verified both the happy path and failure path directly.
  - `audioSynthetic.js` — wall-clock-driven fake level/bass/mid/treble
    with periodic beat pulses. This is the daemon's default audio source
    (no real mic on a Windows dev machine).
  - `audioArecord.js` — real Pi audio: spawns `arecord`, band-splits via
    `fft.js` (bass/mid/treble by frequency range), RMS level, simple
    rolling-average beat detection. Best-effort skeleton, same spirit as
    phase 1's `MatrixDisplay` — untested against real hardware (no Pi +
    USB mic yet). Confirmed it fails closed (`ok:false`, no crash) when
    `arecord` is missing, both standalone and through the daemon's
    `--audio arecord` flag on Windows.
  - `button.js` — edge-detecting state tracker fed by async
    press/release events (decoupled from the frame loop so nothing gets
    missed or double-counted).
  - `index.js` — `createInputSampler({lat,lon,audioSource})` composes
    the above into one `sample(dt)` call per frame.
- **`host/display/Display.js`** — added `onButtonEvent(handler)`, a
  no-op by default. `MatrixDisplay` doesn't override it, so
  `input.button` stays neutral on real hardware until there's an actual
  button device (there isn't one yet — GPIO is occupied by the HUB75
  bonnet, per CLAUDE.md's Pi deploy notes).
- **`host/display/SimDisplay.js`** — now also *receives* WS messages
  (previously send-only): `{type:'button', down}` from the browser.
- **`host/display/simpage/`** — added a press-and-hold button element
  (pointerdown/up/cancel/leave → WS message), no new connection.
- **`host/daemon.js`** — constructs one `InputSampler` before the
  playlist loop (input state is host-global, survives program swaps
  unlike the per-program `VfxRuntime`), calls `runtime.setInput(sampler
  .sample(dt))` every frame before `renderFrame`. New CLI flags:
  `--lat`/`--lon` (default Santa Cruz, CA) and `--audio
  <synthetic|arecord>` (default `synthetic`).
- **`effects/tide_pool_lantern.js`** (new seed piece, UUID
  `3a997c07-9327-4c3e-8b5c-db10ca3fcd8d`) — the first seed piece to
  declare `meta.inputs`. A center glow that breathes on its own
  (graceful-degradation idiom: still alive in total silence), swells
  with audio level, throws sparks on beat, and charges brighter while
  the button is held, releasing as an expanding ring. Registered in
  `index.json` and `effects/playlist.json`. Passes `npm run validate`.
- Verified end-to-end over the real WebSocket protocol (not just unit
  tests): booted the daemon, connected a raw WS client, simulated a
  button press/hold/release exactly as the browser would, and watched
  frame-mean brightness swing with synthetic audio *and* visibly ramp up
  during the simulated hold and pulse on release — confirms
  SimDisplay's new message handling, InputSampler composition, and the
  daemon's per-frame `setInput` call are all wired correctly together,
  not just individually correct in isolation.
- `README.md` updated with the input-sampling flags and sim button.

## Decisions made this session (for consistency going forward)

- **No real button hardware yet** (GPIO occupied by the HUB75 bonnet,
  per CLAUDE.md's Pi deploy notes) — confirmed with Jim rather than
  guessed. Built fully in the sim; real Pi leaves it neutral until a
  device is chosen.
- **Sim audio is a synthetic oscillator, not real browser mic capture**
  — confirmed with Jim. Simpler, no new WS binary audio path, good
  enough to develop/test audio-reactive effects against.
- **Weather is Open-Meteo** (free, no API key) — confirmed with Jim.
- **Default location is Santa Cruz, CA (36.97, -122.03)**, override via
  `--lat`/`--lon` — confirmed with Jim (matches UCSC).
- **This suncalc build (`^2.0.0`) returns solar altitude in degrees, not
  radians** — worth remembering if touching `clock.js` later; the
  classic suncalc docs (and a lot of Stack Overflow) assume radians.
- **Scoped to input sampling only.** The phase-1-deferred crossfade-in
  and watchdog-fallback daemon features stay a separate follow-up, per
  Jim's explicit call, even though both touch `host/daemon.js`.
- **Caught my own bug via the validation harness, not by eye**: the
  first `tide_pool_lantern.js` draft applied the `v*v` perceptual curve
  twice (once via a squared spatial falloff, again via `hsv()`'s value
  arg), crushing the glow to near-invisibility, and separately had
  almost no frame-to-frame variation in silence (only the glow radius's
  edge pixels changed as it breathed, diluted across the full 64×64
  buffer). `npm run validate` caught both as liveliness failures before
  I ever looked at a GIF — fixed by applying the curve once (matching
  `plasma_bloom.js`'s existing idiom) and adding real per-frame
  brightness jitter (a "candlelight flicker," not just per-pixel noise
  texture) so the idle state is genuinely alive at the pixel level, not
  just to the eye.

## What's left (per CLAUDE.md build phases)

- **Still deferred from phase 1**: crossfade-in between programs and
  watchdog fallback-to-known-good on the daemon side. A piece that
  passes `validate/index.js`'s `validateProgram()` is a "known-good"
  candidate — this is the natural next thing to build, and it's the
  last daemon-side gap before phase 4's agent loop can safely deploy
  what it writes.
- **Phase 4**: creativity agent session (`@anthropic-ai/sdk`), library/
  index management, `knowledge/` seed docs (still doesn't exist —
  craft notes, artist dossiers, agent's own lessons-learned).
- **Phase 5**: Pi bring-up — flesh out `MatrixDisplay` for real (still
  untested even though `rpi-led-matrix`'s own demo runs fine on glowy),
  systemd units, wall-label display server, and — now relevant — the
  first real test of `audioArecord.js` against an actual USB mic, plus
  finally deciding on real button hardware.

## Blockers

None. Everything built this session runs and was verified: all four
seed effects pass `npm run validate -- --all`, the arecord audio path
fails closed on Windows (both standalone and through the daemon),
weather sampling degrades gracefully on fetch failure, and the full
button/audio/clock chain was confirmed live over a real WebSocket
connection.

## Uncommitted work

Nothing from this session has been committed yet. `git status --short`
as of writing:

```
 M effects/fireflies.gif
 M effects/koi_pond.gif
 M effects/playlist.json
 M host/daemon.js
 M host/display/Display.js
 M host/display/SimDisplay.js
 M host/display/simpage/client.js
 M host/display/simpage/index.html
 M index.json
 M package-lock.json
 M package.json
?? effects/tide_pool_lantern.gif
?? effects/tide_pool_lantern.js
?? host/input/
```

`fireflies.gif`/`koi_pond.gif` show as modified only because both
effects use `Math.random()` internally, so re-running `npm run validate`
during this session's testing regenerated slightly different (equally
valid) previews — not a functional change. Jim hasn't asked for a commit
yet — check with him before creating one.
