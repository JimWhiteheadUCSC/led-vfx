# Handoff note — 2026-07-14 (later still, same day)

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: wall-label HDMI feature implemented + sim-verified; real-hardware/kiosk check pending a reboot

This session built the wall-label feature (phase 5's last undone
render-host piece besides crossfade/watchdog and systemd units): a
secondary small HDMI screen showing the currently-running effect's
title/rationale, museum-label style. Fully implemented and verified via
the sim path (no Pi-specific setup needed). The one remaining check —
does the Chromium kiosk window actually appear on the physical HDMI
panel — is blocked on a reboot Jim is about to do. **This session's
process is running on glowy itself, so the reboot will kill this
session's connection** — that's why this handoff exists now rather than
after the reboot.

## What's done

**New module `host/wallLabel/`** (mirrors `host/display/`'s
interface/impl shape):
- `pieceInfo.js` — loose, best-effort frontmatter parse (`parsePieceInfo`).
  Deliberately NOT `validate/frontmatter.js`'s strict `validateFrontmatter`
  — never throws, falls back to the filename as title and `''` for
  rationale/artist/created if frontmatter is missing/broken, since a
  program with bad frontmatter still runs on the panel and still
  deserves a label rather than crashing the daemon.
- `currentPieceStore.js` — the daemon↔label-server handoff: writes
  `run/current-piece.json` (atomic temp-file + `renameSync`), reads it
  back safely (`null` on missing/corrupt), and `watchCurrentPiece()`
  pushes changes to a callback. **Important correctness detail a Plan
  sub-agent caught before any code was written**: it watches the
  *containing directory* (`run/`), not the file itself — `fs.watch` on a
  file binds to that file's inode, and the atomic rename replaces the
  inode on every write, which silently orphans a file-level watch after
  the very first update. Directory-watch + filename filter + ~50ms
  debounce is the correct fix. Verified working this session (see
  Verification below).
- `server.js` — standalone HTTP+WebSocket server (closely mirrors
  `host/display/SimDisplay.js`), serves `host/wallLabel/page/`, default
  port **8081** (distinct from `SimDisplay`'s 8080 so both run on one
  machine). Sends `{type:'hello', piece}` on connect (piece may be
  `null`), broadcasts `{type:'piece', piece}` on change. Runnable via
  `npm run wall-label`.
- `page/index.html` + `page/client.js` — same vanilla-JS/inline-style/
  no-build-step conventions as `simpage`, laid out as a title card.
  Resolution-agnostic CSS (`clamp()` font sizing, `vw`/`vh`, flexbox) —
  deliberate, since Jim flagged the current physical panel (a Hagibis
  X86 3.5", 960×640) as a short-lived/quirky form factor that shouldn't
  be hardcoded against. `white-space: pre-wrap` on the rationale element
  since `rationale: |` is a YAML block literal with real newlines that
  `textContent` would otherwise collapse.
- `autostart.sh` — repo-tracked, symlinked to `~/.config/labwc/autostart`.
  Starts the wall-label server, polls (bounded, ~5s) until it's up, then
  launches Chromium in kiosk mode (`--kiosk --app=URL`, isolated
  `--user-data-dir`, no infobars/crash-bubble). Resolves its own repo
  location via `readlink -f "$0"` rather than a hardcoded path. Does
  **not** start the render daemon — still a manual `npm run sim`, per the
  still-deferred systemd split.

**`host/daemon.js`**: two new `require`s, one `writeCurrentPiece(...)`
call in `runProgram()` right after a successful `VfxRuntime.load`,
wrapped in its own try/catch (a run-directory permissions/disk problem
must never take down the render loop — the whole point of the
file-based decoupling instead of an in-process call).

**Small housekeeping**: `package.json` gets a `"wall-label"` script;
`.gitignore` gets `run/` (generated handoff state, not source);
`README.md` gets a new `## Wall label` section (between "Running on real
hardware" and "Validating an effect program") documenting the npm script
and autostart setup; `CLAUDE.md`'s repo-layout bullet for `host/` updated
to mention the wall-label server and drop a stale "(to create)".

**De-risked before writing code** (a Plan sub-agent read the live system
— `ps`, `man labwc-config`, `/usr/bin/labwc-pi`, `/etc/xdg/labwc/autostart`
— not just docs):
- This Pi's session always launches `labwc -m` (hardcoded in
  `/usr/bin/labwc-pi`), and `-m` means a user `~/.config/labwc/autostart`
  *augments* rather than replaces the system one (`wf-panel-pi`,
  `pcmanfm-pi`, `kanshi`, `lxsession-xdg-autostart`) — confirmed safe to
  add without disturbing the existing desktop.
- `lwrespawn` (the system autostart's crash-respawn helper) was
  deliberately skipped — it dedupes via `pgrep <name>`, and both
  `daemon.js` and `wallLabel/server.js` run as plain `node`, so `pgrep
  node` can't tell them apart. Plain `&` backgrounding is enough for the
  stated scope (today's session self-sufficient; full systemd/respawn
  semantics stay in the already-deferred phase-5 item).

## Verification done this session (sim path — no Pi-specific setup needed)

All of these passed, directly on this checkout:
1. Wall-label server alone shows a neutral "waiting" state with no
   `run/current-piece.json` yet.
2. `node host/daemon.js effects/koi_pond.js` → `run/current-piece.json`
   correctly holds Koi Pond's real title/rationale (verified the YAML
   block-literal newlines survive into the JSON correctly).
3. A fresh WebSocket connection's `hello` message immediately reflects
   whatever piece is already running (not just future pushes) — proves
   `readCurrentPiece()` on connect works independently of the watch push.
4. Switching effects (tested both a manual daemon restart and a real
   `--playlist` rotation with short durations) pushes a live `{type:
   'piece', ...}` update to connected clients with no page reload.
5. `touch`ing an unrelated file in `run/` produces **no** broadcast —
   confirms the directory-watch filename filter works, i.e. the
   fs.watch-on-directory design is actually correct, not just
   theoretically justified.
6. An effect file with its `/*@vfx ... @vfx*/` block stripped entirely
   still runs and produces a label falling back to the filename with
   empty rationale/artist/created — no crash in either process.

**Not yet verified — the actual next task**: does the kiosk window
really appear on the physical HDMI panel via the autostart mechanism.

## What's left — the actual next task

Jim ran the autostart symlink setup successfully, but **logging out/in
over SSH did not bring up the kiosk window** — worth recording why,
since it's a non-obvious gotcha: the graphical session on `tty1`/`seat0`
(the one running `labwc`, confirmed via `loginctl show-session 3 -p
Type -p Class -p State -p TTY` → `Type=tty Class=user State=online`,
same session leader PID as before) is completely independent of SSH
sessions. SSH logout/login only ends an SSH ("user" class, no seat)
session — it has zero effect on the desktop session driving HDMI output.
`autostart` is only read at graphical-session start (confirmed earlier
via `man 5 labwc-config`: not re-run on `--reconfigure`/SIGHUP either),
so nothing short of ending that specific graphical session — realistically
a full reboot — will pick it up.

Jim is about to `sudo reboot` glowy. **Next session should**:
1. Confirm the kiosk window appears fullscreen on the HDMI panel with no
   browser chrome (check physically or however Jim reports it).
2. Confirm `wf-panel-pi`/`pcmanfm-pi` (or their post-reboot equivalents)
   are still present on the regular desktop — proves the autostart merge
   didn't clobber the system one, completing the real-Pi verification
   plan's step 2.
3. `npm run sim` manually (still not systemd-started) and confirm the
   physical secondary panel updates live.
4. `kill -9` the wall-label server while kiosk is up, confirm the
   client's reconnect loop keeps retrying and the render daemon is
   unaffected (crash isolation — the whole point of the file-based
   handoff design).
5. If all that holds, this feature is done pending Jim's go-ahead to
   commit (see Uncommitted work below).

## Still deferred (unchanged)

- Phase 1: crossfade-in, watchdog fallback-to-known-good.
- Phase 5 remainder: systemd units (render daemon + wall-label server
  boot-start/restart — explicitly NOT done by the autostart script added
  this session, which only covers "today's graphical session", not
  boot-time/cold-start); the GPIO4→GPIO18 PWM jumper mod (so
  `--gpio-mapping` stays `adafruit-hat`).
- Phase 4: creativity agent, `knowledge/` seed docs — not started.
- CLAUDE.md's two small Pi-deploy-notes inaccuracies (rpi-led-matrix
  install-skip wording, missing `npm approve-scripts` mention) — still
  not folded in, still low priority. A third small one could be added
  while there: CLAUDE.md's Pi deploy notes still don't mention this is
  the full Raspberry Pi Desktop image (labwc/Chromium), not headless
  Lite, which the wall-label feature now actually depends on.

## Blockers

None code-side. Blocked on Jim's reboot + physical confirmation for the
one remaining verification item above.

## Uncommitted work

**Everything from this session is uncommitted.** `git status --short`:

```
 M .gitignore
 M CLAUDE.md
 M HANDOFF.md
 M README.md
 M host/daemon.js
 M package.json
?? host/wallLabel/
```

Jim asked "want me to commit this now?" was asked by the prior instance
but not yet answered before the reboot conversation started — **check
with him before creating a commit**, same as always. Given a reboot is
imminent and this session's process will die with it, this uncommitted
state will persist on disk across the reboot (it's just working-tree
changes, not anything session-scoped) — nothing will be lost, just
un-committed, so there's no urgency to commit blind before losing the
session.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
