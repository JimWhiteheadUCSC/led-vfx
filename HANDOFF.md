# Handoff note — 2026-07-20 (morning, updated)

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: root cause found — a real leak, in our own code, now fixed

After landing two defensive fixes (never crash on dispose, never get
stuck forever on a wedged module — see below, both still correct and
still worth keeping), Jim asked to write up the underlying allocation
bug for a possible upstream bug report. Digging in to write that report
accurately surfaced the actual root cause, and **it's ours, not
QuickJS's or quickjs-emscripten's**:

`host/runtime/vfxRuntime.js`'s `renderFrame()` called
`this.context.getArrayBuffer(bufferHandle)`, which returns a `Lifetime`
wrapping a *native* `_malloc`'d buffer (documented, intentional API
design in `quickjs-emscripten-core` — the disposer callback is exactly
`() => this.module._free(ptr)`). The old code destructured `{ value }`
out of that Lifetime and discarded the Lifetime object itself, **never
calling `.dispose()`** — so the underlying `_free(ptr)` never ran.
Every single `renderFrame()` call leaked exactly one 12,288-byte buffer
(64×64×3, the RGB framebuffer) natively, forever, for the life of the
shared WASM module.

**Confirmed with an A/B RSS test** (identical code, only difference is
calling `.dispose()` on the Lifetime after copying its bytes out):
buggy version grew ~12MB per 1,000 frames (~12KB/frame, matching the
framebuffer size almost exactly); fixed version stayed flat across
8,000 frames. This single leak explains everything observed across both
incidents — the original OOM ("Couldn't allocate memory to get
ArrayBuffer" — the *next* `_malloc` finally failing once ~1.9GB of
never-freed buffers had accumulated over ~90 minutes at 30fps), and
this morning's permanently-wedged module (once the module's WASM linear
memory is saturated with unfreeable garbage, nothing can allocate in it
again, including a fresh runtime).

**Fixed** in `host/runtime/vfxRuntime.js`: `renderFrame()` now disposes
the `Lifetime` returned by `getArrayBuffer()` right after copying its
bytes into the defensive `Uint8Array` copy it already made. Verified
against the exact production code path: 8,000 frames of the real
`while-touching.js`, RSS flat (67.5MB → 64.6MB, noise-level) versus the
old code's confirmed linear growth. **Not yet committed.**

**No upstream bug report needed** — `quickjs-emscripten`'s API worked
exactly as designed (manual-lifetime-management, same pattern used
correctly everywhere else in this file); this was a missed `.dispose()`
call on our side, plain and simple.

### The two earlier defensive fixes are still worth keeping

Both already committed (`8ec6116`, `b5fa9b6`), and both remain correct
general daemon robustness even though they weren't the actual root
cause of this particular leak:
- `host/daemon.js`: never let a bad `dispose()` or a bad frame take the
  whole process down.
- `host/runtime/vfxRuntime.js`: never get stuck retrying a permanently
  wedged shared module forever — discard and rebuild it.

Neither is *wrong* to have — a future genuine OOM (a truly leaky effect
script, or just very long uptime) could still hit similar failure
shapes, and these two fixes mean the daemon degrades gracefully instead
of dying or freezing. But they were treating the symptom; this session
found and fixed the actual disease.

## What's left

- **Get Jim's go-ahead, then commit** the `renderFrame()` leak fix.
- **Restart the real-hardware daemon** once committed.
- Worth a quick audit (not yet done): are there other places in this
  codebase (validation harness, preview rendering) that call
  `getArrayBuffer` or similarly return a `Lifetime`-wrapping API and
  might have the same missed-dispose mistake? A repo-wide grep for
  `getArrayBuffer` found only this one real call site (there's also a
  scratch test file, since deleted) — but worth a broader look at other
  Lifetime-returning APIs (`newArray`, `getProp`, etc.) if time allows,
  since this bug class (destructure-and-drop the wrapper) could recur
  anywhere a `Lifetime` is unwrapped this way.
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
loop from this morning until Jim restarts it with this fix in place.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
