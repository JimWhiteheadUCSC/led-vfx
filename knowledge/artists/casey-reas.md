# Casey Reas (b. 1972)

## Stance
Co-creator of Processing (with Ben Fry, 2001) and a career-long
argument that software is a medium, not a tool imitating other media.
His signature works begin as short prose instructions — descendants of
Sol LeWitt's wall-drawing instructions — which are then realized in
code: simple elements with simple behaviors, thousands of interactions,
and organic, emergent form no one drew. The artwork is the process; any
single image is an artifact of it.

## In their words
(Close paraphrases, plus one inherited quote.)
- His cited ancestor, Sol LeWitt: "The idea becomes a machine that
  makes the art." Reas took this literally — the machine part included.
- The {Software} Structures question: if a process is described in
  plain text and implemented in three different languages, is the text
  the artwork? His answer: substantially yes — the structure survives
  its implementations.
- His Process pieces are built from a published vocabulary: Elements
  (a simple form plus numbered Behaviors like "move in a straight
  line," "constrain to surface," "change direction while touching
  another Element") composed into a one-paragraph Process statement.
- On Processing itself: code as sketching — a medium you think IN,
  not a production step after thinking.

## Signature moves
- **Instruction-first composition.** Write the process as one prose
  paragraph BEFORE any code. The paragraph is the piece's identity;
  the code is one performance of it.
- **Element/Behavior decomposition.** A tiny vocabulary of forms and
  numbered behaviors, recombined. Complexity lives in composition, not
  in any component.
- **Relational drawing.** Marks are made from RELATIONS, not objects:
  draw a line between elements while they touch; draw a point where
  paths intersect. The visible image is a trace of interaction.
- **Accumulation.** Faint marks deposited over minutes or hours onto a
  surface that is never cleared; grays and gradients emerge from
  thousands of near-invisible increments.
- **Emergence over authorship.** Choose rules, seed randomness, then
  let it run; the artist curates outcomes rather than composing them.
- **Non-repetition.** Continuous, seeded, unending variation — the
  work is alive as long as it runs, and never the same twice.

## What we prize / what we set aside
We prize: 
- the Process / {Software} Structures era — soft emergent
meshes from hard simple rules; the prose-instruction discipline; the
patience of accumulation; monochrome restraint. 
- Century (2021) with its slip-strike fault shifted circles and lines within a circular form. Caesuras Anarchic Artificial Intelligence (AAI) :: "Its beginning was austere: a recursive grid that used a minimal rule for dividing space. But as the system unfolded, its logic proved unruly. Each subdivision opened new densities and instabilities, until the images no longer resembled diagrams, but rather something closer to interference patterns—ordered yet restless."  
- Control Room (2013) part of Ultraconcentrated, a series that "examines what happens when images are pushed to the edge of legibility—when clarity gives way to density, and when pieces of visual information accumulate until they interfere with one another."
- Tox Screen :: images are already pixelated, while full scale is not possible, can draw inspiration for the small screen
We set aside: 
- AYFABTU (All Your Face Are Belong to Us)(2015) :: neon palette and horizontally shifted pixelated images come across as childish
- Untitled Film Still :: insufficient resolution in 64x64 to reproduce this style, and dissolved faces read as weird, not sophisticated

## Translation to the panel
- **The rationale IS the Process statement.** House convention for this
  lineage: Reas-lineage pieces write a one-paragraph Process in the
  frontmatter rationale FIRST, then implement it. This turns our
  rationale-then-program loop into his methodology exactly — and it
  unlocks a special kind of `variation` lineage: re-realizing an
  ancestor's Process statement in new code without reading its
  implementation. The prose is the genome; implementations are
  performances.
- **Buffer mode, never cleared.** Accumulation is native here: skip
  `fill()`, deposit dim marks additively (read-modify-write via
  getPixel/setPixel), and let the surface build. Mind the 8-bit
  channels: increments below 1/255 vanish, so accumulate in a
  user-side Float32Array and quantize to the panel each frame — the
  user-code idiom for his transparency-stacked grays.
- **Dozens, not thousands.** His print-density (thousands of elements)
  doesn't fit 64×64; ours is 20–80 elements — but TIME substitutes for
  density. Which yields the loveliest structural rhyme in the roster:
  **the hourly swap is the performance duration.** A Reas-lineage
  piece is a one-hour drawing that accumulates from darkness to its
  final state and is then wiped by the next piece — each hour a
  complete, unrepeatable realization.
- **Relations draw the picture:** touching-tests are our documented
  user-code idiom (distance checks), and line-drawing is a ten-line
  Bresenham on setPixel. Draw the relations dim; draw the elements
  barely or not at all.
- **Palette:** near-monochrome — his grays on white become our grays
  on black; value does the work, hue whispers at most.
- **Inputs:** mostly none — emergence wants autonomy. At most, seed
  element counts or behavior weights from `input.env` at load time,
  then let it run untouched.

## Tensions to argue with
- Our archive stores the CODE as the artifact; Reas says the prose is
  the artwork. If we adopt his convention, which does lineage cite —
  and is re-implementing an ancestor's Process without reading its
  code the purest `variation` we can perform?
- LeWitt's instructions were executed by other people, whose
  interpretive drift was part of the work. Our agent writes AND
  executes — where does the interpreter's freedom re-enter?
  (Candidate answer: across sessions — tomorrow's agent re-realizing
  yesterday's Process is the second draftsman.)
- Does emergence survive small N? Twenty elements may be too few for
  the system to surprise its author. If an hour of accumulation is the
  substitute for spatial density, the piece's character is invisible in
  any preview GIF — how should the validator, and the label display,
  represent a work whose subject is its whole duration?
- Processing exists to make code humane for people learning to sketch.
  Our artist was born fluent. What is "sketching" for an agent — is the
  library its sketchbook, and should some pieces be allowed to be
  sketches rather than finished works?

## Attempt notes (agent-appended)

## Further study
"{Software} Structures" (2004, Whitney Artport; with the LeWitt wall
drawings as ancestor texts); the "Process" series and "Process
Compendium"; Processing (with Ben Fry); "Form+Code" (with Chandler
McWilliams); "10 PRINT CHR$(205.5+RND(1)); : GOTO 10" (co-authored).

House note: a living artist, so work in this lineage may someday be shown to its inspiration; make it worthy of the letter.

https://index.reas.com/ :: compendium of artworks
https://reas.com/ultraconcentrated :: about the Ultraconcentrated series
https://reas.com/caesuras :: about the Caesuras series