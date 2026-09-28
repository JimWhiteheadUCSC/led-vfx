# Thinking log — Someone Else Going Home

4f1bc119-54e4-4def-9b24-336dc17f86d6, committed 2026-09-25

## Turn 1

Since the Wake draft only has one piece after it so far, ratification isn't possible yet — I need five more before that's viable, still signing as Saccade. For the next piece, I'm drawn to the house-at-night thread and thinking about drawing the medium itself rather than the subject, recalling the Two Hands note about a bird not meant for reading, its neck and beak elongated.

I'm weighing other candidates too — the lamp note about a body stopping in a pool of light so its shadow resolves into a legible silhouette, two lamps producing overlapping penumbras, and a vessel with a gap catching two light sources. I also toy with rain on glass acting like lenses, but that feels too close to the pinhole logic of "Each One the Sun." A more promising idea is TV glow flickering on a wall in another room, where you infer the unseen program from shifting color and rhythm — very much in the house-at-night vein, though I'll need to watch for strobing risk from scene cuts causing brightness jumps.

Then the strongest one lands: car headlights sweeping across a bedroom ceiling, where the window's light patch (striped by blinds) distorts and travels as the car passes, letting you infer direction and speed from the projection geometry. It's the inverse of the lamp piece — there the source is fixed and occluders move, here the occluder is fixed and the source moves — and it sits nicely in the lineage of window-projection pieces like Each One the Sun.

But I worry about dead time between cars leaving the ceiling dark and lifeless, so I'm considering layering in a constant dim streetlight patch (sodium orange, with blind stripes) as a baseline, with the brighter white headlight sweeps happening every few seconds atop it — though at quiet hours like 3am the gaps between cars would still risk feeling inert.

I need to decide how the harness's day-cycle affects traffic density, keeping a minimum sweep rate (gaps under ~5s) even during nighttime hours to avoid failing the liveliness check. On geometry, I'm working out whether the panel represents a ceiling or a wall — since it's wall-hung, it probably depicts the wall facing the window rather than a true ceiling view.

Now I'm modeling the physics of headlights from cars below the window sweeping across the surface: treating the panel as the ceiling plane, with the moving light source below projecting through the window aperture. For each ceiling point, I trace a ray back through the source to find where it crosses the window plane, giving a perspective-projected patch shape that moves as the car travels along the street.

Working out the projection through the window aperture, I find the vertical extent of the lit ceiling band stays fixed since it depends only on source height, while horizontally the patch sweeps and keystones as the car moves — explaining why the light band travels sideways across the ceiling with blind slats creating fixed horizontal stripes across that fixed depth band.

Vertical mullions add another effect: since the mullion projects to a line whose ceiling depth varies with sideways position, this creates tilted converging lines that fan out when the car is off-center and go straight when centered — the classic sweeping, skewing headlight trapezoid. I'm now setting up the coordinate mapping so ceiling pixels correspond to positions along the window wall for rendering this panel.

Two headlights spaced apart would create two overlapping, slightly offset patches — echoing that doubled-image idea from my earlier lamp note. For brightness, I'm reasoning that since headlights point forward along the street rather than sideways, the light entering the window is really beam side-spill, so the intensity envelope should peak as the car approaches from a distance rather than when it's directly alongside.

That naturally leads to a nice effect: a bright white sweep as the car approaches, then after it passes, a dimmer red sweep from the tail lights follows — and cars in different lanes (different x-positions) would have different sweep speeds and patch scales depending on direction. I also want to account for finite source size causing a soft penumbra edge, scaling the smoothstep width by headlight radius and perspective factor.

I'm also thinking about adding horizontal blinds that create striped shadows on the ceiling, mapping window height to ceiling depth through the perspective projection, plus a fixed dim streetlight patch as a secondary, stationary light source for variety.

For the clock-driven traffic, I'm deciding that hour of day should mainly govern car frequency—busy at rush hour, sparse at 3am, moderate at noon—rather than trying to simulate actual daylight, since the piece is meant to depict "the house at night" regardless of the literal hour.

Daylight input will instead lift the ambient ceiling level slightly and soften contrast, similar to the lamp piece's behavior. For liveliness, the headlight sweeps moving across the full ceiling width should give good temporal variance, though I want intensity to ramp gradually with distance rather than flash on instantly, keeping frame-to-frame changes smooth. I'm modeling cars as a renewal process with varying lane, direction, speed, and headlight height—including trucks with different light heights so their beam patches shift position on the ceiling.

Working through the geometry, a truck's higher lights place its patch nearer the window wall, while a bicycle contributes just a single dim, slow-moving light. I'm deriving how the patch position on the ceiling scales with car speed based on the perspective projection ratio between street distance and lateral position, finding the patch moves at roughly an eighth to a half of the vehicle's actual speed depending on lane distance.

Now I'm modeling the shearing effect where the far side of the patch moves faster, giving the classic swinging motion, and estimating crossing times of a few seconds. For intensity, I'm setting up a headlight beam model that combines inverse-square falloff with an angular beam profile, computing the angle between the car's heading and the line to the window to determine how much light spills toward the viewer.

With tail lights, I want them dim and red with a wider spill pattern, so the patch brightens as the car approaches within its forward beam, peaks around a 45° angle, and then dims again as the red tail lights sweep the patch to the opposite side after passing.

Now I'm thinking about the color palette—cool white LEDs or warm halogen headlights (randomized per car), amber sodium streetlight, and red taillights—keeping it constrained to just those related hues. For the window itself, I'll add a central mullion dividing two panes plus half-open horizontal blinds, and figure out how the blind slat shadows stretch and project onto the ceiling based on the geometry.

Deciding between blinds and a sash window design, I lean toward blinds with roughly six slats since that striated look is the classic noir bedroom-at-night image. For rendering efficiency, since the slat mask only depends on row position, I can compute the light contribution per row rather than per pixel, factoring in each active headlight and the streetlight along with penumbra softening.

For ceiling brightness, I want to include distance falloff and incidence angle from the window to each ceiling point, but I can approximate this using row and column position rather than full per-pixel distance calculations to keep things cheap.

For tone mapping, I'm considering accumulating light into float RGB buffers then applying a simple exponential tone curve, but since per-pixel exp calls for three channels could get expensive, I'll use a quantized lookup table instead. For soft edges on window bounds and mullions, I'll compute a clamped smoothstep value inline per pixel, and I still need to work out how source radius affects penumbra softness.

Working through the math, moving the source by some displacement δ shifts the window intersection point by δ(1-u), so with a headlight lens radius around 0.09m and u≈0.7, the penumbra half-width comes out to roughly 3cm — smaller than a ceiling pixel's footprint in window coordinates, meaning the softening will mostly show up through pixel-level antialiasing rather than an explicit penumbra calculation.

I'm setting softness as the max of the geometric penumbra width and a fraction of pixel size in window coordinates, which handles the sub-pixel case cleanly. Two headlights spaced 1.5m apart would then produce two offset patches on the ceiling, shifted by roughly 3-12 pixels depending on distance, giving that authentic doubled, sheared headlight pattern with a brighter overlap zone where they intersect. Now I'm thinking about the streetlight case, considering its height relative to the window and ceiling to figure out whether the light source sits above or below the window's field of view.

Since a streetlight positioned high would send light downward onto the floor rather than the ceiling, that geometry doesn't work for a ceiling patch — I need the source to be positioned so its rays angle upward toward the ceiling instead. I'm settling on a simpler alternative: a dim, fixed porch light across the street at a low height, casting a steady amber patch rather than a moving one, since that avoids the awkward streetlight geometry entirely.

That fixed dim patch actually helps legibility — it establishes the window shape so viewers can tell each passing car's bright sweep belongs to the same window. Now I'm working out the ceiling panel's coordinate bounds and orientation, deciding where the window wall should sit relative to the viewer looking up from bed.

For traffic, I'm thinking through a Poisson-style arrival model with a minimum gap and a cap of about three cars at once, tying arrival rate to hour of day so it peaks in the evening and bottoms out around 4am, while making sure the static patch keeps things visually alive even during sparse stretches.

I'm now sketching the actual scene geometry in meters -- placing the window wall, ceiling height, window bounds, and street distance so the headlight sweep angles will feel physically plausible.

Working through the ray tracing math, headlights lower on the road cast light through the window onto surfaces far beyond the ceiling given the height and distance ratios, meaning that portion actually hits the far wall rather than the ceiling, while only a limited horizontal range of source positions actually paints the ceiling patch.

The mullion creates a dark tilted line, and the patch's boundary depends on lane distance—near lane versus far lane gives different starting positions for the lit band based on the geometry between truck height, window position, and ceiling depth.

Checking the static porch light case: it sits far across the road with a low mounting height, so its illuminated patch also gets shifted based on its y-offset. I'm establishing the panel coordinate mapping now—translating pixel row to depth position and pixel column to lateral offset using linear interpolation with a fixed scale factor.

With that mapping set, I work out how the illuminated patch's width and center shift as headlight offset and vehicle distance change. The patch width comes out to roughly half the panel, and dual headlights spread the union wider by several pixels. Tracking the patch center position tells me the car stays visible on the panel only while within about six meters of the window, giving a visibility window of roughly a second or so at typical speeds.

Slowing the vehicle to a residential pace stretches that visible passage to about 1.5-3 seconds with a natural intensity ramp, and with cars passing every few seconds the ceiling stays mostly dark except for the static patch, which should keep things lively without risking rapid full-frame flashing.

Now I'm working out the headlight geometry as a car approaches — since beams are weak off-axis, I want a wide falloff curve so there's still some spill light near closest approach, dimming to a faint glow right as the car passes before switching to a red tail-light glow afterward.

For the direction, since the car moves in +y, the light patch itself should drift in -y, entering bright from one side, fading through center, and exiting as a dim red tail on the other side — a clean, readable asymmetric sweep.

I'm also thinking about adding some vehicle variety beyond just cars — maybe a bicycle with a single small light moving slowly, or a motorcycle with one headlight, to break up the repetition.

Now I'm working out speed variation across vehicles (roughly 6-11 m/s) and lane direction logic where near and far lanes travel opposite ways, then setting up an intensity falloff based on distance from the light source to the camera, combined with the beam shape factor.

For tone mapping I want the exposure to peak near white right where the headlight overlaps the frame. I'm setting the static porch light to a dim amber value, keeping the room ambient a faint blue, and having daylight brighten the ambient toward grey-blue while making headlights fade in visibility as it gets lighter -- so I need a night-ness factor that scales with the daylight parameter, making sure it behaves reasonably at the neutral midpoint since that's what most evaluation will look at.

I'm keeping the ambient fill effect subtle with a squared daylight curve, and computing headlight penumbra softness by combining the geometric falloff with pixel-level anti-aliasing based on projected ceiling offset. I'm also working out mullion width and blind slat spacing to figure out how many slats would actually appear given the visible window height, and how their shadow stripes would fall across the ceiling.

Now I'm computing how the slat pitch translates into pixel spacing on the ceiling at different camera distances, confirming the projected bands stay bold enough to read visually. I'm also considering adding a faint draught-driven sway to the blind shadows -- a subtle phase noise offset to the slat pattern so the static stripes shiver slightly between passing cars, mimicking real blinds rattling.

Turning to the title, I like the truth embedded in the piece: the ceiling patch always sweeps opposite to the car's actual direction. That inversion feels like the emotional core, so "Every Car the Other Way" captures it well.

I'm settling on "Someone Else Going Home" instead — it centers the unseen drivers rather than the physics, giving it a quieter, more melancholic domestic feel. This connects it to the earlier "Each One the Sun" piece (window patch shifting from day to night) and contrasts with "Between the Lamp and the Wall."

Now I'm setting up the code structure with metadata and the ceiling/window/mullion dimensions to build the fixed room geometry that the light source will travel across.

Modeling the light sources next: a fixed porch light plus cars with headlights and taillights, each defined by position, depth, and color intensity. For each row I'm computing perspective projection and blending in the slat mask so light passing through the blinds fades softly at the edges rather than cutting sharply.

Still deriving mask math...

I'm now reconsidering car lamp geometry — headlights are actually spaced across the car's width in the direction toward/away from the house, not along the direction of travel, so I need to rework how I position the two lamps relative to the street axis.

Stripe phase from each headlight will shift with distance too, and overlapping the two slightly-offset slat patterns could just wash into mush rather than crisp bars. I might get away with treating both headlights honestly and checking if it looks muddy, falling back to a single effective source or fewer slats if needed — I can't tune slat pitch to match every car's spacing anyway.

Actually, I think dropping blinds entirely for a Georgian sash window with glazing bars is cleaner: vertical bars at wy = ±0.2 would cast dramatic shearing fan lines as the car passes, doubled by the two headlights into a nice penumbra effect, plus a horizontal bar near the top since only the upper portion of the window reaches ceiling height.

I need to check bar thickness though — at 0.02m half-width the projected bars only come out to about a pixel wide on the ceiling, way too thin to read. Bumping to 0.045m half-width gets me roughly 2-3px, giving that chunky old-sash look I want.

For the porch, I'm placing a static warm amber light down the road, treating it like a distant streetlight rather than flickering. For the car, I'm computing the headlight beam intensity based on the angle between the car's heading and the vector toward the window, using a smoothstep falloff so the beam brightens sharply when pointed at the window.

I'm mirroring this for taillights with a red color and inverted angle logic, positioning them at the rear of the car with a similar paired-lamp offset. With up to three cars each having four lamps plus the porch light, I'm estimating the total pixel operations to make sure the rendering stays fast enough per frame.

Given Pi performance, I want to cull lamps with negligible intensity, skip rows outside the relevant vertical band, and limit pixel range to the patch width so the real cost stays closer to a handful of milliseconds rather than the worst case.

For tone mapping, I'll build a lookup table mapping accumulated light to output brightness using an exponential falloff with a gamma-like exponent, applied per channel, plus a small cool ambient tint layered on top for atmosphere.

Now I'm designing the traffic spawner: randomizing lane, direction, position, speed, and vehicle type (car, truck, bike) with different sizes and brightness, spawning off-screen and despawning past the far edge, with spawn rate varying by time of day.

I'm worried about the still moments between sweeps feeling dead, so I want to add subtle life to the static patches — maybe a swaying branch shadow, denser traffic at midday, distant faint sweeps on a far road, or a curtain edge drifting slightly in a draft to keep everything gently alive.

Going with the curtain idea: it occludes part of the patch based on a wavy edge that shifts slowly over time and slightly by row, giving one side of the window a cheap constant motion. Now I'm starting to write the actual rendering code.

Building the tone mapping curve...

Working out the falloff factor from the vertical mask combined with squared distance, then deriving the horizontal projection range for px by solving the perspective mapping into linear coefficients A and B, clamping to the valid column range, and noting the curtain edge depends on row-specific wz values.

Finishing the accumulation loop, then thinking through how the porch light's curtain masking and beam intensity should scale with distance and viewing angle, checking numbers at a few sample positions to see if the falloff feels right.

I realize the beam patch actually brightens near the panel's edge rather than its center, so the "sweep" will visually read more like a flare near the edge as it moves rather than a uniform glow, and I need to account for that in the intensity formula and tune K empirically in preview.

Checking the far end of the sweep, the patch stays visible but dims as it moves away, and I'm working out the geometry of where the band actually falls within the window rows given the panel's start and rail positions.

Checking trucks at the far lane: the geometry means they'd only show the top pane row, appearing large. Then for the porch across the road, computing its position shows it lands in the top rows of the panel as a static patch, though I want that fixed patch to better convey the window shape.

I'm checking motion speed realism—at residential speeds around 25 km/h, the sweep across the far row works out to roughly 3 px/frame, which is soft enough to avoid strobing artifacts. I'm considering adding a slight temporal blend with the previous frame (~0.35 weight) to simulate motion blur naturally.

Then I'm calculating visible duration: a patch near mid-distance stays in the visible field for only about 1.6 seconds at 7 m/s, which seems short but is realistic given the panel's field of view and patch width.

I want to add a rare, special event that matches the theme better: a car pulling up and stopping, like someone arriving home, with its headlights idling briefly then switching off. This "someone going home" moment could happen maybe 8% of the time, with the car decelerating to a stop near the window, holding still for several seconds, then fading its lights out.

I could also implement the reverse—a parked car with lights off that comes alive, fades its lights on, waits a moment, then pulls away. I'd alternate between a parked and departing state, spacing these events roughly every 6-10 cars, so occasionally there's a lovely quiet moment of a stationary lit patch fading to dark, or the reverse, amid the regular flow of passing traffic.

Setting up the car objects and spawn logic...

After idling, lights fade off and the car becomes a parked object; departing reverses this with a warm-up light phase before accelerating away. I'm smoothing lights toward target values, brightening tail lights during braking, keeping stop positions near the house window, and removing cars once they drive far enough off-screen, plus setting up spawn timing.

Now I'm capping active moving cars to four, tying spawn rate to the raw clock hour, and blending ambient daylight into the render. I'm positioning headlight and taillight pairs offset from each car's center with reduced intensity per lamp, and setting up red tail lamp intensity.

I'm working out rough brightness constants for headlights, taillights, and porch lights by estimating desired luminance targets and back-solving for the intensity coefficients, plus adding a single dimmer lamp setup for bikes.

Checking that tone curves and ambient falloff produce sensible exposure values across the different light levels, then moving into the curtain rendering, computing per-row color values using layered noise and sine terms for subtle animated texture.

To keep it efficient, I decide to precompute the curtain profile on a small lookup table over the wz range rather than recomputing noise per-lamp-per-row, since that would be too many noise calls. I also confirm the curtain only affects one side of the window and settle on using the same soft-shadow approach as elsewhere.

Now I'm starting to write the actual JS implementation, defining the room geometry constants (wall height, window dimensions, bars, rail) and setting up the metadata for the animation.

Writing lamp rendering logic...

Still computing pixel range and curtain interpolation...

Finishing that curtain-glow loop, I move on to headlight beam angle math and car spawning logic, pre-seeding a car near the opening so it doesn't feel empty. I also work out an hourly traffic rate curve using a cosine function so cars are sparse late at night and busier in the evening.

I'm designing arrival and departure probabilities for parked cars, along with their lighting behavior when stopping or leaving, then sketching the car object's fields and its drive/idle/lights-off states.

Now I'm working through the mode transitions: braking to a smooth stop with headlight decay when parking, then a timed pause before lights fade off entirely, and on the reverse side, lights coming on and accelerating back into traffic once departing.

Cars advance position each frame and get removed once far enough off-screen. For rendering, I'm computing headlight beam intensity based on distance and viewing angle, using a smoothstep falloff so the beam brightens as it points toward the camera, then applying that intensity to each lamp position.

Similarly for taillights, I'm computing a brightness factor that boosts intensity during braking, then drawing tail lamps offset behind the car body with a slightly reddish-orange color. Bikes get their own smaller size and lower light intensity constants compared to cars and trucks.

Now I'm setting up an early-exit threshold for the lamp function so negligible contributions get skipped, blending in ambient light that scales with a squared daylight factor for a more natural transition, then converting the accumulated light into a final tone-mapped RGB pixel written through setPixel. I'm also weighing whether that per-pixel write approach will hold up performance-wise once I scale up the number of lamps.



---

## Turn 1

I'll need to call the tool directly and paste the source text as the parameter itself.



---

## Turn 2

This looks promising. The porch patch with its amber three-pane band reads well as glazing bars, though it may be a touch too bright, and it's positioned mostly in the upper rows. The headlight sweeps appear as quick wedges in the bottom-right corner, staying confined to the upper part of the panel.

To fill more of the frame, I'll shift CX0 down to around 1.1 and extend CX1 to 5.0 to account for room depth. I'll also dial back the porch amber to about 70% brightness while keeping the LED car light bright white and the faint tail-light red. For a better preview of car speeds and the arrival event, I want to temporarily force the arrival probability to 1 and check frames around t=20.



---

## Turn 2

That's strange - the file didn't persist even though bash created it and confirmed with "ok", and python had read it successfully before. Maybe bash and python are running in different containers, or /tmp got cleared somehow. Let me check with python again.



---

## Turn 2

Since the filesystem isn't reliable, I'll keep the source in mind and paste it directly. For a preview with a forced arrival, I'll set probability to 1 and make the first car an arriving one, letting me check the stopped patch and switch-off timing at t=6 — which seems like a good approach to carry into the final piece too.



---

## Turn 3

I notice the stopped car's headlight patch overlaps the porch light area since they're in the same spot, and it's dim but visible while switched off; the red brake light smudge on the right is sparse and blurry but reads fine. There's an issue with the lit element I still need to address.

The lit band only fills the upper two-thirds of the panel, leaving the bottom dark since that region corresponds to near-camera distances where the wall above the window shadows things — physically correct but visually top-heavy. I'm considering raising the window top height so the band extends further down and fills more of the panel, though I need to check how that shifts the porch light's starting position too.

I'm weighing whether the porch patch now covers too much of the panel in amber — maybe I should shrink or dim it to around 20% intensity so it reads as a faint accent rather than dominating. Alternatively, I could leave the window geometry as is and instead shift the camera's horizontal range to compress the far ceiling more, changing where the shear in perspective occurs.

I'm satisfied the motion blur sweeps look fine in preview and that the resting car patch, arrival spill beam, and brake lights all work well together. I'm also checking liveliness gaps at neutral hours and confirming the curtain and porch stripes remain visible enough despite being subtle, then considering adding slight persistence for smoother perception.

I'll skip the persistence tweak for now and check daylight budget later, then finalize the piece with frontmatter, the CX0 adjustment, and a preview at t=40 before submitting under the title "Someone Else Going Home" with its accompanying rationale.



---

## Turn 4

The light now fills the height nicely, reading like window light on the ceiling, with headlight wedges sweeping in fast from the right corner. The porch patch feels a bit dominant on the left, so I'm considering dimming it slightly to around 0.8x while keeping it as the grounding fixed element.

Now I'm finalizing the piece: arrive/park/depart logic from version one, CX0 1.45 changes, frontmatter, porch intensity at 60. For the rationale, I'm framing this as a variation on Each One the Sun — there the source was fixed and the medium moved, here the aperture is fixed and the light source travels — and contrasting it with Between the Lamp and the Wall, where nothing moves in this room at all; the subject is entirely outside, only its thrown light crossing backwards. I'm also thinking about where to log this in the knowledge base, maybe a dossier note and a new craft file on projection.

I'll create a new craft file, "light-through-apertures.md," documenting this aperture-projection technique across the three pieces, plus a status note in saccade.md tracking that this is only the first piece after the draft toward a set of five. Then I'll write the final source.



---

## Turn 5

It passed, but there's a frame budget warning—mean 27ms, 83% over on the dev machine, which worries me for the Pi given how the per-pixel lamp walks cost more than estimated. Since the piece is already committed, I should just report this honestly, including that the 10s sheet shows a busy moment with overlapping cars.


