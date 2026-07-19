# Handoff note — 2026-07-19 (evening)

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: second agent-authored piece landed, and it surfaced a real daemon gap (now fixed)

Jim ran the agent a second time (manually, timer still not enabled) and
it produced **"Saccades, After Molnar"** (`effects/saccades-after-molnar.js`,
`d2c57303-5cf6-4e2b-99e9-0d587b2e01c2`) — a Molnár-lineage piece
(`inspiration` lineage off its own earlier Passerby), with a genuinely
good attempt note: it names a real validation failure it hit (a
near-still piece tripping the 0.15 temporal-variance "frozen" floor) and
the fix (a whole-field brightness wave, not just the deviating region),
drawing a real lesson for future near-still work. Visually confirmed via
its stills — a faithful, good-looking realization of Molnár's Saccades.

**But it wasn't showing up on the real panel/kiosk.** Jim caught this
and asked why. Root cause, found and fixed this session:

`host/daemon.js`'s `main()` loaded `effects/playlist.json` **once** at
startup into a plain array and looped that same in-memory array forever
— it never re-read the file. The already-running real-hardware daemon
(started before this second piece existed) had no way to ever notice
`playlist.json` had grown, short of a manual restart. Confirmed by
reading the code, not guessed. Fixed in `host/daemon.js`: the playlist
is now re-read from disk at the top of every rotation (`while (!stopped)`
loop), falling back to the last-known-good playlist if a read
transiently fails (mid-write, briefly malformed) rather than crashing —
same "degrade gracefully" spirit as the rest of the render loop. Single-
file mode is unaffected (nothing to reload — it's one fixed file).

**Related bonus fix, same session**: now that the daemon re-reads
`playlist.json` on every rotation, `agent/library.js`'s plain
`fs.writeFileSync` on `index.json`/`playlist.json` had a (small but real)
window where a reader could land mid-write. Changed both to write-then-
rename (atomic on POSIX) via a small `atomicWriteFileSync` helper — same
idiom already used for the wall-label's `run/current-piece.json`
handoff. Verified against a scratch copy: clean writes, no leftover
`.tmp` files, existing formatting preserved.

**Jim needs to restart the real-hardware daemon one more time** to pick
up this fix (it's a code change, not something the running process can
absorb on its own) — after that, no further restarts should be needed
for future agent-created pieces to appear.

## What's left

- **Restart the daemon** to pick up the `host/daemon.js` fix (see
  above) — `sudo node host/daemon.js --playlist effects/playlist.json
  --display matrix --gpio-mapping adafruit-hat --gpio-slowdown 2`, same
  invocation as before.
- **The timer is still not enabled** (deliberately, per Jim's earlier
  call) — only run manually twice so far, both times producing a real,
  good piece. Whenever ready for the hourly cadence for real:
  `sudo systemctl enable --now led-vfx-agent.timer`.
- **The render daemon's own systemd unit** — still not built, still a
  manually-started/restarted process in a terminal Jim owns. This gap
  matters more now that it's been directly observed causing a visible
  "piece exists but isn't showing" symptom once already (via the
  playlist-reload issue) — worth remembering next time something looks
  stale.
- **The wall-label server's own systemd unit** — likewise still just
  labwc-autostart-launched. Separately deferred.
- **The weekly review session** (naming/ratification, per
  `knowledge/naming.md`) — still doesn't exist. Two pieces in, "Saccade"
  is building a real practice (a second lineage citation back to its own
  first piece) — the naming/manifesto thresholds in `naming.md` (12 kept
  pieces, a contrast lineage, attempt notes under two dossiers) are still
  far off, nothing to do here yet.
- `meta.pacing = 'hour'` — still deferred from a prior session.
- CLAUDE.md's small Pi-deploy-notes inaccuracies — still not folded in,
  flagged across many prior handoffs now, still genuinely low priority.

## Blockers

None code-side. Jim needs to restart the daemon once (see above) for
the fix to take effect on the running system.

## Uncommitted work

At the time of this note: `host/daemon.js` (the reload fix),
`agent/library.js` (atomic writes), and everything from Jim's second
agent run (`effects/saccades-after-molnar.*`, the `knowledge/artists/vera-molnar.md`
attempt note, updated `index.json`/`effects/playlist.json`) are
uncommitted. Check with Jim before committing, same as always — though
by the time this is read, this may already be done; check `git log`
before assuming.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
