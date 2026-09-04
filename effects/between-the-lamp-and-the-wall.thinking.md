# Thinking log — Between the Lamp and the Wall

959b82f7-5cf2-4dd1-8275-79b77fac9a63, committed 2026-07-31

## Turn 1

Looking at my recent work, I'm noticing a pattern emerging—the last few pieces have all used that lattice-of-strokes approach, which means I'm falling into a rut. Reviewing the contact sheets, I see that some pieces like Lodging are reading as dense texture that's almost hitting the legibility floor at 1 meter, while Grain Remembers comes across as dark noise. I need to break away from this direction and try something different.

The pieces that actually work best visually are the ones with bold, clear shapes and strong figure-ground separation—A Curve Nobody Drew, Lengths, Keeping Pace, Sympathetic. So my move here is to abandon the hatch lattice entirely and focus on bold shapes with real visual clarity. I'm considering a few directions: a Campbell's-inspired piece about a body stopping and settling into a legible silhouette, a Reas-inspired approach marking line intersections, a caustic variant with a vessel and two light sources, or something completely new like a shadow or eclipse piece. I'm leaning toward something genuinely fresh rather than another variation on grain or caustic work.

Looking at what actually made the archive sing—the caustic was the visual highlight—I could push that further by giving the vessel a gap so light escapes, or crossing two caustics, or keeping the vessel still and moving only the light. But that might be too close to repeating myself. The shadow idea is more compelling: drawing only the light on a wall and its penumbra, with an undrawn body between lamp and wall. That continues the thread of never drawing the subject directly, but with bold soft shapes instead.

The physics here is elegant—an extended light source creates a penumbra that softens with distance from the wall, so as a hand or body moves closer and farther, the shadow sharpens and blurs. I'm deciding between computing this per-pixel (expensive, but accurate) or using a signed distance field with blur radius tied to depth (cheaper, and I can render the occluder's silhouette as a soft-edged shape).

The occluder itself is what makes it readable—a hand shadow puppet, or simpler: a body walking past a lamp, its shadow sweeping across the wall and growing enormous and soft as it approaches the light source. That's bold and legible.

But this inverts everything I've built so far, which uses bright ink on dark backgrounds. A lit wall with a dark shadow means I need to rethink the aesthetic—a full-field bright wall strains power and looks washed out, so instead I'm imagining a soft vignette of lamplight with a bright core around 0.6 brightness and darker falloff at the edges, with the shadow cutting into that pool of light. That keeps the average brightness moderate and feels more natural for LEDs, which handle gradients well.

This actually connects to Campbell's work—his silhouettes are dark figures against light in some pieces, creating high contrast. Here I'd be doing the same but inverted: a shadow cast on a lit wall by a body passing in front of a lamp. The lamp acts as an area source, so the penumbra softens with distance. It's subtraction rather than addition, and it's a real compositional argument against my usual practice.

For the implementation, I'm setting up the physics: the wall is the panel at z=0, the lamp positioned in front at z=-D, and occluders (spheres or capsules) at intermediate depths. I need to calculate how each occluder projects onto the wall from the lamp's position, which involves ray casting through the sphere center to find the shadow's center point on the wall.

The shadow radius scales with the projection factor, and I'm adding a penumbra effect based on the lamp's radius and the occluder's distance from it—closer occluders create softer, wider shadows. For a figure made of multiple blobs, I'll combine them using a soft maximum blend to create a unified shadow silhouette.

Now I'm thinking through the performance: roughly 49,000 distance calculations per frame across all pixels and blobs. On QuickJS running on a Pi4, that's borderline—maybe 7 milliseconds if I'm lucky. The key optimization is only computing shadows within each blob's bounding box rather than scanning the entire canvas, which should bring it well within budget.

For the wall rendering, I'd precompute a static illumination field from the lamp once at startup—a radial gradient with optional noise texture—then per pixel just blend the wall light by the inverse of the shadow alpha, add ambient, and look up the final color from a palette indexed by brightness.

Now I'm thinking about what should cast the shadow. A walking figure between the lamp and wall creates that classic strong silhouette—especially when close to the lamp, the shadow gets large and soft. But I'm drawn to inverting my "Passerby" concept: instead of the figure being present and the light absent, here the light stays fixed and the human form becomes pure shadow, pure absence sweeping across the wall.

The shadow softness itself becomes meaningful—it encodes depth through physics. As the figure moves closer to the wall, the shadow sharpens and becomes more legible; when it's far from the wall, it dissolves into vagueness. That's the real craft finding: the blur isn't just aesthetic, it's a depth cue that makes the silhouette read as near or far as it passes through the frame.

I'm thinking through the pass itself: a walker crosses diagonally in front of a lamp so their depth changes continuously. The shadow starts small and sharp when they're far from the lamp and near the wall, then swells huge and soft as they approach the lamp. I need to be careful about the timing—keeping it slow enough to avoid flashing (staying well under 3Hz), and making sure the shadow never completely engulfs the panel in a way that reads as frozen or empty. The depth range needs to stay bounded so the shadow stays visible and readable throughout.

I'm also considering adding subtle details like a slight flicker to the lamp itself and a gentle breathing effect across the whole wall, plus maybe a second dimmer shadow from another lamp to create overlapping penumbras. But that adds complexity, so I'm leaning toward keeping it simple with one lamp and one fully developed idea. The big shadow sweeping across the lit field should generate plenty of temporal variation and pixel changes, which is good for the liveliness metric. For renewal between passes, I'll re-roll the direction, depth path, height, cadence, scale, and let the lamp position drift slowly. The lit wall between passes could feel too still, so I need to keep something continuously moving.

A swaying lamp creates a lovely effect where the entire wall gradient shifts and shadows swing across the whole field, which is much more lively than just having gaps between bodies. I'll keep the passes nearly continuous with short gaps of just a couple seconds, and during those gaps the wall light will still shift from the lamp's gentle sway, creating constant whole-field movement.

For the wall illumination, I can use a cheap falloff calculation that avoids the expensive sqrt operation — something like a simple inverse distance formula — which keeps the per-frame cost manageable. The swinging lamp and moving figures aren't two separate ideas but one unified concept: the lamp's subtle sway is what brings the shadow geometry to life, so I'll keep that motion small enough to read as breathing rather than dramatic swinging.

On the figure itself, I'm leaning toward a human walker since gait is the strongest recognition signal and the core idea hinges on "a shadow reads as a body." I want to avoid it feeling like a simple inverted silhouette though — the real distinction comes from the shadow's scale (2-3x the body) and how it passes edge-to-edge across the panel, so you only ever see a fragment of it at any moment.

Now I'm working through the math: if the panel is 64 pixels tall and the body is about 22 pixels at normal scale, a projection scale of 1.4 to 2.4 gives me a shadow between 30 and 52 pixels — nearly filling the panel height with bold, legible shapes. For the penumbra, I'm varying the blur from around 0.8 pixels near the wall up to 6 pixels near the lamp, which at that softness turns a 40-pixel form into a vague dark mass — exactly the effect I want.

Setting up the geometry: the lamp sits on the wall's normal axis at distance D in front, the body is at depth d between the lamp and wall, and I'm calculating how a point at position (px, py) projects onto the wall using the ray from the lamp through that point, which gives me a scale factor s = D/(D-d) that's always greater than 1, so any sphere of radius r casts a shadow with radius r times s.

The penumbra width from the lamp's finite radius RL works out to RL times (s-1), which is elegant. With concrete numbers like D=100 and d=30, I get s≈1.43 and a penumbra of about 2.6 pixels for a 6-pixel lamp radius. For the body itself, I'm defining joints in local coordinates, projecting each one to the wall with its scaled radius and penumbra, then blending the shadows together using a smoothstep function that transitions from opaque to transparent across the penumbra band, taking the maximum alpha across all overlapping blobs to handle unions.

Now I'm working out the wall illumination from the lamp—it follows an inverse-square law with a cosine falloff, so intensity drops as D divided by the cube of the distance from the lamp to each wall point. I'm using a normalized falloff formula that accounts for both the horizontal distance and the lamp's depth, with some gamma correction to control the brightness curve.

I'm testing different lamp depths to balance the vignette effect against the shadow scale: at D=100 the illumination gradient is gentle (1.0 to 0.48 from center to corner), but moving the lamp closer to D=45 creates a tighter pool of light (ratio drops to 0.12) while also affecting how the body's shadow stretches and softens across the wall.

The lamp itself stays off-frame—we're seeing its projection as the bright pool on the wall rather than the lamp object. For the ground brightness, I'm aiming for a peak around 0.62 with a steep falloff so the average stays darker and moodier, using warm amber tones for both the lit area and the near-black shadow, with subtle texture variation.

I want the wall to shift with the day-night cycle: at night the lamp creates high contrast with deep amber shadows, while daylight weakens the shadow and flattens the field with cooler, paler tones. This gives the scene an honest progression that degrades gracefully based on the time input.

For the crossing figures, I'm designing an event queue where each crosser moves one at a time with brief gaps between them. Each pass defines the direction, a depth path that creates subtle scale and softness changes as the figure walks diagonally through space, body placement on the floor line, and movement speed. I'm reusing a proven stance-fraction gait system to avoid skating, and representing the body as a collection of spheres for the head and torso with thinner limbs, or potentially capsules for better silhouettes—around ten blobs total to define the figure's volume.

For rendering, I'm calculating distance-to-segment for each capsule (upper legs, lower legs, arms, torso, neck, plus head) and using that to compute alpha with a smoothstep falloff based on radius and penumbra. Since the body is planar at a single depth, the scale and penumbra are constant across all body parts, which means the entire silhouette shares the same softness—a coherent visual treatment. The distance calculation clamps the projection parameter to find the closest point on each segment, then unions the results across all capsules. For each joint, I'm projecting its coordinates onto the wall using the scaling factor s, which makes the shadow move faster as it gets larger. The body moves at a constant speed in its own plane, but the shadow's apparent speed on the wall scales with s — so a shadow at 2× scale moves twice as fast. I need to be careful about the actual speeds though; even modest body speeds can translate to quick shadow movement across the wall.

I'm also checking whether the shadow coverage becomes overwhelming — at 25-50% of the panel area, it should feel present without completely dominating the space. Between shadow passes, the wall shows just the sway of the lamp's light and the subtle breathing of the palette, which should maintain visual interest even during the gaps.

To keep things lively during those quiet moments, I'm considering either very short gaps (1.5-4 seconds) with more pronounced lamp sway — moving the light pool noticeably across the surface — or running two independent shadow crossers so there's usually at least one on-panel, creating those beautiful moments when both shadows overlap and occasionally brief moments of emptiness. The depth difference between near and far shadows could actually add richness rather than confusion.

Now I'm working through the performance budget: the alpha buffer, capsule shadows for multiple bodies, wall light recomputation, and quantization all add up to roughly 30k inner loop iterations per frame. On the Pi with QuickJS-WASM, function call overhead dominates, but inline iterations are much cheaper, so I need to verify whether this stays within acceptable timing. On Pi4 WASM that drops to maybe 10-30M ops/sec, so 450k operations could take 15-45ms—too risky. I should cut the work: compute the shadow field at half resolution (32×32) and upsample it since the shadow is a smooth blur anyway, which drops bbox iterations to 4-5k. Similarly, render the wall light at half resolution and paint 2×2 blocks, bringing that down to around 1024 iterations plus 4096 setPixel calls—though those function calls themselves add up to roughly 8ms.

I could write directly to the framebuffer instead, but __FB isn't officially documented (it exists as a global in the prelude but relying on it feels hacky and the validator might reject it). My existing pieces already do 4096 setPixel calls per frame in the quantize loop and pass validation, so that path is proven.

Looking at Lodging's performance: it does 4096 setPixel calls plus around 5400 addPix calls from the noise and splat operations across 169 strokes, totaling roughly 12k function calls, which still fits under the 20ms budget. That suggests the overhead per function call is tight but manageable.

Now I'm thinking about how to structure the shadow rendering more efficiently—using a half-resolution shadow field (32×32 cells) to reduce iterations, then compositing at full resolution with minimal operations per pixel. For 9 capsules across 2 bodies, the shadow coverage would be around 4700 cells to process, each with maybe 15 operations inline, keeping everything under my operation budget.

For the wall light, I'm weighing whether to compute it at half resolution and upsample, or just do full-resolution compositing where each pixel multiplies the light value by the upsampled alpha—though that full-res approach with divisions might push toward 30k operations, which is getting tight.

The alternative is rendering the entire composite at half-res, then filling 2×2 pixel blocks at full resolution—that's 1024 light-plus-alpha calculations followed by 4096 setPixel calls. The blockiness from 2×2 upsampling would be subtle for a smooth gradient with soft shadows, though there'd be some banding; it's the kind of honest quantization that feels acceptable for this piece about a physically softening penumbra.

But the sharp end of that penumbra—around 1 pixel—would become 2 pixel blocks, which feels like a compromise. Instead, I could keep the composite at full resolution but make the light calculation itself cheap: precompute a lookup table for the radial falloff as a function of distance squared. Since the lamp sways the light changes, but I can build a static table of the falloff curve indexed by q² shifted down (625 entries covering distances up to ~10000), then per pixel just compute the distance squared, look it up, and avoid any division—roughly 8 operations plus one array read.

Even tighter: precompute dy² per row and cache dx² per column, so each pixel only needs one addition to get q². Then the full pipeline—distance lookup, alpha blend, palette index, setPixel—runs in about 10 operations per pixel, which across 4096 pixels stays manageable. For the alpha channel, nearest-neighbor upsampling (each 2×2 block gets the same alpha) is trivial to index.

The tradeoff is that nearest upsampling creates visible 2-pixel blocky edges in the shadow, especially noticeable where the penumbra is soft. Bilinear upsampling would smooth that out but costs 4 reads and 3 lerps per pixel—roughly doubling the work, though still within budget at around 80k total ops.

I'm weighing whether to skip the half-res buffer entirely and compute shadow alpha analytically per pixel using just 4-6 capsules instead. Or stick with full-res but limit the bounding box per capsule—a limb projects to roughly 30×14 pixels, so 9 capsules across 2 bodies means about 7600 pixels to process at 15 ops each, totaling around 114k ops versus the half-res approach at 1900 iterations. The full-res version is getting expensive.

Actually, comparing the cost of 6000 addPix function calls (each with overhead and bounds checks) against 7600 inline iterations, they're probably comparable or worse. So I'll go with full-res alpha using bbox-limited inline loops—no function calls in the hot path, just the capsule rasterizer inlined with distance math, dot products, clamping, and smoothstep all computed directly. The sqrt per pixel is a concern since it's a function call, but it should still be manageable.

Actually, I can avoid the sqrt entirely by working in squared-distance space: compare d² against (R+p)² and use a squared-domain smoothstep for the falloff. The visual difference is imperceptible—a soft edge is a soft edge—so this trades the sqrt for a bit of math in the squared domain.

Setting up the precomputation: for each capsule, I'll cache the projected endpoints, the delta vector, the inverse length-squared (with a point-case check), the projected radius, penumbra width, and the inner and outer squared radii. Then compute the bounding box from those values.

In the inner loop over pixels, I'm projecting each point onto the capsule line segment, clamping the parameter to [0,1], computing the closest point, and checking the squared distance. If it's outside the outer radius I skip it; otherwise I apply a smoothstep in the squared domain to blend the alpha. About 16 operations per pixel.

Now I'm designing the walker silhouette with eight capsules: a small head, torso, two thighs, two shins, and two arms. With radii ranging from 1.2 to 2.8 pixels and a body height around 20 pixels, the projected shadow will be roughly 30–46 pixels tall with limb widths of 4–7 pixels, giving it a bold, legible look. Adding a second body would double the iteration cost to 15k, so I'm considering making it optional or less frequent.

Instead of two bodies, I'll use one body at a time with short gaps between passes—crossing takes 6–8 seconds with 2–5 second gaps in between. During those gaps, the lamp sway keeps things visually active. The validator samples 2-second windows, so there's a risk of catching a gap and getting low temporal variation, but the lamp's movement should generate enough pixel-value change to compensate. I'm estimating the pool center moves at roughly 1 pixel per second, which combined with the steep vignette falloff should create noticeable changes even during stationary moments.

The math is tight though—a 2-second window might only see ~0.01 temporal standard deviation during a gap, which falls short of my 0.030 target. To solve this, I need a continuous element that fits the scene: moths fluttering in front of the lamp, or a gentle flicker of the lamp itself at 0.5–1.5 Hz with 5–8% amplitude. This kind of subtle flicker won't trigger strobe warnings but will raise temporal variation across the whole field consistently.

Actually, the better approach is simpler: no gaps at all. Keep bodies crossing continuously—they wrap around the panel edges so a shadow is always partially visible, just like the proven technique from my earlier work where "translation of the body IS the liveliness budget." After a figure exits one side, it re-enters from the opposite with fresh parameters, maintaining constant motion.

The trade-off is whether continuous passers read as a parade or feel natural—but that's the honest "people passing" archetype I've already defended. Alternatively, I could use two shadow casters at different depths with independent timing to create overlap variety and prevent emptiness, though that costs around 15k iterations. Let me think through the actual performance cost more carefully by estimating the iteration count. The validator is my gate, so if similar complexity pieces passed there, I'm good. Two bodies would work—a bright near-lamp and a dimmer far one—which shows the depth-legibility gradient directly and makes a stronger visual statement than doing them sequentially. But I'm worried two bodies might create clutter or confusion.

So I'll commit to two crossers with independent depths, directions, and speeds, re-rolling depths each pass but constraining them so they're not both huge simultaneously—one from the near-band, one from the far-band, occasionally swapping roles. Using max-alpha blending for overlaps means shadows merge into a single dark mass rather than double-darkening, which is physically correct. The far/sharp one reads as the body itself while the near/soft one becomes a vague dark mass, which works well.

Now I'm setting the lamp parameters—distance from wall at 46 units and positioning it on the wall plane.

The lamp sways horizontally (Lx varies with sine motion) and sits high up (Ly around 10), which makes shadows fall downward and outward like an overhead light. A body standing on the floor at y around 55 would have its feet shadow project off the bottom of the panel, but the head at y around 35 projects onto the panel, so I'd see mainly the torso's shadow—which could actually look great.

Rather than fight the physics, I'll work backward: pick the desired shadow height and position on the wall, then calculate where the body needs to be in 3D space to cast that shadow, and let the lamp's sway naturally animate the shadow movement as it swings.

For the gait, the feet don't need to sit on a visible floor line since we're only rendering the wall—I just need the silhouette to read clearly within the chosen band. The walker's direction matters too: if they move parallel to the wall at depth d, the shadow scales with the projection factor s, so a lamp sway of ±5 with s=2 causes the shadow to swing opposite the lamp by a factor of (s-1).

The wall light moves with the lamp as well, sliding the light pool ±5px to keep the whole scene dynamic. For the lamp motion itself, I'm layering a slow noise-driven drift with a gentle sinusoidal pendulum component—the periodic swing works fine since it mimics a physical hanging lamp, and the novelty comes from the figures passing through anyway.

For the flicker, I'm keeping it subtle with a small noise-based gain modulation. On the color side, I'm building a palette that shifts the wall from warm amber at night to pale daylight tones, with saturation and brightness responding to the light value—the lit regions stay near white-warm while the falloff deepens into saturated amber, and the shadows get a cool ambient fill to suggest indirect light.

Now I'm weighing how to handle the shadow coloring: either use a second lookup table with a cooler hue for shadowed pixels (which introduces a branch and potential discontinuity), or build a 2D palette indexed by both alpha and brightness value. The 2D approach would be around 2048 entries rebuilt each frame—computationally feasible but worth checking if the simpler branching approach looks acceptable first.

Actually, I can fold the flicker directly into the value index rather than rebuilding the lookup table every frame, so the LUT only updates when the daylight-driven hue or gain changes. For the shadow coolness, I can make the saturation and hue shift based on the brightness value itself—darker pixels naturally become cooler, which gives shadowed areas that cool cast without needing a separate palette. So a single 256-entry LUT where the hue interpolates between cool and warm tones based on the brightness value should handle both effects elegantly. Saturation drops from 0.45 in shadows to 0.12 in lit areas. I'll rebuild the lookup table whenever daylight parameters shift beyond my tolerance threshold. The wall itself is the bright element here—mean brightness peaks around 0.60 at the pool center and falls to 0.10 at the corners, which after the v² curve gives roughly 0.36 peak brightness. This piece will be significantly brighter overall than my previous work, so I need to check whether that violates my validation gates around temporal variance, strobing, and spatial spread.

To stay safe, I'm keeping the lamp pool concentrated with a peak of 0.58 and steep falloff using a smaller D parameter. Computing the intensity function with D=42 and an exponent of 1.5 shows the corners drop to around 0.16–0.32 depending on distance from the lamp center at (30, 12).

With a peak value of 0.62, the output ranges from 0.62 down to 0.11 in linear terms, averaging around 0.12—comparable to my other pieces. The shadow effect darkens shadowed pixels to 0.06 times the light value, creating a near-black form that reads as a dark silhouette against the warm graded wall. The interplay between the soft, depth-varying shadow and the swinging lamp motion is what gives this piece its visual interest.

What elevates this beyond a generic "shadow on a wall" is the conceptual weight: the softness encodes actual physics, the union of two overlapping shadows, the plaster texture, and the honest domestic reference. There's a nice tension here—Campbell's diffuser as physics, but inverted: "everything I've made is light on darkness; this is darkness on light—the figure as subtraction." In a house, a lamp and wall are how bodies are actually rendered. The shadow is literally a low-information projection of a real body, and the blur represents depth. It connects to Plato's cave, though that might be too literal. For titles, I'm considering "The Wall Only Knows the Shadow," "What the Lamp Makes of Us," or "Penumbra"—though the last feels a bit plain.

I'm settling on "Between the Lamp and the Wall"—it names the geometry, feels domestic, and locates the body in the space that's actually the piece's subject. I'll keep the shadow cast by walkers rather than something abstract, since the recognition wager is central and it inverts the archive's polarity while keeping the gait bold at 2x scale. Now I'm working through a legibility concern about the penumbra calculation at that scale. For the far body at small scale, I'm working with a 20–26px figure and setting up depth bands where the near objects have a shadow stretch factor around 1.75–2.35 and far objects around 1.15–1.45. I'm deriving the distance from the stretch factor using the projection formula, then choosing shadow speeds in the 9–15 px/s range to get natural crossing times, which means scaling the body velocity accordingly. For the gait, I'm applying the stride-to-velocity relationship to keep the limb motion consistent with the body's screen speed.

Working through the numbers: a 6 px/s body speed gives a stride amplitude of about 2 px in the body plane, which projects to roughly 4 px on the wall—legs swinging ±4 px against a 40 px shadow. That's quite small relative to a 9 px leg length, so I'm adjusting the cadence downward to around 0.41 cycles per second, which reads as a slow, patient amble rather than a brisk walk. This matches the pacing I used in earlier pieces where a 7–9 px/s body speed with a similar stride-to-speed ratio created that deliberate, unhurried feel.

Now I'm setting up the body skeleton in local coordinates with the hip as the origin. I'm defining the remaining body segments—thighs and shins with their respective radii, arms as single capsules per side to keep the collision cost down, and tallying up the total capsule count for the ragdoll.

Now I'm working out the body's projected height based on the head and foot positions, then scaling it parametrically to fit different depth layers—using a body scale factor between 0.75 and 1.0 so the near figure appears around 38 pixels tall and the far one around 31 pixels, both visually prominent. I'm also calculating where to place the shadow's vertical center and deriving the hip position from the silhouette's center of mass.

Now I'm translating those body coordinates into screen space using the light source position, accounting for the fact that the light sways slightly, which adds natural movement to the shadow. For the horizontal placement, I'm computing the body's x-coordinate to move the shadow across the full width of the canvas, from off-panel on the left to off-panel on the right, adjusting for the shadow's width which spans roughly 20 to 28 pixels depending on the stride and limb widths.

When a body's projected center exits the visible area by a margin of about 26 pixels, I trigger a re-roll to bring it back in from the opposite side or with a new direction. Since I'm managing two bodies independently with their own timers and state, I can re-roll each one separately, and by having them re-enter immediately without gaps, there's always at least one shadow visible on screen—creating the effect of a constantly busy hallway.

Actually, I could add a small random delay (0-2.5 seconds) before re-entry and stagger the cycle lengths so the two bodies de-phase naturally, which would create moments where only one shadow is visible and rarely both are waiting. To guarantee the screen never goes empty, I'll gate the wait: a body can only pause if the other body's shadow is currently on-panel; otherwise it enters right away. That's the same gating trick I used in Keeping Pace.

Setting up the code structure now...

Writing the rendering loop... The palette lookup uses the final normalized value to index into a precomputed HSV table that applies the hue and saturation based on daylight parameters, with brightness following a squared curve. I'm setting up a light falloff lookup table with 512 entries indexed by distance squared, using a power function to create smooth attenuation, though I'm noticing the quantization at small distances creates a flat region near the pool center. 1.3% banding near the peak is acceptable, so I'll bump the LUT to 1024 entries to reduce it further. For the wall texture, I'm computing a noise-based multiplier across a grid at load time — a few milliseconds for 4096 noise calls should be fine during setup.

To be safer, I could sample at half resolution with 1024 noise calls and upsample with nearest-neighbor, which keeps the texture subtle and avoids visible blockiness. I'll go with that approach: generate the coarse grid, then fill the full texture array with nearest-neighbor upsampling. Then per-pixel I'll composite using the lookup table.

Now I'm thinking through whether the shadow reads convincingly — the warm wall gradient plus the soft dark form with a cool penumbra cast should sell it as shadow rather than a hole. I don't think I need an extra contact cue. The spatial spread looks fine since the shadow's brightness gradient covers the wall naturally, and motion spread is localized to the shadow itself while lamp sway affects the whole field slightly. For the temporal estimate, a shadow about 13% of the panel moving at 13 pixels per second over a 2-second window...

Roughly 25-30% of pixels shift significantly (from lit output around 0.35 down to about 0.03), giving a per-pixel standard deviation around 0.15 for those affected pixels. When I average across the whole panel, that's about 0.042 plus the sway contribution — above my 0.030 reference point, but with two bodies moving it improves to around 0.06, which feels right. For strobing, the shadow moving 13 pixels per second at 30fps means only about 0.43 pixels shift per frame, so frame-to-frame mean changes are negligible.

Now I'm setting up the daylight behavior: at night the scene gets deep shadows with warm amber tones and a brighter relative lamp, while during the day skylight fills the shadows (ambient up to 0.34), the hue becomes cooler and paler, and the walls brighten overall. I'm interpolating ambient from 0.05 at night to 0.30 during day, peak brightness from 0.55 to 0.66, hue from warm 0.085 to cooler 0.11, and shadow hue from cool blue 0.60 to 0.55. I'll smooth the daylight input with a low-pass filter using my standard approach.

I'm keeping the input clean with just the clock, then writing the scene setup code that defines the lamp geometry, its distance from the wall, radius for penumbra calculation, mean position, and sway parameters.

Writing scene setup... Writing projection and rasterization logic... The left arm connects from the shoulder to a point determined by the opposite limb parameter, and the right arm mirrors this setup. Legs and arms use opposite parameter pairs, which is correct. The body spans roughly 24.6 units vertically with the center around -1.15, and when rasterizing, I need to apply the direction multiplier to the local x-coordinate while ensuring both capsule endpoints get the direction applied.

Now I'm setting up the shadow rendering loop that iterates through each capsule, computing its projected position and then rasterizing it by calculating the outer and inner radii, determining the span between them, and finding the pixel range to fill. Finishing the line rendering loop... Precomputing squared distances for each row and column to avoid redundant calculations in the composite loop, then iterating through pixels to look up combined distances...

Now I'm working out the lookup table indexing — the scale factor QS converts squared distances into table indices, and I need to ensure Q2MAX covers the maximum possible squared distance across the panel given the lamp's position range, which comes out to around 4625, so setting Q2MAX to 5200 with 1024 table entries gives me the right resolution.

The palette has 256 entries and gets rebuilt whenever hue or saturation parameters change. I'm constructing it by interpolating between shadow and warm hues based on a normalized parameter, then applying a quadratic curve to the brightness to match the perceptual response — this darkens the output since the peak luminance is already around 0.62, bringing the final value down to about 0.38, which matches the intended gamma curve. I'm wondering if this double gamma application is making the shadow-to-wall contrast too pronounced.

For the lighting model, I'm checking how the shadow depth factor affects the final brightness: at night with a shadow depth of 0.95, the shadow becomes essentially black (0.05 times the lit value, then squared to 0.0025), which looks right. During the day with a shadow depth of 0.70, the shadow reaches about 9% of the lit wall brightness after squaring, still quite dark but maybe I should boost the ambient fill strength from 0.42 to get better definition. I'm also layering in lamp flicker using a sine wave plus some noise to create subtle brightness variations, keeping the total modulation under ±0.06, and adding a slow warmth waver to the lamp itself.

For the shadow pass ordering, I need to ensure bodies move strictly forward without stalling, and I'm setting up a system where each pass randomly selects a depth band—either near or far—but with a constraint: only one body can occupy the near band at a time to prevent overlapping giant shadows. I'm checking the other body's current band assignment and forcing this one into the opposite band if needed, otherwise allowing free choice.

Now I'm working through the physics: mapping each band to a shadow speed range, then deriving the body's actual velocity and cadence to ensure the stride length stays proportional to the leg length. For the near band, the math checks out—a stride ratio around 0.38 relative to leg length feels natural. I need to verify the far band calculations work similarly.

Next I'm setting the vertical positioning: the body center sits between the leg base and target height, then the hips offset from there. For the horizontal entry point, I'm calculating how far the shadow extends based on the maximum lateral foot displacement and stride length, then using that to determine where the shadow should start relative to the margin.

Once a leg finishes its cycle, I check if the other leg is still active on the panel — if so, add a brief wait before starting the next pass; otherwise begin immediately. The exit condition triggers when the body's x-coordinate crosses beyond the panel boundary.

I'm setting up the initial state with both bodies crossing through the panel at different positions and directions, randomizing the lamp sway as a noise-driven effect. Since each pass regenerates everything fresh, this creates a clean renewal process.

Writing pose and projection code... Continuing the pose function... Defining limb capsules... Radius scales with the body size and perspective factor. Let me verify the projected heights work out: at close range with smaller scale I get around 39 pixels, and at distance with larger scale about 32 pixels, both matching expectations. The penumbra calculation also checks out. For the near body, I'm computing the torso radius and bounding box dimensions to ensure the geometry fits properly.

Now I'm calculating the total iteration cost by summing up all the body parts—head, limbs, torso—accounting for their radii, lengths, and bounding boxes at both near and far distances. This gives me roughly 2600 iterations per frame, which helps me understand the performance budget. I should also verify how the alpha blending works across overlapping capsule geometry.

For a single body, the union of overlapping capsules creates a clean silhouette with soft penumbra edges where the inner regions stay fully opaque. When two bodies overlap, the max operation merges them into a single dark mass, which is correct. I'm also noticing that the wall near the lamp gets a bright warm glow—around 0.38 in linear terms—which reads as the lamp's light source positioned just out of frame. Now I'm moving into the daylight smoothing logic...

Writing shader code... I need to set up the guard pattern with a started flag so the host calls setup() and my other pieces check it too. Now I'm writing out the full effect file, then I want to verify it works—ideally by running it with Node if available, or porting to Python as a fallback. Let me check if node is accessible first, then I can measure temporal stability metrics over a couple-second window to validate the liveliness.

Computing metrics like mean temporal standard deviation per pixel, frame-to-frame jump magnitude, dark and bright fractions, and dumping a few ASCII frames to visually inspect the silhouette.

---

## Turn 1

I'll set up the effect file in JavaScript and create a mock prelude harness to measure its performance.

---

## Turn 1

I'm setting up the harness to read the effect file and evaluate it in a context where the prelude globals are available, using `new Function` to inject those globals as parameters and return an object containing render, setup, and meta properties.

---

## Turn 1

Now I'm setting up the test harness to run the simulation, compute metrics, and output ASCII frames. I notice a bug in the setup function where the second pass doesn't know about the first body's band assignment, so both could end up as band 0 and be treated as huge objects—I need to fix this by passing the first body's band to the second pass call instead of using -1.

Writing the test harness...

---

## Turn 1

The temporal standard is falling short of my reference threshold, and the wall's brightness never reaches the target. Looking at the peak values in HSV space and converting to RGB, the actual luma comes out around 0.28, which is acceptable but not ideal.

The low standard deviation makes sense now — the shadows are dark shapes moving across a dim wall, so the pixel-level changes are small. Only about a quarter of the pixels get swept, contributing roughly 0.018 to the standard. To push this higher, I need to either brighten the wall to increase contrast between lit and shadow areas, speed up the shadow motion, or increase their size and count. Doubling the wall brightness would roughly double the standard deviation, getting me to around 0.034, and combining that with faster shadow movement might push me toward the 0.045 margin I'm targeting over my reference of 0.030.

Raising the peak luma to 0.85 would compress the curve through the v*v transformation, bringing the output luma to around 0.55, which raises the average brightness to about 0.2 — acceptable compared to similar pieces. But there's a deeper issue: only a quarter of pixels are changing because the lamp sway is too subtle. If the pool itself slid faster across the wall, every pixel would shift, but that conflicts with the slow, drifting quality I want. I'm looking for a structural fix that stays true to the concept.

I could add more people crossing the hallway to sweep more of the wall, though that risks making it feel crowded. Or I could enlarge the shadows and speed them up — making them 45–55 pixels tall and moving at 15 pixels per second would sweep nearly half the panel in two seconds, roughly doubling the variation. Combined with a higher peak luma, that could push the standard deviation up to around 0.05. I'm also wondering whether the flicker itself is helping or just adding noise to the overall effect. I'm testing parameter tweaks with two bodies first, but I'm noticing a spatial issue: the pool is centered at the top, so shadows fall into the lower half where the wall is already dimmer from the edge falloff. That creates poor contrast since the shadowed areas are where the wall is least bright. Moving the lamp closer to the vertical middle might help, though that would spread shadows outward from the center in all directions.

Better approach: position the lamp at around Ly = 24 so the shadow center lands at Yc = 28-40, placing the shadow band directly across the bright pool. This creates a dark body-shaped silhouette cutting through the brightest part of the wall, maximizing both contrast and temporal variation. The vignette from the corner falloff also helps keep the overall brightness moderate while the pool itself stays vivid.

Now I'm reconsidering the depth parameter D. With D = 42 and the pool centered, the maximum distance is about 51 pixels, giving corners at roughly 30% of peak brightness. Smaller D values create steeper falloff—for instance, D = 30 gives much darker corners while D = 26 pushes the effect even further. Since D only controls the light falloff steepness and doesn't directly affect the image through the scaling factor, I can tune it freely to get the vignette I want.

I'm settling on D = 28 and now applying a set of parameter adjustments: repositioning the light source and adjusting the shadow width, tuning the peak brightness curve across day/night, refining the near and far band ranges with their respective brightness scales, adjusting movement speeds for each band, varying the vertical positions, and adding a small flicker effect. Then I'll measure the results and test with three bodies instead of two.

---

## Turn 1

The performance numbers are still concerning, especially that 0.010 case at t=30s which suggests the shadow detection might be hitting a dead zone. I need to add instrumentation to see what's actually happening—tracking the mean occlusion coverage per window and counting active bodies, plus visualizing an ASCII frame to verify the silhouette is being read correctly. The core issue seems to be that the shadow area is quite small relative to the panel size.

I'm working through the math: a 40×25 shadow covers about 1000 pixels (24% of the panel), and at 15 pixels per second it sweeps 30 pixels across a 2-second window, giving maybe 1700 pixels of union area (41%), but each pixel only stays dark for part of that window. The real solution is probably structural—either adding more bodies to create more sweep, making shadows bigger or faster, or brightening the wall itself. Since the current mean luma is 0.12 with only 7% of pixels above 0.35, raising brightness further would just wash everything out. The cleanest approach is adding more traffic with faster speeds—three bodies with one large and two crisp ones would give better contrast and still feel like people passing a lamp, and the performance cost is acceptable.

For the speeds, pushing from 14-22 pixels per second means shadows cross in 4-5 seconds, which actually matches a normal walking pace. The body cadence would be around 0.8 cycles per second, giving about 3 steps per crossing—realistic and more legible. I'll also increase the shadow coverage by making the bodies bigger, up to 0.95 scale with a shadow height around 51 pixels for a softer, more visible mass. Let me test this with three bodies at faster speeds and check the ASCII output to see how legible it actually is.

I'm also thinking about the wall's lighting falloff—right now the corners are too dim and don't carry much visual weight. If I use a gentler falloff, more of the wall stays mid-bright where shadows read better, though the mean brightness would rise. I'll try D=40 with a peak of 0.68 to see if that trades off better. My plan is to run a couple of targeted experiments: one with three bodies and 40% faster speeds, another adding the softer falloff. I'll add the body count as a constant and extend the band logic to handle a third body slot.

Now I need to generalize the band selection for multiple bodies—checking if any other bodies are currently near the band and forcing far if so—and update the wait gating to only pause when at least one other body is active.

---

## Turn 1

The performance is still inconsistent—that one window hit 0.0071, which suggests either all three bodies were waiting simultaneously or only minimal shadows appeared at the dim edge. That's a potential failure case. I need to instrument the code to track how many bodies are active per window and measure coverage, then verify whether the waiting logic actually prevents all bodies from being idle at once—since a body only waits when others are active, but they could finish while it's waiting, creating a gap where everything stalls.

Looking at the frame data, I'm computing coverage by checking the mean luminance and how many pixels fall below 50% of their unoccluded value. For that problematic t=480 window, the mean is 0.126 (the highest across all windows) with only 38% dark pixels—confirming the wall is nearly bare of shadows during that stretch. The fix is to eliminate the wait state entirely and keep bodies in continuous motion, so with three bodies always crossing with random spacing, there should always be roughly three shadows on the wall except during brief transitions.

The crossing cycle is about 6.5 seconds given the body size and margins, so with three bodies at random phases, typically two are on-panel at any time. I could also stagger entry phases by construction to reduce clustering, or boost the per-pixel brightness delta in the shadow band to make the effect more visible.

I'm considering whether to make the near-band shadow much larger—covering 35-45% of the panel would create a massive sweeping mass with higher temporal variance—but that risks blacking out too much of the screen, so I'd keep the height around 45-55 pixels. Now I'm questioning whether my temporal-std reference metric is even the right target, since I measured it on my own Python implementation using the same formula.

Let me try removing the wait state for continuous traffic and test with three bodies first (two far, one near) before adding a fourth, since four overlapping shadows might create visual clutter. I should also generate an ASCII visualization to see how it actually looks.

---

## Turn 1

Looking at the ASCII dump of the pool, I'm seeing a bright radial gradient at the center with rings, but the shadows aren't showing up clearly—the right and bottom-right edges are mostly blank, which might be a falloff effect rather than distinct shadow rendering.

The whole image reads as a smooth, washed-out gradient with mid-tones everywhere, which doesn't match the visual guidance of having dark backgrounds with bright accents. The pool needs a tighter, steeper falloff so the corners go truly black, and the shadow needs to be visible and readable within the pool itself rather than lost in the dim edges.

I'm thinking the lamp position might need adjustment—moving it closer to the wall could create a steeper falloff and a more defined bright pool, though I need to reconsider how that affects the shadow geometry. I should test different pool sizes and peak brightness values to find the right balance—maybe D around 18-26 with peak values between 0.85-0.9 to get that bright, hot core without washing out, then check how the shadow legibility works when it's sized to match the pool dimensions.

---

## Turn 1

The t=900 s5 window keeps performing poorly with minimal coverage, and the overall variability is too high and the values too low. The core problem is that shadows only cover a small area and the wall itself isn't bright enough, so I need to make a bigger structural change. I'm considering adding more bodies to increase coverage and making the shadows themselves the primary light source rather than a secondary effect.

Another approach: give the lamp itself motion—a swinging bulb that genuinely moves back and forth, which would make the entire light pool slide across the wall and cast shadows that sweep dramatically. This creates motion independent of any passing figures and taps into that classic noir image of a swinging overhead light. The challenge is balancing the speed—a faster swing at 0.25 Hz might feel too strobing and contradicts the "speed of patience" aesthetic, so a slower pendulum with a period around 9-13 seconds could work better.

I'm setting up the lamp as a slow pendulum with noise modulation to simulate a cord being gently disturbed, giving the pool about 4 pixels per second of motion across the whole field—enough to guarantee baseline liveliness without relying on whether people happen to walk through. The lamp's vertical position would also sway slightly following the physics of a pendulum's bob rising at the extremes. The shadow effect would be even more pronounced: at a shadow scale of 2.2, the shadows would swing about 11 pixels in the opposite direction of the lamp's 8-pixel amplitude, creating that sweeping effect across the wall.

Implementing the pendulum... The amplitude also varies with noise to simulate the lamp decaying and being gently disturbed, keeping it non-repeating. I'll test this setup with specific parameters and then consider adding a fourth element to the scene.

---

## Turn 1

The baseline metrics are improving, but seed 3 shows concerning drops at t=60 for both night and day cases. I'm realizing this might be a timing issue—when the pendulum swings near its extremes, the velocity drops significantly and bodies cluster sparsely, so a 2-second window captures minimal motion. Since the swing period is around 12 seconds, sampling at certain phases could systematically catch these low-motion moments.

I'm considering a few approaches: speeding up the swing to shorten the dead zones, adding an independent slow drift to the lamp so there's always some baseline motion, or shifting the focus to denser body traffic as the primary liveliness driver with the swing as secondary. I think the best move is combining 4 bodies with a faster swing period around 7 seconds, and possibly increasing the shadow sizes for the far bodies so coverage stays in the 30-40% range and there's always something crossing the pool.

The tight pool naturally culls clutter since only shadows crossing through are visible—those stuck in dark corners disappear. With 4 bodies, that means effectively 2-3 visible at any time, which should feel dynamic without getting messy. The performance cost is manageable at around 5000-6000 pixel visits. I'll speed up the swing slightly and test this configuration.

---

## Turn 1

I'm noticing the shadows in the pool render as dark vertical bands and columns—the penumbra from the limbs blends together into these broad amorphous shapes rather than reading as distinct bodies. This seems to be the intended effect, though I'm questioning whether it actually reads as human figures or just abstract dark regions.

The core issue is that the far shadows—the ones with crisp, legible edges—are too small and often fall outside the pool's boundary, while the pool's own gradient competes for attention. The overall image reads more like a glowing gradient with random dark blobs than actual figures. I'm thinking I need to reshape the pool itself: make it more like a spotlight with a flat bright interior and a sharp falloff at the edges, so silhouettes read clearly against a more uniform background rather than getting lost in the smooth glow.

I'm implementing this by adding a soft radial gate function that multiplies the falloff—essentially clipping the light pool at a defined radius with soft edges, like a lamp shade. This gives me a bright, fairly even interior where figures are legible, then a quick drop to black at the boundary. I'm tuning the pool radius and the falloff curve (using a larger D value for a flatter interior) so the bright area stays moderate and the silhouettes pop against the light field.

The result should be a bold, high-contrast warm disc on black with bodies crossing through it—unmistakable and simple. I'm considering whether a soft edge on the pool boundary reads better as "light from a lamp" rather than a hard geometric circle, and the plaster texture should help sell that effect.

For the shape, a perfect circle is a nice abstraction, but a real lamp would cast an elliptical pool. I could make the gate elliptical instead—wider than tall—by computing a scaled distance metric per pixel using different scale factors for x and y, then applying that same elliptical metric to both the hard boundary and the soft falloff for consistency.

I'm settling on a 1.35 aspect ratio (y-weighted at 1.8) to mimic light from a shade thrown along the wall. For brightness, the pool interior at v≈0.8 becomes luma ~0.5 after squaring, which is bright for amber; with 35% area coverage that averages to ~0.2 luma—bright for this space but LEDs can handle it, and shadows will naturally reduce it. I'll measure the actual mean and keep the peak around 0.72 for night mode. Now I need to think through how the shadow bands interact with the bounded pool, since large near-shadows will often cover most of it.

Let me implement this and measure the results, checking that the far body's silhouette reads clearly against the bright pool. I'm setting up the lookup table with a gate, compositing using an elliptical distance metric where dy gets weighted by 1.8, and ensuring Q2MAX covers the full range—about 5600 should be safe. The gate uses an elliptical radius of 28 horizontally and 21 vertically, giving a pool roughly 56 wide by 42 tall.

Adjusting the gate parameters down slightly to RIN 13 and ROUT 25 gives a 50 by 37 pool, which covers about 36% of the panel—that feels more balanced.

---

## Turn 1

The pool is rendering as a bright blob but much smaller than expected—only about 30 pixels in each dimension. I'm checking the math: the ellipse equation q2e = dx² + 1.8*dy² should give a vertical extent of 38 rows and horizontal of 51, which roughly matches what the debug output shows (40 wide, 33 tall), though it seems positioned higher than intended.

Visually though, the issue is clear: dark vertical bands are cutting through the lit area, making it read as stripes rather than bodies. The shadows are too large relative to the pool—they're 12-20 pixels wide and taller than the pool itself, so they just appear as structureless dark columns instead of readable figures. To actually see a silhouette (head, torso, legs, gaps between limbs), the shadows need to be smaller than the pool dimensions, maybe capped at around 28 pixels tall while the pool is 35 tall and 50 wide.

I'm adjusting the shadow parameters down: the near band should be around 25-31 pixels tall and 14 pixels wide, and the far band around 25 pixels tall. That's small enough to read as actual figures on the lit area. The tradeoff is less shadow coverage and lower contrast, but I can compensate by increasing the number of bodies (already at 4) and raising the peak brightness since the lit area is now smaller and more concentrated. Pushing PK to 0.95 would give an intense amber core that's nearly white-hot.

Alternatively, I could expand the pool itself—making it 60 by 49 pixels instead—so it covers more of the panel and gives the shadows more room to breathe. That would push the mean luminance up to around 0.25, which is brighter than the current 0.2, but it conflicts with the house preference for dark grounds. Since this piece is deliberately inverting that convention, I need to decide whether to keep a clear dark border or commit to the brighter pool.

I'm settling on a middle ground: RIN 15, ROUT 28.5, with a vertical squeeze to 1.55, giving me a 57-by-46-pixel pool. The falloff creates a gentle dome effect rather than a flat interior, peaking around 0.55 luma, which brings the panel mean down to 0.17—dark enough to feel intentional. The shadows will compress to 25–31 pixels tall, which keeps them proportional.

With four figures moving through the scene, roughly 2–3 will occupy the pool at any moment, covering 25–40% of it and creating solid contrast without washing out the legibility. The standard deviation of the flicker should land around 0.05 luma as they sweep across, which feels stable and not distracting.

Now I'll scale down the figure sizes, increase the pool dimensions, and boost the peak brightness, then run measurements to see how it looks.

---

## Turn 1

The standard deviation is holding steady between 0.033-0.054 across all epochs, which gives me a solid margin above the 0.030 threshold and matches my best results. Looking at the mean, dark, and bright values, they're all tracking well within expected ranges. Now examining the legibility in this output — I can see the light pool with darker surrounding areas, and there's a narrow vertical dark band running down around columns 25-28 that extends through the full pool height and widens at the bottom, which appears to be a body artifact.

The left side shows what looks like a smooth gradient falloff from the pool rather than a distinct shape. ASCII rendering with large smooth gradients is hard to parse visually, so I'm thinking about generating PNGs with ImageMagick to see the actual images, but I can't view them directly in this environment. Instead, I should compute quantitative legibility metrics — I could extract just the occlusion/shadow silhouette as ASCII to see the body shape clearly without the gradient noise, though that requires some hackery since occlusion isn't directly exposed as a dumpable field.

The simplest approach: create a variant where the wall is uniformly lit (no falloff, constant brightness) so the rendered image becomes pure silhouette, then dump that as ASCII at a few timesteps to verify the body geometry actually reads as a body shape.

---

## Turn 1

The silhouettes are rendering too narrow—they're appearing as thin vertical bars only 5-6 pixels wide with occasional leg splits, when they should be closer to 8-10 pixels wide to maintain proper proportions relative to their 26-row height.

The math shows the issue: the lamp's penumbra at the current scale is about 2 pixels, which is nearly the same size as the limb radius (~2.1 pixels), so the legs wash out into the shadow instead of reading as distinct features. I'm weighing three fixes—reducing the lamp radius to sharpen the penumbra contrast, increasing the limb radii to make them more prominent, or scaling up the body size overall—each with tradeoffs between gait visibility and the soft shadow effect.

Now I'm checking the actual dimensions: the pool is 57×46, and at different scales the figures range from 29.5 pixels tall (far, crisp) to 37 pixels tall (near, with a larger penumbra), which fits the space. The key is getting the limb-to-penumbra ratio right so the legs stay visible even when scaled up.

I'm settling on RL = 1.9 with a range for the near figure (bs around 0.76–0.90, s around 1.62–2.0) and far figure (bs around 0.86–1.05, s around 1.08–1.32). To make the silhouette read better, I should widen the figure a bit—increase arm swing and leg spread, maybe push the limb radius clamp up to 5. The side view is the right choice for gait clarity, even though it means the body stays narrow.

The math checks out: with the current setup, R comes out to about 4.0, which gives roughly an 11-pixel leg spread—good legibility. The formula R = 1.95 × vb / cadence with vb = 8.4 and cadence ≈ 4.08 confirms this works. The dump at t=12 already shows the leg spread at the bottom of the figure, so that's validating.

I'm noticing the gap between the legs fills in a bit due to the penumbra, but that's fine for the near figure. Also, the figures in the dump extend beyond the pool's vertical bounds (pool is 46 tall, figure is 37), which is expected.

Now I'll apply RL 1.9 with these sizes and re-measure both flat and lit versions. The smaller sizes do weaken the "huge soft mass" effect in the near-band, but legibility takes priority—the softness contrast between 0.4 and 1.7 pixel penumbra still varies by 4x, which should read clearly enough.

---

## Turn 1

The Python patch failed because the pose lines have inline formatting that doesn't match what the script expected, so the assertion triggered and nothing was written—that's why the metrics stayed the same as before. The old parameter dumps I was looking at had RL=2.55, which explains the discrepancy.

Now I need to apply the changes with the correct string patterns and check what the actual lines look like in the file.

---

## Turn 1

Looking at the character dumps more carefully, I can now make out distinct figures: one narrow silhouette spanning columns 28-33 that's about 24 rows tall, and another figure at columns 43-50 with visible arm and leg spread at the bottom rows showing the `%%%` pattern.

The metrics look solid across all conditions—standard deviation ranges from 0.036-0.053, mean values 0.087-0.130, with dark scenes at 0.67-0.79 and bright at 0.08-0.20, all well within acceptable bounds and beating my reference benchmarks. Now I need to verify the actual performance cost by instrumenting the iteration count to make sure the per-frame operations (the occupancy fill, shadow rasterization, and composite loop with setPixel calls) aren't unexpectedly high given the 4 bodies and 8 capsules per body, and I should also visually confirm the lit version looks convincing as a pool scene with figures.

---

## Turn 1

The per-frame performance budget looks solid—just 2385 inner iterations plus some lightweight operations like pixel fills and HSV conversions, which is actually cheaper than my previous lattice pieces. I'm checking how the lit composite looks at different time points.

I want to verify the palette isn't showing banding artifacts and spot-check some RGB values from the pool's center and edges. The elliptical light pool is bounded nicely—at its horizontal radius of 28.5, it spans nearly the full width, so when the lamp swings ±9 pixels the pool edge slides off the panel edges, which reads as light spilling rather than a floating disc. Vertically it sits from the top edge down to about y=47, creating that sense of overhead illumination. Let me view the lit output at a couple of key moments.

---

## Turn 1

The silhouettes are taking shape — two dark figures against a warm elliptical light pool, one with a clear head and torso around columns 25-33, the other narrower at 36-40, both showing leg gaps that suggest walking poses. The geometry reads as proper walker silhouettes, though whether they truly register as people depends on the animation. I'm noticing the pool's aspect ratio might need adjustment...

Looking at the ASCII gradient rings, that's just how the smooth gradient quantizes across the character set — totally expected. The proportions check out too: the figures are about 5-7 pixels wide at the torso and 25 pixels tall, which matches the real human shoulder-to-height ratio. But I want to strengthen the silhouette reading by refining the head and neck — right now the head capsule is actually narrower than the torso, creating a bottle shape instead of the distinct head-and-shoulders profile you see in real shadows. I'm thinking of adjusting the torso radius and repositioning the head higher with a subtle gap to create a neck notch that reads even through the penumbra. I'll go ahead with this small adjustment to the head positioning and move through the remaining checks: verifying the soft figure compositing looks right, confirming the default daylight case works as expected, and testing that the swept clock transitions smoothly without strobing as the daylight value changes rapidly.

---

## Turn 1

Most windows are hitting the 0.045-0.075 range, but seed 9 at t=60 is a problem case—it's dropping to 0.023 on day 0 and 0.029 on day 1, both below my 0.030 threshold. This looks like a configuration where all four bodies happen to be positioned or moving in a way that keeps their shadows off the pool simultaneously. I need to dig into seed 9 at t=60 specifically and examine the frame-by-frame coverage to understand what's causing this outlier.

---

## Turn 1

At seed 9 with t=60, there's only one narrow shadow visible along the pool's right edge, covering about 550 pixels of penumbra—essentially just one figure crossing through. The issue is that I need more bodies reliably positioned inside the pool rather than this sparse coverage, so I'm considering increasing the population count as a first option.

I'm going to try bumping the body count to 5 or 6 (the computational cost is manageable, going from 2400 to 3600 iterations), which should typically keep 3 figures on the pool at once. Since shadows outside the pool are invisible anyway, the effective count self-limits. I'm also tightening the entry and exit margins so bodies spend more time on-panel—reducing the margin from about 20 pixels to around 11-12 based on the actual shadow half-width calculations—which pushes the duty cycle from 62% to 73%. Additionally, I'm biasing the vertical center position to keep bodies more centered on the pool itself rather than spread across the full range. Let me test all three changes together on the worst-case seeds to see if this improves coverage.

---

## Turn 1

All the window measurements are coming in well above my reference points, with the worst case at 0.043 — the mean values range from 0.09 to 0.14 depending on lighting conditions, and I'm seeing a max jitter of 0.0055. I need to verify the iteration count is around 3000 with 5 bodies and do a final visual check to make sure everything looks right.

---

## Turn 1

I'm noticing a critical issue with the shadow visibility — at t=30 with seed 3, the pool appears completely bare with no shadows at all, which contradicts the high standard deviation values I'm seeing. The shadows that do appear at other timestamps like t=8 and t=121 are clustered at the edges rather than distributed across the pool, suggesting the piece isn't maintaining consistent contact with the surface as it should.

I suspect there's a coordinate transformation bug where the lamp's swing affects how body positions are calculated. Since the lamp position Lx swings left and right, and body positions depend on this offset, the bodies might be moving in the opposite direction than expected. At t=30 specifically, the pool is centered left of where it should be, yet all five bodies seem to vanish — which shouldn't happen statistically. I need to print out the actual body states (their X and Y coordinates and which band they're in) at that moment to see if they're all somehow positioned off-panel or if the Y-coordinate calculation is broken due to the lamp's vertical swing affecting how positions are computed relative to the changing lamp height.

---

## Turn 1

At t=30, the bodies have clustered toward the right edge of the simulation space—most are off-panel except for b2 which sits at the boundary. This clustering happens because bodies moving at similar speeds re-enter from opposite edges in sync, creating a synchronization effect where they bunch up together.

The root issue is that when a body exits the right side and randomly re-rolls its direction, if it picks dir=-1 it re-enters immediately from the same spot it just left, causing bodies to linger on one side and amplify the bunching. I'm considering fixes like spreading bodies by construction—either by choosing entry sides based on crowding, or by offsetting each body's entry timing, though the latter risks popping shadows mid-pool which looks wrong. The better approach might be to choose the direction strategically so bodies enter from less crowded sides.

Implementing a solution that counts active bodies on each half of the pool and prefers entering from the emptier side, combined with a separation check at entry that pushes the body further back if it's too close to others moving the same direction—this should naturally de-cluster them. I'll code this up with a loop allowing up to 3 pushes to enforce minimum spacing.

Implementing the newPass function... Now I need to verify that the distribution actually works by tracking how many bodies are positioned within the pool region over time, checking both the average and minimum values across sliding windows to ensure consistent coverage.

---

## Turn 1

The dbg output is stale, so I need to regenerate it and check the distribution of shadow centers on the pool. I'm also going to dump images at various points to verify the bodies are positioned correctly. Additionally, I want to track over a 300-second run how many frames have shadow centers within the pool bounds, and report what fraction show zero centers.

---

## Turn 1

The pool occupancy is looking solid—typically 2-3 bodies with bare stretches under 2.6 seconds, so it's well-populated without feeling crowded. Now I'm doing a final visual check at a few key time points and comparing how shadows render at different distances, then I'll clean up the code and write out the rationale before finalizing.

---

## Turn 1

I need to clean up some code issues: there's a stray comment on the SWING_R constant that should be removed, and the `wait` state and `st` field are no longer being used since `st` is always 0 now. I can simplify by removing both the wait field and the st===1 branch entirely, though I'll need to adjust the crowding checks in the newPass loops that currently reference `st`.

The `band` field in the initial body object is set to `i` but gets overwritten immediately by newPass anyway, so I should just initialize it to 1. I also need to fix a comment that says "two crossings" when it should say "five," and verify the Q2MAX coverage calculations work out—the max dx and dy values stay well under the 6400 limit. The variable names like `bx2` and `pi` don't shadow anything problematic, and I should remove the unused `wait` variable entirely.

One more thing to check: whether the soft shadow effect ever looks too faint, but the math checks out—the limb radius is large enough compared to the shadow parameter.

Now I'm reviewing the piece's metadata and lineage. The title "Between the Lamp and the Wall" works well, and the conceptual lineage is solid: it inverts the light-on-dark polarity from Passerby, and like The Grain Remembers, the subject isn't drawn directly but the medium responds to it. I'm reconsidering whether Casey Reas is really a strong influence here—the connection feels thin.  The work is fundamentally Campbell's approach: threshold, diffusion, silhouette, Day for Night. While there's a process-statement quality to how I've written the rationale, that's not enough to justify listing Reas. I'll pare the influences down to just jim-campbell for honesty and clarity, and update the frontmatter accordingly.

Now I need to finalize the piece: five walkers crossing, the shaded lamp's pool, pendulum drift, penumbra physics, and the interplay of night and day. I'll refresh the rationale to capture that, touch on the position mechanics (subtraction versus addition) and the claim that legibility emerges from depth. The header comment needs updating too—it currently references two bodies and 2600 iterations, but the final version has five crossings and roughly 3400 measured iterations. Let me rewrite the whole file cleanly with the corrected frontmatter and implementation.

---

## Turn 1

The measurements are holding up consistently across the final version. I need to verify the validator handles edge cases like neutral daylight values and all-neutral states, plus confirm there's no crash on the first render before setup completes. The `bodies` array grows during setup, so I should trace through what happens if setup gets called multiple times—my guard prevents duplicate calls by setting a flag, but I want to make sure the host's setup call and my internal guard don't conflict.

Now I'm documenting my findings in the knowledge base. I've identified two key discoveries: the subtraction/inverted polarity as a new register position, and the craft insight about penumbra physics as a legibility control with the shadow-caster occupancy pattern. I'll consolidate both into a single knowledge update under the Jim Campbell artist notes, written in my established style, then submit.
