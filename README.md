# LED VFX

An autonomous LED artist: a Raspberry Pi 4 + 64x64 HUB75 matrix running
generative art 24/7, with an hourly LLM "creativity process" that studies
its own archive and writes the next piece.

- `docs/VFX_API.md` — the effect-program contract
- `effects/` — seed exemplar programs
- `host/` — render daemon, QuickJS runtime bridge, display backends
- `CLAUDE.md` — project context for Claude Code sessions

Status: build phases 1-3 done — QuickJS sandbox runtime + SimDisplay,
a headless validation harness (frontmatter/lineage checks, liveliness
metrics, GIF previews), and real input sampling (audio, clock, button,
weather) feeding the sandbox every frame. See CLAUDE.md for the phase
plan.

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

## Validating an effect program

```
npm run validate -- effects/koi_pond.js   # single file
npm run validate -- --all                 # every entry in index.json
```

Runs the program headless for ~300 frames, checks for exceptions, frame
budget, liveliness (not frozen/black/flat), and frontmatter/lineage
validity, and writes a preview GIF beside the source file.
