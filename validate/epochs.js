'use strict';

// Simulated-time horizons for the creativity agent's "see its own past
// life" preview mechanism (contact sheets - see validate/preview.js's
// writeContactSheet). Shared between the validator (which decides when to
// capture contact-sheet frames) and the agent pipeline (which names/labels
// the resulting artifacts), so the two can never drift apart.
//
// Under validate/index.js's default MAX_SIM_SECONDS, only the first few
// epochs are actually reachable - later ones are simply absent (null) in
// a piece's contactSheetPaths, which is itself meaningful (see
// agent/archive.js's ensureContactSheets and agent/prompt.js's per-epoch
// labeling of null entries), not a bug to fix.
const EPOCHS = [
  { seconds: 10, label: '10s' },
  { seconds: 60, label: '1m' },
  { seconds: 180, label: '3m' },
  { seconds: 480, label: '8m' },
];

module.exports = { EPOCHS };
