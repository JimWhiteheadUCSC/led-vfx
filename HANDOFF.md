# Handoff note — 2026-07-14

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: MatrixDisplay confirmed working on real hardware 🎉

The big milestone: **the render pipeline now actually drives the real
64×64 panel on glowy**, not just the sim. Jim confirmed both
`koi_pond.js` (buffer mode) and `plasma_bloom.js` (pixel mode) render
correctly via:

```
sudo node host/daemon.js effects/<name>.js --display matrix --gpio-mapping adafruit-hat --gpio-slowdown 2
```

This session was almost entirely remote hardware debugging (Jim on the
Pi, me without direct access) — three real issues found and fixed, all
committed and pushed (`master` is at `0ba46e6`, working tree clean, all
verification below happened on the actual panel, not the sim). The next
session is expected to run **directly on the Pi**, which removes the
"relay commands, wait for paste-back" loop this session had to work
through — should make the remaining performance work much faster to
iterate on.

## What's done (three real bugs, found via actual hardware testing)

1. **`sudo`/`node` PATH** — `sudo node ...` failed with "command not
   found" even though plain `node` worked, because `sudo` uses a
   restricted PATH that doesn't include nvm-installed binaries. Fixed on
   the Pi itself (not a repo change): `sudo ln -s "$(which node)"
   /usr/local/bin/node` (and same for `npm`).
2. **`npm install` script approval** — glowy's npm has a newer
   `allow-scripts` security gate that blocks install scripts (including
   `rpi-led-matrix`'s `node-gyp rebuild`) until explicitly approved.
   Fixed on the Pi: `npm approve-scripts --allow-scripts-pending` then
   re-run `npm install`. Confirmed the native addon actually compiled:
   `node -e "require('rpi-led-matrix')"` succeeded.
3. **EACCES reading effect files under `sudo`** — `rpi-led-matrix`
   drops root → the `daemon` Linux user right after GPIO init (a
   library security default). Jim correctly diagnosed the real cause
   himself: it wasn't `effects/`, `led-vfx/`, or `Code/` permissions
   (all fine, `r-x` for other) — it was his **home directory** being
   `drwx------` (700), which blocks directory *traversal* for the
   `daemon` user regardless of permissions further down the path. Fixed
   on the Pi: `chmod go+rx /home/ejw`. (I initially — before this
   diagnosis — proposed disabling the library's privilege-drop
   entirely in `MatrixDisplay.js` as a code-level workaround. Jim's
   fix is correct and more targeted; I reverted that code change. If a
   future session is tempted to disable `dropPrivileges` again, don't —
   the real fix is filesystem permissions, already applied.)
4. **QuickJS interrupt guard too tight for Pi timing** (the one actual
   code fix, `host/runtime/vfxRuntime.js`) — `plasma_bloom.js` (pixel
   mode, 4096 `pixel(x,y,t)` calls/frame) got killed on its first frame
   with `InternalError: interrupted`. QuickJS-as-WASM on a Pi 4 is
   considerably slower than the Windows dev machine this was tuned
   against; the 80ms crash-guard (4× the 20ms frame budget — meant to
   catch runaway loops, not enforce real timing) was too tight for a
   legitimately-just-slow-on-this-hardware frame. Widened to 15×
   (300ms). Confirmed fix: plasma_bloom now renders on the real panel
   without getting killed.

## What's left — the actual next task

**plasma_bloom renders correctly now, but at a noticeably lower frame
rate than koi_pond.** This is the open thread for the next session.
Some starting angles, not a prescribed path:

- Profile where the time actually goes for a pixel-mode frame on the
  Pi — is it QuickJS/WASM interpretation overhead, the `noise2`/`sin`
  math itself, or something else? Now doable directly on-device, which
  wasn't true this session.
- `--gpio-slowdown` is a GPIO/PWM timing knob (how fast bits get pushed
  to the panel), unrelated to JS compute time — don't conflate the two
  bottlenecks when diagnosing. koi_pond (buffer mode, no per-pixel
  QuickJS math) being smooth while plasma_bloom (pixel mode) is choppy
  points at JS-side compute, not GPIO refresh.
- `validate/metrics.js`'s `FRAME_BUDGET_MS`/timing checks are explicitly
  documented as calibrated against dev-machine timing, not the Pi
  ("dev-machine timing doesn't match the Pi's, so budget enforcement is
  best-effort here" — see the comments in that file). Now that there's
  a real Pi to test on, running `npm run validate` *on glowy itself*
  would give real frame-timing numbers for the first time, which could
  inform whether the validator's thresholds need a Pi-aware mode, or
  whether pixel-mode effects just need lighter per-pixel math as an
  authoring guideline.
- Worth checking whether other pixel-mode effects (there's currently
  just the one, `plasma_bloom.js`) or future ones need this looked at
  as a general "pixel mode is expensive on Pi 4" caveat worth adding to
  `docs/VFX_API.md`'s guidance section, vs. this being specific to
  `plasma_bloom.js`'s particular math (3 sine fields + noise2 per
  pixel).

## Still deferred (unchanged from before, for completeness)

- Phase 1: crossfade-in between programs, watchdog fallback-to-known-good.
- Phase 5 remainder: systemd units, wall-label HDMI screen. Also the
  GPIO4→GPIO18 PWM jumper mod still hasn't been done, so `--gpio-mapping`
  stays `adafruit-hat`, not the PWM variant.
- Phase 4: creativity agent, `knowledge/` seed docs — not started.
- CLAUDE.md's Pi deploy notes still say `rpi-led-matrix`'s native
  compile "is skipped with a warning on non-Pi machines" — still not
  accurate (see the `optionalDependencies` note from the prior
  handoff), and now there's a second inaccuracy worth folding in at the
  same time: glowy's `npm install` needed an explicit `npm
  approve-scripts` step CLAUDE.md doesn't mention. Small doc fix,
  hasn't been prioritized yet.

## Blockers

None. Everything committed and pushed (`0ba46e6`). The open item above
is a performance investigation, not a broken build.

## Uncommitted work

None — working tree is clean as of this note.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind (clear error
messages, the README's real-hardware section) if that comes up in a
future session.
