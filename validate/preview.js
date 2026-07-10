'use strict';

// Renders a GIF preview from a run's captured frame buffers, written
// beside the program's source file (docs/VFX_API.md / CLAUDE.md phase 2:
// "render a preview GIF stored beside the piece"). Frames are sampled
// (not every frame, to keep file size sane) and nearest-neighbor upscaled,
// since a native 64x64 GIF is hard to read in a file browser or the
// creativity agent's own vision context when it studies its archive.

const fs = require('fs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const SAMPLE_STRIDE = 5;
const UPSCALE = 4;
const MAX_SAMPLED_FRAMES = 90;

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

module.exports = { writePreviewGif };
