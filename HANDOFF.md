# Handoff note — 2026-07-10

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: Build phase 2 complete

Also worth noting: Jim confirmed the physical hardware path this session
too — `rpi-led-matrix`'s demo program runs correctly on the Pi ("glowy")
against the real 64×64 panel. That's independent of the phase 2 work
below but de-risks phase 5 (Pi bring-up) whenever we get there.

## What's done

- **`host/runtime/prelude.js` / `host/runtime/vfxRuntime.js`** — added
  `__vfxSetInput(json)` (prelude) and `VfxRuntime.prototype.setInput(obj)`
  (host wrapper), same JSON-crossing pattern already used for `meta`. Lets
  the host push values into the sandboxed `input` object; the real-time
  daemon loop doesn't call it yet (still phase 3), but the validation
  harness now does, and phase 3's real sampling will use the same hook.
- **`validate/`** — the headless validation harness, all per plan
  (`C:\Users\Jim\.claude\plans\glistening-sparking-fiddle.md` has the full
  design writeup if useful context resurfaces):
  - `inputScenarios.js` — neutral input object + synthesized per-frame
    generators for audio/button/clock/env (sine-wave audio with beat
    pulses, a button press/hold/release schedule, an hour-of-day sweep
    with a synthetic daylight curve, slow env ramps).
  - `metrics.js` — temporal variance, mean brightness, spatial contrast
    (per-frame std dev — deliberately NOT histogram entropy, see Decisions
    below), plus frame-timing evaluation. All thresholds are named
    constants, calibrated against the three seed pieces (see Decisions).
  - `frontmatter.js` — extracts `/*@vfx ... @vfx*/`, parses via `js-yaml`,
    validates `id`/`title`/`rationale` presence, UUID shape, lineage
    entries (id resolves in `index.json`, relation is one of
    variation/inspiration/contrast).
  - `preview.js` — samples frames, nearest-neighbor 4× upscale, encodes
    via `gifenc`, writes beside the source file.
  - `index.js` — orchestrates both passes (neutral + synthesized, only if
    `meta.inputs` is non-empty), runs all checks, exports
    `validateProgram()` for programmatic use (phase 4's agent loop will
    call this to decide deploy vs. retry) and a CLI: `node
    validate/index.js <file.js>` or `--all` (iterates `index.json`).
- **`package.json`** — added `js-yaml`, `gifenc`; added `"validate": "node
  validate/index.js"` script.
- Verified: all three seed effects pass `--all` (frontmatter, no
  exceptions, liveliness, frame budget, no exceptions with synthesized
  inputs) and produce sane-looking preview GIFs (`effects/*.gif`, now
  tracked). Hand-wrote and confirmed-then-deleted five scratch programs to
  prove each failure mode fires correctly: mid-frame throw, malformed
  frontmatter YAML, frozen/black/flat output, unresolved lineage id +
  invalid lineage relation. Separately confirmed (via a throwaway script,
  also deleted) that the synthesized input pass actually drives changing
  output frame to frame, not just "didn't throw."
- `README.md` updated with a "Validating an effect program" section.

## Decisions made this session (for consistency going forward)

- **Spatial "liveliness" metric is per-frame pixel-value standard
  deviation, not brightness-histogram entropy.** First implementation
  used entropy and it failed all three seed pieces — CLAUDE.md's own
  aesthetic guidance ("dark backgrounds + bright accents, moderate
  average brightness") systematically skews a brightness histogram
  toward one bin even for a genuinely lively piece (koi_pond: 4% mean
  brightness but std ~21, because the koi are much brighter than the
  pond). Std deviation rewards spatial contrast regardless of how dark
  the overall image is, which is what "flat" actually means here.
- **Liveliness thresholds are calibrated against the three seed pieces**,
  not derived analytically — `FROZEN_TEMPORAL_VARIANCE` and
  `BLACK_MEAN_BRIGHTNESS` in particular started too strict and rejected
  fireflies (deliberately sparse/dim, one of the three documented seed
  aesthetics) and plasma_bloom (slowly-evolving fields, which the spec
  explicitly allows — "motion visible within 2s" doesn't mean large
  frame-to-frame deltas). Current constants have comfortable margin below
  all three observed values while still catching the genuinely-degenerate
  case (exactly 0 for a program that renders nothing). Worth re-checking
  once real agent-written pieces start flowing through.
- **Frame-budget overruns are a soft warning, not a hard fail**, except
  when grossly over (mean > 4× the 20ms budget, matching the interrupt
  handler's own crash-guard multiple in `vfxRuntime.js`). Dev-machine
  (Windows) timing doesn't represent the Pi's, so strict enforcement here
  would be flaky/meaningless — real budget enforcement matters most on
  the Pi and isn't this harness's job to gate hard on.
- **Synthesized-input pass uses a fresh sandbox**, not the same instance
  the neutral pass ran in — keeps the two scenarios independent (no
  particle-state/elapsed-time carryover from the neutral run bleeding
  into the "does it react correctly" check).
- **GIF previews are written whenever the neutral pass produces at least
  2 frames**, even if other checks fail — seeing what a rejected piece
  actually looked like is useful for debugging now and for the agent's
  own retry loop later (phase 4).
- Preview GIFs upscale 64×64 → 256×256 (nearest-neighbor, 4×) — a native
  64×64 GIF is hard to read in a file browser or in the creativity
  agent's vision context when it studies its own archive.

## What's left (per CLAUDE.md build phases)

- **Phase 3 (next up)**: real input sampling — audio via `arecord` +
  `fft.js` on the Pi (sim-page fake on Windows), clock via `suncalc`,
  button, weather fetch (`env`, `ok:false` on failure). The daemon needs
  to start calling the now-existing `runtime.setInput()` per frame with
  real sampled values; currently only the validation harness calls it.
- Also still owed from phase 1, deferred deliberately: crossfade-in
  between programs and watchdog fallback-to-known-good on the daemon
  side. These pair naturally with phase 2's harness output (a piece that
  passed validation is a "known-good" candidate) — worth doing either
  right before or alongside phase 3's daemon changes, since both touch
  `host/daemon.js`.
- **Phase 4**: creativity agent session (`@anthropic-ai/sdk`), library/
  index management, `knowledge/` seed docs. `validate/index.js`'s
  exported `validateProgram()` is what the agent's retry loop will call.
- **Phase 5**: Pi bring-up — flesh out `MatrixDisplay` for real (still
  untested even though `rpi-led-matrix`'s own demo now runs fine on
  glowy — the bonnet/panel path is confirmed, but `MatrixDisplay.js`
  itself has never been exercised), systemd units, wall-label display
  server.

## Blockers

None. Everything built this session runs and was verified (seed effects
pass, all five deliberately-broken scratch cases fail with correct
reasons, synthesized input pass confirmed to actually change output).

## Uncommitted work

Nothing from this session has been committed yet. `git status --short`
as of writing:

```
 M host/runtime/prelude.js
 M host/runtime/vfxRuntime.js
 M package-lock.json
 M package.json
?? effects/fireflies.gif
?? effects/koi_pond.gif
?? effects/plasma_bloom.gif
?? validate/
```

The three `effects/*.gif` files are generated previews, left tracked
(not gitignored) — they travel with the piece the same way the code does,
and the creativity agent is meant to review its own past work visually
(CLAUDE.md: "the agent should SEE its past work"). Jim hasn't asked for a
commit yet — check with him before creating one.
