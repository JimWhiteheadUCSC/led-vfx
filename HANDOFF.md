# Handoff note — 2026-07-21

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: USB mic wired up, audio-reactive pieces confirmed working end to end

Jim attached a USB microphone (Logitech BRIO webcam's mic) to the Pi and
wasn't sure it was actually reaching the render daemon. Built a small
debug tool for exactly this (`effects/mic_check.js`, deliberately **not**
added to `index.json`/`playlist.json` — it's a diagnostic, not a library
piece): panel stays black under silence, shows a dim red square if
`input.audio.ok` is false (sampler has no signal path at all), otherwise
draws bass/mid/treble bars + an overall level bar + a beat blip.

Chased a real, non-obvious bug to ground, three layers deep:

1. **No `-D` device flag at all** — `host/input/audioArecord.js` never
   told `arecord` which ALSA device to use, relying on the "default"
   device, which doesn't reliably exist/match a USB mic added after
   boot. Fixed: added a `--audio-device` CLI flag (`daemon.js` →
   `createInputSampler` → `ArecordAudioSource`), e.g.
   `--audio-device plughw:CARD=BRIO,DEV=0`.
2. **arecord's stderr was silently swallowed** — a real diagnostic dead
   end; every error message that would have explained the failures below
   was being thrown away. Fixed: now logged with an `[ArecordAudioSource]
   arecord: ...` prefix, plus exit code/signal on process exit.
3. **The real root cause**: `rpi-led-matrix` (the real `MatrixDisplay`
   backend) drops the whole Node process from root down to the
   low-privilege `daemon` Linux system user right after GPIO init - the
   same mechanism that caused the earlier wall-label `run/` permission
   bug. `daemon.js`'s `main()` called `display.init()` **before**
   `sampler.init()`, so by the time `arecord` was spawned, the process
   (and everything it spawns) was running as `daemon`, which has zero
   permission on `/dev/snd/*` (confirmed: `id daemon` → only group is
   `daemon`, not `audio`; every `/dev/snd/*` node is `root:audio
   crw-rw----`). Adding `daemon` to the `audio` group (`sudo usermod -aG
   audio daemon`) did **not** fix it - the privilege-drop doesn't refresh
   supplementary groups, so newly-added group membership never takes
   effect for that demoted process. **Actual fix**: reordered
   `daemon.js`'s `main()` to call `sampler.init()` (which spawns
   `arecord`) *before* `display.init()`, while the process is still
   root - a spawned child process keeps the privilege level it had at
   fork time regardless of what the parent does to its own privileges
   afterward. Confirmed working on real hardware after this reorder.

All of this was found the hard way (real hardware, real error messages,
each fix tested and ruled in/out one layer at a time) - see the
conversation history for the full diagnostic trail if the compressed
version above raises questions later.

**Uncommitted at time of writing**: `host/daemon.js` (the reorder),
`host/input/audioArecord.js` (device flag + retry-on-fast-failure +
stderr logging), `host/input/index.js` (threads `audioDevice` through),
`effects/mic_check.js` (new debug tool, not wired into the library).
Get Jim's go-ahead before committing, same as always.

Also worth noting for later: `ArecordAudioSource.init()` now retries up
to 4 times on a fast failure, on the theory the failure might have been
a transient startup race - it wasn't (this was the deterministic
privilege issue above, and retries alone never fixed it), but the retry
logic is still harmless/reasonable defense-in-depth for a genuinely
transient hiccup in the future, so it was left in rather than reverted.

## What's left

- **Get Jim's go-ahead, then commit** the four files above.
- The retune note already in `audioArecord.js`'s file header (scale
  factors for level/bass/mid/treble/beat were heuristic, untested
  against real hardware) is now actually testable — worth revisiting
  once Jim's had a chance to react to `mic_check.js` with real sound and
  see whether the bars/beat detection feel right, or need retuning.
- Unrelated, sitting uncommitted in the working tree from agent runs
  (not touched this session, not evaluated): `effects/isobars.js`,
  `effects/lengths.js`, `effects/murmuration.js`, `effects/sympathetic.js`,
  `effects/the-sources-are-elsewhere.js` and their preview GIFs, plus the
  `index.json`/`effects/playlist.json`/knowledge-dossier updates that go
  with them.
- The timer is still not enabled (deliberate, per Jim's earlier call).
- The render daemon's own systemd unit — still not built.
- The wall-label server's own systemd unit — still not built.
- The weekly review session (naming/ratification) — still doesn't exist.
- `meta.pacing = 'hour'` — still deferred from a prior session.
- CLAUDE.md's small Pi-deploy-notes inaccuracies — still not folded in,
  still low priority. Worth folding in THIS session's finding too at
  some point: the deploy notes already mention GPIO/PWM quirks but not
  the root→daemon privilege drop's effect on subprocess permissions in
  general (audio was the second symptom of it; file-write was the
  first) - a general "spawn anything needing elevated permissions before
  display.init()" note could save a future session real time.

## Blockers

None. Audio confirmed working on real hardware as of this session.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
