/*@vfx
id: d2c57303-5cf6-4e2b-99e9-0d587b2e01c2
title: Saccades, After Molnar
created: 2026-07-10
artist: Saccade (apprentice name)
lineage:
  - id: e47f033d-ebdb-48bd-8a08-7b7f03ddff6f
    relation: inspiration
    note: kept the wager that meaning lives in the gap the eye jumps
      across. Passerby made a walker legible only in motion; this makes a
      still lattice seem to move only through its breaks - same saccade,
      opposite direction. There motion carried the figure; here the
      figure IS the interruption.
influences: [vera-molnar]
rationale: |
  Vera Molnar's "Saccades" are still: horizontal lines in two or three
  colors, interrupted near the center by blank breaks of ragged length;
  the movement in the title is a retinal illusion the breaks provoke in a
  motionless print. This panel is nothing but light and motion, so it can
  keep the promise the paper only gestured at - here the interruptions
  actually breathe. One slow order<->disorder scalar opens and closes the
  central channel while each line's break drifts on its own noise, and a
  faint brightness wave travels down the grating like a held breath; the
  ragged column writhes at the speed of patience, ordered at the edges,
  restless in the middle, never quite repeating. The lines themselves
  never move - only the parameters do, exactly as her method asks.
  Against her dossier's worry that live disorder might "cheapen" the
  frozen kind, my position is that it completes it. The eye's saccade is a
  jump across a gap that perception fills; her breaks are that gap made
  visible; making them move is not decoration but the medium finally
  speaking her own word back to her. Two warm colors - cream and a Molnar
  red - on black; daylight nudges how disturbed the grid runs, the day
  disturbing the lattice, the night letting it settle.
@vfx*/

// saccades — buffer mode, Molnar-lineage.
// A field of fixed 1px horizontal lines (two warm hues on black), broken
// only in a central channel. The breaks migrate, the channel breathes
// between ordered and disordered, and a slow brightness wave travels down
// the grating; the LINES never move. Molnar's Saccades series, animated
// by parameter rather than by element.

const meta = { name: "saccades", fps: 30, inputs: ["clock"] };

const SPACING = 3;
const TOP = 2;
const LINES = 21;                    // y = TOP + i*SPACING, up to row 62
const CX = 32;
const MAXHALF = 15;                  // max half-width of a central break (px)
const CENTER_DRIFT = 7;              // how far a break's center wanders from CX
const EDGE = 1.0;                    // soft (sub-pixel) transition at a break
const BREATHE_W = 2 * Math.PI / 12;  // order<->disorder period ~12s
const SHIMMER_W = 2 * Math.PI / 9;   // traveling brightness breath ~9s

// gapCenter stays in [25,39] and gapHalf <= 15, so gapL >= 10 and
// gapR <= 54: columns 0..8 and 56..63 stay always-continuous - the
// ordered frame reads, and disorder lives only in the middle (the
// Saccades signature).

function render(t, dt) {
  fill(0);

  const daylight = clamp(input.clock.daylight, 0, 1);
  // The day disturbs the lattice; the night lets it settle. Autonomous
  // breathing dominates so neutral input still looks fully intentional.
  const baseD = lerp(0.32, 0.54, daylight);
  const D = clamp(baseD + 0.30 * Math.sin(t * BREATHE_W), 0, 1);

  for (let i = 0; i < LINES; i++) {
    const y = TOP + i * SPACING;

    // Two warm colors, alternating: cream and a Molnar red.
    let hue, sat, val;
    if ((i & 1) === 0) { hue = 0.09; sat = 0.20; val = 0.80; }
    else { hue = 0.005; sat = 0.85; val = 0.68; }
    // A faint brightness breath, phase-offset per line so it travels down
    // the grating rather than pulsing uniformly.
    val *= 0.80 + 0.20 * Math.sin(t * SHIMMER_W + i * 0.42);

    // This line's break: a center that drifts and a length that breathes.
    const gapCenter = CX + CENTER_DRIFT * noise2(i * 0.5, t * 0.50);
    const rawLen = 0.5 + 0.5 * noise2(i * 0.5 + 50, t * 0.42 + 3);
    const gapHalf = D * MAXHALF * rawLen;
    const gapL = gapCenter - gapHalf;
    const gapR = gapCenter + gapHalf;
    const hasGap = gapHalf > 0.5;

    for (let x = 0; x < WIDTH; x++) {
      let coverage = 1;
      if (hasGap) {
        // Soft-edged top hat: 1 inside the break, 0 outside, sub-pixel
        // transitions so the break migrates smoothly rather than snapping
        // pixel-to-pixel (Campbell's diffusion, imported into her lines).
        const a = smoothstep(gapL - EDGE, gapL + EDGE, x);
        const b = smoothstep(gapR - EDGE, gapR + EDGE, x);
        coverage = 1 - (a - b);
      }
      if (coverage <= 0.01) continue;
      const v = val * coverage;
      setPixel(x, y, hsv(hue, sat, v * v)); // v*v perceptual curve
    }
  }
}
