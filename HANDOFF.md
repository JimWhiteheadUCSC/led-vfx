# Handoff note — 2026-07-20 (morning)

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: the crash fix from last night was necessary but not sufficient — module-level wedging found and fixed too

Jim restarted the daemon on `while-touching.js` alone overnight to test
last night's fix (committed as `8ec6116`). It didn't crash again — but
by morning the panel was dark, and the terminal was in a **tight
infinite retry loop**:

```
[daemon] failed to load .../while-touching.js: RuntimeError: memory access out of bounds
    at wasm://wasm/...:wasm-function[1065]:...
    at QuickJSWASMModule.newRuntime (.../quickjs-emscripten-core/dist/index.js:...)
    at VfxRuntime.load (.../host/runtime/vfxRuntime.js:50:24)
```

Jim asked directly: did we fix the crash but not the underlying leak?
**Yes, correctly identified.** And it's deeper than "one runtime leaks":
`host/runtime/vfxRuntime.js` memoizes **one shared WASM module for the
whole process**, and every `VfxRuntime.load()` just creates a new
runtime inside it. `newRuntime()` throwing `memory access out of
bounds` means the *shared module itself* — not just the runtime that
OOM'd overnight — was permanently wedged. Disposing a runtime frees its
own objects back to the module's allocator, but WASM linear memory only
grows, never shrinks (a real platform limit); whatever state the module
was left in after the earlier OOM meant it could never construct a
fresh runtime again, for the rest of that process's life. That's why
last night's try/catch (which stops the *process* from dying) didn't
help here: every subsequent load was doomed by construction, forever,
with nothing to catch and recover from at that layer.

**Fix, verified, NOT yet committed** (`host/runtime/vfxRuntime.js`):
switched from the package's own `getQuickJS()` (an opaque, unresettable
singleton) to `newQuickJSWASMModule()` (a factory that bypasses it),
kept locally memoized the same way but now behind a `resetQuickJSModule()`
escape hatch. `VfxRuntime.load()` now wraps just the
`newRuntime()`/`setMemoryLimit()`/`newContext()` step (not script eval)
in its own try/catch: a failure there means the *module*, not this
program's source, is the problem, so it discards the memoized module
before rethrowing. The next `loadQuickJS()` call then builds a
genuinely fresh WASM instance with fresh linear memory. **Verified with
a mock** (not a 90-minute wait — simulating a 90-minute wait costs
roughly 90 CPU-minutes, confirmed the hard way last night): a fake
module whose `newRuntime()` throws on its first instance behaves
exactly like the real bug, and the very next load call correctly builds
a second, working module and succeeds. Practical effect: instead of an
unrecoverable infinite retry loop, a wedged module now costs one failed
load (logged) and then a self-healed recovery on the next playlist/loop
iteration — near-instant, not "dark until a human intervenes."

Deliberately **not** implemented: periodic preventive runtime recycling
in single-file/infinite-duration mode (reload on a timer regardless of
errors, to stay far from whatever's actually accumulating). The reactive
fix above is simpler and has no aesthetic cost (it only interrupts
when a failure would have happened anyway); periodic recycling would
change `while-touching.js`'s specific artistic premise (continuous
accumulation over the run) on an arbitrary schedule rather than on a
real failure — worth Jim's opinion before adding, and not pursued
unless the reactive fix turns out insufficient in practice.

## Background (from last night, already committed as `8ec6116`)

A ~90-minute single-effect run of `while-touching.js` (single-file
mode, never rotating) hit `"Couldn't allocate memory to get
ArrayBuffer"` — a *native* `_malloc` inside `quickjs-emscripten-core`'s
`getArrayBuffer()`, used once per frame to copy the 12KB pixel buffer
out of WASM memory, and a different allocator than QuickJS's own
tracked `rt.setMemoryLimit(16MB)` heap. `host/daemon.js` caught that
frame error, but the `runtime.dispose()` that followed tripped an
internal C assertion (`list_empty(&rt->gc_obj_list)`), which aborted
the whole process. That commit wrapped both `runtime.dispose()` and the
`runProgram()` call itself in try/catch — necessary, and it did stop
the process-level crash (confirmed: it didn't die overnight) — but as
this morning showed, insufficient on its own, hence the module-reset
fix above. `while-touching.js` itself was read in full both sessions;
no unbounded state found in its own script logic (fixed-size
`Float32Array`, fixed 34-element array) — this looks like a
WASM/allocator-layer issue, not an effect-code bug.

## What's left

- **Get Jim's go-ahead, then commit** `host/runtime/vfxRuntime.js`'s
  module-reset fix.
- **Restart the real-hardware daemon** once committed — presumably
  still stuck in the retry loop until restarted.
- Consider (not yet decided, worth raising with Jim): periodic
  preventive runtime recycling in single-file mode — see above, holding
  off unless the reactive fix proves insufficient.
- Also worth watching: does the *same* wedging happen in normal
  playlist mode, just on a much longer timescale (rotating through
  short-duration pieces spreads the same shared-module lifetime across
  many runtimes)? Nothing suggests it's while-touching-specific; the
  shared module accumulates across every playlist rotation too, just
  more slowly. Not yet observed for real in playlist mode — flagging so
  a "playlist mode also went dark eventually" report doesn't look like
  a new bug.
- The timer is still not enabled (deliberate, per Jim's earlier call).
- The render daemon's own systemd unit — still not built.
- The wall-label server's own systemd unit — still not built.
- The weekly review session (naming/ratification) — still doesn't exist;
  three pieces in now, still short of `naming.md`'s thresholds.
- `meta.pacing = 'hour'` — still deferred from a prior session.
- CLAUDE.md's small Pi-deploy-notes inaccuracies — still not folded in,
  still low priority.

## Blockers

None code-side. The real daemon is presumably still stuck in the retry
loop from this morning until Jim restarts it with the new fix in place.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
