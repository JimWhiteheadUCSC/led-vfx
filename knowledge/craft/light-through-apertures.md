# Light through apertures

A cookbook for pieces whose image is light passing an opening (a window, a gap in leaves, a lamp's shade) and landing on a surface. Distilled from three pieces in this house: Between the Lamp and the Wall (959b82f7-5cf2-4dd1-8275-79b77fac9a63), Each One the Sun (2c0bcddb-44ec-4053-b26c-8eb08fce32ea), and Someone Else Going Home (4f1bc119-54e4-4def-9b24-336dc17f86d6).

## The projection

Put the aperture in a plane (x=0), the source at S=(-Xs, sy, zs) on one side and the receiving surface on the other. For a receiver point C, the ray C->S crosses the aperture plane at parameter u = Xs/(Xs + distance of C from the plane). If the receiver is itself a plane (a ceiling at z=H, rows indexed by distance cx from the aperture wall):

- wz = zs + u*(H - zs) depends on the ROW only;
- wy = sy*(1-u) + u*cy is LINEAR across the row.

So per source: one row setup (vertical edges of the aperture, any horizontal bars, falloff u*u), then a walk over only the pixels whose wy lies inside the aperture, incrementing wy by u*pixel each step. No divide, sqrt or trig per pixel. Someone Else Going Home runs ~13 of these per frame.

## Softness

A source of radius r gives a penumbra of r*(1-u) in aperture coordinates (the same fact Between the Lamp and the Wall used as p = RL*(s-1) for occluders). Floor it at half a receiver pixel's footprint in aperture coordinates (u*pixel horizontally, pixel*(H-zs)*u^2/Xs vertically) so every edge is antialiased even when the physics says razor-sharp.

## What the geometry gives you for free

- A moving source moves the image OPPOSITE to itself, faster at receiver points further from the aperture: bars fan rather than slide.
- Source height sets where the lit band begins (cx = Xs*(H - top)/(top - zs)): higher lamps land nearer the wall.
- Two sources side by side (headlights) are two passes; their images coincide when the source is square-on and split toward the edges.
- The receiver strip next to the aperture wall is shadowed by the wall above the opening. Choose the viewed range so it doesn't eat a third of the panel.

## Colour

Accumulate each source's light in float RGB, wipe every frame (see accumulation.md), tone-map per channel through one LUT (1-exp(-kL))^1.4. Mix endpoint colours in RGB, never by lerping hue (Each One the Sun's green-dapple lesson).

## Figure/ground

A bounded lit shape on a dark ground reads as light lying on a surface; a lit field filling the panel reads as looking through something. Both Lamp and Each One the Sun were rescued by bounding the lit area.

---

*Written 2026-09-25, in the session that produced 4f1bc119-54e4-4def-9b24-336dc17f86d6.*
