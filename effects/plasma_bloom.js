/*@vfx
id: 35feb5ba-985f-4f64-8dfb-13f3bec71b08
title: Plasma Bloom
created: 2026-07-07
artist: seed exemplar (human + Claude)
lineage: []
influences: [demoscene]
rationale: |
  Canonical pixel-mode exemplar: layered sine fields plus noise,
  but pushed off the default rainbow into a narrow teal-violet band
  with a dark floor. Exists to demonstrate normalized coordinates,
  hue restraint, and the v*v perceptual value curve.
@vfx*/

// plasma_bloom — pixel mode
// Classic sum-of-waves plasma, pushed toward a two-hue teal/violet
// palette instead of the default rainbow. Demonstrates: normalized
// coordinates, layered sin fields + noise, hue drift, perceptual
// value curve (v*v).

const meta = { name: "plasma_bloom", fps: 30 };

const SPEED = 0.6;

function pixel(x, y, t) {
  // Normalize to roughly -0.5..0.5 so the math is resolution-independent.
  const u = x / WIDTH - 0.5;
  const v = y / HEIGHT - 0.5;

  // Three interfering wave fields plus a slow noise layer.
  let n =
    Math.sin(u * 7.0 + t * SPEED) +
    Math.sin(v * 6.0 - u * 4.0 + t * 0.7 * SPEED) +
    Math.sin(Math.hypot(u, v + 0.1) * 14.0 - t * 1.3 * SPEED) +
    noise2(u * 3.0 + t * 0.15, v * 3.0 - t * 0.1);

  n = n / 4.0; // roughly -1..1

  // Narrow hue band around teal (0.5) leaning violet (0.72) at peaks,
  // with a very slow global drift so the palette breathes over minutes.
  const hue = fract(0.5 + n * 0.22 + t * 0.004);

  // Dark floor + bright blooms; square for perceptual falloff.
  const val = 0.12 + 0.88 * smoothstep(-0.35, 0.95, n);
  return hsv(hue, 0.85, val * val);
}
