# Handoff note — 2026-07-09

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: Build phase 1 complete and visually confirmed

Jim ran `npm run sim`, opened the browser page, and confirmed it looks
right — all three seed effects rendering live.

## What's done

- **`host/runtime/prelude.js`** — the full stdlib injected into the QuickJS
  sandbox: `rgb`/`hsv`, vendored simplex `noise2`/`noise3` (permutation
  table generated via a seeded mulberry32 shuffle, not a hand-copied
  table — deliberate choice, see Decisions below), `clamp`/`lerp`/
  `smoothstep`/`fract`, the framebuffer + `setPixel`/`getPixel`/`fill`/
  `fade`, `sprite`/`blit`, the neutral `input` object, and the
  `__vfxFrame` mode-dispatch wrapper (pixel-mode's per-pixel loop lives
  in-sandbox, per the one-crossing-per-frame rule).
- **`host/runtime/vfxRuntime.js`** — wraps `quickjs-emscripten`. One
  QuickJSRuntime+context per loaded program, 16MB memory limit, interrupt
  handler as a crash guard against runaway loops, `eval`/`Function`
  deleted from sandbox globals. `renderFrame(t, dt)` is the single
  per-frame crossing: one `callFunction`, buffer read back via
  `getArrayBuffer` in that same call.
- **`host/display/`** — `Display` base class; `SimDisplay` (http + ws
  server, serves `simpage/` static files, broadcasts raw RGB frames as
  binary WS messages); `MatrixDisplay` (lazy-`require`s `rpi-led-matrix`,
  best-effort skeleton, **not exercised on real hardware** — full bring-up
  is phase 5); `index.js` picks backend by `kind` ('sim' | 'matrix').
- **`host/display/simpage/`** — `index.html` + `client.js`, canvas draws
  64×64 frames as chunky LED-style squares (10px pitch, 2px gap),
  reconnects on drop.
- **`host/daemon.js`** — CLI: `node host/daemon.js <effect.js>` (single,
  runs until Ctrl+C) or `node host/daemon.js --playlist <file.json>
  [--port N]` (loops forever). Playlist JSON: array of `{ file,
  duration? }`, duration in seconds, default 20. Hard-cut swap between
  programs (no crossfade — deferred, see Decisions).
- **`effects/playlist.json`** — demo playlist covering all three seed
  effects.
- Verified: smoke-tested `VfxRuntime` against all three seed effects
  (pixel mode / buffer+fade / buffer+sprites), confirmed changing output
  over 90 frames each; raw WebSocket client confirmed binary frame stream
  with plausible non-zero pixel counts; daemon log confirmed playlist
  cycling through all three; single-file CLI mode confirmed serving.
  Then Jim eyeballed it in a real browser — first visual confirmation.
- `README.md` updated with run instructions; `.gitignore` added
  (`node_modules/`).

## Decisions made this session (for consistency going forward)

- **Plain JavaScript**, not TypeScript, for all host code — no build
  step, runs identically on Windows/Pi. (User's explicit choice.)
- **CLI has two modes**: single-file arg, or `--playlist` pointing at a
  JSON file of `{file, duration}` entries (default duration 20s),
  looping forever. (User's explicit spec.)
- **Crossfade-in and watchdog fallback deferred to phase 2** — they pair
  naturally with the validation harness, which is what defines
  "known-good" for the fallback to swap to. Phase 1 daemon does a hard
  cut between programs and just logs+skips a program that throws on
  load or mid-frame.
- Simplex noise permutation table is generated at prelude-load time from
  a fixed seed (mulberry32 PRNG shuffle) rather than transcribed from a
  canonical Perlin table by hand — avoids transcription-error risk,
  still fully deterministic run-to-run.
- `rpi-led-matrix` has NOT been `npm install`ed yet — MatrixDisplay's
  `require` is untested. CLAUDE.md says it should stay a normal
  dependency (its own install script warns/no-ops on non-Pi), but nobody
  has confirmed that on this machine. Worth checking before phase 5.

## What's left (per CLAUDE.md build phases)

- **Phase 2 (next up)**: validation harness — run ~300 frames headless,
  check no exceptions/overruns, liveliness metrics (temporal variance,
  mean brightness, spatial entropy), exercise declared `meta.inputs`
  with synthesized streams (recorded audio, scripted button presses,
  time-warped clock) AND a neutral-input sweep, verify frontmatter
  parses (needs `js-yaml`, not yet installed) with UUID present and
  lineage refs resolving against `index.json`, render a preview GIF
  (needs `gifenc`, not yet installed).
- **Phase 3**: real input sampling (audio via `arecord`+`fft.js` on Pi,
  clock via `suncalc`, button, weather fetch). Right now `input` is a
  static neutral object the host never mutates.
- **Phase 4**: creativity agent session (`@anthropic-ai/sdk`), library/
  index management, `knowledge/` seed docs.
- **Phase 5**: Pi bring-up — flesh out `MatrixDisplay` for real, systemd
  units, wall-label display server.

## Blockers

None currently — everything built this session runs and was visually
confirmed. The one open loose end is the untested `rpi-led-matrix`
install (see Decisions above), which only matters once phase 5 starts.

## Uncommitted work

Nothing from this session has been committed yet. `git status --short`
as of writing:

```
 M README.md
?? .gitignore
?? effects/playlist.json
?? host/
?? package-lock.json
?? package.json
```

`node_modules/` is untracked but now gitignored, so it won't show up in
`git add -A`. Jim hasn't asked for a commit yet — check with him before
creating one.
