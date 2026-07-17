#!/usr/bin/env node
'use strict';

// Headless validation harness (build phase 2). Runs a VFX program through
// VfxRuntime the same way the daemon does, but off-screen, and checks it
// against every gate docs/VFX_API.md's validation-harness section
// specifies: no exceptions, frame budget, liveliness (not frozen/black/
// flat), frontmatter/lineage, and a neutral-vs-synthesized input sweep.
// Exports validateProgram() for programmatic use (the phase-4 creativity
// agent will call this directly to decide deploy vs. retry) and doubles
// as a CLI:
//
//   node validate/index.js <effect.js>
//   node validate/index.js --all        # every entry in index.json

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { VfxRuntime } = require('../host/runtime/vfxRuntime');
const { validateFrontmatter } = require('./frontmatter');
const { INPUT_GROUPS, NEUTRAL_INPUT, synthesizeFrame } = require('./inputScenarios');
const { computeMetrics, evaluateLiveliness, evaluateFrameTiming } = require('./metrics');
const { writePreviewGif } = require('./preview');

const TOTAL_FRAMES = 300;
const WIDTH = 64;
const HEIGHT = 64;
const INDEX_PATH = path.join(__dirname, '..', 'index.json');

function clampFps(fps) {
  if (!fps || typeof fps !== 'number') return 30;
  return Math.max(15, Math.min(60, fps));
}

// Runs `totalFrames` of a fresh-loaded runtime with a fixed dt (no
// wall-clock jitter — this is a headless, deterministic test). `onFrame`
// is called before each renderFrame with (frameIndex, t, dt) to set input.
// Returns { frames, frameTimesMs, error } — on error, frames/frameTimesMs
// contain whatever was captured before the throw.
function runPass(runtime, totalFrames, dt, onFrame) {
  const frames = [];
  const frameTimesMs = [];
  let t = 0;
  try {
    for (let i = 0; i < totalFrames; i++) {
      if (onFrame) onFrame(i, t, dt);
      const start = performance.now();
      const buf = runtime.renderFrame(t, dt);
      frameTimesMs.push(performance.now() - start);
      frames.push(buf);
      t += dt;
    }
    return { frames, frameTimesMs, error: null };
  } catch (err) {
    return { frames, frameTimesMs, error: err };
  }
}

// source: full program text. opts.filePath (optional): if given, the GIF
// preview is written beside it (`foo.js` -> `foo.gif`).
async function validateProgram(source, opts = {}) {
  const errors = [];
  const warnings = [];
  const checks = {};

  const fm = validateFrontmatter(source);
  checks.frontmatter = fm.ok;
  errors.push(...fm.failures.map((f) => `frontmatter: ${f}`));
  warnings.push(...fm.warnings.map((w) => `frontmatter: ${w}`));

  let runtime;
  try {
    runtime = await VfxRuntime.load(source);
  } catch (err) {
    errors.push(`load failed: ${err.message}`);
    return { pass: false, checks, metrics: null, warnings, errors, gifPath: null, frontmatter: fm.frontmatter };
  }

  const declaredInputs = Array.isArray(runtime.meta.inputs)
    ? runtime.meta.inputs.filter((g) => {
        const known = INPUT_GROUPS.includes(g);
        if (!known) warnings.push(`meta.inputs declares unknown group "${g}" (ignored)`);
        return known;
      })
    : [];
  const fps = clampFps(runtime.meta.fps);
  const dt = 1 / fps;

  if (runtime.meta.quality === 'half' && runtime.mode !== 'pixel') {
    warnings.push('meta.quality has no effect in buffer mode (pixel mode only); ignored');
  }

  // Neutral pass: also the source of liveliness metrics, frame timing, and
  // the GIF preview.
  runtime.setInput(NEUTRAL_INPUT);
  const neutral = runPass(runtime, TOTAL_FRAMES, dt, null);
  checks.noExceptionsNeutral = !neutral.error;
  if (neutral.error) errors.push(`exception during neutral pass: ${neutral.error.message}`);

  let metrics = null;
  if (neutral.frames.length >= 2) {
    metrics = computeMetrics(neutral.frames);
    const live = evaluateLiveliness(metrics);
    checks.liveliness = live.failures.length === 0;
    errors.push(...live.failures.map((f) => `liveliness: ${f}`));
    warnings.push(...live.warnings.map((w) => `liveliness: ${w}`));
  } else {
    checks.liveliness = false;
    if (!neutral.error) errors.push('liveliness: not enough frames captured to evaluate');
  }

  if (neutral.frameTimesMs.length > 0) {
    const timing = evaluateFrameTiming(neutral.frameTimesMs);
    checks.frameBudget = timing.failures.length === 0;
    errors.push(...timing.failures.map((f) => `frame budget: ${f}`));
    warnings.push(...timing.warnings.map((w) => `frame budget: ${w}`));
  }

  let gifPath = null;
  if (neutral.frames.length >= 2 && opts.filePath) {
    try {
      gifPath = writePreviewGif({
        frames: neutral.frames,
        width: WIDTH,
        height: HEIGHT,
        fps,
        outputPath: opts.filePath.replace(/\.js$/, '.gif'),
      });
    } catch (err) {
      warnings.push(`preview GIF generation failed: ${err.message}`);
    }
  }

  runtime.dispose();

  // Synthesized pass: fresh sandbox so state doesn't carry over from the
  // neutral run, only exercised when the program declares reactive input
  // groups (nothing to synthesize otherwise).
  if (declaredInputs.length > 0) {
    let synthRuntime;
    let synthError;
    try {
      synthRuntime = await VfxRuntime.load(source);
      const result = runPass(synthRuntime, TOTAL_FRAMES, dt, (i, t, frameDt) => {
        synthRuntime.setInput(synthesizeFrame(declaredInputs, i, t, frameDt, TOTAL_FRAMES));
      });
      synthError = result.error;
    } catch (err) {
      synthError = err;
    } finally {
      if (synthRuntime) synthRuntime.dispose();
    }
    checks.noExceptionsSynthesized = !synthError;
    if (synthError) errors.push(`exception during synthesized pass: ${synthError.message}`);
  } else {
    checks.noExceptionsSynthesized = true;
  }

  return {
    pass: errors.length === 0,
    checks,
    metrics,
    warnings,
    errors,
    gifPath,
    frontmatter: fm.frontmatter,
    declaredInputs,
  };
}

function formatReport(label, report) {
  const lines = [];
  lines.push(`${report.pass ? 'PASS' : 'FAIL'}  ${label}`);
  for (const [name, ok] of Object.entries(report.checks)) {
    lines.push(`  [${ok ? 'x' : ' '}] ${name}`);
  }
  if (report.metrics) {
    const m = report.metrics;
    lines.push(
      `  metrics: temporalVariance=${m.temporalVariance.toFixed(3)} meanBrightness=${m.meanBrightness.toFixed(2)} spatialContrast=${m.spatialContrast.toFixed(2)}`
    );
  }
  if (report.declaredInputs && report.declaredInputs.length) {
    lines.push(`  declared inputs: ${report.declaredInputs.join(', ')}`);
  }
  if (report.gifPath) lines.push(`  preview: ${report.gifPath}`);
  for (const w of report.warnings) lines.push(`  warning: ${w}`);
  for (const e of report.errors) lines.push(`  error: ${e}`);
  return lines.join('\n');
}

async function validateFile(filePath) {
  const resolved = path.resolve(filePath);
  const source = fs.readFileSync(resolved, 'utf8');
  return validateProgram(source, { filePath: resolved });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage:\n  node validate/index.js <effect.js>\n  node validate/index.js --all');
    process.exit(1);
  }

  let allPass = true;

  if (args[0] === '--all') {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    for (const [id, relPath] of Object.entries(index)) {
      const filePath = path.join(__dirname, '..', relPath);
      const report = await validateFile(filePath);
      console.log(formatReport(`${relPath} (${id})`, report));
      console.log('');
      if (!report.pass) allPass = false;
    }
  } else {
    const report = await validateFile(args[0]);
    console.log(formatReport(args[0], report));
    allPass = report.pass;
  }

  process.exit(allPass ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[validate] fatal:', err);
    process.exit(1);
  });
}

module.exports = { validateProgram, validateFile };
