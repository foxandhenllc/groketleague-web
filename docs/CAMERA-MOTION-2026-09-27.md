# Continuous 3D camera follow-up

The live screenshot audit and player feedback exposed a gap in the earlier
framing checks: an on-screen ball did not guarantee a readable, comfortable view.
The old renderer clamped camera height to 18 each frame, then its framing solver
could immediately raise it much higher in 12% steps and replace the aim point.
The chase direction also followed every turn of the car.

## Changes

- A persistent damped controller now owns the play camera. It follows a stable
  field direction for each player, rather than orbiting with vehicle steering.
- Target movement, elevation and chase distance ease continuously. Camera
  rotation has an explicit speed limit. The zoom solver uses a scratch camera
  and continuous bisection, never an immediate change to the rendered camera.
- Zoom is capped at 36 world units high on wide screens and 48 on portrait.
  Distant action may temporarily leave the view; an inset arrow locates the ball.
- A small screen-space ring marks a ball obscured by a vehicle or scenery, or
  too small to read. The cue is hidden in menus, during pause, and in 2D.
- Fog distances compensate for camera elevation. The coarse-pointer boost
  meter is back at the bottom, including short landscape screens.
- Camera shake on goals is removed. Physics, vehicle stats, AI and the online
  simulation version are unchanged.

## Motion regression

`tests/camera-motion.mjs` replays a checked-in 712-state Semi trajectory through
the actual renderer controller, interpolated to 60 Hz. It includes faceoff
position resets. Each of three viewports produces 3,555 measured camera updates.
It also renders a two-second screenshot sequence at 30 simulated frames per
second. These are controlled trajectory measurements, not device FPS benchmarks.

| Viewport | Largest old / new movement per update | Largest old / new rotation |
|---|---|---|
| 1280x800 | 20.03 / 0.38 world units | 56.53 / 0.39 degrees |
| 390x844 | 28.73 / 0.42 world units | 56.47 / 0.39 degrees |
| 844x390 | 20.03 / 0.38 world units | 56.53 / 0.39 degrees |

All 10,665 new-camera updates passed the motion/height bounds. Explicit browser
fixtures also passed for an occluded-ball ring, an offscreen arrow and hiding
the cue while paused. The short rendered sequences were visually reviewed.
`tests/framing-browser.mjs` now delegates to this temporal regression instead
of testing only isolated instant-zoom poses.

The baseline used the main/camera source saved from production revision
`2af2566` before editing, under `output/camera-motion-before/`. New evidence is
under `output/camera-motion-final/`, with previews under
`output/camera-motion-after/`. The fixture preserves positions and dimensions,
not the complete prior simulation internals.

## Additional validation

- All 89 simulation checks passed.
- Eight responsive layout cases passed, including 3D portrait and landscape.
- The local online guest check passed 3D tracking, touch viewport rotation in
  both directions and menu/resume, with inspected screenshots.
- Four natural-result local matches completed across all vehicles and the four
  desktop/phone sizes, with 177 sampled screenshots and no uncaught page errors.
  Whole-match overview sheets and representative original frames were reviewed.
- The browser scoring fixture now starts a fresh match before its controlled
  three-goal phase. Previously, a real goal during the earlier boost check could
  invalidate its assumption that scoring still started at zero.
- The final local integration rerun passed all nine checks, with no page or
  console errors (`output/camera-smooth-browser-final/results.json`).
- A concurrent browser run encountered startup timeouts; the gameplay suite
  recorded connection-refused resource errors. Those failed attempts are
  retained. A simple fresh boot succeeded; full-match capture was restarted
  sequentially. The precise cause of the intermittent startup failures was not
  established, so they are not counted as passing runs.

This is a calmer, elevated view with bounded zoom. It intentionally uses a ball
cue instead of forcing every ball position into view with an abrupt zoom. The
motion replay does not prove every random match or device will render smoothly.

## Release

Game revision `f87533c` was deployed to the existing Vercel project as
`dpl_knyNeiupAomgta2Rn4XKc2EhF7QH`. The candidate's online 3D guest, rotation and
resume checks passed before promotion. Both public domains then returned exact
SHA-256 matches for all 11 checked source files and working presence responses.
The preceding deployment is `dpl_BVmXj8d3bmbZ95FfJMbVYgXUyv7A` if rollback is
needed. Internal test fixtures, docs and recordings remain excluded from uploads.

All six public-site browser checks passed, with no page or console errors:
both renderers, boost/pause/resume, private rooms, disconnect, quick match and
mobile controls. Evidence is under `output/camera-smooth-production/`.
