'use strict';

// Builds the system/messages arrays for the creativity session, with
// cache_control placed per the plan's three-tier design:
//   1. the frozen contract (VFX_API.md + prelude.js) - almost never changes
//   2. the knowledge base - changes only when the agent appends lessons
//   3. the archive+stills block - volatile across hours, static within
//      this session's retries (reused on every attempt)

const fs = require('fs');
const config = require('./config');
const { VFX_API_PATH, PRELUDE_PATH } = config;
const { readKnowledgeBaseText } = require('./knowledge');
const { EPOCHS } = require('../validate/epochs');

function readContractText() {
  const vfxApi = fs.readFileSync(VFX_API_PATH, 'utf8');
  const prelude = fs.readFileSync(PRELUDE_PATH, 'utf8');
  return (
    `--- docs/VFX_API.md (the contract) ---\n\n${vfxApi}\n\n` +
    `--- host/runtime/prelude.js (the stdlib injected into every sandbox - ` +
    `this is the exact source of rgb/hsv/setPixel/noise2/etc., not a summary) ---\n\n${prelude}`
  );
}

function imageBlockFromGif(absPath) {
  const data = fs.readFileSync(absPath).toString('base64');
  return { type: 'image', source: { type: 'base64', media_type: 'image/gif', data } };
}

function pieceContentBlocks(piece) {
  const fm = piece.frontmatter;
  const lineageText = Array.isArray(fm.lineage) && fm.lineage.length
    ? fm.lineage.map((l) => `  - ${l.relation} of ${l.id}: ${l.note || ''}`).join('\n')
    : '  (none)';
  const influencesText = Array.isArray(fm.influences) && fm.influences.length
    ? fm.influences.join(', ')
    : '(none)';

  const header =
    `### "${fm.title || piece.relPath}" (${piece.uuid})\n` +
    `Created: ${fm.created || 'unknown'}  Artist: ${fm.artist || 'unknown'}\n` +
    `Influences: ${influencesText}\n` +
    `Lineage:\n${lineageText}\n` +
    `Rationale: ${fm.rationale || '(none)'}\n\n` +
    `Source (${piece.relPath}):\n${piece.source}`;

  const blocks = [{ type: 'text', text: header }];
  piece.contactSheetPaths.forEach((sheetPath, i) => {
    const epoch = EPOCHS[i];
    if (sheetPath) {
      blocks.push({
        type: 'text',
        text: `[t≈${epoch.label}: a 3x3 grid of frames ~0.7s apart, showing motion at this point in the run]`,
      });
      blocks.push(imageBlockFromGif(sheetPath));
    } else {
      blocks.push({
        type: 'text',
        text:
          `[t≈${epoch.label}: not reached - this piece found a stable attractor, or the run hit ` +
          `the validator's simulated-time cap, before this epoch]`,
      });
    }
  });
  return blocks;
}

// archive: agent/archive.js's gatherArchive() output.
// issuedUuid: host-generated crypto.randomUUID() for the piece to be written.
function buildPrompt({ archive, issuedUuid, maxAttempts = config.MAX_ATTEMPTS }) {
  const system = [
    { type: 'text', text: readContractText(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: readKnowledgeBaseText(), cache_control: { type: 'ephemeral' } },
  ];

  const archiveIntro = {
    type: 'text',
    text:
      `Here is the recent archive of pieces you (or a prior instance of you) have made - ` +
      `${archive.length} piece(s), most recent first. Each includes its full source and, for ` +
      `a handful of simulated-time epochs (t≈10s/1m/3m/8m into the run), a contact sheet: a ` +
      `3x3 grid of frames sampled ~0.7s apart composited into one image, so motion reads across ` +
      `the panels (your vision only ever sees a still's single frame, so one frame per epoch ` +
      `would be motion-blind). An epoch marked "not reached" means the piece found a stable ` +
      `attractor, or the validator hit its simulated-time cap, before then. Look across a ` +
      `piece's epochs for whether it's still finding new configurations by its later ones, or ` +
      `has settled into repeating the same handful of shapes - see ` +
      `knowledge/craft/attractors.md for why that distinction matters.`,
  };

  const archiveBlocks = archive.flatMap(pieceContentBlocks);

  const instruction = {
    type: 'text',
    text:
      `This is an hourly working session, not the weekly review session - naming/ratification ` +
      `powers aren't available here (per knowledge/naming.md); if you feel the pull to name ` +
      `yourself, write the feeling into your notes and return to work.\n\n` +
      `Write a new piece now, using the write_effect tool. Its UUID is exactly "${issuedUuid}" - ` +
      `embed that exact string as the frontmatter id. You have up to ${maxAttempts} attempts; ` +
      `this is attempt 1. If validation fails, you'll see the errors and can try again. If this ` +
      `is your final attempt and it fails, respond with text only - do not call write_effect again.\n\n` +
      `Web search and web fetch are available if you want to look into an influence before writing ` +
      `- optional, not required.`,
    cache_control: { type: 'ephemeral' },
  };

  const messages = [
    { role: 'user', content: [archiveIntro, ...archiveBlocks, instruction] },
  ];

  return { system, messages };
}

module.exports = { buildPrompt };
