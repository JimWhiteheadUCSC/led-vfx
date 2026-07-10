'use strict';

// HUB75 backend for the real panel via the `rpi-led-matrix` npm package
// (N-API bindings to hzeller/rpi-rgb-led-matrix). Only ever imported when
// this backend is actually selected — see host/display/index.js — so
// Windows dev never touches the native module. `rpi-led-matrix` itself
// skips its native build with a warning on non-Pi machines, so it can
// stay a normal dependency.
//
// This is a skeleton: full hardware bring-up (GPIO jumpers, chain/parallel
// config, brightness limits) is build phase 5 per CLAUDE.md. Pixel-pushing
// below is a best-effort mapping onto the documented rpi-led-matrix API and
// has not been exercised against real hardware yet.

const { Display } = require('./Display');

class MatrixDisplay extends Display {
  constructor({ width = 64, height = 64, gpioSlowdown = 2 } = {}) {
    super();
    this.width = width;
    this.height = height;
    this.gpioSlowdown = gpioSlowdown;
    this.matrix = null;
  }

  async init() {
    let rpiLedMatrix;
    try {
      rpiLedMatrix = require('rpi-led-matrix');
    } catch (err) {
      console.warn(
        '[MatrixDisplay] rpi-led-matrix is not available on this machine ' +
          '(expected unless you are on a Raspberry Pi with the native module built).'
      );
      throw err;
    }

    const { LedMatrix, GpioMapping } = rpiLedMatrix;
    this.matrix = new LedMatrix(
      {
        ...LedMatrix.defaultMatrixOptions(),
        rows: this.height,
        cols: this.width,
        chainLength: 1,
        hardwareMapping: GpioMapping.AdafruitHatPwm,
      },
      {
        ...LedMatrix.defaultRuntimeOptions(),
        gpioSlowdown: this.gpioSlowdown,
      }
    );
  }

  pushFrame(buffer) {
    if (!this.matrix) throw new Error('MatrixDisplay not initialized');
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (y * this.width + x) * 3;
        this.matrix.setPixel(x, y, buffer[idx], buffer[idx + 1], buffer[idx + 2]);
      }
    }
    this.matrix.sync();
  }

  async close() {
    this.matrix = null;
  }
}

module.exports = { MatrixDisplay };
