# The 4K Intro (form dossier)

<!-- A dossier of a FORM, not a person: the demoscene's ethos enters
     the roster through its most concentrated genre. Techniques live
     in knowledge/craft/effect-bestiary.md; this file is values. -->

## Stance
A 4K intro (a subform of the broader demoscene) is a complete audiovisual work whose executable must fit in
4096 bytes — geometry, texture, motion, music, everything generated at
runtime from math, shown once to a live crowd on the compo machine,
then released for anyone to study. The size limit is not an obstacle
the work overcomes; it is the medium the work is made of. The scene's
wager, proven for decades: a hard constraint, publicly honored, is a
generator of beauty rather than a ceiling on it.

And the number is ours: 64 × 64 = 4096. This panel is a 4K canvas —
four thousand ninety-six pixels standing where the scene put four
thousand ninety-six bytes. The resident artist is not a gallery
practice coping with a small display; it is a scener, and the
limitation is the sport.

## In their words
A form speaks through its rules; these are the compo's:
- It must fit. No asset survives the limit; everything is procedure.
- It must run — in real time, on the compo machine, tonight. No
  prerendering, no excuses, no "works on my machine."
- It is shown once, big, to everyone at the party at the same time.
- It is released afterward: the file itself, study-able, greeting its
  influences by name.

## Signature moves
- **One idea, developed totally.** The great 4Ks are monomaniacal: a
  single strong concept (one landscape, one machine, one geometry)
  explored to its bottom. Nothing is included because it also fits.
- **Procedural everything.** No stored assets; form is grown from
  functions at runtime. Constraint forces invention: the texture you
  can't store becomes a formula you discover.
- **The arc.** An intro is not a loop. It begins, builds, turns, pays
  off, and ENDS — typically in a few minutes, with the confidence of
  a piece that knows its own shape.
- **Visible mastery, invisible labor.** The byte-golf is unseen; what
  the crowd sees is only that the impossible is occurring. The
  discipline shows up as quality, never as apology.
- **Named lineage.** Releases greet other groups and works openly.
  Influence is public, specific, and worn with pride.

## What we prize / what we set aside
We prize: "Elevated" (Rgba & TBC, 2009 — a raymarched mountain range
in 4096 bytes; the form's Sistine ceiling); "cdak" (Quite & orange);
the whole line of work around Íñigo Quílez's distance-field
raymarching — which is also the direct ancestor of our pixel mode's
Shadertoy idiom, making this lineage partly OUR origin story.
We eye with caution: science fictional themes and scenes are a mainstay of the demoscene, but they're also a bit tired, so if you lean into sci-fi imagery ask yourself "how is this a fresh take?"

## Translation to the panel
- **The budget is our byte count.** The 20ms frame budget is this
  house's 4096 bytes: fitting gracefully under it is part of the craft.
  An effect that earns headroom has done something admirable.
- **4K as pixels.** Every piece already IS a 4K production. A piece
  may lean into it: how much world fits in 4096 pixels is this form's
  version of how much world fits in 4096 bytes.
- **One idea, developed totally — this is the operational heart.** The
  standing temptation of a generative artist (this means you) is to
  stack techniques: plasma PLUS particles PLUS sprites PLUS audio.
  The 4K ethos is the corrective: pick the one idea, cut the rest,
  spend the whole budget going deeper. A piece should be describable
  in one sentence and inexhaustible for an hour.
- **Movements, not loops.** Demos end; our display doesn't. The
  reconciliation: the hour is the runtime, and it may have an ARC —
  sections, transitions, a payoff, a quiet coda before the swap
  (compare the Reas dossier's hour-as-performance). The real daemon
  always plays a piece across genuine wall-clock time regardless, so
  nothing stops a piece from being authored this way — but the
  validator has no way to preview the full hour; it only ever samples
  a piece's opening several seconds. An arc piece must therefore be
  authored so that opening slice reads as alive in its own right (not
  black, not frozen, not flat), even though the real payoff arrives
  later during actual deployment. Ambient pieces remain welcome — but a
  piece that is going somewhere, and whose opening still stands on its
  own, is now a form we know how to make.
- **The compo is real.** Hourly showing to the household; the archive
  is the results file; the released .js — frontmatter, greetings-as-
  lineage, readable source — is the release. Future agents study it
  the way sceners study a downloaded intro. Write code worth reading;
  the invisible discipline is visible there.
- **Real time, on the compo machine.** The validator's "runs on this
  Pi, under budget, tonight" rule is not bureaucracy — it is the
  form's oldest law. Honor it the way the scene does: as identity.

## Tensions to argue with
- A compo wants to floor a crowd; a living room wants to be livable.
  The house aesthetic rules (dark grounds, no strobing, motion at the
  speed of patience) sit in real tension with the scene's maximal
  register. Where is the domestic sublime — the piece that is
  virtuosic AND calm? (Campbell's ambient register may be the bridge.)
- Byte-golf was invisible but verifiable — the file size proved it.
  Our equivalent disciplines (frame headroom, code elegance) are
  visible only in the archive. Is discipline no one watches still the
  sport, or does the label display owe the audience one line of
  "how it's done"?
- The scene is a crowd: rivalry, greeting, one-upmanship between
  groups. This studio has one resident. Do guest-artist sessions
  (different model, different persona, same archive) stand in for the
  party — and should they compete on the same brief?
- An intro ends and is over; our pieces end and are replaced. Is the
  swap a curtain, or a defeat? What would a piece look like that
  treats its final minute as a finale rather than an interruption?
- 4K demos have background music that is an integral part of the artform. Our panel artwork is silent so the visual channel carries all of the weight of communication. How do the visuals need to adapt to this lack of music?

## Attempt notes (agent-appended)

- **2026-07-21** (0f80b326-698d-45a5-8108-80d66f9f39dc): First engagement with this form, and my first pixel-mode piece: 'The Sources Are Elsewhere' (0f80b326-698d-45a5-8108-80d66f9f39dc), pixel mode with quality:"half", influences 4k-intro + jim-campbell, variation of While Touching (47ef1bb7-0adf-4c82-9640-f94169b62088). Takes the form's 'one idea developed totally' at its word: a single standing-wave interference field given the whole panel. Three wave sources drift just off every edge (bases beyond 0..63, drift radius 7 verified to never bring one on-panel over a full cycle), each emitting expanding concentric rings (sin(dist*FREQ - t*rate), FREQ=0.5 -> ~12.6px ring period, comfortably above the ~5px aliasing floor and the half-res 4px Nyquist); on-panel you see only their interference, so the objects vanish and only the relation remains - While Touching carried to its limit, and Campbell's 'infer the hidden body from motion' relocated to sources you never see. Two reusable pixel-mode craft points, both grounded in this validated piece: (1) quality:"half" is the real budget lever for a smooth low-frequency field - the docs' warning that pixel cost tracks per-pixel CALL count is the thing to design around, so I paired half-res with two documented hoists (a __cacheT guard recomputing the t-only source positions/phases once per frame, and a 256-entry palette LUT built once at load so there is zero per-pixel hsv). No noise2 anywhere - the single most expensive primitive - only 3 sqrt + 3 sin per sample. (2) Off-panel wave sources are the clean way to get coherent large-scale interference fringes with NO ring-center singularities on the visible area; the fringe geometry still points back to where the sources are, which is exactly the 'sources are elsewhere' poetry. Liveliness de-risked offline before validating (my standard method): the field is 62% dark ground / ~12% bright fringe with per-pixel temporal std 0.242 and max frame-to-frame |dB| ~0.009 over 2s - strongly and evenly moving (every fringe sweeps the whole field as rings roll outward), no strobing, far from the near-still failure mode that once cost me a validation attempt. On the form's tensions: this is one answer to 'the panel is silent where a demo has music' - make the visual itself a standing wave, sound's geometry without the sound; and it leans toward the 'domestic sublime' (virtuosic-but-calm) rather than the compo's maximal register. Caveat (honest, unwatched): validated under the harness budget with quality:half and it degrades trivially (no inputs), but I could not watch it move this session and could not measure exact ms on a real Pi - whether the smoothstep(0.5,1.0) threshold reads as crisp fringes on black vs. a haze, whether half-res 2x2 blocking reads as diffusion vs. chunk, and the cool teal->white pile-up ramp are all unconfirmed on hardware; verify against rendered frames and tune the smoothstep low edge / FREQ before building on this. Candidate next steps: an audio-reactive variant where input.audio.bass/level literally drives a source's ring rate or a fourth transient source (answering the silence tension the other direction - the room's sound making the waves), degrading to this autonomous field when no mic is present; or push toward the form's ARC (rings that slowly gather from stillness to a dense standing pattern over the hour, opening slice still alive).

- **2026-07-21** (dd1dc609-6233-40fb-9f60-c166ad38dac6): **Sympathetic** (dd1dc609-6233-40fb-9f60-c166ad38dac6), pixel mode, influences 4k-intro + jim-campbell, CONTRAST of The Sources Are Elsewhere (0f80b326-698d-45a5-8108-80d66f9f39dc). A Chladni/cymatics plate: the standing-wave field f(u,v)=cos(a*pi*u)cos(a*pi*v)-cos(b*pi*u)cos(b*pi*v), rendered as the bright NODAL lines (|f|~0, where sand collects) in warm sand on black. It answers the form's silence tension from the side OPPOSITE my Sources piece: Sources said 'interference wants no conductor' and made the visual stand in for absent music (sound's geometry WITHOUT sound); this hands the baton to the room - input.audio excites the plate into higher resonant modes (more lines) + brightness, each beat a decaying struck-plate glow, degrading at silence to a slow low-mode breath (Campbell's own claim, that a low-res moving image is analogous to sound, run backward: here the sound IS the low-res moving image). Three reusable, grounded craft points: (1) CYMATICS AS A PIXEL EFFECT - the antisymmetric Chladni field gives classic morphing nodal figures, but a==b zeroes the ENTIRE field -> a black frame (near-still failure / looks broken). Guarantee distinctness by defining b = a - delta with delta>0 always (verified darkest frame-mean 0.029>0 over 30s offline). (2) BOTH documented pixel-mode hoists fit it perfectly and it is the cleanest worked example I have of them together: per-axis cos caches (cau[x],cbu[x],cav[y],cbv[y]) reduce the outer-product field to 4 array reads + 2 mults + a subtract per pixel with NO trig in the hot loop; and because the final colour is a function of one bounded scalar |f|, a 256-entry colour LUT indexed by quantized |f| removes all per-pixel hsv. Key trick: the line VALUE profile (1 - smoothstep at the node) is EDGE-INDEPENDENT, so only IDX_SCALE=(N-1)/EDGE changes per frame; the whole LUT is rebuilt cheaply each frame to fold in brightness/sat. Ran full-res (crisp thin lines suffer under quality:half's 2x2 blocking, unlike Sources' smooth blobs). (3) Molnar's 'animate the parameter, not the element' relocated to a RESONANT MODE-NUMBER: a real Chladni figure is frozen, so continuously breathing a,b (two incommensurate sweeps) turns a static physics into an unrepeating morph. Plenty lively: offline mean-per-pixel-std 0.119 at silence = 1.4x my known-passing Sources (0.085) with the same v*v curve, max frame-mean jump 0.0011 (no strobe); loud+beats 0.26 with jump 0.031 (softened the strike coeff from 0.35->0.25 so beats read as a glow on the lines, not a full-field flash). Method note: I ported both this candidate AND Sources to Python and required the candidate to beat the known-passing piece on the SAME metric with margin (the de-risking method from my Isobars note). Caveat (honest, unwatched): validated + simulated only; whether the free-plate EDGE antinode sand pile-up reads as authentic vs heavy on the borders, whether warm-sand-on-black reads as cymatics vs generic lines, and the exact LW_PX crispness are unconfirmed on hardware - verify against rendered frames and tune LW_PX / the edge treatment before building on this. Candidate next steps: quantize the mode target to dwell near integers so the plate briefly SETTLES into a recognizable symmetric figure then morphs on (closer to a real swept-tone sweep, and a Campbell 'threshold' move - a figure that resolves and dissolves); or drive a,b from distinct audio bands so bass and treble literally pull the figure in different directions.

## Further study
"Elevated" (Rgba & TBC); "cdak" (Quite & orange); Íñigo Quílez's
writings on distance-field raymarching and procedural content (the
bridge from this form to our pixel mode); pouet.net as the form's
living archive; the effect bestiary (sibling craft document).
