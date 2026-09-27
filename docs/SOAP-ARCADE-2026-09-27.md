# Kitchen Sink: soap arcade pass

Select **Continue -> Kitchen Sink -> 3D -> Play**. Autonomous driving stays in place: time boost with Space/Shift, call Attack/Auto/Defend with A/S/D, and use the vehicle's signature move with E or the touch buttons.

## What changed

- A beveled, glossy pink bar replaces the sphere in 3D Kitchen Sink. It leans against banks, tumbles in flight, leaves contact-only suds and casts a landing shadow. The old circular locator no longer masks its rectangular silhouette; an edge indicator remains available outside the safe play area.
- Soap keeps momentum on steel, with still less drag in the wet lane. The upper banks redirect uphill momentum into an inward aerial while preserving motion along the bank. It lands against the same height field used by the renderer and carries speed into its next slide. Cars stay on the ground.
- Soft lip forces return soap to the bowl. Sustained car/bank pins receive a small visible slip-and-hop impulse after 1.2 seconds of inadequate progress. There is no recovery teleport. Fast, low drain approaches use swept entry detection, including rim grazes; high aerials clear the hole.
- A scored soap bar starts its celebration at the actual entry transform, spirals inward, drops below the drain, then releases team-colored bubbles and ripples. Cars coast during the 2.65-second sequence. The winning goal also completes its celebration before results appear.
- The sink camera gently tracks play, widens a little for fast/aerial motion, and makes one smooth goal push before returning. It does not cut, shake or change its field of view. Reduced motion keeps the wide composition and quiet drain animation.
- Launch, landing, slip, catch, flush and bubble sounds mark the physical beats. Brief captions explain airtime and pin release. Existing surface/hazard warnings keep their priority during live play.

This is the arcade feel requested by the user: readable bank-to-air-to-slide motion and exaggerated goal payoff, inspired by the supplied THPS and Wayne Gretzky hockey references. No external artwork was copied. The core remains a custom height-field simulation with a circular contact proxy, not a general rigid-body or fluid solver. Soap's long dimension matches the two-unit collision diameter; its thinner width is a deliberate arcade approximation.

## Ownership and timing

`soap-physics.js` owns authoritative height, launch/landing, orientation, lip return, anti-pin release and swept capture. `SINK.soap` in the hashed simulation configuration holds tuning. `soap-scene.js` renders the bar, suds and drain choreography; `sink-scene.js` holds bounded celebration effect pools. `sink-goal.js` owns the serializable score timeline. `sink-camera.js` supplies continuous composition and damping.

Only the host advances physics and goal age. The guest receives the full soap and goal state, interpolates presentation and never invents scores. Offline pause freezes the celebration. Online menus leave host simulation running. Compatibility version `soap-arcade-9` prevents mixing the old ball simulation with this version.

## Validation

Evidence is in ignored `output/soap-*` directories. `tests/soap-browser.mjs` injects fixtures only into localhost responses; no fixture controls ship.

- All 141 automated regression tests passed. New tests cover bank tilt, four launch directions, observable airtime and landing, sliding drag, swept drain entry, a driven semi pin, passive car coasting/collision, goal timeline and camera continuity/pause/reduced motion. The five camera/presentation tests passed again after the final small-screen framing change.
- Eight seeded 90-second simulation soaks cover every car with varied opponents and kickoff layouts. They recorded 3-8 goals, 24-45 touches, 6-16 launches and 8.05-17.71 seconds airborne per run. The longest continuous low-speed spell was 4.49 seconds; no invalid-state or safety-repair counters were recorded. These extend beyond first-to-three to stress the full duration and do not measure enjoyment or competitive balance.
- Rendered audits cover 1440x900, 390x844, 844x390 and 568x320; both scoring directions on phones; actual launch/landing; coasting; exactly one score; all celebration phases; pause/resume; uninterrupted winning goals; reduced motion; and share-card image content. Final runs reported no browser exceptions or check failures. Software screenshot encoding initially missed short phases, so phase captures now hold deterministic simulation ages; the winning goal also runs uninterrupted with per-frame telemetry. Camera telemetry uses animation-frame timestamps, avoiding sampling-time inflation.
- The 568x320 controls were tightened after visual review: active width grew from 256 to 336 pixels while tactic targets remain 44x44 and primary controls 104x44. Soap is still small at this viewport, but the pink bar and aerial shadow are more readable. During goal close-ups the inactive opposite drain may move behind controls; the scoring drain stays clear, and the camera returns to the full play composition.
- Local gameplay/netplay passed all 11 checks, including a private 3D room, identical captured entry state, a single score, advancing guest presentation age, frozen match/environment clocks during celebration, a complete winning goal, same-session rematch, guest controls, hazard synchronization and quick match (`output/soap-netplay-local/results.json`). The existing eight-case classic arena UI suite passed on the staged deployment; desktop and phone screenshots were inspected (`output/soap-classic-ui-candidate`).
- Deployment `dpl_3zu7hhADtQkB8JwkHTrs2axkv7Tp`, https://groketleague-jv7850vvn-rat-benetar-team.vercel.app, was promoted to both public domains. Both https://www.groketleague.com and https://groketleague.com serve matching SHA-256 hashes for all 28 checked runtime/style/HTML files and a responding presence API.
- A naturally scored public-site 3D match completed the celebration and returned to the next kickoff. Observation recorded 24 frames, goal ages 0.083-2.567 seconds and exactly one score throughout; no fixture changed the live game state (`output/soap-netplay-live/natural-goal.json`).
- All eight public-site gameplay/netplay checks passed, including that natural goal, a private 3D room, shared hazards, guest controls, live menus, disconnect, quick match and mobile controls. No browser or console errors were reported (`output/soap-netplay-live/results.json`).

Desktop/mobile browser tests use Chromium with software WebGL. They verify behavior and presentation, not hardware frame rates. Subjective enjoyment remains a human playtest judgment.
