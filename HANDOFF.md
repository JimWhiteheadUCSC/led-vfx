# Handoff note — 2026-07-17

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: wall-label confirmed on real hardware; knowledge base reviewed; quality:'half' built, pacing:'hour' deferred

Wall-label feature (previous handoff's open item) is fully done and
confirmed on real hardware: after Jim's reboot, the kiosk window came up
via `~/.config/labwc/autostart`, initially showing the neutral "waiting"
state (correct — nothing had written `run/current-piece.json` yet since
reboot, and the render daemon isn't auto-started, by design). Starting
`npm run sim` populated it immediately and Jim confirmed the physical
HDMI panel shows live title/rationale in sync with the SimDisplay web
view. Committed and pushed (`d5700a9`). Nothing left on this thread.

Jim then brought in the knowledge base he'd developed in a separate
session: `knowledge/README.md` (the craft/artists room-split framing)
plus `knowledge/artists/{4k-intro,casey-reas,jim-campbell,vera-molnar}.md`
and `knowledge/craft/effect-bestiary.md`. Reviewed in detail — see below.

## What's done

**Knowledge base review** — overall very strong (the craft/artists split
with the "could a reasonable artist disagree?" sorting test is a clean
piece of information architecture; each dossier does real translation
work from a real practice to panel-specific technique, not just vibes).
Found and fixed three small issues while reviewing:
- `4k-intro.md` stated "40.96 ms per frame is this house's 4096 bytes" —
  factually wrong (the real, host-enforced budget is **20ms**; 40.96
  looks like a deliberate 4096-hundredths-of-a-ms numerology pun that
  accidentally got stated as if it were the real number). Fixed to say
  20ms.
- Two typos: `casey-reas.md` had "so wWork in this lineage"; `vera-
  molnar.md` had "a red rectange... at an slight angle." Both fixed.

**`meta.quality = 'half'` — built, verified, done.** The knowledge base
referenced this and `meta.pacing = 'hour'` as if they were real contract
fields; neither existed anywhere in code. Jim's call after reviewing the
design: build `quality` now (simple, low-risk), defer `pacing` (see
below for why).
- `host/runtime/prelude.js`'s `__vfxFrame` dispatch: pixel-mode +
  `quality:'half'` samples `pixel(x,y,t)` on a 2x2 grid (true 0..63
  coords passed through, so the effect's own normalization stays
  correct with zero awareness of quality mode) and paints each result
  as a 2x2 block. Zero changes needed to `host/runtime/vfxRuntime.js` or
  `host/daemon.js` — the global `meta` a program declares stays live in
  the same QuickJS context prelude.js's own code runs in, so this is
  entirely sandbox-internal and benefits the real daemon and the
  validator identically (they share this file verbatim).
- `validate/index.js`: new warning if `quality` is declared on a
  buffer-mode program (no defined meaning there), mirroring the existing
  unknown-`meta.inputs`-group warning pattern.
- `docs/VFX_API.md`: documented in the "Optional metadata" section.
- **Verified on real hardware this session**: a test harness (temporary,
  not committed) confirmed pixel-mode call count drops exactly 4096→1024
  (the predicted 4x) with `quality:'half'`; mean frame time on a
  deliberately expensive uncached test effect (raw `noise2()`/`hsv()`
  per pixel) dropped 67.94ms→21.48ms (~3.2x — slightly under the
  theoretical 4x since `setPixel` call count is unchanged, only the
  expensive per-pixel math shrinks, consistent with this session's
  earlier `plasma_bloom.js` profiling findings); the buffer-mode warning
  fires correctly; `npm run validate -- --all` still passes all four
  seed effects unchanged (none declare `quality`, proving the default
  path is untouched).

**`4k-intro.md`'s `pacing: hour` claim softened** — see next section for
why it wasn't built. The artistic idea (a piece with a deliberate
hour-scale arc) is kept; the fabricated field reference is removed, and
a new practical consequence is spelled out: since the real daemon always
plays a piece across genuine wall-clock time regardless of any
validator feature, nothing stops a piece from being authored this way —
but the validator has no way to preview the full hour, so an arc piece
must be authored so its opening several seconds *also* reads as alive
(not black/frozen/flat), even though the real payoff arrives later
during actual deployment.

## `pacing: 'hour'` — designed in detail, deferred, not built

Worth recording in full since real design work happened here across two
sub-agent passes before Jim's call to stop — so a future session
revisiting this doesn't have to re-derive it.

**The idea**: today's validator always runs a fixed `TOTAL_FRAMES=300`
at `dt=1/fps` — for a 30fps piece, only the opening ~10 simulated
seconds, regardless of a piece's real deployed runtime (~1 hour). A
piece designed with a deliberate hour-scale arc (dark → build → climax
— the 4K-intro and Reas dossiers' best ideas) can never have that arc
actually exercised or previewed by the validator today; `pacing:'hour'`
would have told the harness to sample across a simulated hour instead.

**The converged design** (validator-side only — zero effect on the real
daemon, which always plays a program in real wall-clock time regardless
of any pacing metadata):
- Split by `runtime.mode`, because pixel and buffer mode have genuinely
  different correctness requirements:
  - **pixel mode**: cheap and exact. `pixel(x,y,t)` structurally never
    receives `dt` (confirmed: not part of the call signature at all, not
    just convention), so there's no integration-correctness risk to
    giant time jumps — just call `runPass(runtime, 300, 3600/299, null)`
    directly. Same cost as today, just landing on evenly-spaced `t`
    values across the full simulated hour instead of the first 10s.
  - **buffer mode**: needs real fine-grained `dt` stepping to keep
    velocity/state integration correct (a naive giant-dt version would
    produce overshoot/teleporting/broken bounce logic that never happens
    in real daemon operation). Run the full simulation at `dt=1/fps` for
    `totalSteps = Math.round(3600*fps)` real calls, but only *retain*
    every Nth call's frame buffer for metrics/GIF (bounded memory: all
    108,000 retained 12KB buffers would be ~1.3GB).
- `runPass` would need a `{retainStride, maxWallMs}` options object
  (backward compatible, defaults preserve today's exact behavior).
- `validate/preview.js` and `validate/inputScenarios.js` need **zero**
  code changes — confirmed by both sub-agent passes. `writePreviewGif`
  just re-samples whatever `frames` array it's given and computes delay
  from the real `fps`; fed hour-paced frames it naturally produces a
  ~10s "time-lapse trailer," which is the right behavior, not a gap.
  `synthClock`'s day-sweep is already `frameIndex/totalFrames`-relative,
  intentionally orthogonal to a piece's own pacing (arc-length and
  hour-of-day-robustness are different concerns) — CLAUDE.md/
  VFX_API.md already describe the day-sweep as independent of this.

**Why it's deferred — the real risk, not just Jim's discomfort with
complexity**: a buffer-mode piece that's merely *within* the existing
20ms frame budget (a legitimately passing piece, not a pathological one)
costs `108,000 x 20ms ≈ 36 minutes` for the neutral pass alone at 30fps.
CLAUDE.md's creativity loop retries up to 3 times per hour — that alone
could blow past the hourly cadence with no way to fail fast. A
`maxWallMs` ceiling (polled *inside* the loop, since `renderFrame` is
fully synchronous with no `await` anywhere in its call chain — an outer
`Promise.race`/`setTimeout` would never fire until the loop yields on
its own, i.e. never) would close this specific hole, but Jim's call is
that the whole feature adds real brittleness to the validator for a
benefit that hasn't been proven yet — not worth it until there's a
concrete piece that actually needs it. **If revisited**: the design
above (including the `runPass` diff and the wall-clock-ceiling
mechanism) is ready to implement close to as-is; re-read this section
rather than redesigning from scratch.

## What's left — the actual next task

**The artist-agent code itself** (CLAUDE.md phase 4) — still not
started at all. `agent/` doesn't exist yet. This is the big remaining
piece: the hourly creativity session (Anthropic API calls, prompt design
against `docs/VFX_API.md` + the now-reviewed `knowledge/` + past
pieces' frontmatter and GIF previews), the validate-with-retry loop
(up to 3 retries per CLAUDE.md, then fall back to replaying a library
piece), and `index.json`/library management (writing new pieces,
lineage citation, appending lessons to the knowledge base). No design
decisions made on this yet — starting fresh next.

## Still deferred (unchanged)

- Phase 1: crossfade-in, watchdog fallback-to-known-good.
- Phase 5 remainder: systemd units (render daemon + wall-label server
  boot-start/restart — the labwc autostart added last session only
  covers "today's graphical session," not boot-time/cold-start); the
  GPIO4→GPIO18 PWM jumper mod.
- CLAUDE.md's small Pi-deploy-notes inaccuracies (rpi-led-matrix
  install-skip wording, missing `npm approve-scripts` mention, not
  mentioning this is the full Raspberry Pi Desktop image rather than
  headless Lite) — still not folded in, still low priority.

## Blockers

None. Everything in this session is implemented and verified; nothing
committed yet (see below).

## Uncommitted work

Everything from this session is uncommitted. `git status --short`:

```
 M docs/VFX_API.md
 M effects/fireflies.gif
 M effects/koi_pond.gif
 M effects/tide_pool_lantern.gif
 M host/runtime/prelude.js
 M knowledge/artists/4k-intro.md
 M knowledge/artists/casey-reas.md
 M knowledge/artists/vera-molnar.md
 M validate/index.js
```

(`knowledge/README.md`, `knowledge/artists/jim-campbell.md`, and
`knowledge/craft/effect-bestiary.md` are Jim's own new files from his
separate session, already in the working tree but not yet committed
either — the whole knowledge base is landing as part of whatever commit
covers this session.) Check with Jim before committing, same as always.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
