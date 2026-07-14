# LED VFX

An autonomous LED artist: a Raspberry Pi 4 + 64x64 HUB75 matrix running
generative art 24/7, with an hourly LLM "creativity process" that studies
its own archive and writes the next piece.

- `docs/VFX_API.md` — the effect-program contract
- `effects/` — seed exemplar programs
- `host/` — render daemon, QuickJS runtime bridge, display backends
- `CLAUDE.md` — project context for Claude Code sessions

Status: build phases 1-3 done, plus real-hardware rendering from phase 5
— QuickJS sandbox runtime + SimDisplay, a headless validation harness
(frontmatter/lineage checks, liveliness metrics, GIF previews), real
input sampling (audio, clock, button, weather) feeding the sandbox every
frame, and a MatrixDisplay backend that renders to an actual HUB75 panel
on a Pi. See CLAUDE.md for the phase plan.

## Running the sim

```
npm install
npm run sim                        # loops effects/playlist.json
node host/daemon.js effects/koi_pond.js   # or run a single effect
```

Then open http://localhost:8080 in a browser. Hold the on-screen button
to feed `input.button`; audio is a synthetic oscillator by default (real
mic input is Pi-only — see below).

### Input sampling flags

```
node host/daemon.js effects/tide_pool_lantern.js --lat 36.97 --lon -122.03 --audio synthetic
```

- `--lat` / `--lon` — install site coordinates, drive `input.clock`'s
  daylight curve (via `suncalc`) and `input.env` weather (via
  Open-Meteo). Default: Santa Cruz, CA.
- `--audio` — `synthetic` (default; a fake oscillator, since dev
  machines don't have a panel mic) or `arecord` (real mic input via
  `arecord` + `fft.js`, Pi-only — degrades to `ok:false` gracefully if
  `arecord` isn't available, e.g. on Windows).

## Running on real hardware

`MatrixDisplay` (`host/display/MatrixDisplay.js`) renders to an actual
HUB75 panel via `rpi-led-matrix`, which wraps hzeller/rpi-rgb-led-matrix
in a native N-API addon. That addon has to compile on the Pi's own ARM
hardware, so the repo needs to live and build on the Pi itself:

```
# on the Pi (e.g. glowy), not Windows:
git clone https://github.com/JimWhiteheadUCSC/led-vfx.git   # or `git pull` if already cloned
cd led-vfx
node --version                        # confirm Node 20+ (ARM64 build)
npm install                           # builds rpi-led-matrix's native addon here

sudo node host/daemon.js effects/koi_pond.js \
  --display matrix --gpio-mapping adafruit-hat --gpio-slowdown 2
```

Notes:
- **`sudo` is required** — GPIO access needs root, same as the
  `rpi-rgb-led-matrix` demo binary.
- `rpi-led-matrix` is an `optionalDependency`: its own install has no
  non-Pi guard and hard-fails via node-gyp on Windows, so `npm install`
  simply omits it there rather than breaking the whole install. This
  means `--display matrix` only ever works on a machine where that
  native build actually succeeded.
- `--gpio-mapping adafruit-hat` (the default) matches a confirmed-working
  hardware config: the GPIO4→GPIO18 jumper mod for hardware PWM hasn't
  been done, so `adafruit-hat-pwm` isn't correct yet. Switch to it later
  if that mod happens.
- `--gpio-slowdown` (default 2) and `--brightness` (default 100, 0-100)
  are also tunable if you see flicker/artifacts or want to reduce power
  draw — see `host/display/MatrixDisplay.js` for the reasoning behind
  the defaults.
- `--display sim` (the default) is unaffected by any of this — the sim
  path doesn't touch `rpi-led-matrix` at all.

## Wall label

A secondary small screen (HDMI on the Pi) can show the currently-running
piece's title and rationale, straight from its `/*@vfx ... @vfx*/`
frontmatter — like a museum wall label. It's a standalone process,
independent of the render daemon: `host/daemon.js` writes the current
piece's info to `run/current-piece.json` on every program switch, and
the wall-label server (`host/wallLabel/server.js`) watches that file and
pushes it to a browser page over WebSocket. Neither process can take the
other down.

```
npm run wall-label                        # serves http://localhost:8081
npm run sim                               # (in another terminal) drives it
```

Open `http://localhost:8081` in any browser to see it update live as the
render daemon switches effects — no Pi or real display required to try
this. The page is plain HTML/CSS (`clamp()`-based responsive text, no
fixed resolution assumed) so it isn't tied to any particular screen size.

On the Pi, point a kiosk browser at that URL instead of a regular tab.
`host/wallLabel/autostart.sh` does this automatically via labwc (the
desktop's Wayland compositor):

```
chmod +x host/wallLabel/autostart.sh
ln -s "$(pwd)/host/wallLabel/autostart.sh" ~/.config/labwc/autostart
```

Then log out/in or reboot (labwc only reads `autostart` at session
start, not on `--reconfigure`/SIGHUP). This starts the wall-label server
and a Chromium kiosk window on the secondary HDMI output; it does *not*
start the render daemon itself — that's still a manual `npm run sim` (or
the real-hardware command above) until systemd units exist. Logs land in
`~/.cache/wall-label-server.log` and `~/.cache/wall-label-chromium.log`.

## Validating an effect program

```
npm run validate -- effects/koi_pond.js   # single file
npm run validate -- --all                 # every entry in index.json
```

Runs the program headless for ~300 frames, checks for exceptions, frame
budget, liveliness (not frozen/black/flat), and frontmatter/lineage
validity, and writes a preview GIF beside the source file.
