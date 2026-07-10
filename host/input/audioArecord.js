'use strict';

// Real audio input for the Pi: spawns `arecord`, band-splits via `fft.js`.
// Best-effort skeleton in the same spirit as phase 1's MatrixDisplay —
// the plumbing is real but untested against actual hardware (no Pi + USB
// mic to verify against yet). If `arecord` is missing, fails to start, or
// exits, this degrades to `ok:false` rather than crashing the daemon —
// graceful degradation applies to the host's own sampling, not just
// program code (docs/VFX_API.md's "Degrade gracefully" rule).
//
// Scale factors in _bandEnergy/sample (level *4, /(WINDOW_SIZE/8), the
// beat threshold multiplier) are heuristic starting points, not measured
// against a real mic — expect to retune once this actually runs on glowy.

const { spawn } = require('child_process');
const FFT = require('fft.js');

const SAMPLE_RATE = 44100;
const WINDOW_SIZE = 1024; // must be a power of two for fft.js
const STARTUP_GRACE_MS = 200;

const BASS_HZ = [20, 250];
const MID_HZ = [250, 2000];
const TREBLE_HZ = [2000, 8000];

const BEAT_THRESHOLD_MULTIPLIER = 1.5;
const BEAT_MIN_BASS = 0.02;
const BEAT_COOLDOWN_SECONDS = 0.2;
const BASELINE_EMA_ALPHA = 0.05;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, u) {
  return a + (b - a) * u;
}

class ArecordAudioSource {
  constructor() {
    this.available = false;
    this.proc = null;
    this.ring = new Float32Array(WINDOW_SIZE);
    this.ringFilled = 0;
    this.writeIndex = 0;
    this.leftoverByte = null;
    this.fft = new FFT(WINDOW_SIZE);
    this.complexOut = this.fft.createComplexArray();
    this.bassBaseline = 0;
    this.beatCooldown = 0;
  }

  async init() {
    try {
      this.proc = spawn('arecord', ['-f', 'S16_LE', '-r', String(SAMPLE_RATE), '-c', '1', '-t', 'raw'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      console.warn('[ArecordAudioSource] failed to spawn arecord:', err.message);
      this.available = false;
      return;
    }

    this.proc.on('error', (err) => {
      console.warn('[ArecordAudioSource] arecord process error:', err.message);
      this.available = false;
    });
    this.proc.on('exit', () => {
      this.available = false;
    });
    this.proc.stderr.on('data', () => {}); // swallow arecord's own logging
    this.proc.stdout.on('data', (chunk) => this._ingest(chunk));

    this.available = true; // optimistic; the listeners above flip this
    // false asynchronously if arecord isn't actually usable (missing
    // binary, no device) — give that a moment to happen before we report
    // ourselves ready.
    await new Promise((resolve) => setTimeout(resolve, STARTUP_GRACE_MS));
  }

  _ingest(chunk) {
    let buf = chunk;
    if (this.leftoverByte !== null) {
      buf = Buffer.concat([Buffer.from([this.leftoverByte]), chunk]);
      this.leftoverByte = null;
    }
    if (buf.length % 2 === 1) {
      this.leftoverByte = buf[buf.length - 1];
      buf = buf.subarray(0, buf.length - 1);
    }
    const sampleCount = buf.length >> 1;
    for (let i = 0; i < sampleCount; i++) {
      this.ring[this.writeIndex] = buf.readInt16LE(i * 2) / 32768;
      this.writeIndex = (this.writeIndex + 1) % WINDOW_SIZE;
      if (this.ringFilled < WINDOW_SIZE) this.ringFilled++;
    }
  }

  _bandEnergy([loHz, hiHz]) {
    const loBin = Math.max(1, Math.floor((loHz * WINDOW_SIZE) / SAMPLE_RATE));
    const hiBin = Math.min(WINDOW_SIZE / 2 - 1, Math.ceil((hiHz * WINDOW_SIZE) / SAMPLE_RATE));
    let sum = 0;
    let count = 0;
    for (let k = loBin; k <= hiBin; k++) {
      const re = this.complexOut[2 * k];
      const im = this.complexOut[2 * k + 1];
      sum += Math.sqrt(re * re + im * im);
      count++;
    }
    const mean = count > 0 ? sum / count : 0;
    return mean / (WINDOW_SIZE / 8); // heuristic normalization, see file header
  }

  sample(dt) {
    if (this.beatCooldown > 0) this.beatCooldown -= dt;

    if (!this.available || this.ringFilled < WINDOW_SIZE) {
      return { ok: false, level: 0, bass: 0, mid: 0, treble: 0, beat: false };
    }

    const windowed = new Array(WINDOW_SIZE);
    let sumSquares = 0;
    for (let i = 0; i < WINDOW_SIZE; i++) {
      const s = this.ring[(this.writeIndex + i) % WINDOW_SIZE];
      windowed[i] = s;
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / WINDOW_SIZE);

    this.fft.realTransform(this.complexOut, windowed);
    this.fft.completeSpectrum(this.complexOut);

    const bass = clamp01(this._bandEnergy(BASS_HZ));
    const mid = clamp01(this._bandEnergy(MID_HZ));
    const treble = clamp01(this._bandEnergy(TREBLE_HZ));

    this.bassBaseline = this.bassBaseline === 0 ? bass : lerp(this.bassBaseline, bass, BASELINE_EMA_ALPHA);
    let beat = false;
    if (this.beatCooldown <= 0 && bass > BEAT_MIN_BASS && bass > this.bassBaseline * BEAT_THRESHOLD_MULTIPLIER) {
      beat = true;
      this.beatCooldown = BEAT_COOLDOWN_SECONDS;
    }

    return { ok: true, level: clamp01(rms * 4), bass, mid, treble, beat };
  }

  close() {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.available = false;
  }
}

module.exports = { ArecordAudioSource };
