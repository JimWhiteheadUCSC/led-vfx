# LED VFX

An autonomous LED artist: a Raspberry Pi 4 + 64x64 HUB75 matrix running
generative art 24/7, with an hourly LLM "creativity process" that studies
its own archive and writes the next piece.

- `docs/VFX_API.md` — the effect-program contract
- `effects/` — seed exemplar programs
- `host/` — render daemon, QuickJS runtime bridge, display backends
- `CLAUDE.md` — project context for Claude Code sessions

Status: build phase 1 done — QuickJS sandbox runtime + SimDisplay running
all three seed effects in a browser. See CLAUDE.md for the phase plan.

## Running the sim

```
npm install
npm run sim                        # loops effects/playlist.json
node host/daemon.js effects/koi_pond.js   # or run a single effect
```

Then open http://localhost:8080 in a browser.
