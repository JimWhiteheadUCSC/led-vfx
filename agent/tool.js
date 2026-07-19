'use strict';

// The write_effect tool: the agent's only way to actually produce
// anything. Retry accounting lives in the shared `attempts` object the
// caller (agent/session.js) owns and inspects from outside the loop -
// this tool's run() enforces the same limit from inside, belt-and-
// suspenders (see the plan's reasoning on why neither alone is trusted).

const fs = require('fs');
const path = require('path');
const { betaTool } = require('@anthropic-ai/sdk/helpers/beta/json-schema');
const config = require('./config');
const { EFFECTS_DIR } = config;
const { validateProgram } = require('../validate');
const { stillPathsFor } = require('./archive');

// A scratch basename for this attempt's preview artifacts - never
// actually written as a .js file itself (validateProgram only uses it
// to derive where to write the .gif/.still-N.gif, it never writes source
// to this path), so there's no risk of a stray placeholder effect file.
function scratchPreviewBase(issuedUuid, attemptNumber) {
  return path.join(EFFECTS_DIR, `.attempt-${issuedUuid}-${attemptNumber}.js`);
}

function deleteIfExists(p) {
  if (!p) return;
  try {
    fs.unlinkSync(p);
  } catch {
    // fine if it was never written
  }
}

// { attempts, issuedUuid, maxAttempts? } -> a BetaRunnableTool for
// client.beta.messages.toolRunner. maxAttempts defaults to config's, but
// session.js's --max-attempts override must flow through here explicitly
// (not read fresh from config) so the tool's own enforcement and the
// message it shows the model both match whatever the outer loop is
// actually enforcing.
function createWriteEffectTool({ attempts, issuedUuid, maxAttempts = config.MAX_ATTEMPTS }) {
  return betaTool({
    name: 'write_effect',
    description:
      'Submit a complete VFX effect program (frontmatter + code) to be validated. ' +
      `You have ${maxAttempts} attempts total this session; validation errors are ` +
      'returned so you can fix and retry. Optionally propose a knowledgeUpdate - it is ' +
      'committed only if THIS exact submission passes validation.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description:
            'The complete effect program source, including the /*@vfx ... @vfx*/ frontmatter block.',
        },
        knowledgeUpdate: {
          type: 'object',
          description:
            'Optional: a lesson to append to the knowledge base. Only committed if this submission validates.',
          properties: {
            file: {
              type: 'string',
              description:
                'Path relative to knowledge/, e.g. "artists/jim-campbell.md". Must be directly ' +
                'under knowledge/artists/ or knowledge/craft/ (no nesting); a new filename creates ' +
                'a new file (e.g. your own manifesto/notes).',
            },
            note: {
              type: 'string',
              description:
                'The note prose only - the host stamps the date and UUID, do not include them yourself.',
            },
          },
          required: ['file', 'note'],
        },
      },
      required: ['source'],
    },
    run: async ({ source, knowledgeUpdate }) => {
      if (attempts.passed) {
        return 'Already validated successfully this session - do not call this tool again.';
      }
      if (attempts.count >= maxAttempts) {
        return `Attempt budget (${maxAttempts}) already exhausted - do not call this tool again.`;
      }

      attempts.count += 1;
      const attemptNumber = attempts.count;
      const scratchBase = scratchPreviewBase(issuedUuid, attemptNumber);
      const stillPaths = stillPathsFor(scratchBase);

      const report = await validateProgram(source, { filePath: scratchBase, stillPaths });
      attempts.history.push({
        attemptNumber,
        pass: report.pass,
        errors: report.errors,
        warnings: report.warnings,
      });

      if (!report.pass) {
        deleteIfExists(report.gifPath);
        for (const p of report.stillPaths || []) deleteIfExists(p);

        const remaining = maxAttempts - attempts.count;
        const errorList = report.errors.map((e) => `  - ${e}`).join('\n');
        return remaining > 0
          ? `FAILED validation (attempt ${attemptNumber}/${maxAttempts}, ${remaining} remaining):\n${errorList}\n\nFix these and call write_effect again.`
          : `FAILED validation (attempt ${attemptNumber}/${maxAttempts}, no attempts remaining):\n${errorList}\n\nDo not call write_effect again - respond with text only.`;
      }

      attempts.passed = true;
      attempts.final = {
        source,
        frontmatter: report.frontmatter,
        knowledgeUpdate: knowledgeUpdate || null,
        gifPath: report.gifPath,
        stillPaths: report.stillPaths,
      };
      return `PASSED validation on attempt ${attemptNumber}/${maxAttempts}. This piece will be committed to the library.`;
    },
  });
}

module.exports = { createWriteEffectTool };
