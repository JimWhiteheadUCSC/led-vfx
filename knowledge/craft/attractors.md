# Attractors: a piece is not its opening

A craft law for any piece whose image emerges from moving elements and
interaction rules — flocks, walkers, particles, growth.

## The law

A dynamical piece has a transient (its opening minutes, sliding away
from the initial conditions) and an attractor (where its rules send it,
forever after). The wall shows the attractor for hours; it shows the
transient once. **Judge the piece by its attractor.** If the first two
minutes are the best two minutes, the piece is upside down.

## Why closed systems settle

Rules that only reference the elements themselves — cohere, seek,
align, attract — are contraction forces, and contraction finds its
equilibrium: flocks merge into one flock, seekers gather at the
centroid of their goals, energy averages out. Nothing inside a closed
system replenishes its novelty. The validator's windowed gates
(settling, inward collapse, boundary pooling) exist to catch this
mechanically, but do not design to pass the gate; design the attractor
you actually want to live with.

## Ways to keep a system alive

- **External forcing.** Feed time-varying noise into the dynamics —
  a wind that is `noise2(x·k, t·k)` never lets the system finish
  settling. (Fireflies and the koi survive on exactly this; a
  symmetric, periodic stirring does NOT count — it stirs the pot
  without breaking the lump.)
- **Antagonist events.** Occasional perturbations with structure: a
  predator pass through a flock, a waypoint dying and respawning far
  away, a gust, a cull-and-respawn. Rare, sharp, asymmetric.
- **Negative feedback on crowding.** Make density self-limiting:
  attraction that weakens (or reverses) as a cluster grows; goals that
  lose appeal as traffic wears them.
- **Budget the boundary.** A hard or soft wall plus persistent outward
  drift equals pooling at the edge. Prefer wrap when the piece's logic
  allows it, or make containment forces balance the outward pressure
  you have actually created, not the one you intended.
- **Design the equilibrium.** Sometimes settling is right — a piece
  MAY resolve (the 4K arc wants an ending). Then the attractor is the
  destination: shape it deliberately, and make the label's promise
  match ("resolves by minute ten" is honest; "never repeats" must be
  true at minute forty).

## Evidence (in-repo, not hypothetical)

Desire Paths' own attempt note (`knowledge/artists/casey-reas.md`,
2026-07-21) measured its worn-path accumulator directly: *"the worn
field stabilized by ~2min (t120s==t300s)... heavily-travelled routes
saturate as a bright skeleton while the ground stays dark."* That
measurement is real and the framing of it — a ceiling-clamped slow
accumulator reaching a moderate, non-washed equilibrium instead of
blowing out to white — is correctly called a success; it solved a real
saturation problem. What the same note didn't flag as a problem: the 22
walkers themselves re-target uniformly at random among the *same five
fixed waypoints* for the entire run, so the piece's WALKING geometry
reached its own attractor just as fast, and stayed there — not the
accumulator settling (fine), but the active content having nowhere left
to go (not fine). The note's own "candidate next steps" already named
the fix without applying it: *"a discrete waypoint RELOCATION event on a
long timer (a hub retires, its routes fade, a new one grows - the map
visibly redrawing) instead of only continuous drift."* That's the
difference between measuring your dynamics and reading what the
measurement means.

Murmuration.js is the cleaner mechanical case: 64 boids with cohesion +
alignment and no anti-merge or scale-limiting term, plus a periodic (not
novel) `sin(t)` wind — exactly the "symmetric, periodic stirring does
NOT count" trap above. Confirmed by direct simulation: spread and
motion-weighted spread both fall to roughly half their opening value
within four minutes as the flock consolidates.

## A caveat about the mechanical gates

The validator's windowed gates reliably catch murmuration's shape of
failure (spatial collapse — content gathering into one place) because
`spread`/`motionSpread` are literally a measure of how distributed
brightness/change is across the panel. They do **not** reliably catch
Desire Paths' shape of failure: its slow-decaying worn-path layer keeps
overall brightness spread across the whole route network regardless of
whether the walkers' own positions have gone stale, so a piece can pass
every numeric gate while still being the "always the same five hubs"
kind of boring. That specific failure needs eyes, not a threshold — look
at a piece's epoch contact sheets and ask whether minute eight is
exploring anything minute one didn't already show. Metrics catch
collapse; they can't catch boring.

## The discipline

Before a rationale claims "never repeats" or "keeps reorganizing,"
look at the late-epoch contact sheets and ask: is that claim true of
MINUTE EIGHT? The rationale describes the piece; the attractor IS the
piece. Write the sentence the late frames can keep.
