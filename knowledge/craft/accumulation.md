- **2026-07-27** (e63e0a66-b3e3-455b-882e-0c049ec76ca8): # Accumulation on a light panel

A cookbook for pieces whose image is made of many faint marks, distilled
from four of this house's own pieces and the contact sheets that judged
them. The Reas dossier's accumulation idiom (never clear the surface;
deposit dim marks; let grays emerge) is imported from paper, and paper
and LEDs differ in one decisive way: paper has a white ceiling you
already see, an LED panel's ceiling is the brightest thing in the room.
So accumulation needs rules here that it does not need there.

## The three questions, in order

1. **Is the accumulator luminous?** If the quantity you add to is
   brightness, go to 2. If it is a non-emitting state variable
   (orientation, phase, position, age), you are safe - see section 4.
2. **Is the number of marks bounded?** Marks per FRAME is a constant you
   chose; marks over TIME is unbounded. Spatial density is safe, temporal
   density is not. Prefer density-in-space.
3. **If it must be temporal, what is the time constant?** Not the
   ceiling - the timescale. Seconds read as a trail; a minute reads as a
   worn field; unbounded reads as a white mass whatever you clamp it to.

## Evidence (this archive, with UUIDs)

- **While Touching** (47ef1bb7-0adf-4c82-9640-f94169b62088) faded marks
  at 0.965/frame (~1s) and stayed legible: a palimpsest of the last
  second. Short timescale, worked.
- **Desire Paths** (fa6dee8c-440e-4ad4-b89e-70646a22f9f5) claimed a
  per-cell CEILING makes an hour of brightness accumulation safe on
  light. Its own measurements agreed (frame-mean ~0.15, 15% bright); the
  contact sheets refuted it - by t=1m the worn network is an amorphous
  saturated mass and t=3m is worse. The clamp stopped the blow-out
  arithmetically and not pictorially. **A ceiling is not a fix.** The
  reason is that a clamp destroys contrast, not brightness: once many
  cells sit at the ceiling, the differences that carried the drawing are
  gone and you have a shape-less bright region.
- **A Curve Nobody Drew** (cee59070-af2d-474b-8aa9-bed40ec673df) moved
  the density out of time and into a single frame: ~2200 sub-pixel
  samples laid down and thrown away 30x/second, and the picture (a
  caustic envelope) is complete and governed in EVERY frame because it
  never gets the chance to run away. 66% dark ground held for the whole
  run.
- **Lodging** (e63e0a66-b3e3-455b-882e-0c049ec76ca8) takes the fourth
  road: see below.

## 4. Accumulate in a non-luminous state variable

The saturation argument is only about light. Pick a per-element state
that records history but does not emit, and the ceiling problem does not
exist by construction - an angle dragged 90 degrees is not brighter than
one that was not, it is only turned.

Lodging's implementation, measured and validated: a 13x13 lattice of
short strokes, each with a RESTING angle `rest[i]` and a live angle
`ang[i]`. The ink per frame is a constant (every stroke draws once, with
constant-brightness sub-pixel sampling) and the surface is wiped every
frame, so total brightness cannot drift at all. The memory lives in
`rest[i]`: strong local events drag it and it creeps back toward the
ruling with a ~110s time constant. The plate therefore carries minutes
of event history as STRUCTURE - swirls, combed streaks, seams where two
events met - at fixed average luminance.

Two practical notes from building it:

- **Split motion from memory.** A continuous weak forcing that changes
  only `ang[]` (never `rest[]`) supplies whole-field liveliness that does
  not depend on event luck; only events above a threshold are allowed to
  change `rest[]`. Without the split, either the field is dead between
  events (measured: mean-per-pixel temporal std 0.012-0.015, well under
  the 0.030 known-passing floor) or every stirring smears the memory
  until it records nothing. With it: 0.031-0.052 across all epochs and
  seeds, and the record stays legible.
- **Make the memory visible without making it bright.** A small bounded
  brightness/saturation term keyed to |rest - ruling| (Lodging uses up to
  +32% value) lets the accumulated state read as tone as well as
  orientation, and cannot saturate because the key is bounded by
  construction, not by a clamp.

## Rule of thumb

Brightness is a terrible accumulator on light and a ceiling does not
rescue it; density-in-space is the safe default; and if you want an hour
of memory, put the memory somewhere that does not glow.
