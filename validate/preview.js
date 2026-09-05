'use strict';

// Renders a GIF preview from a run's captured frame buffers, written
// beside the program's source file (docs/VFX_API.md / CLAUDE.md phase 2:
// "render a preview GIF stored beside the piece"). Frames are sampled
// (not every frame, to keep file size sane) and nearest-neighbor upscaled,
// since a native 64x64 GIF is hard to read in a file browser or the
// creativity agent's own vision context when it studies its archive.
//
// UPSCALE is nearest-neighbor, so it adds ZERO information over the native
// 64x64 frames - it only makes them legible. That makes it pure cost on the
// agent's side: contact sheets are sent to the model as images, and image
// tokens scale with pixel area (~w*h/750). At 4x a 3x3 sheet was 772x772
// (~790 tokens each, ~18K tokens per session across the archive); at 2x it
// is 386x386 (~200 tokens each) for exactly the same pixels. Raise it again
// only if a human actually can't read the files - the model cannot tell the
// difference.
const fs = require('fs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const SAMPLE_STRIDE = 5;
const UPSCALE = 2;
const MAX_SAMPLED_FRAMES = 90;
const GUTTER_PX = 2;

// Nearest-neighbor upscale of a WIDTH*HEIGHT*3 RGB buffer to an
// (WIDTH*scale)*(HEIGHT*scale)*4 RGBA buffer (gifenc wants RGBA input).
function upscaleToRgba(rgb, width, height, scale) {
  const outW = width * scale;
  const outH = height * scale;
  const rgba = new Uint8Array(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const srcY = (y / scale) | 0;
    for (let x = 0; x < outW; x++) {
      const srcX = (x / scale) | 0;
      const srcIdx = (srcY * width + srcX) * 3;
      const dstIdx = (y * outW + x) * 4;
      rgba[dstIdx] = rgb[srcIdx];
      rgba[dstIdx + 1] = rgb[srcIdx + 1];
      rgba[dstIdx + 2] = rgb[srcIdx + 2];
      rgba[dstIdx + 3] = 255;
    }
  }
  return rgba;
}

// frames: array of Uint8Array (width*height*3 RGB), captured at `fps`.
// Writes a GIF to outputPath and returns the path.
function writePreviewGif({ frames, width, height, fps, outputPath }) {
  let sampled = frames.filter((_, i) => i % SAMPLE_STRIDE === 0);
  if (sampled.length > MAX_SAMPLED_FRAMES) sampled = sampled.slice(0, MAX_SAMPLED_FRAMES);

  const delayMs = Math.round((SAMPLE_STRIDE / fps) * 1000);
  const outW = width * UPSCALE;
  const outH = height * UPSCALE;

  const gif = GIFEncoder();
  for (const frame of sampled) {
    const rgba = upscaleToRgba(frame, width, height, UPSCALE);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, outW, outH, { palette, delay: delayMs, repeat: 0 });
  }
  gif.finish();

  fs.writeFileSync(outputPath, gif.bytes());
  return outputPath;
}

// Claude's vision only ever sees the first frame of an animated GIF
// ("Animations are unsupported, and only the first frame is used" - the
// Vision API docs) - so the animated preview above is useless as a way
// for the creativity agent to actually see a piece's motion/character.
// This renders a handful of genuinely static single-frame GIFs instead,
// sampled at even fractions across the run, reusing the same pipeline.
// frames/width/height: same as writePreviewGif. outputPaths: one path
// per still - its length determines how many stills are rendered.
function writePreviewStills({ frames, width, height, outputPaths }) {
  const outW = width * UPSCALE;
  const outH = height * UPSCALE;
  const n = outputPaths.length;

  for (let i = 0; i < n; i++) {
    // Evenly spaced across the run, e.g. [0.15, 0.5, 0.85] for n=3.
    const frac = (i + 1) / (n + 1);
    const frameIdx = Math.min(frames.length - 1, Math.floor(frac * frames.length));
    const frame = frames[frameIdx];

    const rgba = upscaleToRgba(frame, width, height, UPSCALE);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);

    const gif = GIFEncoder();
    gif.writeFrame(index, outW, outH, { palette, delay: 0, repeat: 0 });
    gif.finish();

    fs.writeFileSync(outputPaths[i], gif.bytes());
  }

  return outputPaths;
}

// Composites up to gridSize*gridSize frames (nominally captured a fraction
// of a second apart, so motion reads across the grid) into ONE still image
// - same "Claude's vision only sees frame 0 of an animated GIF" reasoning
// as writePreviewStills above, but a single still is motion-blind; a grid
// of near-frames in one image isn't. `frames[i]` may be missing (undefined/
// null) if the run ended before that slot's target time was reached - that
// cell is left blank (the dark canvas background) rather than erroring,
// since "this epoch wasn't reached" is itself meaningful information (see
// agent/archive.js/agent/prompt.js's handling of a null contact sheet).
function writeContactSheet({ frames, width, height, gridSize = 3, outputPath }) {
  const cellW = width * UPSCALE;
  const cellH = height * UPSCALE;
  const outW = cellW * gridSize + GUTTER_PX * (gridSize - 1);
  const outH = cellH * gridSize + GUTTER_PX * (gridSize - 1);

  const rgba = new Uint8Array(outW * outH * 4);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255; // opaque canvas; r/g/b stay 0 (black) for gutters/blank cells

  for (let cell = 0; cell < gridSize * gridSize; cell++) {
    const frame = frames[cell];
    if (!frame) continue;
    const col = cell % gridSize;
    const row = (cell / gridSize) | 0;
    const cellRgba = upscaleToRgba(frame, width, height, UPSCALE);
    const offsetX = col * (cellW + GUTTER_PX);
    const offsetY = row * (cellH + GUTTER_PX);
    for (let y = 0; y < cellH; y++) {
      const dstStart = ((offsetY + y) * outW + offsetX) * 4;
      const srcStart = y * cellW * 4;
      rgba.set(cellRgba.subarray(srcStart, srcStart + cellW * 4), dstStart);
    }
  }

  const palette = quantize(rgba, 256);
  const index = applyPalette(rgba, palette);

  const gif = GIFEncoder();
  gif.writeFrame(index, outW, outH, { delay: 0, repeat: 0, palette });
  gif.finish();

  fs.writeFileSync(outputPath, gif.bytes());
  return outputPath;
}

module.exports = { writePreviewGif, writePreviewStills, writeContactSheet };
