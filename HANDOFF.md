# Handoff note — 2026-07-21 (later)

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: validator collapse-detection feature built, tested, tuned — NOT yet committed

Jim's reaction to two agent-authored pieces (`murmuration.js` merging
into one flock and piling against an edge; `desire-paths.js` converging
into overlapping central blobs) drove a full extension of the validation
harness, per a plan approved via plan mode. Built, all in `validate/` +
`agent/`:

- **Streaming, windowed metrics** (`validate/metrics.js`): no more
  buffering a whole run's frames — a run now streams through per-15s-
  window accumulators. Two new per-pixel statistics: `spread`
  (luminance-weighted standard distance from centroid — collapses toward
  0 as content gathers into one clump) and `edgeMass` (fraction of
  luminance near the border). Both weight by the SQUARE of
  luminance/delta (matches this codebase's existing v*v idiom), added
  after real testing showed linear weighting missed a real case.
- **Extended, adaptive horizon** (`validate/index.js`): default
  `MAX_SIM_SECONDS=240` (4 simulated minutes, env-overridable via
  `VALIDATE_MAX_SIM_SECONDS`), with early-stop once consecutive windows'
  metrics converge (never before 120s — desire-paths' own documented
  settle time). Chosen conservative per Jim's explicit decision, given
  this validator runs on the Pi itself hourly and this project has
  already been burned once by dev-machine timing not holding on real Pi
  hardware. **Not yet benchmarked on the real Pi** — ask Jim to run
  `time node validate/index.js effects/murmuration.js` there before
  trusting this inside the live hourly agent path; raise the cap only
  after that comes back comfortable.
- **New ratio-based gates** (`validate/collapseGates.js`): compares
  early (first 30s) vs. late (last 30s of whatever the run reached)
  windows. Thresholds are empirically calibrated against a real
  `node validate/index.js --all` sweep of the entire library (13
  pieces), not guessed — every genuine piece measured spread/motion-
  spread ratios of 0.94-1.16; murmuration.js (a real, user-confirmed
  collapse) measured 0.49-0.82 across different random seeds (its
  `setup()` isn't RNG-seeded). `COLLAPSE_SPREAD_RATIO`/
  `MOTION_COLLAPSE_RATIO` are set to 0.85 — comfortably below every real
  piece's floor, comfortably above murmuration's worst-observed-luck run.
  **Confirmed working**: `node validate/index.js effects/murmuration.js`
  now reliably FAILs with data-driven messages ("spread fell from 12.9px
  to 8.1px, 62% of its early value"); `koi_pond.js` (the tightest real
  "healthy" case at 0.94-1.01) still cleanly PASSes.
- **Epoch contact sheets** (`validate/preview.js`'s `writeContactSheet`,
  `validate/epochs.js`'s shared `EPOCHS` list): replaced the old flat
  N-evenly-spaced single-frame stills with 3x3 grids of near-frames
  (~0.7s apart) at t≈10s/1m/3m/8m, so motion reads within a single
  still image. Renamed throughout: `stillPaths`→`contactSheetPaths`,
  `.still-N.gif`→`.epoch-<label>.gif`, `STILL_COUNT` removed (now
  derived from `EPOCHS.length`). Backfilled successfully for all 8
  archived pieces (`node -e "require('./agent/archive').gatherArchive()"`
  already run once by hand, confirmed on disk) — epochs beyond the
  240s cap correctly show as `null`/"not reached", not an error. All 15
  stale old-style `.still-N.gif` files (5 pieces outside the recency
  window, never touched by the lazy per-piece cleanup) deleted by hand.

### Important honest finding: the gates don't catch everything, by design

The numeric gates reliably catch murmuration's failure shape (spatial
collapse) but **do not** reliably catch desire-paths' failure shape
(a small, permanently-fixed set of waypoints re-walked forever — its
slow-decaying "worn path" layer keeps overall spread looking constant
regardless of whether the walkers' own positions have gone stale). Tried
three metric variants (linear spread, linear motion-weighted spread,
squared motion-weighted spread) — none caught it. Rather than keep
chasing thresholds and risk overfitting to two examples, this is
documented honestly in `validate/metrics.js`'s comments and in
`knowledge/craft/attractors.md` (see below) as a real, structural
limitation: this specific failure shape needs the epoch contact
sheets / the agent's own eyes, not a numeric threshold. "Metrics catch
collapse; they can't catch boring."

### Knowledge base: extended an existing file, didn't create a duplicate

Went looking to add a new `knowledge/craft/closed-vs-forced-systems.md`
per the original plan, and found `knowledge/craft/attractors.md`
**already existed**, uncommitted, from a separate/concurrent agent
session — and it already articulated almost exactly the intended lesson,
in the project's own voice, even pre-referencing "the validator's
windowed gates" and "late-epoch contact sheets" that didn't exist yet.
Extended that file instead of duplicating it: added an "Evidence
(in-repo)" section quoting `knowledge/artists/casey-reas.md`'s real
Desire Paths attempt note (which measured the exact settle-by-2min
behavior but framed only the accumulator's equilibrium as a success,
never flagging the walkers' own position collapse as a problem — its own
"candidate next steps" already named the fix, a waypoint-relocation
timer, without applying it), plus an honest caveat section on what the
mechanical gates can and can't catch.

### Docs updated

`CLAUDE.md`'s validation-harness paragraph and `docs/VFX_API.md`'s
Aesthetic guidance section both rewritten to describe the new adaptive
windowed horizon and point at `knowledge/craft/attractors.md`.

### Pulled from rotation, not deleted

`murmuration.js` and `desire-paths.js` removed from
`effects/playlist.json` only — still in `index.json` and on disk, so the
agent keeps studying them (now alongside the craft doc explaining what
went wrong) without the live panel keeping showing the known collapse.

## What's left

- **Get Jim's go-ahead, then commit** — see "Uncommitted work" below,
  this needs an explicit conversation about how to split it, not a
  blind `git add`.
- **Ask Jim to benchmark real Pi timing** (see above) before trusting
  `MAX_SIM_SECONDS=240` inside the live hourly agent path — this
  session's testing was all done on the dev machine.
- Consider whether `SETTLES_TEMPORAL_RATIO`/`EDGE_MASS_POOL_THRESHOLD`
  (unchanged from their original guessed values — only the two spread
  ratios got empirically retuned this session) need the same real-sweep
  treatment once more pieces exist to calibrate against.
- Desire-paths' failure shape is still uncaught mechanically — worth
  watching whether a future piece exhibits the same "fixed small
  repertoire" pattern and whether the contact-sheet mechanism actually
  catches it in practice (this session couldn't test that, since it
  requires the agent's own vision, not a headless script).

## Blockers

None code-side. Needs Jim's review before committing (see below) and,
separately, a real Pi timing benchmark before this is fully trusted live.

## Uncommitted work — genuinely tangled, needs a conversation before committing

The working tree currently mixes THIS session's validator work with what
appears to be a separate, unrelated concurrent agent session's output:
new pieces (`isobars.js`, `lengths.js`, `sympathetic.js`,
`the-sources-are-elsewhere.js`, plus `murmuration.js`/`desire-paths.js`
themselves), their own `index.json`/`effects/playlist.json`/knowledge-
dossier entries, and `knowledge/craft/attractors.md` itself (mostly
theirs, this session only added two sections to it). `effects/
playlist.json`'s diff in particular has BOTH sessions' changes
interleaved in one file — cannot be cleanly split by `git add -p`
without care. Do not commit blindly; walk through `git status`/`git
diff` with Jim first and confirm which files belong to which piece of
work before staging anything.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
