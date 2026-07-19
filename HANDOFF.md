# Handoff note — 2026-07-19

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: creativity agent shipped (committed `79d7ecb`, pushed); its hourly systemd timer is written but needs a manual sudo install

The creativity agent (CLAUDE.md phase 4 — see the prior handoff section
in git history for the full design writeup) is done, committed, and
pushed. Its first real piece, `effects/passerby.js`, is in the library.
This session's work: wiring `agent/session.js` to run automatically on
an hourly cadence via systemd, per Jim's explicit request, scoped
narrowly to *just* the agent timer (the render daemon's and wall-label's
own separately-deferred systemd items are untouched, on purpose).

## What's done

`agent/systemd/led-vfx-agent.{service,timer}` — repo-tracked unit files
(same "write in the repo, symlink into `/etc/systemd/system/`" pattern
already used for `host/wallLabel/autostart.sh`). `systemd-analyze
verify` passes on both with no errors.

Decisions, per Jim's explicit answers this session (don't re-litigate):
- **Left disabled after install, not enabled/started.** Unattended,
  recurring Opus 4.8 spend is something Jim turns on himself
  (`systemctl enable --now led-vfx-agent.timer`), not something a repo
  change silently activates.
- **`Type=oneshot`, no `Restart=`.** A failed run (exhausted retries, a
  bad key, a network blip) waits for the next hourly trigger rather than
  retrying in a tight loop that would compound cost on a persistent
  problem — it just shows up in `systemctl --failed` for whoever checks.
- **Timer sets `Persistent=false`** (explicit, not just relying on the
  also-false default) — a missed run (machine off) does not fire a
  catch-up burst on return. This is a creative cadence, not a critical
  job worth backfilling.
- **Runs as `User=ejw`, never root** — the agent only reads/writes repo
  files and talks to the Anthropic API, no GPIO/hardware access needed,
  unlike the render daemon which genuinely does need `sudo`.
- **`EnvironmentFile=%h/Code/led-vfx/.env`** — confirmed the existing
  `.env` (plain `KEY=VALUE`, no quotes) is directly compatible with
  systemd's own env-file syntax, no translation needed. `%h` (not a
  hardcoded path) resolves from `User=`.
- **`ExecStart` uses `/usr/local/bin/node`**, not a bare `node` relying
  on `PATH` — systemd services don't source shell rc files where nvm
  sets up `PATH`, and this symlink (to the real nvm-installed binary)
  already exists from the MatrixDisplay `sudo`/PATH fix several sessions
  back. Confirmed it still resolves correctly before relying on it again.
- **`TimeoutStartSec=1800`** — a generous but real bound, in the same
  spirit as this project's other "don't let a slow/hung run block
  forever" guards (e.g. the `pacing:'hour'` wall-clock-ceiling design
  from an earlier session, deferred but recorded for exactly this
  reason).

README.md gained a "Running it automatically (systemd timer)" section
under "The creativity agent" documenting all of the above plus the
install/verify/manual-run commands.

**Blocked on Jim, not on anything code-side**: installing the units
needs `sudo`, and this session has no interactive terminal for a
password prompt (same situation as the wall-label autostart install a
few sessions back). Jim needs to run, on glowy:

```
sudo ln -sf /home/ejw/Code/led-vfx/agent/systemd/led-vfx-agent.service /etc/systemd/system/led-vfx-agent.service
sudo ln -sf /home/ejw/Code/led-vfx/agent/systemd/led-vfx-agent.timer /etc/systemd/system/led-vfx-agent.timer
sudo systemctl daemon-reload
systemctl status led-vfx-agent.timer   # confirm: loaded, disabled, inactive
```

Then, whenever he's ready to actually let it run hourly:
`sudo systemctl enable --now led-vfx-agent.timer`. Worth testing with a
manual `sudo systemctl start led-vfx-agent.service` +
`journalctl -u led-vfx-agent.service -f` first, per the README, before
flipping the timer on for real.

## What's left

- **The actual install + first real run under systemd** — see above,
  needs Jim's hands. Once installed, a next session should confirm the
  service actually finds `.env`/node/the repo correctly under systemd's
  more restricted environment (interactive-shell testing doesn't fully
  prove this — e.g. `EnvironmentFile` parsing edge cases, though the
  `.env` format was confirmed compatible by inspection).
- **The render daemon's and wall-label's own systemd items** — still
  separately deferred, explicitly not touched this pass.
- **The weekly review session** (naming/ratification, per
  `knowledge/naming.md`) — still doesn't exist.
- **`meta.pacing = 'hour'`** — still deferred from a prior session.
- CLAUDE.md's small Pi-deploy-notes inaccuracies — still not folded in,
  still low priority, flagged across multiple prior handoffs now.

## Blockers

Just the sudo install step above — nothing code-side.

## Uncommitted work

`agent/systemd/led-vfx-agent.service`, `agent/systemd/led-vfx-agent.timer`,
and the README addition are uncommitted as of this note. Check with Jim
before committing, same as always.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
