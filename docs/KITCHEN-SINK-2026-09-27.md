# Kitchen Sink arena - September 27, 2026

This is the first-release record (`b5fd37e`). The subsequent [readable physics and graphics pass](KITCHEN-SINK-READABILITY-2026-09-27.md) supersedes its surface forces, event cycle and camera details.

Select **Continue -> Arena -> Kitchen Sink - chaos soccer**. Both Arcade 2D and 3D support the arena, offline matches, private rooms and host-selected quick matches. Rematches retain the arena. Racing was deferred in favor of this arena at the user's request.

## Rules

- Each team defends a colored drain at z +/-23. The opposing drain scores when the whole ball fits inside its four-unit radius and is low enough to fall in. Closed basin ends no longer score goals.
- Raised basin shoulders push bodies back toward the center. The 3D presentation places cars and the ball above the same visual basin height profile.
- A five-second faucet surge occurs in each fourteen-second cycle, accelerating cars and the ball sideways.
- Meteors and lightning alternate. The first warning starts five seconds into a possession; subsequent warnings are eight seconds apart. Locations are seeded from the match/round and frozen when the warning starts.
- A 1.5-second warning circle precedes impact. Meteors apply radial knockback and lift the 3D ball. Lightning applies a smaller impulse and briefly interrupts nearby vehicles' propulsion. Impulses are bounded. Each strike fires once.
- Impact rings, meteor fragments, lightning, faucet flow, and sound communicate the events. Goals shrink/drop the ball into the drain.
- Sink 3D uses a stable wide camera so the drains and hazards can be followed. Short landscape layouts put controls beside the action. Classic camera behavior is unchanged.

## Implementation

`sink.js` owns arena rules and hazard state; shared `sim.js`/`contacts.js` handle sink boundaries and drain goals. `autopilot.js` aims at the actual drains. `sink-scene.js` and `pixel.js` render the kitchen independently of physics. The existing host simulates hazards and sends their state to the guest. The configuration hash includes sink parameters; simulation version is `sink-chaos-7`.

## Validation

- All 110 regression tests pass, including drain scoring, seeded hazards, basin forces and lightning interruption. Targeted final physics/skills/drain checks also passed after follow-up corrections.
- Eight 90-second deterministic sink matches (four vehicles, both views): 1-5 goals per run, meteor and lightning events in every run, no diagnostic repair or safety-cap counters. These are synthetic stability tests, not a claim that balance or enjoyment is settled.
- Eight browser scenarios cover desktop, portrait, small phone and landscape; warning/impact/lightning screenshots inspected. A short-landscape control overlap was corrected and rechecked.
- Local sink gameplay/netplay checks cover scoring, kickoff, offline/online rematches, guest skills, matching hazard positions, disconnect, quick match and mobile controls.
- Browser initialization occasionally timed out while loading external modules during concurrent testing. Sequential reruns and reuse of the same CDN module response in the screenshot test completed successfully; runtime dependencies were not replaced.

Evidence is stored in ignored `output/sink-*` folders. Hazard rate, force and drain size are initial tuning values. The current sink has two competing cars, not a larger team roster or racing mode.

Production deployment: https://groketleague-mxmd74o4f-rat-benetar-team.vercel.app (`dpl_4NoMfuUe9hrhn47oThEuVsgWSXYb`). Both public domains serve matching hashes for all 21 checked files; presence responds. The classic arena UI suite also passes all eight cases on the staged release.
