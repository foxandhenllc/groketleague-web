# Arcade 2D (internal mode: PIXEL)

## Current direction - 2026-09-23

At Fox's request, the old bitmap castle view has been replaced with **CIRCUIT**,
a procedural top-down arcade stadium. The garage labels it **ARCADE 2D**;
`pixel` remains the stored/network mode ID so existing preferences and rooms work.
The old rules requiring castle PNGs, integer 384x216 scaling, and atlas blits are
superseded for this renderer. The legacy assets remain in `assets/pixel/` as reference.

## Sources of truth

| File | Responsibility |
|------|----------------|
| `pixel.js` | Cached stadium, day/night turf, car silhouettes, ball and boost trails |
| `arena.css` | Match scoreboard, menu, boost, chat and responsive layout |
| `arena-layout.js` | One uniform world-to-screen scale; rotation for portrait/landscape |
| `arena-geometry.js` | Shared rounded-corner radius and goal recess depth |
| `characters.js`, `catalog.js` | Shared car stats, 44x68 field and ball radius |
| `sim.js` | Oriented car contacts, board constraints, ball motion and goals |
| `autopilot.js` | Approach, strike, defend, recovery and stalled-ball decisions |

## Geometry and rendering rules

- The logical clamp is `[25, 40, 245, 380]`: 220x340 boundary spans at 5 logical pixels/world unit, giving a 44x68 field.
- The ball is radius 0.9 world units (9 logical pixels in diameter). Draw and collision use `ballRadius(true)`; its screen size changes with viewport scale.
- Cars use their actual width/length and yaw. Do not inflate their painted bodies or add oversized circular hitboxes.
- Round corners use the shared 7-unit radius. Goal mouths are 11 units wide and recesses 5.2 units deep. Render and collision changes must agree.
- Desktop play runs left-to-right (amber starts left); portrait play runs bottom-to-top (amber starts bottom). This is a view rotation only; physics/network coordinates stay x/z.
- The canvas uses native device resolution capped at 2x. Never stretch x and z independently.
- Stadium art is cached until size/theme changes. Only moving objects render every frame. Reduced-motion users get no ball trail or flickering exhaust.
- Keep text out of the canvas. The DOM scoreboard and controls occupy separate bands above/below the arena.
- A chevron marks the local car. The host is amber and guest cyan; the guest's boost meter and identity must follow cyan.

## Driving and contacts

- FSD drives both cars. A human hold requests boost when aligned; the offline CPU chooses its own boost timing.
- Brake before tight turns, approach from behind the ball, retreat goal-side against incoming shots, and reverse out of blocked contacts.
- Recovery measures progress over time. Slow deliberate turns are not automatically considered stuck. A ball-progress timer breaks circling stalemates.
- Car/car contacts use oriented rectangles and mass-weighted separation. Car/ball separation also accounts for mass. Resting/separating contacts never add a kick.
- PIXEL balls remain flat. Shared physics runs at 120 Hz with elapsed-time rolling friction.

## Verification

```powershell
node --experimental-default-type=module --test tests/physics.test.mjs tests/autopilot.test.mjs
$env:GAME_URL='http://127.0.0.1:5173'
node tests/netplay.mjs
node tests/arena-ui.mjs
```

The AI suite checks all four cars' open shots, wrong-side approaches and board recovery,
then runs every car pairing for 90 simulated seconds. The browser suites cover both
renderers, real PeerJS rooms, rematches, day/night, all cars, 320px/390px phones,
phone landscape, live resizing, controls outside the arena and screenshots.
Screenshots and simulation receipts are under ignored `output/`.
