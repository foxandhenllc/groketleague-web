# Kitchen Sink: readable physics and presentation

Historical baseline: the later [3D soap arcade pass](SOAP-ARCADE-2026-09-27.md) supersedes the 3D ball drag, whole-ball drain scoring, goal animation, camera and protocol details below. The 2D mechanics remain as described here.

The original sink had a global invisible current, subtle banks, generic hazard instructions, and a camera that let phone controls cover a drain. This pass makes the environment explain its rules while keeping the autonomous soccer loop.

## What to look for

Select **Continue -> Arena -> Kitchen Sink**, then either Arcade 2D or 3D.

- **Curved steel banks:** etched inward arrows and shoulder contours show the downhill direction. The rendered height and acceleration use the same quadratic surface; 3D cars lean with that surface and contact effects follow its elevation.
- **Wet lane:** the blue area starts beneath the faucet and has soft boundaries. Wet tires retain 48% of dry lateral grip; the ball retains 50% of dry rolling drag. Wakes appear only on wet surface contact. This patch changes grip in the sink only.
- **Faucet:** each fourteen seconds has seven idle seconds, two warning seconds, 3.5 seconds of flow with a half-second ramp, and 1.5 seconds of ebb. The nozzle warns, the jet lands at the lane entrance, and arrows/foam show the actual push direction. Dry portions of the bowl receive no faucet force. Wetness remains after flow stops.
- **Drain approach:** inward trails identify a modest ball-only pull within 7.5 world units of each drain. The four-unit scoring hole still requires the whole low ball. Cars are not sucked in. High airborne balls clear the floor forces.
- **Meteor / lightning:** each has an exact six-unit danger footprint, countdown, distinct icon/effect, sound, and cause/effect caption. Meteors knock outward; lightning briefly interrupts car propulsion. Debris, scorch marks, forked bolts and ground arcs add spectacle without camera shake or full-screen flashes.
- **Match rhythm:** water time and the alternating hazard sequence continue across goals. The old target is cleared and the next warning has at least 2.5 seconds of kickoff grace. A new match starts a fresh cycle.
- **Framing:** a stable perspective camera fits the raised rim within the space reserved between controls. Compact scores and side controls on short landscapes keep both drains visible. The sink renders at native CSS resolution up to 1600x1000; WebGL antialiasing smooths edges. Reduced motion removes decorative particle motion and the introductory camera travel while preserving warnings.

The small contextual caption explains the current effect on the player or ball; it yields to approaching hazards. It does not replace the arena's directional and spatial cues.

## Design references

[Riot's clarity principles](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/) informed exact warning footprints and the visual priority of gameplay over decoration. [Overcooked 2](https://www.team17.com/games/overcooked-2) informed the playful oversized kitchen setting and readable environmental changes. These are design references; no artwork or code was copied.

## Implementation and bounds

`sink.js` supplies `sinkHeight`, `sinkSurface`, `faucetPhase`, deterministic events and round transitions. `sim.js` samples wetness for grip/drag; `contacts.js` accounts for relative surface elevation. All mechanical constants are in the hashed configuration, with compatibility version `sink-surface-8`.

`sink-scene.js` renders the 3D kitchen with reused effects and instancing. `sink-pixel.js` renders the 2D counterpart, sampling the same wetness mask. `sink-camera.js` fits the rim to the HUD's content bounds; `sink-feedback.js` supplies truthful, prioritized descriptions. `sink.css` scopes the compact HUD to this arena. Classic arenas retain their physical rules and camera.

This remains an arcade height-field model, not a fluid solver or a full rigid-body simulation. The water is a force field with bounded effects. Two cars compete; racing and larger-team modes remain separate future work.

## Validation

Evidence is stored under ignored `output/sink-*` directories. Browser fixtures are injected only into localhost responses by `tests/sink-readability.mjs`; the shipped game has no fixture controls.

- Eight 90-second deterministic physics soaks, covering all four vehicles in both modes and round transitions: 2-9 goals, 28-95 contacts, both hazards and faucet flow in every run, no invalid-state or repair counters. These stability runs continue after three goals to exercise the full ninety seconds; they are not a balance or enjoyment measurement.
- Presentation tests project the complete raised rim into the reserved space across nine viewport sizes and check that feedback agrees with the physical state.
- Screenshot scenarios cover banks, faucet warning/flow/ebb, drain approach, meteor warning/impact and lightning warning/impact. Browser checks also cover live motion, pause, console errors, painted canvas, control placement and drain obstruction.
- Scene probe: 127 draw calls idle and 146 during simultaneous flow/meteor impact, about 61k triangles and six textures. This is a bounded complexity check, not a frame-rate claim for the user's hardware.

Final verification:

- All **125 automated regression tests passed** (`output/sink-refinement-unit-final.txt`).
- **10 renderer/viewport cases and 90 staged screenshots passed**, plus a clean 2D desktop rerun/video, eighteen reduced-motion scenarios, and six focused normal/reduced-motion meteor frames. Initial blank-canvas and label-overlap defects were corrected and rechecked. Both goals remain clear of controls, including at 320x568 and 568x320. On these smallest screens, small floor labels are supplemented by the readable status caption and spatial arrows.
- The existing **eight-case classic arena UI suite passed** on the staged release. Local sink gameplay/netplay passed all **ten checks**, including real goal/reset/rematch behavior, guest boost/tactics/moves, matching hazard targets, environmental continuity across a goal, quick match, disconnect and touch controls.
- Production deployment **dpl_F2NvJPXVf8qer5ZV1ZieG7idZjWN**: https://groketleague-8ualvb37u-rat-benetar-team.vercel.app. Both https://www.groketleague.com and https://groketleague.com serve matching SHA-256 hashes for all 25 checked source/style files; the presence API responds.
- All **seven public-site gameplay/netplay checks passed**, including both renderers, private-room hazard synchronization and guest controls, quick match, disconnect, and mobile controls (`output/sink-refinement-netplay-live/results.json`). No browser or console errors were reported.

The audit records code and behavior checks rather than claiming enjoyment or hardware frame rates. The remaining assessment is human play: whether the environmental choices and clearer spectacle feel satisfying over repeated matches.
