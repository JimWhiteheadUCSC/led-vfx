#!/usr/bin/env node
'use strict';

// The hourly creativity session (CLAUDE.md phase 4): studies the
// knowledge base + recent archive, writes a new effect via the
// write_effect tool, validates with up to MAX_ATTEMPTS retries, and on
// success commits it to the live library (index.json + playlist.json).
// On exhaustion, touches nothing and exits non-zero - the render daemon
// already keeps looping whatever playlist.json already has, so that
// absence of a new entry *is* the "fall back to a library piece"
// CLAUDE.md describes; there's nothing further to build for it here.
//
//   node agent/session.js [--dry-run] [--model <id>] [--max-attempts <n>]
//
// Systemd/hourly-timer wiring is out of scope - this is meant to be run
// by hand today, and by a timer unit later (a separate, deferred piece).

const crypto = require('crypto');
const config = require('./config');
const { gatherArchive } = require('./archive');
const { buildPrompt } = require('./prompt');
const { createWriteEffectTool } = require('./tool');
const { commitNewPiece } = require('./library');

function parseArgs(argv) {
  const args = argv.slice(2);
  let dryRun = false;
  let model = config.MODEL_ID;
  let maxAttempts = config.MAX_ATTEMPTS;

  const dryRunIdx = args.indexOf('--dry-run');
  if (dryRunIdx !== -1) {
    dryRun = true;
    args.splice(dryRunIdx, 1);
  }

  const modelIdx = args.indexOf('--model');
  if (modelIdx !== -1) {
    model = args[modelIdx + 1];
    if (!model) throw new Error('--model requires a value');
    args.splice(modelIdx, 2);
  }

  const maxAttemptsIdx = args.indexOf('--max-attempts');
  if (maxAttemptsIdx !== -1) {
    maxAttempts = Number(args[maxAttemptsIdx + 1]);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new Error('--max-attempts requires a positive integer');
    }
    args.splice(maxAttemptsIdx, 2);
  }

  return { dryRun, model, maxAttempts };
}

// Redacts image blocks to a size placeholder for a human-readable dump -
// the real payload's images are base64 image data, not useful to print.
function summarizePromptForDryRun({ system, messages }) {
  const summarizeBlock = (b) =>
    b.type === 'image' ? { type: 'image', bytes: b.source.data.length } : b;
  return {
    system: system.map((b) => ({ ...summarizeBlock(b), text: b.text ? `${b.text.length} chars` : undefined })),
    messages: messages.map((m) => ({ role: m.role, content: m.content.map(summarizeBlock) })),
  };
}

async function main() {
  const { dryRun, model, maxAttempts } = parseArgs(process.argv);

  console.log('[agent] gathering archive...');
  const archive = await gatherArchive();
  console.log(`[agent] archive: ${archive.length} piece(s)`);

  const issuedUuid = crypto.randomUUID();
  const { system, messages } = buildPrompt({ archive, issuedUuid, maxAttempts });

  if (dryRun) {
    console.log('[agent] --dry-run: assembled payload (no API call)');
    console.log(JSON.stringify(summarizePromptForDryRun({ system, messages }), null, 2));
    console.log(`[agent] issued UUID: ${issuedUuid}`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error(
      '[agent] no ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) in the environment - ' +
        'set one in .env at the repo root (see README) or export it before running.'
    );
    process.exit(1);
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();

  const attempts = { count: 0, passed: false, history: [], final: null };
  const writeEffectTool = createWriteEffectTool({ attempts, issuedUuid, maxAttempts });

  console.log(`[agent] starting session (model=${model}, max attempts=${maxAttempts})`);

  const runner = client.beta.messages.toolRunner({
    model,
    max_tokens: config.MAX_TOKENS,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: config.EFFORT },
    system,
    messages,
    tools: [
      writeEffectTool,
      { type: 'web_search_20260318', name: 'web_search', max_uses: config.WEB_TOOL_MAX_USES },
      { type: 'web_fetch_20260318', name: 'web_fetch', max_uses: config.WEB_TOOL_MAX_USES },
    ],
    max_iterations: config.MAX_ITERATIONS, // outer safety net only - attempts.count is authoritative
    stream: true,
  });

  for await (const stream of runner) {
    const message = await stream.finalMessage();
    if (message.usage) {
      console.log(
        `[agent] turn: stop_reason=${message.stop_reason} ` +
          `in=${message.usage.input_tokens} out=${message.usage.output_tokens} ` +
          `cache_read=${message.usage.cache_read_input_tokens || 0}`
      );
    }
    for (const block of message.content) {
      if (block.type === 'thinking' && block.thinking) {
        console.log(`[agent] thinking: ${block.thinking.slice(0, 500)}`);
      }
    }
    if (attempts.passed || attempts.count >= maxAttempts) break;
  }

  if (attempts.passed && attempts.final) {
    const { source, frontmatter, knowledgeUpdate, gifPath, stillPaths } = attempts.final;
    const result = commitNewPiece({
      uuid: issuedUuid,
      title: frontmatter.title,
      source,
      knowledgeUpdate,
      previewGifPath: gifPath,
      previewStillPaths: stillPaths,
    });
    console.log(`[agent] committed: ${result.relPath}`);
    if (result.knowledgePath) console.log(`[agent] knowledge update: ${result.knowledgePath}`);
    return;
  }

  console.error(`[agent] exhausted ${attempts.count} attempt(s) without a passing piece:`);
  for (const attempt of attempts.history) {
    console.error(`  attempt ${attempt.attemptNumber}:`);
    for (const e of attempt.errors) console.error(`    - ${e}`);
  }
  console.error('[agent] nothing committed - index.json and playlist.json untouched.');
  process.exit(1);
}

main().catch((err) => {
  console.error('[agent] fatal:', err);
  process.exit(1);
});
