# Handoff note — 2026-07-19 (night)

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: real 90-minute daemon crash, root-caused and fixed (not yet committed)

Jim ran a third agent-authored piece manually and liked it enough to run
it alone, single-file, for ~90 minutes straight (not via the playlist).
The daemon died with a QuickJS-internal C assertion
(`Aborted(Assertion failed: list_empty(&rt->gc_obj_list)...)`) surfacing
as an uncaught `RuntimeError`.

**Root cause, traced to source, not guessed:** the actual frame error
that started it was `"Couldn't allocate memory to get ArrayBuffer"` —
that string lives in `quickjs-emscripten-core`'s `QuickJSContext
.getArrayBuffer()`, a *native* `_malloc` used once per frame to copy the
12KB pixel buffer out of WASM memory. This is a **different allocator**
than QuickJS's own tracked `rt.setMemoryLimit(16MB)` heap — it's the
underlying Emscripten module's linear memory. `host/daemon.js` already
caught that frame error and moved on to call `runtime.dispose()` — but
a runtime left in that state can make `dispose()` itself trip the
internal C assertion, and that call was unguarded. One 90-minute
single-effect run (never rotating, since single-file mode uses
`durationSeconds: Infinity` and playlist mode wasn't in use) was enough
to hit it; a real stress test on the actual `while-touching.js` (killed
early, see below) showed steady RSS growth over the run — consistent
with either a genuine slow leak in the long-lived WASM instance or
allocator fragmentation from ~162,000 alloc/free cycles of that same
scratch buffer, not obviously a bug in `while-touching.js`'s own script
logic (its state is fixed-size: one `Float32Array`, one 34-element
array — read in full, nothing unbounded found).

**Fix, written but NOT yet committed** (`host/daemon.js`): wrapped
`runtime.dispose()` in try/catch at the end of `runProgram()`, and
wrapped the `await runProgram(...)` call itself in `main()`'s loop in
try/catch. Neither depends on knowing the exact internal failure mode —
whatever a bad frame or a bad dispose throws, it's now logged and the
daemon moves to the next playlist item (or, in single-file mode, simply
keeps looping) instead of dying. This is the minimal version of
CLAUDE.md's "watchdog falls back to a known-good piece" — full
known-good-piece fallback is still a richer follow-up.

Two synthetic repro attempts (deliberately-leaking scratch effects, not
committed, already deleted) didn't reproduce the *exact* assertion —
one tripped the per-frame 300ms interrupt-deadline guard first, the
other hit a clean "out of memory" `Error` that `dispose()` survived.
Getting the exact assertion to fire synthetically would need sustained
real time (the interpreter's per-frame cost roughly matches real-frame
budget, so "simulate 90 minutes fast" isn't actually fast — confirmed
firsthand when a stress-test run of the real `while-touching.js` was
still on frame <10,000 after ~4 CPU-minutes). Given the fix's
correctness doesn't depend on the precise failure string, this wasn't
pushed further.

**Not yet committed at all**: `effects/while-touching.js` (+ its
`.gif`/3 `.still-N.gif` preview files) — the third agent-authored piece,
sitting as untracked files in the working tree. Its `index.json` /
`effects/playlist.json` entries and the `knowledge/artists/casey-reas.md`
attempt note are already staged as modifications (from the same agent
run) but likewise uncommitted.

## What's left

- **Get Jim's go-ahead, then commit**: the `host/daemon.js` robustness
  fix, plus the third piece (`while-touching.js` + previews +
  `index.json`/`playlist.json`/`casey-reas.md` updates) — all from the
  same investigation, reasonable to land together.
- **Restart the real-hardware daemon** once the fix is committed — it's
  presumably still down from the crash Jim reported.
- Consider (not yet decided, worth raising with Jim): should
  single-file mode periodically recycle the runtime (fresh
  `VfxRuntime.load()`) even when playing one piece forever, as a
  preventive measure independent of whatever's actually growing? This
  wasn't implemented — the try/catch fix addresses "never crash," not
  "never leak," and recycling changes the "no full repeat under ~30s"
  aesthetic contract in ways worth Jim weighing in on first.
- The timer is still not enabled (deliberate, per Jim's earlier call).
- The render daemon's own systemd unit — still not built.
- The wall-label server's own systemd unit — still not built.
- The weekly review session (naming/ratification) — still doesn't exist;
  three pieces in now, still short of `naming.md`'s thresholds.
- `meta.pacing = 'hour'` — still deferred from a prior session.
- CLAUDE.md's small Pi-deploy-notes inaccuracies — still not folded in,
  still low priority.

## Blockers

None code-side. The real daemon is presumably down until Jim restarts it
with the fix in place.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
