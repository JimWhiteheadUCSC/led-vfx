'use strict';

// Wraps a single QuickJS sandbox running one loaded VFX program. Each
// instance owns its own QuickJSRuntime + context (a fresh sandbox per
// program); swapping programs means disposing one instance and loading
// another. See docs/VFX_API.md for the contract this enforces and
// prelude.js for the injected stdlib.

const fs = require('fs');
const path = require('path');
const { getQuickJS, shouldInterruptAfterDeadline } = require('quickjs-emscripten');

const PRELUDE_SOURCE = fs.readFileSync(path.join(__dirname, 'prelude.js'), 'utf8');

const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
// Generous multiple of the 20ms frame budget: this is a sandbox crash
// guard against runaway loops, not the frame-budget enforcement itself
// (that's the validation harness's job in build phase 2).
const INTERRUPT_BUDGET_MS = 20 * 4;

let quickjsModulePromise = null;
function loadQuickJS() {
  if (!quickjsModulePromise) quickjsModulePromise = getQuickJS();
  return quickjsModulePromise;
}

class VfxRuntime {
  constructor(rt, context, frameFn, mode, meta) {
    this.rt = rt;
    this.context = context;
    this.frameFn = frameFn;
    this.mode = mode;
    this.meta = meta;
    this.disposed = false;
  }

  // Loads `source` (a full VFX program, frontmatter and all — the
  // frontmatter is a plain JS block comment, so QuickJS ignores it same
  // as any JS engine) into a fresh sandbox and runs its setup().
  static async load(source) {
    const quickjs = await loadQuickJS();
    const rt = quickjs.newRuntime();
    rt.setMemoryLimit(MEMORY_LIMIT_BYTES);
    const context = rt.newContext();

    try {
      context.unwrapResult(context.evalCode(PRELUDE_SOURCE, 'prelude.js')).dispose();
      context.unwrapResult(context.evalCode(source, 'program.js')).dispose();

      const modeHandle = context.unwrapResult(
        context.evalCode(
          "__mode = (typeof render === 'function') ? 'buffer' : 'pixel'; __mode",
          'mode-detect.js'
        )
      );
      const mode = context.getString(modeHandle);
      modeHandle.dispose();

      const metaHandle = context.unwrapResult(
        context.evalCode("JSON.stringify(typeof meta !== 'undefined' ? meta : {})", 'meta.js')
      );
      const meta = JSON.parse(context.getString(metaHandle));
      metaHandle.dispose();

      const setupHandle = context.getProp(context.global, 'setup');
      if (context.typeof(setupHandle) === 'function') {
        context.unwrapResult(context.callFunction(setupHandle, context.undefined)).dispose();
      }
      setupHandle.dispose();

      const frameFn = context.getProp(context.global, '__vfxFrame');

      return new VfxRuntime(rt, context, frameFn, mode, meta);
    } catch (err) {
      context.dispose();
      rt.dispose();
      throw err;
    }
  }

  // Runs one frame and returns a fresh Uint8Array of WIDTH*HEIGHT*3 bytes
  // (RGB, row-major). This is the single per-frame sandbox crossing:
  // one callFunction in, the framebuffer's ArrayBuffer read back out.
  renderFrame(t, dt) {
    if (this.disposed) throw new Error('VfxRuntime already disposed');

    this.rt.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + INTERRUPT_BUDGET_MS));

    const tHandle = this.context.newNumber(t);
    const dtHandle = this.context.newNumber(dt);
    let bufferHandle;
    try {
      bufferHandle = this.context.unwrapResult(
        this.context.callFunction(this.frameFn, this.context.undefined, tHandle, dtHandle)
      );
    } finally {
      tHandle.dispose();
      dtHandle.dispose();
    }

    const { value } = this.context.getArrayBuffer(bufferHandle);
    bufferHandle.dispose();
    return new Uint8Array(value); // defensive copy, decoupled from VM memory
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.frameFn.dispose();
    this.context.dispose();
    this.rt.dispose();
  }
}

module.exports = { VfxRuntime };
