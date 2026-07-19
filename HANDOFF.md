# Handoff note — 2026-07-18/19

Scratch note for picking this session back up. Not part of the permanent
docs set (CLAUDE.md / VFX_API.md remain authoritative) — delete this file
once its contents are stale.

## Status: the creativity agent (CLAUDE.md phase 4) is built, verified, and has already produced a real piece

This was the last unbuilt major piece of the project. `agent/` didn't
exist at the start of this session; by the end, a real `node agent/session.js`
run against `claude-opus-4-8` studied the knowledge base + archive, wrote
a genuinely good new effect (`effects/passerby.js`, a Jim-Campbell-lineage
point-light walker) on its **first attempt**, named itself an apprentice
("Saccade") correctly per `knowledge/naming.md`'s rules, wrote a real
`contrast` lineage citation against `fireflies.js` with specific
reasoning, and appended an honest, well-evidenced note to a new
`knowledge/artists/saccade.md` file — including candidly flagging what
it *couldn't* verify (motion, since it only ever sees still frames).
Everything landed correctly: `index.json`/`effects/playlist.json`
updated, no leftover scratch files, existing file formatting preserved.

## What's done

**`agent/` (new)**:
- `session.js` — entry point (`node agent/session.js [--dry-run]
  [--model <id>] [--max-attempts <n>]`). Owns the retry loop and the
  `attempts` state; commits on success via `library.js`, exits 1 on
  exhaustion touching nothing.
- `config.js` — constants (model=`claude-opus-4-8`, effort=`xhigh`,
  `max_tokens`=64000, `MAX_ATTEMPTS`=3, `RECENT_PIECES_LIMIT`=8, etc.)
  and a hand-rolled `.env` loader (no `dotenv` dependency).
- `archive.js` — gathers the recent-pieces archive from `index.json`,
  capped to the 8 most recent by `created` date; backfills missing
  preview stills for pieces older than this session (self-healing, zero
  API cost).
- `prompt.js` — builds the `system`/`messages` arrays with three
  prompt-cache tiers (frozen contract, knowledge base, per-session
  archive block — see "Design decisions" below).
- `tool.js` — the single `write_effect` tool. Host-owned attempt
  counter (not the model's `stop_reason`) decides when the retry loop is
  actually done; cleans up preview artifacts from failed attempts.
- `knowledge.js` — reads all of `knowledge/*.md` + `artists/*.md` +
  `craft/*.md` (generic glob, not hardcoded filenames — picks up
  `naming.md` automatically); `appendKnowledgeNote()` with a path
  allowlist (must stay directly under `knowledge/artists/` or
  `knowledge/craft/`; `effect-bestiary.md` is rejected — "many books
  about cooking," not edited in place).
- `library.js` — `slugify`/`commitNewPiece`. Writes the effect,
  updates `index.json` + `effects/playlist.json` (preserving their
  existing hand-formatted styles exactly, not `JSON.stringify`'s
  default), renames the validating attempt's scratch preview artifacts
  to the final name.

**Modified**: `validate/preview.js` gained `writePreviewStills()` (see
below); `validate/index.js` threads `opts.stillPaths` through and
returns them in the report; `package.json` got `@anthropic-ai/sdk` +
an `"agent"` script; `README.md` got a usage section.

## Design decisions (for consistency going forward)

- **Vision-limitation fix, the most important finding this session**:
  Claude's vision only ever sees the first frame of an animated GIF —
  confirmed against the live API docs, not assumed. Feeding the existing
  animated `.gif` preview as "the agent sees its past work" would
  silently only ever show frame 0. Fixed by adding
  `writePreviewStills()` (reuses `writePreviewGif`'s exact
  upscale→quantize→applyPalette pipeline, writes N genuinely static
  single-frame GIFs sampled across the run instead) — no new dependency,
  no duplicated rendering logic.
- **Host owns identity, agent owns content** (the project's existing
  razor, applied here twice): the host generates the piece's UUID via
  `crypto.randomUUID()` before the session starts and tells the agent
  the exact string to embed — removes a whole class of possible
  validation failures. Same split for `knowledgeUpdate`: the agent
  proposes prose, the host stamps date/UUID and only commits it if that
  exact `write_effect` call validated.
- **One tool, not two.** `knowledgeUpdate` is an optional field on
  `write_effect` rather than a separate tool, specifically so a lesson
  is never recorded about a piece that didn't pass.
- **Retry loop uses the SDK's Tool Runner** (`client.beta.messages.toolRunner`)
  but the "stop after exactly N attempts" decision is host-owned
  (`attempts.count`/`attempts.passed` in a closure), not derived from
  `stop_reason` — each loop iteration yields the assistant message
  *before* its tool executes, so breaking on the outside prevents a 4th
  validation from ever running. The tool's own `run()` also short-
  circuits past the limit, belt-and-suspenders. `max_iterations` (16) is
  set as a generous *outer* safety net only — it's not tightly bound to
  `MAX_ATTEMPTS` because web-search/fetch calls also consume iterations.
- **Prompt caching, three tiers**: (1) `docs/VFX_API.md` +
  `host/runtime/prelude.js` concatenated into one system block (either
  alone is close to the ~4096-token minimum cacheable prefix on
  Opus-tier models; combined they clear it comfortably) — practically
  never changes. (2) the knowledge base — changes only when the agent
  appends a lesson. (3) the archive+stills block, cached at the end of
  the one user message — volatile *across* hours but fully static
  *within* one session's retries, which is the highest-value breakpoint
  in this design since the Messages API resends full history every turn.
- **Web research tools** (`web_search`/`web_fetch`, currently the
  `_20260318` dated variants — confirmed against the installed SDK,
  newer than what was cached in the skill's docs) are Anthropic
  server-side tools, not a client-side fetch we'd execute ourselves — no
  code on this machine ever fetches an agent-chosen destination.
  `max_uses: 5` each. Security reasoning: the only actionable output of
  the whole session is still the single `write_effect` call, which must
  pass `validateProgram()` and then runs in the QuickJS sandbox with
  zero host access — that boundary already contains the worst case of a
  prompt-injected search result. The uncontained residual risk is
  content-quality (a misleading `knowledgeUpdate` note), not security.
- **`betaTool()` from `@anthropic-ai/sdk/helpers/beta/json-schema`** is
  the real raw-JSON-schema tool-runner helper (confirmed by reading the
  installed package's source, not guessed) — no `zod` dependency needed.
- **`knowledge/naming.md`** (added by Jim mid-session): the agent must
  know it's in an *hourly working session*, not the *weekly review
  session* naming/ratification is gated to (which doesn't exist yet) —
  this is stated explicitly in the final instruction block, since
  `naming.md` itself can't distinguish session types, only the host can.
  The real run respected this correctly on its own (see Status above).

## What's left

- **Systemd/hourly-timer wiring** — explicitly out of scope this
  session, same as the wall-label's autostart was scoped narrowly.
  `agent/session.js` is meant to be run by hand today, by a timer unit
  later.
- **The weekly review session** (naming/ratification, per
  `knowledge/naming.md`) — doesn't exist. Not started; `naming.md`
  itself anticipates this as a separate, later piece.
- **`RECENT_PIECES_LIMIT` (8) will eventually matter** — currently a
  no-op at 5 pieces. No summarization/curation built on top of it yet;
  deliberately deferred until there's real data to tune against (same
  pattern as this project's other "tune once you have real data" calls).
- `meta.pacing = 'hour'` — still deferred from earlier this session
  (see the previous handoff section preserved in git history / this
  file's prior version), unrelated to the agent work but worth
  remembering if an agent-authored piece ever wants an hour-scale arc.
- CLAUDE.md's small Pi-deploy-notes inaccuracies (rpi-led-matrix
  install-skip wording, missing `npm approve-scripts` mention, headless
  vs. full-desktop) — still not folded in, still low priority, flagged
  across multiple prior handoffs now.

## Blockers

None. The agent works end-to-end against the real API.

## Uncommitted work

Everything from this session is uncommitted, including the real piece
the agent produced (`effects/passerby.js` and friends) and the new
`knowledge/artists/saccade.md`/`knowledge/naming.md` files. `git status
--short`:

```
 M .gitignore
 M README.md
 M effects/fireflies.gif
 M effects/koi_pond.gif
 M effects/playlist.json
 M effects/tide_pool_lantern.gif
 M index.json
 M package-lock.json
 M package.json
 M validate/index.js
 M validate/preview.js
?? agent/
?? effects/fireflies.still-{1,2,3}.gif
?? effects/koi_pond.still-{1,2,3}.gif
?? effects/passerby.gif
?? effects/passerby.js
?? effects/passerby.still-{1,2,3}.gif
?? effects/plasma_bloom.still-{1,2,3}.gif
?? effects/tide_pool_lantern.still-{1,2,3}.gif
?? knowledge/artists/saccade.md
?? knowledge/naming.md
```

Check with Jim before committing, same as always. Note `.env` is
correctly gitignored and won't show up here — nothing to scrub before
committing.

## Other context

Jim's son (who gave him the panel and the Pi) is excited to try running
this too — worth keeping onboarding-friendliness in mind if that comes up.
