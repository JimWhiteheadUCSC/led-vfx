/*@vfx
id: edf2b430-e1c7-48e9-b3c3-d5f018443d89
title: Mic Check (debug utility, not a library piece)
created: 2026-07-21
artist: debug-tool
lineage: []
influences: []
rationale: |
  Not an artwork - a diagnostic aid for confirming a USB microphone is
  actually reaching the render daemon's audio sampler, written the day
  Jim wired one up to the Pi for the first time. Deliberately literal
  where every other piece in this library is deliberately not: it does
  nothing at all when input.audio looks silent, so "the panel stays
  dark" is itself the useful signal, not something to make art from.
  Not added to index.json/playlist.json on purpose - run it standalone.
@vfx*/

// mic_check - buffer mode debug tool, not part of the curated library.
//
// Run with the REAL audio source, not the default synthetic one, or
// this will show a fake signal regardless of hardware:
//   node host/daemon.js effects/mic_check.js --audio arecord --display matrix
// (add --display sim to check on a dev machine with no real mic first -
// the sim's fake audio still exercises the "ok" / bar-drawing logic.)
//
// Panel stays fully black unless input.audio says otherwise:
//   - top-left 4x4 dim red square: input.audio.ok is false - the host's
//     audio sampler has no signal path at all (arecord missing/dead, or
//     still filling its startup window). If this is showing, the panel
//     daemon isn't receiving anything from the mic, full stop - check
//     `arecord -l` lists the USB device and that nothing else has it
//     open, independent of anything on screen.
//   - otherwise, ok is true (the sampler IS delivering samples) but
//     nothing is drawn until input.audio.level clears a small noise
//     floor - true silence should look identical to "no piece running."
//   - three vertical bars (bass=red, mid=green, treble=blue) sized by
//     each band's energy, plus a white bar across the bottom row sized
//     by overall level, plus a small white blip in the top-right corner
//     on a detected beat (e.g. clapping).

const meta = { name: "mic_check", fps: 30, inputs: ["audio"] };

const NO_MIC_COLOR = rgb(50, 0, 0);
const SILENCE_LEVEL = 0.03; // just above the sampler's own noise floor

const BAR_COLOR = [rgb(230, 60, 40), rgb(60, 220, 90), rgb(70, 150, 255)]; // bass, mid, treble
const BAR_CX = [14, 30, 46];
const BAR_HALF_WIDTH = 5;
const BAR_MAX_HEIGHT = HEIGHT - 6; // leave room for the level row + headroom

function drawBar(cx, value) {
  const h = Math.round(clamp(value, 0, 1) * BAR_MAX_HEIGHT);
  return h;
}

function render(t, dt) {
  fill(0);

  const au = input.audio;

  if (!au.ok) {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) setPixel(x, y, NO_MIC_COLOR);
    }
    return;
  }

  if (au.level < SILENCE_LEVEL) return; // sampler is live, room is just quiet

  const bands = [au.bass, au.mid, au.treble];
  for (let i = 0; i < 3; i++) {
    const h = drawBar(BAR_CX[i], bands[i]);
    for (let y = 0; y < h; y++) {
      for (let dx = -BAR_HALF_WIDTH; dx <= BAR_HALF_WIDTH; dx++) {
        setPixel(BAR_CX[i] + dx, HEIGHT - 2 - y, BAR_COLOR[i]);
      }
    }
  }

  const levelWidth = Math.round(clamp(au.level, 0, 1) * WIDTH);
  const white = rgb(255, 255, 255);
  for (let x = 0; x < levelWidth; x++) setPixel(x, HEIGHT - 1, white);

  if (au.beat) {
    for (let y = 0; y < 3; y++) {
      for (let x = WIDTH - 3; x < WIDTH; x++) setPixel(x, y, white);
    }
  }
}
