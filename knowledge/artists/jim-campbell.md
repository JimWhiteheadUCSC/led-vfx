# Jim Campbell (b. 1956)

## Stance
An engineer-turned-artist (MIT mathematics and engineering; years as a
Silicon Valley image-processing chip designer) who spent his career
locating the threshold of recognition: how few pixels, how little
information, before a moving image stops being a person and becomes
noise — and the discovery that the answer is "astonishingly few,
provided it moves." His grids of a few hundred LEDs show walkers,
swimmers, birds; illegible as stills, unmistakable in motion. The
patron saint of this panel.

## In their words
(Close paraphrases; he speaks in an engineer's plain terms.)
- His recurring project: finding the point at which an image becomes —
  or just barely fails to become — recognizable, and working exactly
  there.
- He frames his work as exploring the gap between digital and analog:
  discrete, countable pixels on one side; continuous human motion and
  perception on the other.
- On blur: partially defocusing a low-resolution image makes it MORE
  legible, not less — smoothing lets the eye complete what the grid
  quantizes away.
(Exact quotes)
- "From the very beginning in 2000 when I tried to photograph a 200 pixel work and 99 out of 100 pictures were unrecognizable, I realized how important movement was for the recognition of low resolution images."
- "...typically, if you pause the work, the images become completely abstract. There is no way that you could figure out what you are looking at without the movement. So the movement in these works is really the most fundamental way your brain understands what you are looking at."
- "In some ways, low resolution moving images are analogous to sound.  Sound is defined by movement and as such, the more a sound is slowed down, the more abstract it becomes."
- "Drastically reducing the details of a moving image allows the viewer to experience a simpler form of perception. In the more successful works this process bypasses the more analytical parts of the brain leaving room for a more 'primal' perception of an image that is more felt than seen."
- "Abstract Expressionists were interested in expressing their unconscious. Low resolution moving images do the opposite. They express to the unconscious."

## Signature moves
- **Motion as the carrier.** Content that is unreadable in any single
  frame and obvious across twenty. The information lives in the
  trajectory, not the bitmap. (The perceptual science behind it:
  Johansson's point-light walkers — a dozen moving dots convey gait,
  effort, even mood. A dozen dots. We have 4,096 pixels.)
- **The silhouette figure.** One high-contrast human form against
  darkness — walking, running, falling, swimming. Gait is the most
  recognizable signal the human visual system knows.
- **Diffusion.** A blur layer in front of the LED grid; sometimes
  tilted so legibility visibly sharpens across the piece. Operationally:
  soft edges beat hard ones at low resolution.
- **Radical downsampling.** Start from continuous, real motion; crush
  it to the grid. The violence of quantization is visible and is part
  of the content.
- **Biological rhythm as clock.** Images modulated by breath or
  heartbeat rates — flicker at the pace of a body, not a machine.
- **Ambient sub-legibility.** At city scale ("Day for Night", the
  Salesforce Tower crown) he runs imagery deliberately below full
  legibility — a presence you sense more than read.

## What we prize / what we set aside
We prize: the figure works ("Ambiguous Icons" lineage — running,
falling, walking silhouettes); the threshold discipline (always at the
edge, never comfortably above it); the quiet, unhurried pacing; blur
used as generosity toward the viewer.
We set aside: works with blurry motion behind a real photo as that wouldn't translate well to 64x64, pieces where the LEDs are only on the border of the piece (5Th At 56Th is one example), sculptural 3D arrays that don't translate well to a flat panel.

## Translation to the panel
- **Our panel out-resolves his medium.** 64×64 is several times the
  resolution of his classic grids. A Campbell-lineage piece should
  either (a) render figures small — a walker 12–20 px tall keeps the
  threshold alive — or (b) deliberately sub-resolve: compute at
  16×24-ish and upscale, letting the quantization show.
- **Sub-pixel splatting is our diffusion layer.** Instead of snapping a
  figure to integer pixels, draw points at float positions with
  bilinear weight spread over the 2×2 neighboring pixels (user-code
  idiom in buffer mode: additive setPixel with corner weights). Motion
  becomes silk-smooth and edges soften — his defocus, achieved in
  math. This is THE core technique for this lineage.
- **Synthesize gait, don't fake footage.** We have no camera; motion
  must be procedural. A point-light walker is very implementable: hip
  point + sinusoidal limb phases (opposite legs/arms pi out of phase,
  knees leading ankles) reads as human within a dozen splatted dots.
  Flocking birds, falling rain, a swimmer's stroke cycle all have
  known procedural skeletons.
- **Palette:** near-monochrome, dark ground, single warm-white or cool
  figure. His works are effectively grayscale; color is off-key here.
- **Pacing:** biological rates. Walk cycles ~1–2 Hz, breath ~0.2 Hz,
  heartbeat ~1 Hz as a brightness tremor. `input.clock.daylight` suits
  the ambient register ("Day for Night" logic: a city presence that
  dims and slows at night); a heartbeat modulation could sit on a slow
  timer with no input at all.
- **Threshold check:** if a still frame of the piece is fully legible,
  it's above the Campbell zone — take pixels away or shrink the figure.

## Tensions to argue with
- His images are indexical — filmed people, real bodies, sometimes
  people he knew. Ours are synthesized from equations. Is a procedural
  walker a person at the threshold of recognition, or an animation of
  no one? Can the rationale supply the referent the camera used to?
- He removes information from something real to reach the threshold;
  we add information to nothing until the threshold is reached.
  Opposite approaches to the same edge — do they land in the same
  place?
- Our panel's abundance: is deliberately degrading 64×64 to 24×32 an
  honest constraint or a costume? (Molnár's dossier would say a chosen
  constraint is still a constraint. Would he?)
- His works are silent and self-paced. Does audio-reactivity have any
  place in this lineage, or is `input.audio` simply off-key here the
  way it is for Molnár?

## Attempt notes (agent-appended)

## Further study
"Ambiguous Icons" series (incl. "Running Falling"); "Motion and Rest";
"Home Movies" (wall-facing LEDs); "Exploded Views" (SFMOMA, 2011);
"Scattered Light" (Madison Square Park, 2010); "Day for Night"
(Salesforce Tower, 2018); early biofeedback portraits (heartbeat/
breath-modulated images); Southern California (2019), Data Transformation 3 (2017), Divide (2005), Johansson point-light walker literature.
https://www.jimcampbell.tv/collection/low-resolution-works :: artist website with collection of LED works
https://www.interaliamag.org/interviews/jim-campbell/ :: interview with Campbell
https://www.artpractical.org/column/interview_with_jim_campbell/ :: interview with Campbell
