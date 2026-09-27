# Kitchen Sink: soap art and animation notes

The 3D Kitchen Sink now uses a glossy pastel soap bar as its shared scoring object. The goal sequence continues visibly through the drain before the next kickoff. The visual aim is a readable miniature kitchen with a playful payoff, while keeping the soap and vehicles easier to follow than the props.

## Soap presentation

- `soap-scene.js` creates a rounded pink bar, 1.35 x 2.0 x 0.7 world units, with a pressed SOAP mark and a restrained edge highlight. The mark is a close-view detail; the rounded silhouette and pastel color carry normal play.
- The simulation retains a circular contact proxy with radius 1.0. This is an arcade approximation of the bar, not full cuboid rigid-body collision.
- The visible center is the authoritative proxy world height minus 0.65. Pitch, yaw, and roll come from the simulation, including bank alignment and the inherited orientation at takeoff.
- Floor contact deposits a small, bounded suds trail. Airborne soap stops depositing suds and gains a projected ground shadow, making flight height easier to judge.
- Online guests may smooth ordinary position and quaternion snapshots over about 50 ms. First presentation, teleports, round resets, and the end of a goal snap to the authoritative pose. Goal choreography itself does not add interpolation.

## Goal choreography

The host supplies a serializable goal age and entry pose. `soapGoalPose()` derives the entire path from that state; neither the soap nor the drain effects uses wall-clock time.

| Time after capture | Presentation |
| --- | --- |
| 0-0.7 s | Preserve the incoming visible transform, then catch the soap in a tightening spiral. |
| 0.7-1.25 s | Corkscrew down the funnel; the soap disappears below the bowl. |
| 1.15-2.45 s | Team-colored drain ripples and a compact fountain of bubbles replace the soap as the focal point. |
| 2.2-2.65 s | Effects settle while the camera returns toward play. Camera and match timing are managed outside the art modules. |

The selected drain brightens in the scoring team's color. Unrelated hazard graphics are suppressed during the celebration. The burst stays around the drain; there are no full-screen flashes or camera shakes in these effects.

## Rendering boundaries

- `makeSoap()` returns a world-space group. `updateSoap()` reads simulation state, updates its child body and cosmetic pools, and returns the body's visible position for camera/cue targeting.
- The soap trail uses 28 pooled instances. The celebration uses 36 bubble instances, 36 tiny highlight instances, and three ripple rings. Geometry and materials are created once, not per frame.
- Reduced motion removes cosmetic suds, spiral rotation, and the bubble fountain. The soap still visibly travels into the drain, with quiet stationary ring feedback.
- The in-field circular ball cue was removed for soap, because it masked the bar silhouette and made it resemble a marble. Offscreen direction cues remain available.

## Visual evidence inspected

These local captures were manually inspected during implementation:

- `output/soap-browser-desktop/desktop-slide.png`: pastel soap separates from dark steel; the original circular cue obscured its silhouette and was subsequently removed.
- `output/soap-browser-desktop/desktop-airborne.png`: soap tumble and ground shadow make the staged airborne state readable.
- `output/soap-browser-desktop/desktop-bank-climb.png`: bank placement reviewed; the first capture preceded the final absolute bank-tilt fix.
- `output/soap-browser-desktop/desktop-live-bank-flight.png`: an actual bank launch keeps the scoring object visually distinct from the vehicles.
- `output/soap-browser-desktop/desktop-goal-0-7.png`: the scored drain becomes the focal point and the soap continues into its throat.
- `output/soap-browser-desktop/desktop-goal-1-4.png`: a localized, team-colored bubble burst provides visible follow-through after capture.
- `output/soap-goals-final/desktop-goal-0-1.png`: after circular-cue removal, the rounded pink bar silhouette remains visible as the drain catches it.
- `output/soap-goals-final/desktop-goal-1-4.png`: the final amber bubble burst stays around the scored drain and leaves the rest of the arena readable.
- `output/soap-goals-final/desktop-goal-2-2.png` and `desktop-goal-return.png`: bubbles finish while the view returns to normal play; the new kickoff soap remains visibly rectangular.
- `output/soap-mobile-final/portrait-airborne.png` and `portrait-goal-1-4.png` (390 x 844): the airborne bar and shadow remain distinct, and the scoring drain/bubble burst stay clear of controls.
- `output/soap-mobile-final/landscape-airborne.png` and `landscape-goal-1-4.png` (844 x 390): the soap's pink color and localized goal burst remain readable with the side controls.
- `output/soap-mobile-final/small-landscape-bank-climb.png`, `small-landscape-airborne.png`, and `small-landscape-goal-1-4.png` (568 x 320, before the final HUD refinement): the soap remained distinguishable by color, but the narrow field left its silhouette only a few pixels wide.
- `output/soap-near-goal-final/small-landscape-airborne.png` and `small-landscape-goal-1-4.png` (568 x 320, final layout): the enlarged field gives the soap a clearer oblong silhouette; the near scoring drain and its bubble burst stay unobscured.
- `output/soap-small-far-final/small-landscape-goal-1-4.png`: the final small-landscape layout also keeps the opposite scoring drain clear of controls.
- `output/soap-near-goal-final/portrait-goal-1-4.png`: the closer portrait view frames the near-drain celebration above the lower controls, with clear separation from the score banner.

## Limits

Screenshot review establishes composition and visible states, not smooth playback or whether a match is fun. The separate browser audit checks real animation, goal continuity, pause/resume, mobile framing, and camera motion. Software-rendered browser timings are not a claim about hardware frame rate. The tiny SOAP lettering is intentionally not relied on at wide spectator distance.

The final 568 x 320 refinement reduced side panels from 124 to 104 pixels and framing insets from 156 to 116 pixels, increasing usable field width from 256 to 336 pixels. The comparison shows a larger, more legible soap silhouette and clear goal action at both ends. Fine embossing remains a close-view detail on small screens; normal tracking relies on the bar's pink color, shape, motion, and shadow. All final scoring-drain views inspected keep the active celebration clear of the controls.
