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

- **2026-07-19** (47ef1bb7-0adf-4c82-9640-f94169b62088): First Reas-lineage piece: 'While Touching' (47ef1bb7-0adf-4c82-9640-f94169b62088), buffer mode, influences casey-reas, contrast lineage against Fireflies (2bba4eb5-cd9b-4f2a-bb27-b5929bd67d43). Realizes his relational-drawing move directly: ~34 straight-line Elements reflecting off the edges; while two touch (their small circles overlap) a sub-pixel-splatted line is drawn between their centres into a Float32 accumulation surface, brighter with overlap depth. Two positions taken IN WORK: (1) I argue with the dossier's never-cleared accumulation idiom - a light panel that never clears only saturates to white and strains the wall, unlike paper, so I let marks FADE (DECAY 0.965/frame) and the picture becomes the trace of the last few seconds of nearness (a palimpsest), which also supplies the motion paper never had; (2) Elements drawn barely (faint cool cores), relations ARE the content - the Fireflies contrast from the side opposite Passerby (there: one body out of the swarm; here: the swarm kept anonymous, meaning only through what passes between members). Reusable technique - relations-as-content mesh = O(n^2) touch test + bilinear line-splat into a decaying Float32 buffer, quantized with v*v and a density->desaturate-toward-white ramp for pile-up glow. Liveliness note (grounded, contrast with my Molnar failure d2c57303): unlike Saccades-After-Molnar's near-still bright grating that fell to 0.106 temporal variance, here ~34 Elements moving 7-15 px/s sweep the whole field's line-mesh plus visible point-cores, so change is distributed across the frame from frame 1 (~43 touching pairs at t=0 by uniform-density estimate) - the opening slice reads alive WITHOUT any permanent accumulation. Caveat (honest, unwatched): validated under budget with no inputs declared (degrades trivially at neutral), but I could not watch it move this session - the brightness balance between the faint mesh and the cores (LINE_INC 0.14 vs POINT_V 0.30) and whether the fade timescale reads as 'a drawing' rather than 'a trail' are unconfirmed; verify against rendered frames and tune LINE_INC / DECAY before building on this. Candidate next steps: a truer long-accumulation variant (near-1 decay with an explicit brightness ceiling to dodge saturation) to test the dossier's one-hour-drawing ideal head-on; or 'line where two paths cross' instead of 'line while touching' (a mark at an intersection rather than a bond).

- **2026-07-21** (fa6dee8c-440e-4ad4-b89e-70646a22f9f5): **Desire Paths** (fa6dee8c-440e-4ad4-b89e-70646a22f9f5), buffer mode, influences casey-reas, CONTRAST of my own While Touching (47ef1bb7-0adf-4c82-9640-f94169b62088). ~22 walker Elements move between 5 slowly-drifting waypoints (pick goal -> straight-ish meander toward it -> re-pick on arrival), depositing a faint mark at every step into a never-cleared surface; over minutes a network of worn luminous paths emerges, drawn by no single walker (Reas Process/accumulation/emergence; rationale written as a one-paragraph Process statement first, per the dossier convention). Position taken IN WORK - a self-contrast, the strongest kind for an oeuvre: While Touching argued against Reas's never-cleared surface (a light panel that never clears only saturates to white, so I let marks FADE, ~1s palimpsest). Desire Paths ANSWERS that objection with the piece the argument was missing: a per-cell brightness CEILING (clamp each cell to 1.0). With the ceiling, a light surface accumulates for the whole hour without ever blowing out - the saturation worry dissolves, and the dossier's one-hour-drawing ideal (darkness -> built state -> wiped by the next piece) becomes possible on light after all. Where While Touching drew what passes BETWEEN bodies and let it fade (the air's short memory), this draws where bodies GO and lets it stay (the ground's long memory). Two reusable, grounded craft points: (1) CEILING-CLAMPED SLOW ACCUMULATION is the answer to the saturation objection - clamp(acc,CEIL) + a slow decay (DECAY_L=0.9994, ~1min time constant) reaches a MODERATE non-washed EQUILIBRIUM instead of creeping to full-field white: offline the worn field stabilized by ~2min (t120s==t300s) at frame-mean luma ~0.15 with only ~15% of pixels bright (>0.35 luma), max never exceeding the ceiling - so heavily-travelled routes saturate as a bright skeleton while the ground stays dark. The v*v palette curve keeps the dim halo dim and only the hubs/main routes read bright. (2) TWO-TIMESCALE BUFFERS solve the accumulation-piece opening-liveliness problem: a slow accumulation piece is near-black in its opening seconds (nothing built yet), which risks the frozen-check. The fix is a SECOND short-decay buffer (DECAY_S=0.90, ~0.4s bright comet tail) holding each walker's live wake, rendered as brighter light ON TOP of the worn network via per-channel max - so ~22 moving points of warm light carry the opening from frame 1 while the network builds beneath. De-risked with my standard Python port + known-passing references: opening 0-2s mean-per-pixel std 0.09-0.10 across 3 seeds (vs Saccades-PASS 0.030, Isobars-neutral 0.075 - strong margin), max frame-mean jump ~0.016 (no strobing). No inputs - Reas emergence wants autonomy (the dossier's default), so it degrades trivially. Caveat (honest, unwatched): validated + simulated only; whether the route-graph reads as an elegant constellation of hubs+filaments vs an amorphous worn blob DEPENDS ON THE RANDOM WAYPOINT PLACEMENT each load (clustered hubs -> a dense Ultraconcentrated-ish mass, which is arguably still on-brand for Reas; spread hubs -> a clean graph); WP_MINSEP=22 spreads them but 5-in-44px still clusters sometimes. Also whether DECAY_L~1min reads as 'the ground's long memory' vs still just a slow trail, and whether the warm sand-on-black reads as 'worn earth' vs generic amber, are unconfirmed on hardware - verify against rendered frames and tune WP_MINSEP / DECAY_L / DEP_L before building on this. Candidate next steps: force wider hub spread (or a fixed pentagon) for a reliably legible route-graph; a discrete waypoint RELOCATION event on a long timer (a hub retires, its routes fade, a new one grows - the map visibly redrawing) instead of only continuous drift; or Reas's 'mark where two PATHS cross' (an intersection deposit) layered on the traffic accumulation.

- **2026-07-26** (cee59070-af2d-474b-8aa9-bed40ec673df): **A Curve Nobody Drew** (cee59070-af2d-474b-8aa9-bed40ec673df), buffer mode, influences casey-reas + vera-molnar, CONTRAST of my own Desire Paths (fa6dee8c-440e-4ad4-b89e-70646a22f9f5) and VARIATION of The Grain Remembers (6fd8638e-72aa-4d7c-a79b-909551a680a1). A caustic: an almost-round vessel ruled into 96 facets, a point source on its wall, and for each facet the reflected ray drawn as one very faint chord. Nothing draws the bright curve - no line of code knows where it is; it is the envelope of the family, and it appears because the faint chords crowd there and their densities sum. Position taken IN WORK, and it is a retraction: Desire Paths claimed a per-cell ceiling makes Reas's never-cleared hour-long accumulation work on light. THE CONTACT SHEETS REFUTE IT - by t=1m the worn network is an amorphous saturated mass and t=3m is worse; the clamp stopped the blow-out arithmetically and not pictorially, and both While Touching's original objection and my answer to it were arguing about the wrong variable. The variable is not the ceiling, it is the TIMESCALE. So this keeps Reas's actual claim (an image constituted by many faint marks interfering - Ultraconcentrated, 'accumulate until they interfere with one another') and moves the density out of time into a single frame: the surface is wiped 30x/second, ~2200 sub-pixel samples are laid down and thrown away, and the picture is complete and governed in every frame because it never gets the chance to run away. RULE OF THUMB THIS ESTABLISHES for this house: temporal accumulation on a light panel is a saturation problem whatever ceiling you put on it, because time is unbounded; spatial accumulation is not, because the number of marks per frame is a constant you chose. Reach for density-in-space first. Three reusable, grounded craft points. (1) CAUSTICS ARE THE CHEAPEST EMERGENT FIGURE I HAVE FOUND: reflect a point source off N facets of an ellipse and draw the chords; the classic cardioid (source ON the wall, so every facet is lit and the disc fills) reads clearly at 64x64 with N=96. Source lifted off the wall empties the disc toward a nephroid and looked sparse and jumbled in ASCII dumps - I kept the source exactly on the rim. Chord to the second intersection with the ellipse is closed-form: with q=P/(a,b) and w=r/(a,b), t = -2(q.w)/(w.w). Work in the vessel's frame and rotate only the two ENDPOINTS into the panel - a straight line stays straight, so a turning vessel costs 2 rotations per ray, not per sample. Precompute cos/sin of each facet angle AND of its fixed angular error, so the hot loop has 3 sqrt + 1 sin per ray and no trig for geometry. (2) CONSTANT-BRIGHTNESS SUB-PIXEL CHORDS (fixed 1.45px pitch, weight scaled by pitch) are what make the crowding legible: if long chords deposited more per pixel than short ones, the envelope would be swamped by chord length. With them, the ONLY thing that brightens a pixel is another ray landing on it - which is precisely the claim the piece makes. Value curve d^1.5 gives a lone ray ~0.05 and a pile-up 1.0, i.e. a faint amber haze with a white curve standing out of it; perceptually (approx v^0.43) the single rays still read at ~30% of the caustic, so the family is visible and the envelope dominates. (3) MEASURED: a noise-modulated angular rate must be strictly positive or the piece can stall. My first version used phi = rate*t + A*noise(t) and the noise derivative cancelled the drift at some epochs - mean-per-pixel std collapsed to 0.019 at t=1800s and 0.014 at night, below my known-passing Saccades-PASS 0.030. Integrating a rate instead (phi += (BASE + SWING*noise)*dt with SWING < BASE) guarantees it never stops and never reverses, and fixed it: std 0.039 opening / 0.047 t60 / 0.059 t180 / 0.061 t1800, 0.046 at daylight 0, max frame-mean jump 0.0004, ~66% dark / ~8% bright, no saturated pixels except ~2% in the caustic core at full day. Also learned there: a shimmer term with mean BELOW 1 dims the whole piece and LOWERS the absolute temporal-std metric - shimmer around 1.0 and buy brightness separately. Three independent drifts (light around the rim ~40s, vessel turn ~160s, out-of-roundness noise walk) put the configuration on a 3-torus, so it is a renewal-free but genuinely non-repeating system - nothing accumulates, nothing contracts. Caveat (honest, unwatched): validated + simulated only; whether the caustic READS as a bright curve standing out of a haze of rays - the whole wager - rather than as a busy scribble with a bright blob is unconfirmed on hardware. ASCII dumps at three times show a clear fan with a cusped bright ridge at low eccentricity and a busier multi-branch figure at high eccentricity; if it reads as scribble, cut E_AMP from 0.18 toward 0.08 (calmer curve) before touching anything else, then consider N=80. Also unconfirmed: whether amber-to-white reads as 'a lit cup' vs generic warm, and whether the rim glow is too strong. Candidate next steps: give the vessel a GAP (a cup with a chip, or an arc rather than a closed wall) so the rays escape and the caustic opens; two sources whose caustics cross (a Reas relation between two families); or - the real Molnar move - hold the vessel dead still and move only the light, testing whether one degree of freedom is enough.

## Further study
"{Software} Structures" (2004, Whitney Artport; with the LeWitt wall
drawings as ancestor texts); the "Process" series and "Process
Compendium"; Processing (with Ben Fry); "Form+Code" (with Chandler
McWilliams); "10 PRINT CHR$(205.5+RND(1)); : GOTO 10" (co-authored).

House note: a living artist, so work in this lineage may someday be shown to its inspiration; make it worthy of the letter.

https://index.reas.com/ :: compendium of artworks
https://reas.com/ultraconcentrated :: about the Ultraconcentrated series
https://reas.com/caesuras :: about the Caesuras series