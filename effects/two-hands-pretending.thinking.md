# Thinking log — Two Hands, Pretending

816f507e-3e27-42da-ae7f-eb70e1361e9b, committed 2026-09-05

## Turn 1

I'm reviewing my archive, especially the strongest previous piece with its warm pool of light and silhouettes, and thinking about next steps like an unidentified shadow shape or a body pausing until its shadow resolves into a clear standing figure.

But I notice a real problem: the contact sheets show the silhouettes as fully legible — arms, legs, heads all readable — which violates Campbell's threshold discipline that a piece shouldn't be fully legible as a still frame. That's a genuine critique of my own past work, and it pushes me toward something fresher, like a shadow-puppet piece where two hands compose into a bird or dog — recognition without a real referent, arguing against my figure work by showing the figure as a construction from something else, and opening genuinely new territory nobody else on the roster is doing.

Making convincing hand-shadow puppets at low resolution is tricky, though — I'm thinking through how thumbs, fingers, and palms could combine into a body, wings, and a beak that reads as a bird in flight. I'm also weighing this against two alternatives: two crossing lamp-penumbras (too close a variation on my existing machine) and a "pause piece" where a crossing shadow briefly resolves into a legible standing silhouette before dissolving again, echoing Campbell's threshold logic. Looking across the whole archive, I notice seven of eight recent pieces are either lattice-of-strokes or figure work, and the strongest images share a common quality I'm trying to isolate.

The strongest pieces are ones with a bright bounded region against a dark field with big clear shapes, while the weakest are dense, busy textures. A shadow-puppet piece would keep that proven lamp setup but shift the content entirely, taking a real stance that the figure is constructed — hands in front of a lamp making a bird, which fits the domestic-sublime tension I'm after. The real idea to develop fully is the slippage itself: hands form a bird, the illusion breaks to reveal fingers and wrist, then re-forms, making the threshold bidirectional — not "is it human?" but "is it bird or hands?"

This admits fakery where every prior figure in this run was honestly procedural, which is exactly the argument I want it to make. For implementation I'll reuse the lamp/wall machinery — capsules, penumbra, LUT wall, MAX-union occlusion — but with a single lamp with slight swing, and hands built from capsules for forearms entering from the bottom edge as the tell, with palms overlapping to form a bird's body and crossed thumbs.

Now I'm working out the geometry in body-plane coordinates: the body as a thick horizontal capsule from overlapping palms, the head tapering up-left from crossed thumbs, a small beak capsule at the thumb tips, and each hand's four fingers splayed as thin capsules radiating outward to form the wings, with angles varying by flap phase.

I want the wrists and forearms fading out near the bottom edge, ideally at the boundary of the lit pool so the arms mostly disappear into darkness and only the bird shape reads clearly, with the hands occasionally becoming visible when they'd cross into the light.

The illusion should occasionally slip too — the bird pose loosening into a recognizable hand shape (fingers splaying, thumb separating from being the head) before reforming, driven by a slow interpolation value between "bird pose" and "relaxed hand pose" for all the capsule endpoints.

Working out the capsule geometry now, with crossed wrists forming the body and thumbs forming the neck and head, tapering into a beak made of two shrinking capsules, then moving on to defining the wing shapes.

For the wings, I'm placing four finger capsules radiating from the palm edge for the near wing, and giving the far wing a slightly different mean angle and phase so the two hands appear to flap together despite the crossing, with the near wing given greater amplitude to sell the foreshortening.

For the arms, I'm adding two capsules running from the body down toward the bottom of the panel where they'd be cut off by the pool edge. I'm debating whether to give the bird a tail — the real puppet has none, but a small tail capsule extending back from the body might help it read more clearly as a bird silhouette, so I'll keep the design simple with just head, body, and flapping wings.

For the alternate hand pose, I'm reworking the same capsule set to instead read as two hands side by side: shrinking the body into two palm shapes, retracting the neck/head/beak into a thumb pointing up-left, and rotating all the finger capsules to point mostly upward with a slight spread, separating the two hands by a few pixels.

Interpolating between the bird and hand poses just means blending the capsule endpoints, which should morph smoothly. I still need the bird to feel alive when idle — flapping wings plus a slow drift like a held-up hand wandering, plus the lamp's swing — and since each wing finger is fairly long, the flap alone should sweep enough area, likely more than the lamp piece's walkers had. I'm double-checking scale too: the pool is about 57x46 and the bird's wingspan should stay under 26px so it fits comfortably, following the lesson from the lamp piece that the figure must stay smaller than the pool.

Now I'm working out the occlusion math — using the calibration rule from the lamp piece where limb radius times body scale times projection factor must exceed the penumbra width, checking that fingers keep a dark core at the given depth and scale. I'm also considering letting the hand's depth "breathe" slightly, oscillating the scale slowly so the fingers soften and sharpen over time while staying inside the safe margin.

Beyond that, I'm thinking about how to avoid repetition over a full hour of animation: layering slow independent noise processes for flap rate, a threshold-based form scalar for irregular slips, drifting hand position, lamp swing intensity, occasional head turns or beak openings, and periodic breathing of the depth scale. I also want occasional larger "gesture" events — the bird flipping to face the other direction by mirroring hand positions, or briefly taking off with faster wingbeats before settling back down — with these gesture parameters re-rolled on a timer so the piece never feels like it's looping.

Locking down the state variables now: a wing-flap phase that integrates a noise-modulated rate (always positive, roughly a slow patient wingbeat that speeds up during takeoff), and a form scalar driven by a smoothed noise walk that stays mostly open but occasionally dips low.

That dip creates the illusion of hands emerging every 20-40 seconds, and when it happens the facing direction can flip — the creature literally re-forms as itself again but backwards, like its identity isn't preserved through the transformation. I'm also thinking through a hand-center position that drifts with noise plus a slow hover bob, a breathing scale factor, and a lamp that swings subtly in the background.

No walkers or people needed — just the hands entering from below, as if someone's arms are reaching in, holding something invisible. Keeping the warm plaster palette with cooler shadow fill feels right for a bedtime/nursery mood. I want to reconsider the penumbra argument here too: unlike the lamp piece where shadows were fully legible on their own, this piece should work the opposite way — a still frame reads as an ambiguous bird-shape, and only the motion reveals the hand.

Actually, the real threshold isn't about legibility at all, it's about identity — not "how few pixels before a person disappears" but "how few before something that isn't a bird becomes one." High legibility is fine, even desired.

For a title, I'm weighing a few options — "Bedtime," "The Bird Is Two Hands," "Making a Bird," "Rabbit, Bird, Hands," "What the Hands Are Doing," "Nightly, a Bird." I keep circling back to something like "Two Hands, Pretending" or "The Illusion Slips" as the strongest contenders.

I'll settle on "Two Hands, Pretending" since it names both readings and the wager at once. For lineage, this is a variation of the Between the Lamp and the Wall piece — keeping the lamp/wall/shadow machinery while retiring the crossing bodies. For contrast, I want to set it against my run of honest, unambiguous figures, so I'm considering citing Keeping Pace or Passerby as the counterpoint.

I already used Passerby as contrast on the lamp piece, so I'll go with Keeping Pace instead — it's my purest "honest figure" piece, just two bodies synthesized honestly with nothing but gait and timing, which makes the sharpest contrast against this piece's trick of turning two hands into a false animal. Two lineage entries feels sufficient: variation of the lamp piece, contrast of Keeping Pace.

Now I'm setting up the buffer mode structure with metadata for the piece — name, fps, and clock input.

Next I'm defining constants for the wall's lighting geometry and reusing the proven wall lookup tables and pool rendering code from before. I'm laying out fifteen capsules to represent the bird pose (body, tail, neck, beak, wing fingers) mapped onto the two hands making it, with pose arrays tracking their positions and rotations over time.

Now I'm scaling body-plane units so the projected bird spans roughly 30 by 26 pixels, then placing the body and tail capsule endpoints for a bird facing away from the viewer.

I'm continuing to define capsule endpoints for the neck, head, and beak, then setting up wing root positions and finger lengths along the top of the body.

Now I'm working out the flapping angle range so the wings sweep naturally from up-and-back to down-and-out, adjusting the mean angle and amplitude until the tip positions look right relative to horizontal.

For the far wing, I'm offsetting its root position and giving it a smaller mean angle and amplitude with a phase lag so it reads as slightly behind the near wing, shortening its fingers slightly for a foreshortened look. Since the bird faces left and both wings sit to the right of the body, I realize the overlap between the near and far wings is actually the correct visual result for this pose.

Checking finger radius and spacing at 64x64 resolution — I want the finger width and pitch tight enough to look like distinct digits with visible gaps rather than blurring together.

Those forearms fall outside the pool's visible bottom edge, so I don't need to worry about them showing.

For the hand pose at f=0, I'm placing two hands with palms facing the wall and fingers pointing up, spaced apart—one near the body capsule region and one near the tail, each built from small capsules for palm and thumb with specific coordinates and radii to define their shape.

The beak segments become nearly invisible, folding into the thumb as a small continuation stub. The wing fingers for each hand splay upward at slightly varying angles and lengths to suggest individual digits, rooted near each palm's base.

Now I'm setting hand2's forearm as well, then interpolating every endpoint and radius by the morph factor f — so the transition literally becomes the hands rotating and drawing together, mirroring the real gesture of forming a shadow puppet. For the facing flip, I multiply local x by a direction sign, but only apply it while f is low, since the pose is roughly symmetric there and the flip stays hidden — same trick used for the streamline mirror.

For added life in bird form, I'm considering a slow head bob and occasional beak-open events, done by rotating the second beak segment down a few degrees during a triggered "call" animation.

Adding a noise-gated beak-open rotation applied to the beak's far endpoint, plus a small overall body tilt (driven by a sine wave) rotating all local coordinates about the origin each frame to simulate the wing-flap motion — cheap since it's just rotating around 30 endpoints per frame, but it adds a lot of visual life. I'm also thinking about how to layer in a hover effect.

I'll reuse the same projection and raster casting logic from the lamp piece for a single body, and I'm roughly estimating the pixel cost: about 289px per wing finger across 8 fingers, plus the body and forearm bounding boxes, totaling around 3500 pixel visits — comparable to the lamp piece's 3372, so performance should be fine.

Adding the wall's 4096-pixel LUT lookup, I'm now checking liveliness — the wings sweep across roughly 25% of the pool at 0.8Hz, and estimating the frame-to-frame occlusion change comes out to about 0.4% of frame-mean per frame over half a wingbeat, which is well under the lamp piece's 0.0055 max jump, so no strobing risk there.

That said, beating that fast over a bright pool could still feel busy in a living room, so I'm slowing the base rate to 0.55-0.7 Hz and introducing an amplitude envelope so the bird sometimes glides (wings held, motion carried by drift and tilt) and sometimes beats — giving the piece a more patient internal rhythm while making sure glides stay short and the envelope never drops to zero so the wings are always at least subtly moving.

I want the flap rate to be modulated alongside the amplitude, never hitting zero. I'll wire in clock/daylight input handling similar to the Day for Night piece, declaring inputs as clock.

Structurally, this is a renewal-free but non-repeating system — independent noise walks for flap phase, form, drift, lamp swing, breath, and facing flips, plus discrete events like facing flips and beak calls, with nothing accumulating so minute forty looks different from minute one. It's one continuous performance rather than a repeating cycle, and since it's noise-driven it shouldn't visibly settle, though I'm now wondering if it risks feeling too static.

To avoid the puppet feeling frozen in place, I'll let the bird drift within the pool over roughly 40-second cycles while the lamp swings so the pool slides underneath it, and form slips reshape the whole silhouette. I also want to add an occasional rest where the hands lower out of the light entirely, emptying the pool for a couple seconds before it refills — giving the piece an arc, though I need to keep these exits rare and brief since a bare pool risks reading as a dead frame.

Actually, I'll skip the exit idea since it risks failing the frozen-frame check, and just keep the hands always up. It's a small fiction that the hands never tire, but that's fine for the art. Now I'm setting up the room dimensions, swing parameters, and constants for the piece.

Setting up light LUT tables...

Defining more finger params...

Still writing wing/hand pose math...

Still filling in capsule coordinates...

I'm confirming that the hand pose's beak2 correctly maps to the thumb tip, then working out the rotation logic for opening the beak and tilting the whole figure about the origin.

Then I need to handle facing direction — deciding whether to mirror the x-coordinate before or after applying tilt. I settle on mirroring only in the final projection step, which naturally flips the tilt too, keeping things correct without extra bookkeeping.

For flipping direction, I want it to happen at most once per slip, so I'm tracking an armed flag: once the phase crosses a threshold going one way, it becomes eligible to flip when crossing back, with some randomness deciding whether it actually flips.

For positioning, I need the hands' body-plane coordinates so the projected shadow lands centered in the pool, solving for hx in terms of the pool center and scale factor.

I'm working out how to keep the shadow drifting near the pool center by computing a target position that drifts slowly over time, then inverting the projection math to find what hand position would produce that shadow location — though I realize fixing the hand position this way means the bird itself won't visually swing with the lamp, undermining the effect where the shadow swings opposite the lamp's motion, so I'm reconsidering the approach.

Fixing the hand position from a target based on the mean lamp position instead means the shadow will wobble a few pixels opposite the lamp swing, which is a small but physically satisfying counter-swing effect worth keeping. Now I'm figuring out the bird's projected size based on the scaling factor and body size.

Settling on bs = 0.92 for the bird scale. Now working out finger thickness so the dark core stays visible against the lighter outline—adjusting the ring length and finger radius until the inner radius comes out around 0.6px, which keeps things thin but not lost.

Checking the resulting finger width against the gap between fingers—too tight and the fingers would blur together into a blob rather than reading as individual digits, so I'm widening the spread angle to open up the gaps near the tips while keeping the root spread proportional.

With a wider spread the wing spans roughly 82°, which fits since shadow-puppet wings should look splayed. Tracking the flap angle range through the stroke cycle, fingers sweep from up-left/up-right at the top to right/down-right at the bottom, which seems reasonable, though I'm noting a possible collision between the fingers and the forearm capsules near the bottom of the stroke.

Since it's a shadow they'll just merge visually, so I'll tighten the flap amplitude to 0.9 with a mean of -0.70, giving a range of about -1.6 to 0.2. I'll reuse the lamp piece's LUT approach for the wall texture, and keep its setup() pattern with the `started` guard so the host's call to setup() properly triggers once. Now I'm writing the setup function that precomputes squared radius bounds and iterates through the texture.

Computing endpoints...

Then I randomize the swing phase, flap phase, and initial facing direction for the bird, marking it as started. I pause to reconsider the direction convention—checking whether dir=-1 should correspond to facing right instead.

Now I'm writing the render function, starting with the lamp swing physics using noise-driven angular velocity and amplitude modulation.

Still writing bird animation logic...

Adding tilt only in bird form, keeping hands upright. Writing the pose function...

Still writing finger positions...

Finishing the cast function similarly to the lamp piece, then I'm sanity-checking the LUT-based wall distance calculation—verifying the squared distance bounds stay within the lookup table's range given the Y-axis weighting factor. I'm also double-checking the palette formula, confirming the hue/saturation/value interpolation matches what I intended.

Now I'm keeping the gentle flicker in the composite pass and thinking through whether the wing-flapping motion alone provides enough visual liveliness for a mostly-stationary subject—estimating the swept area of the wingtips per beat cycle and how much per-pixel variance that generates at 30fps to judge if it reads as sufficiently dynamic.

Working through the math, the mean per-pixel temporal standard deviation from the wing sweep, combined with the gradient shifts from the lamp swinging, should land around 0.05, close enough to my known-passing reference range from a similar lamp piece. Since I can't directly run the validator, I want to write a quick Python check offline to verify the liveliness metric myself before finalizing.

Writing the silhouette-and-wall port...

Writing analysis script...

I also want to settle the influences list for the rationale — leaning toward jim-campbell alone as the cleanest reference, though the domestic shadow-puppet quality and the 4k-intro idea of fully developing one concept both feel relevant too.

I'll title it "Two Hands, Pretending" and start coding.

---

## Turn 1

Let me run it and see what happens.

---

## Turn 1

Liveliness at day=0.5 sits in a reasonable range compared to the other pieces, but it collapses sharply at the boundary days of 0.0 and 1.0, which seems suspicious. I'm trying to figure out whether that's an artifact of how the smoothing behaves at the extremes of the range.

At day=1, shallower shadows plausibly explain a lower variance, but at day=0, shadows are deepest, so the variance should actually be higher, not lower — the shadow depth and peak values (SD=0.955, PK=0.84) suggest day=0 ought to produce more contrast-driven variation than day=0.5, contradicting the drop I'm seeing. Something in how the trajectory or warm-up is computed must be diverging from expectations, so I want to isolate whether the discrepancy comes from the form's position, timing, or the day-to-shadow parameter mapping itself.

---

## Turn 1

Turns out it's not a daylight issue — there are genuinely weak windows around t=55-60 where the value dips to 0.018-0.022, below my known-passing floor of 0.030. This is the near-still failure mode: the flap envelope and rate both dip, nearly stopping the wings, so I'm working out the minimum phase rate to see how long a full beat takes in that scenario.

The fix is to decouple amplitude from rate less aggressively, raise the floors, and add a second liveliness source independent of flap luck — keeping the flap rate on its own independent cycle instead of multiplying it by envelope, raising the envelope floor so it never gets near-still, and adding a continuous drift/tremor to simulate a hand that can't be held perfectly still.

I'm sizing the tremor so it moves every edge pixel by roughly a pixel across the silhouette, tuning it to around ±0.6 units at ~0.9 Hz plus noise so it reads as a live held hand rather than jitter, and coupling a subtle body tilt to the flap cycle for a breathing effect. I'll bump the flap amplitude back up to keep the wings sweeping visibly, then retest.

---

## Turn 1

Still weak in the 0.0165-0.0225 range, which suggests something is periodically stilling the motion beyond what I've addressed. Since both seeds share the same t-driven noise for env, rate, form, and position, the weak windows around t≈55-60 must trace back to that shared noise — possibly the form value slipping into a hands pose, which would be static and explain the dip.

Actually that's the real bug: hand pose fingers are fixed angles, so during a slip the panel nearly freezes since flap contributes almost nothing at low weight. The fix is to give the hand pose its own motion — animate finger angles with a slow curl and slight hand rotation, framing it as hands "searching for the shape," using the flap phase at half rate with per-finger offsets so it never fully stills.

Comparing amplitudes, I want the hand's finger splay and wrist rotation to produce enough tip displacement to feel alive without matching the full bird flap swing — something like 0.5 rad splay plus ±0.25 rad wrist rotation seems close in scale. I'm also considering shortening and randomizing the slip duration so weak-blend moments are brief rather than lingering, and reframing the slip as a quick, energetic break-apart-and-reform event rather than a lull.

I'm restructuring the transition as an explicit scheduled event instead of relying on noise thresholds: a timer fires a slip every 14-34 seconds, driving an envelope that drops over 0.9s, holds around 1.6s, and rises over 1.3s, with the hands flexing during the hold — giving a deterministic ~4 second burst of motion that stays lively throughout.

These likely overlap with slips too, since the form curve is driven identically by t across seeds. Time to implement the event-based slip with animated hands and retest, maybe letting hands drift apart a bit more during the hold.

---

## Turn 1

The numbers improved but still fall short in several windows compared to the Saccades-PASS benchmark, and the lamp measurement runs even higher, so I don't have enough margin yet. The real problem is that this figure is stationary—a flapping puppet without body translation only disturbs pixels in the wing zone, echoing my own point that translation is the liveliness budget. I need to think through other ways to address this.

Actually, real shadow puppetry has the bird physically fly across the wall—the hands sweep, the puppet drifts and dives. That's the answer: give the puppet a genuine flight path traversing the pool, dipping and rising over 20-30 seconds, with the bird facing its direction of travel. And when it reaches the edge and must turn around, that's precisely where the slip belongs—the hands breaking apart to reverse the puppet's orientation. This ties the technical constraint to the dramatic beat perfectly: the illusion fails exactly when the puppeteer must physically reverse the hands.

Now I'm working out the timing: with a traverse speed of 3.5-5 px/s across a 45px pool, each crossing takes roughly 9-13 seconds, meaning a slip every 11 seconds or so—maybe too frequent if I want the illusion to mostly hold. I consider adding vertical bobbing that syncs with wingbeats to mimic natural bounding flight, and stretching the reversal interval to 14-22 seconds with a 4.2-second slip, though that still puts about a quarter of the time in transition, which might read as excessive.

For vertical motion, the bird rises on the downstroke tied to flap phase, with a small amplitude plus a slow noise drift for altitude variation, and the facing flip should be tied to travel direction rather than random. I'm reworking the horizontal range and speed so traverses take around 10 seconds while covering roughly 31px, giving fewer but more natural-looking crossings.

Since the wingtip can reach the pool's edge where shadows fade, that actually reads as the bird flying to the light's boundary and turning back, which is a nice effect. I'm noting that the speed I'm tuning is the shadow's speed on the wall, not the hand's speed, since the hand moves proportionally slower — I'll keep driving the target x directly in wall coordinates to keep this straightforward.

---

## Turn 1

The median improved to 0.036 and max to 0.0535, but the min dropped to 0.0152, suggesting one window got much worse—likely the bird straying outside the pool or the traverse stalling. I suspect during a slip the form drops toward 0.1, which drags the speed multiplier down and damps the flap since the wings lerp toward the static hand pose weighted by form, making the bird nearly stationary with flexed hands.

I want to fix this by strengthening the wrist rotation during holds so the hands visibly turn and open—raising the flex amplitude and adding a form-weighted tilt blend between bird tilt and hand tilt so more capsules move during slips. I'll also shorten the hold duration and reduce how much slips slow the travel speed, then re-measure with denser sampling after checking whether the worst window actually coincides with a slip.

---

## Turn 1

The median jump is fine but the max jump of 0.0115 stands out—twice the lamp piece's value, likely from a slip transition rather than strobing, so I want to check it more closely. I'm going to look at the worst window, seed0 at t=39, and print out the form/flap/tx values there, suspecting the bird is at the dim far edge of the pool at that moment.

---

## Turn 1

I've confirmed the weak spots: the slip and the bird overshooting to x=12.2, which pushes it past XLO=16 and outside the pool's dim edge entirely, leaving the puppet half-lit during that turn. So I need to fix this by triggering the slip earlier to bound the overshoot before it exits the light.

Setting XLO=20.5, XHI=42.5 with tx clamped to [18.5, 44.5] keeps the bird inside the pool, but this shrinks the traverse to only 22px, which at typical speeds means a slip every 6-9 seconds — too frequent for the illusion to hold convincingly. I'm now weighing whether to slow the vertical speed instead, but that still produces a slip roughly every 11 seconds, still too tight — so I'm reconsidering whether the bird's reversal timing needs a different dramaturgical approach altogether.

Rather than slipping at every edge turn, I think it's better to make slips probabilistic — around 35% of turns — so they happen roughly every 30 seconds, while the rest are "banks": lively, clean tilt-and-reverse motions with a mirrored flip. The tricky part is hiding that mirror flip so it doesn't visibly pop; I'm considering having the bird fold its wings into a compact, roughly symmetric silhouette at the peak of the bank, using that instant to hide the mirror the same way I concealed one in a symmetric streamline pose before.

Actually, simplifying further: every turn becomes a fold-and-mirror "wingover" lasting about 1.4 seconds, and occasionally — every 25 to 40 seconds — that fold overshoots into a full 4-second slip into hands. I'm sketching the event logic now: a turn always fires when the bird hits a horizontal bound, with duration depending on whether it rolls into a bank or a slip, folding wing amplitude and swinging tilt accordingly, and mirroring the shape partway through the fold.

I'll bound the horizontal traverse between 19 and 44 pixels with a speed range giving 7-11 second legs, then trigger an event at each bound with a 38% chance of being a deeper dip lasting longer. During these events I'll fold the wings by scaling the envelope down, add a banking tilt swing, and only reduce form on the deeper variant — then implement and measure against the target interval.

---

## Turn 1

This is running too slowly with 124 windows and warm-up included. I should cut down the sample size and reduce warm-up overhead, just running fewer iterations instead.

---

## Turn 1

The median timing looks good compared to other pieces, but there's a 3.5% frame jump from the mirror flip that's too abrupt compared to my other pieces' smoother transitions — that's a visible flicker I need to fix, likely caused by the mirror flipping the bird instantaneously rather than easing into it.

Instead of an instant flip, I could animate the mirror as a rotation in depth — scaling the local x-axis from 1 to 0 to -1, so the bird appears to turn edge-on like a real hand rotating about a vertical axis. At the midpoint it collapses to a thin vertical blade shape, which is a dramatic but continuous and physically believable transition, like a shadow puppet turning around.

At the collapse moment the whole shape becomes a thin vertical bar spanning the wingtips' y-range, like the bird flashing edge-on before reopening — visually striking but still smooth since the occluded area only dips briefly over a 22-frame window, keeping per-frame delta small.

I'll keep the bank tilt for flavor even though the collapse handles the turn illusion, and switch the cast function to take a signed x-scale rather than a direction flag. That should also tighten up those low-variance windows now that the turn is one continuous motion.

But I'm realizing a conflict: during a deep slip I want mx near ±1 so the hands are clearly visible, yet the deep-slip hold currently keeps form near 0.1 while mx sits close to zero — exactly when the hands go edge-on and become hardest to see.

The fix is to sequence the gesture properly: the turn (mx) completes in the first 45% of the event, then the hands fully separate and flex into view, then form returns to the bird shape. Shallow bank events skip this and just do the quick mx turn with folded wings. So I'm defining u_turn as a clamped ramp over that first 45%, driving mx as a cosine of it, with the form-drop bump timed to peak afterward using a smoothstep.

Otherwise it's just full velocity with no fold or bump. The form factor shrinks based on the bump amount, so during a deep turn the wings compress significantly before reforming. Timing checks out: deep events give enough time for the turn, hand visibility, and reformation, and shallow events are quicker overall—now I need to implement this and test it.

---

## Turn 1

The jump is fixed now, matching my other pieces with a median around 0.038, but the minimum still sits at 0.012-0.020, meaning quiet 2s windows persist and p10 falls just under the Saccades-PASS threshold. I need to locate the argmin and check what state produces these quiet windows, possibly during the deep-slip hold where hands are visible and flexing but not translating.

Since travel resumes at full speed once fold returns to 0, that's not the cause—maybe it's a low flap envelope combined with the bird being near the pool edge, or a low-env glide paired with slow vx. I'll find the worst windows and print out the state to check.

---

## Turn 1

I notice tx gets clamped at the extremes (17.0/46.0) during deep events, so the bird sits motionless at the pool edge during the hands phase — the clamp is freezing its travel right when the event starts. I'm double-checking whether vx is still active during this frozen period.

Actually, I found the real bug: vx keeps its old sign until the event ends, so translation keeps pushing outward and hits the clamp. The fix is to flip vx at the zero-crossing (ut=0.5, when mx=0 and the bird is edge-on), rather than waiting until the event ends. But I need to be careful — flipping `dir` at that same midpoint breaks sign continuity in the xs formula, since dir and mx interact multiplicatively. So the right approach is to keep `dir` flipping at the event's end as before, but flip `vx` independently at ut=0.5, since vx only governs the rendering direction and isn't tied to the mx sign convention.

Now looking at another quiet case around t=223, where form=1 with no event but tx=40.6 and std=0.0216 — noticeably lower than the median of 0.038. I'm checking whether wing amplitude or flap rate could explain the low variance, but the numbers (env floor, beat frequency) suggest the wings should still be lively. I'm wondering if position near the right edge of the pool, where lighting is dimmer, might reduce the absolute magnitude of occlusion-driven changes.

Working out the pool's brightness falloff, I find that at x=40.6 the bird is still within the bright inner radius, but if its wingspan extends to x≈54 it edges into the dimming falloff zone, partially darkening. To fix this I'm considering narrowing the flight range so the bird stays more central and slightly enlarging the bright pool radius. I'm also thinking the vertical bounce amplitude is too small for a convincing bounding flight, so I want to increase it and add a slow multi-second altitude swoop for more natural variation.

Since the bird's silhouette is fairly wide, small vertical shifts change a lot of the visible pixels, making vertical motion an efficient way to boost brightness variation. I'm tuning the flip timing, horizontal range, clamp limits, and vertical bound amplitude, and adding a noise-driven altitude term with a faster frequency so the swoop feels organic rather than periodic.

---

## Turn 1

Looking at the current run's stats, the median lands right at 0.041, matching the known-passing Lengths piece, with a p10 around 0.030-0.033 and a rare quiet minimum near 0.020-0.025 across the 300-second window. That occasional dip isn't alarming since the lamp piece showed similar quiet epochs at 0.023 before its fix, so this looks consistent with normal variance rather than a real problem.

I want to double-check that the silhouette actually reads as a bird made of hands across flap phases, so I'm dumping ASCII renders at full form, at the hands-heavy form value, and at the edge-on moment to visually confirm.

Writing occlusion rendering code...

---

## Turn 1

I realize the shadow should actually be the dark mass in the middle of the pool, not a clean bird shape—checking the character-to-brightness mapping again to confirm which symbols represent darkness versus the bright walls.

The blob seems way too large, spanning nearly the entire pool instead of a distinct bird silhouette, which is concerning. Let me dump the occlusion field directly as a binary mask so I can actually see the silhouette shape clearly instead of guessing from the density characters.

---

## Turn 1

The silhouette is reading as a solid blob rather than distinct wing fingers — the fingers are fusing together because at this scale the finger diameter plus penumbra is wider than the spacing between them, so they merge into a triangular wedge instead of separate feather-like shapes.

I'm working out the fix: shrinking the overall body scale (BS from 0.92 to 0.68) to get better proportions relative to the pool, then thinning the finger radius down to try to preserve a visible dark core once the penumbra blur is applied. But shrinking too far makes the penumbra swallow the core entirely, so I need to also reduce the scale variation range to keep enough contrast for the fingers to read as separate shapes.

Working through the penumbra math, I realize the soft shadow blur washes out anything thinner than about 2px of core darkness, so fingers need roughly 2.5px total width with a small but visible dark center to read clearly rather than blur into grey.

To hit the ratio-of-6 target, fingers would need to stretch to 22px — workable for a wing but not for a whole four-finger wingspan without doubling the panel width. So I'm shrinking the lamp radius instead: a smaller light source tightens the penumbra, letting shorter 12px fingers still read with a decent contrast ratio, even though this softens the diffusion conceit that defined the earlier piece.

Now I'm reworking the hand geometry itself — widening the angular spread between fingers so their tips separate into clear gaps while keeping the roots merged near the palm (which reads correctly as the hand), and slimming the palm radius down so the overall body stays lean like a bird.

For the forearms, I'm cutting them down from a dominant thick bar to a thinner stroke, and making sure mostly one arm reads visibly rather than both overlapping — plus timing them to exit the visible pool region a bit sooner based on the pool's geometry.

With k roughly 1, I work out the body and tail proportions in pixel-like units, sizing the body around 13x5px and sketching neck and beak segments so the whole bird stays legible within a 64px panel.

Now I'm laying out the wing roots and their taper lengths for both wing pairs, plus the forearm segments extending from the body, keeping the spread and radius values consistent with the scaled-down bird silhouette.

Continuing to map out the hand and arm coordinates - thumbs, fingertips, and the upstretched arms connecting to the shoulders, plus root positions for the finger spread.

Adding finger roots for the other hand, then checking overall hand span against the bird proportions to make sure it looks right. I'm recalculating finger width-to-length ratios to get proportions that feel more natural.

I'm weighing whether keeping four visibly separate fingers per wing is worth it -- it's the giveaway that this is a shadow-puppet bird, so I think it's worth keeping despite the smaller scale. But shrinking the bird reduces the silhouette area, which cuts down on how much the shape changes frame to frame, so I'm estimating the drop in movement/liveliness and thinking about how to compensate for it.

To recover that liveliness, I'll bump up the flight speed range, widen the flight boundaries since the bird is smaller now, and increase the bounce amount, then adjust related sizing constants like the radius, base scale, and stroke midpoint/amplitude values. Now I'm rewriting the whole geometry constants block with these new values before re-measuring and re-dumping the output.

---

## Turn 1

Now I can see distinct diagonal strokes in the "mid" frame that read like splayed fingers or feathers, plus a horizontal body bar with the beak pointing left. The "hands" frame wasn't captured in that window, but overall the shape reads as a horizontal bar body with arms extending outward.

The main problem is that the two arms merge into one solid vertical column running most of the pool's height — that's a static-looking mass that hurts liveliness and reads more like "bird on a post" than a bird with wrists. I need to angle the arms apart so they diverge into two visible strokes, matching the crossed-wrist bird pose.

---

## Turn 1

The "mid" frame reads well now, with distinct splayed arms, a body bar, a beak, and finger-strokes above. The "edge" frame collapses nicely into a thin vertical bar, a strong edge-on gesture. But I notice no "hands" frame appeared within 120s at seed 2—form never dropped below 0.14, which is odd given P_DEEP and the turn timing should have triggered it.

Working through the smoothing math, the bump's plateau window is too narrow to let form dip below ~0.20, so I'm widening the plateau (shifting the smoothstep bounds) to give it more time to settle, which should bring form down to ~0.12. I'll also confirm that mx has fully completed its turn at the deep-slip moment so the hands are seen full-face. Let me re-dump the hands frame with the wider plateau and rerun the final metrics.

---

## Turn 1

The hands frame reads clearly now — two separate palms with four splayed fingers each pointing up, and two wrists descending, distinctly different from the bird. Time to check final metrics with all the changes applied.

---

## Turn 1

The median comes in at 0.046, comfortably above the Long Fall benchmark and other comparisons, with jump values staying low enough to avoid strobing and dark/bright ratios holding steady across days. Now I'm moving to write the JS implementation, carefully transcribing the key positional and swing parameters before building out the logic.

I'm mapping out more constants—slip and bank durations, flex amplitudes, hand-position bounds, and flap timing values—then laying out the render loop order to mirror the Python frame function: computing swing and hand positions, then the state variable, envelope and flap rate, hand phase, the event state machine controlling fold/bump/bank/crossfade, applying the envelope reduction from folding, then call timing, tremor, target positions, and finally composing pose, cast, and day/palette rendering. I'm double-checking the order of operations around when the envelope gets modified relative to flap integration to make sure the wing amplitude behaves correctly.

I'm working out how to port the direction-flip and velocity-sign logic from Python's `copysign` into equivalent JS conditional expressions, and confirming when the turn state resets happen at the start and end of each movement event so the bird's direction, slip phase, and cross-fade variables all initialize consistently between segments.

Now I'm turning to performance considerations, thinking about how the 15 rasterized capsules stack up in size, with the forearms being among the largest segments to render.

Right, the flex-based dynamic computation means those precomputed hand angle constants aren't needed anymore, so I can drop them and compute both bird and hand endpoints inline each frame. I still need to carry over the bank-tilt sign logic and the daylight/palette smoothing from the lamp piece, then I'm ready to write out the full source with the frontmatter.

Now let me settle the frontmatter details: id, title "Two Hands, Pretending", the creation date, artist name Saccade, its lineage as a variation of the lamp piece and contrast to Keeping Pace, and the jim-campbell influence — then write the rationale prose before the code.

I'm double-checking the tilt rotation applied in the pose function — since it affects all capsules including the forearms, a bank angle of about 0.6 radians could swing the arm endpoint by roughly 17 units, which seems like a large but intentional sweep matching how arms move when the wrists turn.

That swing across the pool is actually dramatic but believable, and since it showed up in the measured version already, it's part of what makes the motion feel lively, so I'll keep it as is. Checking the projected position confirms the arms extend to about y=55, past the pool's bottom edge around 47, meaning they properly move out of the light — which is the effect I want, so now I'm confirming the pose function's parameters before finalizing everything.
