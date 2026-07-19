# Handoff note — 2026-07-19 (later)

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: the whole pipeline is live and confirmed working end-to-end on real hardware

Everything is installed, fixed, and verified on glowy - not just "should
work." In order:

1. **Creativity agent** (CLAUDE.md phase 4) shipped and pushed earlier
   today (`79d7ecb`) — see that commit / the prior handoff section in
   git history for the full design. Its first piece, `effects/passerby.js`
   ("Saccade"), is in the library.
2. **Systemd timer for the agent** (`agent/systemd/led-vfx-agent.{service,timer}`,
   pushed as `5cc4759`) — installed by Jim, left deliberately disabled
   (see that commit for the reasoning: no auto-start, no `Restart=`,
   `Persistent=false`, runs as `ejw` not root).
3. **Found and fixed a real bug during Jim's first manual test run**:
   `EnvironmentFile=%h/Code/led-vfx/.env` / `WorkingDirectory=%h/Code/led-vfx`
   failed with "Failed to load environment files" / "Failed to spawn
   'start' task: No such file or directory". Root cause: `%h` in a
   **system** unit (as opposed to a per-user unit) resolves relative to
   the service manager's own context (effectively root/`/root`), not to
   that specific service's `User=ejw` — a real systemd gotcha, confirmed
   the hard way rather than assumed. Fixed by hardcoding
   `/home/ejw/Code/led-vfx` instead of relying on the specifier (more
   correct for a single-Pi personal deployment anyway — nothing here
   needs to be portable across users). Jim ran `daemon-reload` +
   `reset-failed` + `start` after the fix and **confirmed it now works**.
4. **Found and fixed a second real bug, unrelated to systemd**: the
   wall-label's `run/current-piece.json` was stale (last updated two
   days prior) even though `--display matrix` was actively running.
   Root cause: `rpi-led-matrix` drops root to the `daemon` Linux user
   after GPIO init (documented from an earlier session), and `run/` was
   `755`-ish, owned by `ejw:ejw` — not writable by `daemon`. Every write
   attempt was silently failing (caught, logged to stderr, easy to miss
   under `sudo` in another terminal). Fixed with `chmod o+w run/` (no
   `sudo` needed — `ejw` already owned the directory). Confirmed by
   checking the file's mtime updated after Jim restarted the daemon.
5. **Jim also switched his manual real-hardware daemon invocation from
   single-file mode to `--playlist effects/playlist.json`** — single-file
   mode (`node host/daemon.js effects/passerby.js ...`) loops forever on
   one file and would never rotate to future agent-created pieces
   regardless of the permissions fix. Confirmed: the panel is now
   visibly looping through the whole library, and
   `run/current-piece.json` updates on each rotation.

**Net effect**: an hourly agent run, once Jim flips the timer on, will
land a new piece in `index.json` + `effects/playlist.json`, and the
already-running real-hardware daemon (playlist mode) will pick it up and
show it on both the LED panel and the wall-label kiosk automatically -
no further wiring needed for that path.

## What's left

- **The timer is still not enabled** (deliberately) — Jim has only run
  the service manually once (successfully, post-fix). Whenever he wants
  the hourly cadence for real: `sudo systemctl enable --now
  led-vfx-agent.timer`.
- **The render daemon's own systemd unit** — still not built. Right now
  it's a manually-started, manually-restarted `sudo node host/daemon.js
  --playlist ... --display matrix ...` in a terminal Jim owns; it does
  not survive a reboot or crash on its own. Separately deferred, per
  Jim's explicit scoping from earlier today - but worth noting the
  agent's systemd timer being live now makes this gap more visible than
  before (a piece can land in the library with nothing running to ever
  show it, if the daemon isn't up).
- **The wall-label server's own systemd unit** — likewise still just
  labwc-autostart-launched, not systemd. Separately deferred too.
- **The weekly review session** (naming/ratification, per
  `knowledge/naming.md`) — still doesn't exist.
- `meta.pacing = 'hour'` — still deferred from a prior session.
- CLAUDE.md's small Pi-deploy-notes inaccuracies — still not folded in,
  flagged across many prior handoffs now, still genuinely low priority.

## Blockers

None. Everything discussed above is code-side resolved and confirmed
working on real hardware.

## Uncommitted work

None as of this note - the `%h` fix (`agent/systemd/led-vfx-agent.service`)
still needs a commit+push (was about to happen when this note was
written; do that first if it isn't already done). The `chmod o+w run/`
fix has no repo footprint (it's a filesystem permission on a gitignored
runtime directory, not a tracked file) - nothing to commit for that one,
just worth remembering it's now part of the real deployment's state,
same category as the earlier `chmod go+rx /home/ejw` fix.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
