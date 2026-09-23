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
const { pieceContentBlocks } = require('./archive');

function readContractText() {
  const vfxApi = fs.readFileSync(VFX_API_PATH, 'utf8');
  const prelude = fs.readFileSync(PRELUDE_PATH, 'utf8');
  return (
    `--- docs/VFX_API.md (the contract) ---\n\n${vfxApi}\n\n` +
    `--- host/runtime/prelude.js (the stdlib injected into every sandbox - ` +
    `this is the exact source of rgb/hsv/setPixel/noise2/etc., not a summary) ---\n\n${prelude}`
  );
}

// The whole library as one compact table of contents - every piece, not
// just the slice shown in full below it. Without this, a piece that falls
// outside RECENT_PIECES_LIMIT is not merely abbreviated but INVISIBLE:
// the session cannot cite it (naming.md's grounding rule wants UUID and
// title), cannot judge the `contrast` lineage gate against it, and cannot
// even know to ask for it by UUID. Deliberately text-only - no source, no
// images - so it stays affordable as the archive grows.
function formatManifest(manifest, shownUuids) {
  const rows = manifest.map((m) => {
    const lineage = m.lineage.length
      ? m.lineage.map((l) => `${l.relation} of ${l.id}`).join('; ')
      : 'none';
    const influences = m.influences.length ? m.influences.join(', ') : 'none';
    const availability = shownUuids.has(m.uuid)
      ? 'full entry below'
      : 'not shown below - read_archive_piece with this UUID for its source and images';
    return (
      `- "${m.title}" (${m.uuid})\n` +
      `    ${m.created}, signed ${m.artist} [${availability}]\n` +
      `    lineage: ${lineage}  |  influences: ${influences}`
    );
  });
  return (
    `COMPLETE LIBRARY MANIFEST - every one of the ${manifest.length} piece(s) in the library, ` +
    `newest first. This is the full list; the detailed entries that follow are only the most ` +
    `recent few. Cite from this list by UUID and title, and judge naming.md's evidence gates ` +
    `against it rather than against what happens to be shown in full.\n\n${rows.join('\n')}`
  );
}

// archive: agent/archive.js's gatherArchive() output's `pieces` (the
// recent slice actually shown, in full).
// archiveTotalCount: that same call's `totalCount` - the WHOLE library's
// size, not just the slice - so the model can evaluate naming.md's
// "library holds at least 12 pieces" gate even once the archive grows
// past RECENT_PIECES_LIMIT and this slice stops being the whole story.
// archiveManifest: that same call's `manifest` - one lightweight row per
// piece in the whole library (see formatManifest).
// issuedUuid: host-generated crypto.randomUUID() for the piece to be written.
function buildPrompt({
  archive,
  archiveTotalCount,
  archiveManifest = [],
  issuedUuid,
  maxAttempts = config.MAX_ATTEMPTS,
}) {
  const system = [
    { type: 'text', text: readContractText(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: readKnowledgeBaseText(), cache_control: { type: 'ephemeral' } },
  ];

  const olderCount = archiveTotalCount - archive.length;
  const archiveIntro = {
    type: 'text',
    text:
      `Here is the recent archive of pieces you (or a prior instance of you) have made, most ` +
      `recent first. The library holds ${archiveTotalCount} piece(s) in total; the ${archive.length} ` +
      `most recent are shown below` +
      (olderCount > 0
        ? `, plus ${olderCount} older one(s) listed in the manifest above but not detailed here - ` +
          `call read_archive_piece with a UUID to pull any of them in full, source and images ` +
          `included. naming.md's evidence gates count the library total, not just what's shown.`
        : ` (that's all of them).`) +
      ` The newest ` +
      `${Math.min(config.FULL_SOURCE_PIECES, archive.length)} include their full source; the ` +
      `rest are catalogue-only (identity, rationale, lineage and images, no code). Each ` +
      `includes, for ` +
      `a handful of simulated-time epochs (t≈10s/1m/3m/8m into the run), a contact sheet: a ` +
      `3x3 grid of frames sampled ~0.7s apart composited into one image, so motion reads across ` +
      `the panels (your vision only ever sees a still's single frame, so one frame per epoch ` +
      `would be motion-blind). An epoch marked "not reached" means the piece found a stable ` +
      `attractor, or the validator hit its simulated-time cap, before then. Look across a ` +
      `piece's epochs for whether it's still finding new configurations by its later ones, or ` +
      `has settled into repeating the same handful of shapes - see ` +
      `knowledge/craft/attractors.md for why that distinction matters.`,
  };

  const manifestBlock = {
    type: 'text',
    text: formatManifest(archiveManifest, new Set(archive.map((p) => p.uuid))),
  };

  const archiveBlocks = archive.flatMap((piece, i) =>
    pieceContentBlocks(piece, { includeSource: i < config.FULL_SOURCE_PIECES })
  );

  const instruction = {
    type: 'text',
    text:
      `This is a full working session where the goal is to create a novel artwork. ` +
      `Naming and ratification powers are available in any session now (per ` +
      `knowledge/naming.md) - there's no separate weekly review session in this ` +
      `architecture - but the evidence gate and the draft/ratify timing that doc ` +
      `describes still apply; check them before drafting or ratifying a name.\n\n` +
      `Write a new piece now, using the write_effect tool. Its UUID is exactly "${issuedUuid}" - ` +
      `embed that exact string as the frontmatter id. You have up to ${maxAttempts} attempts; ` +
      `this is attempt 1. Don't be overly concerned about running out of attempts - historically ` +
      `only a handful of sessions have needed a 3rd. If validation fails, you'll see the errors ` +
      `and can try again. If this is your final attempt and it fails, respond with text only - ` +
      `do not call write_effect again.\n\n` +
      `While drafting, use preview_effect to actually render a contact sheet of your draft at a ` +
      `time you choose - it costs nothing against your write_effect attempts. Prefer it over ` +
      `hand-simulating what the code would produce; check what a change actually looks like ` +
      `before spending an attempt on it.\n\n` +
      `Use read_archive_piece to pull any piece in the manifest - including ones too old to be ` +
      `shown in full - with its source and contact sheets. Reach for it whenever a claim you ` +
      `are about to make depends on what an older piece actually is: drafting or ratifying a ` +
      `name under naming.md's grounding rule, citing lineage against a piece you cannot see, ` +
      `or checking whether you have already done the thing you are about to do again.\n\n` +
      `Web search and web fetch are available if you want to look into an influence before writing ` +
      `- optional, not required.`,
    cache_control: { type: 'ephemeral' },
  };

  const messages = [
    { role: 'user', content: [manifestBlock, archiveIntro, ...archiveBlocks, instruction] },
  ];

  return { system, messages };
}

module.exports = { buildPrompt };
