# Handoff note — 2026-07-10

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: Build phase 5 (partial) — MatrixDisplay real hardware support

Scoped narrowly per Jim's call: MatrixDisplay + CLI wiring only. No
systemd unit, no wall-label HDMI screen yet — those are follow-ups once
he's seen this running reliably by hand.

**This phase ends with Jim, not me** — I have no access to glowy (his
Pi), so everything below is implemented and verified as far as I can on
Windows (syntax, regression tests, graceful-failure paths), but the
actual "does the panel render correctly" check can only happen when Jim
runs it there and reports back.

## What's done

- **`package.json`**: `rpi-led-matrix` added as an **`optionalDependency`**,
  not a plain one. Important discovery this session: CLAUDE.md assumed
  "native compile is skipped with a warning on non-Pi machines" — that's
  false for this package as published. It has no custom install script;
  npm's default binding.gyp-triggered auto-build kicks in unconditionally
  and hard-fails via node-gyp/MSBuild on Windows (verified: a plain
  `npm install rpi-led-matrix` aborts the whole install with a real
  error). Moving it to `optionalDependencies` is what actually produces
  the graceful "skip on non-Pi" behavior CLAUDE.md wanted — verified with
  a clean `rm -rf node_modules package-lock.json && npm install`: exit 0,
  no warnings, package simply absent from `node_modules`. Worth
  correcting the assumption in CLAUDE.md at some point (didn't do it this
  session — see below).
- **`host/display/MatrixDisplay.js`** — rewritten against the package's
  *real* API (confirmed via its `dist/index.d.ts` and native source
  `src/led-matrix.addon.cc`, installed locally with `--ignore-scripts` to
  read the JS/TS surface without needing a working native build):
  - `GpioMapping.AdafruitHat === 'adafruit-hat'` etc. — confirmed by
    reading the compiled enum object directly in `dist/index.cjs` (static
    analysis; couldn't execute `require()` on Windows since the whole
    module throws atomically when the native addon is missing — even
    pure-JS exports like the enum become unreachable, not just the
    native bits. This actually simplified the design: one try/catch
    around the whole `require()` call is correct and sufficient).
  - Default `gpioMapping` is now the plain `adafruit-hat` (not the phase-1
    skeleton's `AdafruitHatPwm`) — matches Jim's confirmed-working demo
    command; the GPIO4→GPIO18 PWM jumper mod hasn't been done.
  - **Found a real bulk-write API**: `matrix.drawBuffer(buffer, w, h)`
    takes exactly our `Display.pushFrame` contract (`assert(len == w*h*3)`
    in the native source — RGB, row-major, no conversion needed) as a
    single N-API call. Replaced the phase-1 skeleton's per-pixel
    `setPixel(x,y,r,g,b)` loop entirely — that signature doesn't even
    exist in the real API (this version's `setPixel(x,y)` takes no color
    args, painting with the currently-set `fgColor`). This resolves the
    performance risk flagged in this session's plan before writing any
    code.
  - `gpioMapping`/`gpioSlowdown`/`brightness` are now constructor options
    (and CLI flags, see below), not hardcoded.
  - Clearer failure messaging: missing-module warning explains the
    optionalDependency situation; an init failure specifically on Linux
    suggests checking `sudo`.
- **`host/daemon.js`** — new CLI flags: `--display <sim|matrix>` (default
  `sim` — this didn't exist at all before, so there was previously no way
  to select `MatrixDisplay` from the CLI regardless of platform),
  `--gpio-mapping`, `--gpio-slowdown`, `--brightness` (matrix-only,
  harmlessly ignored otherwise). Same indexOf+splice flag-parsing pattern
  as `--lat`/`--lon`/`--audio`.
- **`README.md`** — new "Running on real hardware" section: prerequisites,
  git-clone-on-Pi flow (native addon must compile on ARM, so the repo has
  to live and build on the Pi itself), the `sudo` requirement, and the
  confirmed-working example command.
- Verified on Windows: `npm install` succeeds cleanly with the optional
  dependency; `npm run sim` and `npm run validate -- --all` both
  unaffected; `--display matrix` fails with the expected clear warning +
  clean error (not a crash); full flag-combination parsing and bad-value
  error paths all behave correctly.

## Decisions made this session (for consistency going forward)

- **GPIO mapping default is `adafruit-hat`, not `adafruit-hat-pwm`** —
  confirmed with Jim (PWM jumper mod not done). Change the default once
  that mod happens, not before.
- **Deploy method is git clone/pull directly on the Pi** — confirmed with
  Jim. The native addon has to compile on ARM regardless of how the repo
  gets there.
- **Scoped to MatrixDisplay only this pass** — confirmed with Jim.
  systemd (boot-start/auto-restart) and the wall-label HDMI screen are
  explicitly deferred, not forgotten.
- **`rpi-led-matrix` must be an `optionalDependency`, never a plain
  one** — this is now load-bearing for `npm install` working on Windows
  at all. If a future session touches `package.json`, don't "fix" this
  back to a plain dependency without re-reading this note.

## What's left (per CLAUDE.md build phases)

- **You (Jim) run it on glowy and report back**: confirm `node --version`
  is 20+ ARM64, `git clone`/`pull`, `npm install` (first real test of the
  native build actually compiling), then `sudo node host/daemon.js
  effects/koi_pond.js --display matrix --gpio-mapping adafruit-hat
  --gpio-slowdown 2`. Also worth trying `tide_pool_lantern.js` to sanity
  check real input sampling alongside MatrixDisplay. Report back anything
  unexpected — flicker, wrong colors, crashes, permission errors — so the
  next session can fix it against real signal.
- **Still deferred from phase 1**: crossfade-in between programs and
  watchdog fallback-to-known-good on the daemon side.
- **Still deferred from this phase 5 pass**: systemd units (render daemon
  boot-start/restart), wall-label HDMI screen.
- **Phase 4**: creativity agent session, library/index management,
  `knowledge/` seed docs — still not started.
- Worth a small CLAUDE.md correction at some point: its Pi deploy notes
  say `rpi-led-matrix`'s "native compile is skipped with a warning on
  non-Pi machines" — that's not accurate for the package as published;
  it's `optionalDependencies` doing the graceful-skip work, not the
  package itself. Didn't touch CLAUDE.md this session (out of scope for
  a hands-on implementation pass), but flagging it so it doesn't mislead
  a future session reading it as ground truth.

## Blockers

None on my end, but real verification is blocked on Jim running the
above on glowy — see "What's left."

## Uncommitted work

Nothing from this session has been committed yet. `git status --short`
as of writing:

```
 M README.md
 M host/daemon.js
 M host/display/MatrixDisplay.js
 M package-lock.json
 M package.json
```

Jim hasn't asked for a commit yet — check with him before creating one.
