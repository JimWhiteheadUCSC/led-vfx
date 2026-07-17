# The Effect Bestiary

Demoscene craft, distilled and translated to this panel and the VFX
contract. This is a cookbook, not an influence: no taste lives here,
only technique. Each entry gives the idea, the math, and what survives
64×64. Combine freely; but see the 4K intro dossier before combining
too much — one idea developed beats three ideas stacked.

Cost ratings: CHEAP (nothing to think about) · MODERATE (mind the
budget) · SPICY (profile it; consider `quality: half` or reduced fps).

## Ground rules of the craft

- **LUTs in setup().** Anything per-pixel that doesn't depend on t
  (tunnel angles, distances, dither matrices) is computed once into a
  Float32Array at load (this is the LookUp Table, or LUT). The demoscene ran on this discipline; so do we.
- **Accumulate in Float32, show in 8-bit.** Heat maps, feedback
  buffers, and slow accumulation live in user-side Float32Arrays;
  quantize to the panel each frame. Increments under 1/255 vanish in
  packed ints (see the Reas dossier's accumulation idiom).
- **Additive splat.** Glow = read-modify-write: getPixel, add, clamp,
  setPixel — or add into your float buffer. Overlapping light should
  sum, like real light.
- **Palette ramps are half the effect.** The classic fire and copper
  looks are 90% palette. Build ramps as arrays of lerped color stops
  in setup(); index by intensity. Dark floor, bright narrow peak.
- **Half-res is honorable.** Heavy pixel-mode math at 32×32 upscaled
  reads as softness (see the Campbell dossier). The scene shipped
  plenty of 160×100 effects on 320×200 screens.

---

### Plasma — CHEAP · pixel mode
Sum 3–4 sine fields of differing frequency/direction, one drifting
noise layer, normalize to −1..1, map through a palette.
`n = sin(u·a + t) + sin(v·b − u·c + t·k) + sin(hypot(u,v)·d − t) + noise2(...)`
At 64×64: keep hue range narrow (see plasma_bloom.js, the house
exemplar); full-rainbow plasma is the "default settings" look.

### Fire — CHEAP · buffer mode
Float32 heat field. Each frame: seed the bottom row with random heat;
each cell above becomes the average of the 3 cells below it minus a
cooling constant; render heat through a black→red→orange→white→ ramp.
At 64×64: cooling ≈ 0.02–0.05 per step; wind = sample one cell
diagonally. The palette IS the fire — spend your effort there.

### Rotozoomer — CHEAP · pixel mode
Sample a procedural pattern with rotated, scaled coordinates:
`u' = (x·cosθ − y·sinθ)·s + ox; v' = (x·sinθ + y·cosθ)·s + oy`
then pattern(u', v') — checkerboard, rings, noise. Animate θ, s, and
the offsets on slow sines. At 64×64: keep pattern features ≥ 4 px or
they shimmer; smoothstep the pattern edges.

### Tunnel — MODERATE · pixel mode
In setup(), two LUTs per pixel: angle = atan2(v, u) and depth = k/r.
Per frame, sample a procedural texture at
(angle·A + t·spin, depth + t·speed). Free variations: off-center eye
(shift u,v before the LUT), wobbling radius. At 64×64: darken with
depth (`v *= smoothstep(0, 8, r)`) to hide the singular center.

### Twister — CHEAP · buffer mode
A vertical column made of 4 edges; per row y, each edge's x is
`cx + W·sin(phase + y·twist + t·speed)`. Fill between consecutive
edges with alternating shades; edge order flips create the twist
illusion. At 64×64: column width ~20–28 px, twist ≈ 0.05–0.12 rad/row.
Two twisters out of phase beat one.

### Copper bars — CHEAP · buffer mode
Horizontal bars (each a vertical brightness ramp peaking at its
center line) whose y-positions ride sines at different phases; draw
back-to-front or additively so crossings glow. Pure palette-craft:
each bar one hue, ramp dark→bright→dark over ~7–9 rows. The classic
"cheap effect that looks expensive."

### Starfield — CHEAP · buffer mode
Points with (x, y, z); each frame z -= speed·dt; project px = cx +
x/z·f, py = cy + y/z·f; brightness ∝ 1/z; respawn behind when past.
At 64×64: 40–80 stars; sub-pixel splat them (Campbell dossier) or
they twinkle harshly. Streaks: draw from previous projection to
current, brightness low.

### Metaballs — MODERATE · pixel mode
Field = Σ rᵢ²/((x−xᵢ)² + (y−yᵢ)²) over 3–5 moving centers; color by
smoothstep bands of the field (soft threshold ≈ 1.0). At 64×64:
radii 6–12 px; precompute nothing — it's just adds and divides, but
5+ balls at 60 fps gets SPICY; 30 fps is fine.

### Interference / moiré — CHEAP · pixel mode
Two (or three) ring fields from moving centers:
`sin(d₁·f − t·s₁) + sin(d₂·f + t·s₂)`, palette by the sum. Related
family: XOR patterns `((x+ox) ^ (y+oy)) & mask` scrolled — the
oldest trick alive, still hypnotic. Keep f low (ring spacing ≥ 5 px)
at this resolution.

### Voxel landscape — SPICY · buffer mode
Comanche-style: for each of 64 screen columns, march a ray across a
heightfield (noise2(worldX, worldZ)); at each step, if the projected
height rises above the highest column pixel drawn so far, fill the
gap with distance-fogged terrain color. ~30–50 steps/column ≈ 2–3k
samples/frame — fine at 30 fps, but profile. Fly the camera on a slow
noise path; fog to the sky ramp.

### Vector balls / dot sphere — MODERATE · buffer mode
A 3D point cloud (fibonacci sphere, cube lattice, or Lissajous knot),
rotated by two slow angles, projected like the starfield, splatted
with brightness by depth. Draw far-to-near. At 64×64: 60–150 points;
sub-pixel splat mandatory or rotation strobes.

### Feedback — MODERATE · buffer mode
Keep last frame in a user Float32 buffer. Each frame: resample it
with a slight transform (zoom 1.02× toward center, rotate 0.5°, or
translate), multiply by 0.90–0.97, THEN draw a few seed shapes into
it, then quantize to the panel. Zoom-feedback makes infinite
corridors; rotate-feedback makes galaxies from a single moving dot.
The transform resample is 4096 bilinear reads — cheap in a flat
loop. The mother of a thousand demo effects.

### Sine scroller — CHEAP · buffer mode
Text on a wave. Needs a sprite font: a 3×5 pixel font covers A–Z 0–9
in ~40 tiny sprites (define once in a helper block; entirely inline-
able). Letters advance leftward, each bobbing on
`y = cy + A·sin(t·s + x·k)`. At 64×64: 3×5 font with 1 px spacing
fits ~15 characters across. Use sparingly — words on the panel are
loud — but a piece that occasionally spells one word can be a knife.
