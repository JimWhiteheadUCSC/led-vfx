# Vera Molnár (1924–2023)

## Stance
A lifelong systematic investigation of how little disorder a rigid
structure needs before it comes alive — conducted mostly on the square,
in series, with the machine as accomplice. Before she ever touched a
computer (plotter access from 1968) she executed algorithms by hand,
her "machine imaginaire": the method preceded the hardware. The series,
not the single image, is her unit of work.

## In their words
- "My life is squares, triangles, lines. I am mad about lines."
- Her recurring prescription: introduce roughly one percent disorder
  into an ordered system — small deviations against a strong rule are
  where the interest lives.
- She valued the computer for stepping outside learned habit: the
  machine proposes variations a hand trained by culture would not.
- "[I came up with] a system with which […] I can check what changes were made and what that [change] provoked in me. It’s an experimental method, [taken] step by step. The computer is fantastic for this purpose. The computer isn’t dumb. So I called [the process] machine imaginaire."
- "[As an artist] you are always having to make decisions. [...] With the machine imaginaire, there was a good tool for avoiding this — randomness. It’s not me, the “genius,” who has to make the decisions; it’s all [determined by] the roll of the dice. […] And intuition — that holy intuition — randomness can replace that."

## Signature moves
- **Serial parameter sweep.** Fix a motif; vary one parameter across
  many realizations; the sweep itself is the artwork. (Our medium can
  lay the sweep across time instead of across a wall.)
- **Perturbed grid.** Regular lattice of simple elements; per-cell
  random jitter in position, rotation, or scale, with jitter amplitude
  as THE expressive control.
- **Stochastic omission.** Remove elements from a structure with some
  probability; the gaps carry the feeling ("Interruptions").
- **Nested/concentric forms with noise.** Concentric squares or frames,
  each vertex or edge displaced slightly; order still legible through
  the tremor ("(Dés)Ordres").
- **Order↔disorder interpolation.** A single scalar walks a composition
  between rigid and broken; the interesting territory is near the
  ordered end, not the chaotic end.
- **Simulated hand.** Machine line-work that trembles like handwriting
  ("Lettres à ma mère") — noise as warmth, not damage.

## What we prize / what we set aside
We prize: the near-threshold pieces where the rule remains fully
legible through the deviation; line over fill; monochrome or two-color
restraint; the patience of exhausting a variation before abandoning it.
Some series of Molnar that we like:
- Homage to Dürer 400 Needles Crossed by a Thread: the geometric complexity created by the exploration of a parameter space of the crossings of lines inscribed inside a square region
- Mouvement giratoire (rouge): a simple shape (a red rectangle) rotated at a slight angle, then repeated around a circle, creates a piece that appears to have movement even though it is static.
- Moldrian series: the complexity that emerges from a simple set of line drawing rules, and the exploration of the resulting parameter space.
- Gothique series: the play of shape and color in this series of drawings designed to evoke the structure of stained glass windows in Gothic churches
- Saccades series: compositions consisting of horizontal lines (often of only 2 or 3 colors), where, in the center of each composition, the lines are interrupted more or less randomly on different lengths by a blank space (these are the saccades of the title). This creates pieces with a kind of movement in them created by the breaks.
- (Des)Ordres series: This series has grids of squares within squares, with each square drawn slightly differently (permutations of line widths, line angles, line shake, etc.) While a grid of squares would not work on a 64x64 panel, it might be possible to have a single set of nested squares.
We set aside the following series that we feel will not translate to LED panels:
- Hommage a Monet: The wide horizontal watercolor strokes just appear washed out, and the LED panel is not well disposed to creating watercolor style brushstrokes.
- Lettres a ma mere: these faux handwriting pieces require finer lines than a LED display can show. It might be possible to reproduce something like a single "word" from one of these series? 

## Translation to the panel
- Buffer mode is her natural home: grids of 4–8 px cells on 64×64 give
  8–16 elements per side — enough for a lattice to read as a lattice.
- Displacement discipline: jitter beyond ~2–3 px destroys grid
  legibility at this resolution; her near-threshold aesthetic is
  therefore also a technical constraint here. Omission and rotation
  survive better than large translation.
- Line-work wants bright-on-dark (the panel's strength); her paper
  restraint maps to 1–2 hues, high value contrast, no fills.
- Time is our wall: animate the PARAMETER, not the elements — let the
  disorder scalar breathe over minutes, or sweep a series overnight.
  A Molnár-lineage piece may be almost still; motion at the speed of
  patience.
- Natural input pairings: `input.clock.daylight` or `input.env` driving
  the disorder scalar (the day disturbs the grid); `input.audio` is
  probably OUT of key for this lineage — silence suits her.

## Tensions to argue with
- She chose the plotter's line on paper: no light, no motion, no color
  to speak of. Our medium is nothing but light and motion. What would
  she refuse about this panel — and is that refusal itself a piece? How might movement and animation enhance this aesthetic?
- Her disorder was frozen at plot time; ours can be live and reactive.
  Does responsiveness cheapen the deviation, or complete it?
- The series lived across a gallery wall, simultaneously comparable.
  Across time, earlier variations are gone. What replaces side-by-side
  comparison — memory? the archive? the label display?

## Attempt notes (agent-appended)

- **2026-07-19** (d2c57303-5cf6-4e2b-99e9-0d587b2e01c2): First Molnar-lineage piece: 'Saccades, After Molnar' (d2c57303-5cf6-4e2b-99e9-0d587b2e01c2), buffer mode, inspiration lineage off my own Passerby (e47f033d-ebdb-48bd-8a08-7b7f03ddff6f). Realizes her Saccades series: ~21 fixed 1px horizontal lines (spacing 3) in two warm colors (cream + a Molnar red) on black, broken only in a central channel; panel columns ~0-8 and ~56-63 are held always-continuous so the ordered frame reads and disorder lives only in the middle (the near-the-ordered-end prize, made concrete). Two reusable techniques: (1) sub-pixel-soft break edges via a smoothstep top-hat [a=smoothstep(gapL-1,gapL+1,x); b=smoothstep(gapR-1,gapR+1,x); coverage=1-(a-b)] let breaks migrate silk-smooth instead of snapping pixel-to-pixel - Campbell's diffusion imported into her line-work; (2) animate the PARAMETER not the element - one order<->disorder scalar breathing (~12s) plus per-line noise drift on break center and length, while the lines stay fixed. IMPORTANT LIVELINESS LESSON (grounded, cost me a validation attempt): a near-still Molnar realization can fail the harness 'frozen' check - my first version (slow ~20s breathing, breaks moving only a thin central channel, only soft edge pixels changing) scored temporal variance 0.106 vs the 0.15 floor. The concept keeps most of the frame static (dark bands + ordered edges), so break-motion alone isn't enough aggregate change. Fix that passed: faster/larger channel breathing AND a faint per-line-phased brightness wave traveling down the whole grating (0.80 + 0.20*sin(t*w + i*0.42)), so every line pixel contributes temporal variance while staying gentle and non-strobing. Takeaway for future Molnar/Reas near-still pieces: budget for the 0.15 temporal-variance floor from the start - give the WHOLE field a slow breath, not just the deviating region. Caveat: validated (far under budget, degrades gracefully at neutral clock; a Molnar still is legitimately legible frozen, so the harness stills are representative), but I could not watch it breathe this session - confirm the traveling shimmer reads as calm and the open channel looks like breaks, not a tear. Candidate next steps: a discrete 'saccade' JUMP variant (hold, then leap to a re-rolled configuration - closer to the eye movement the title names); or a single nested-square (Des)Ordres realization.

## Further study
"(Dés)Ordres"; "Interruptions"; "Molndrian" (Mondrian variations);
the Sainte-Victoire / Cézanne variations;
"machine imaginaire" period pre-1968.
https://dam.org/museum/artists_ui/artists/molnar-vera/ :: lists major series
https://www.lerandom.art/editorial/molnars-paris :: locations in Paris where Molnar lived
https://arterritory.com/en/visual_arts/interviews/26565-99_visiting_vera_molnar/ :: interview with Molnar
