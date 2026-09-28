# Moon Grand Prix

The first racing release is a 3D, solo bot cup at `/moon.html`. The home screen has
an image button into the race; its primary action still starts 3D Kitchen Sink soccer.
No account, queue, steering controls or dropdowns are required for racing.

## Rooting for a team

Eight drivers form four original teams: Comet Club (Nova and Blip), Moon Mops
(Dusty and Bucket), Budget Boosters (Coupon and Overtime), and Crater Gators
(Chomp and Pebble). Each team has a consistent color, initials and two recognizable
car silhouettes. The selected team persists locally; cup points last for the current
three-heat cup. Both cars score 15 / 12 / 10 / 8 / 6 / 4 / 2 / 1 for finishing positions.
Unfinished racers receive zero. Equal cup points produce a shared championship.

The reference to [Jelle's Marble Runs](https://jellesmarbleruns.com/collections/team-marbles)
informed the emphasis on named, recognizable teams and spectator investment.
No names, logos, audio or artwork from that series are reused.

Watch & root enables autonomous driving and boost for the whole grid. Time your
boost gives Space, either Shift key or the touch button to the first driver on your
team; the second remains autonomous. Boost spends a recharging reserve. A burst
at cruising speed on a straight is more useful than spending it while still
accelerating from rest or while fighting a bend. Pause and hidden-tab behavior stop
the offline race, and clear held inputs. Leader and Circuit views are optional.

## Course and spectacle

The shared track curve is approximately 634 metres long. Two laps form a heat.
Grids, driver pace, driving styles and hazard phase vary by seed. Overtaking uses
traffic-aware lane selection; drafting supplies a modest speed and reserve benefit.
The inside lane is physically shorter. There is no prescribed winning team,
scripted finishing order or position-based catch-up multiplier.

- Space-ish: a fictional launch hangar, Tall-ish rocket and prototype exhaust lane.
  The orange strip warns before the plume activates and pushes cars outward.
- Low-G Skyway: a cyan runway crest launches cars carrying enough speed. Arcade
  gravity and reduced air steering provide long jumps and visible landings.
- Crater Cut: a differently colored, dusty section reduces lateral grip.
- N.A.P.S.: the National Agency for Procrastinated Spaceflight. A moving cargo
  crate crosses the circuit under a crane; the crate's visible lane and collision
  lane use the same function. A dish, habitats, solar panels and Roverdraft rover
  dress the base.

All buildings, props, textures, names and space signs are original procedural work.
They use no real space agency or company logos. The existing game's vehicle meshes
are recolored and normalized to the racing collider length. The goal is comic space
base scenery, without recreating branded rockets or facilities.

Race standings identify both teammates; announcements explain contact with hazards,
airtime and confirmed lead changes. The first finisher gets a banner, sound and
confetti while the rest finish. The cup table follows with next-heat and rematch buttons.
Camera follow uses a fixed world heading and eased translation, with no automatic
turn-by-turn spins or cuts. Portrait framing reserves space beside the standings.
Nearby signs are capped in screen size and fade if they cover the followed racer.
Reduced motion disables dust/confetti and uses gentler follow.

## Implementation boundaries

- `moon-track.js`: pure track geometry, sectors and hazard positions/timing.
- `moon-sim.js`: seeded race state, 120 Hz stepping, lane dynamics, airborne motion,
  collision footprints, ordered checkpoints, finish times and points.
- `moon-scene.js`: road mesh from that same curve, lunar terrain and facilities,
  reused vehicle meshes, presentation and smoothed cameras.
- `moon.js`: setup, keyboard/touch controls, pause, cup progression, HUD and audio.
- `moon.html` / `moon.css`: responsive setup, race HUD and result dialogs.

Racing follows a constrained course, with lateral dynamics and arcade jumps. It is
not an unconstrained rigid-body driving simulator. The separate entrypoint leaves
soccer physics, room authority and network protocols unchanged. The release has
no racing multiplayer, streaming integration, persistent league or race replay UI.
`?seed=...` repeats a cup seed, including each heat suffix, for reproducible reports.
`render_game_to_text()` is a read-only diagnostic; no mutable test controls ship.

## Verification

`tests/moon-physics.test.mjs` checks deterministic replay, unbiased team selection,
closed-track continuity and safe curvature, controls, countdown, jump/landing,
missed ramps, hazard impulses, two-lap finishing, scoring and 32 seeded heats.
The 32-heat check requires all 256 starters to finish, all teams to produce winners,
finite bounded states and no stuck-recovery intervention. Existing soccer physics
and autopilot checks run alongside it.

`tests/moon-race.mjs` exercises eight three-heat cups with real simulation and camera
updates, including all four teams, watch/manual boost, simultaneous held keys,
pause, camera choices, rematches, points and responsive layouts down to 320x568 and
568x320. Its local-only injection accelerates time but does not choose race winners
or force finish positions. Screenshots are sampled through each first heat and at
results. A public run uses real wall-clock time with no module interception.

`tests/home-flow.mjs` and `tests/arena-ui.mjs` check the existing soccer entrypoints
and desktop/mobile play after adding the Moon card. Evidence is under
`output/playwright/`; production source hashes and a public browser race are checked
before announcing the release live.

Early visual review caught reversed road triangles, an inside edge folding through
a tight corner, oversized signs, crowded car labels, and a portrait view that put the
followed car too close to the standings. Those were corrected before release. A
test now guards the minimum corner radius. These checks establish functionality
and a first balance sample; they do not establish perfect balance or guaranteed
frame rates on every phone.
