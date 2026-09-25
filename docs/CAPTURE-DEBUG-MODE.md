# Local full-match screenshot debugger

Run from the repository root, with the local game server running:

```powershell
$env:GAME_URL='http://127.0.0.1:5198/'
node tests/capture-matches.mjs
```

The command prints its absolute output directory. By default each experiment gets
a new timestamped directory under `output/capture-matches/`. To choose another
directory, set `QA_OUT` before starting. Use a new directory for each experiment.
These outputs are ignored by Git. No files are uploaded or deployed.

The standard experiment runs eight full offline games: every selectable player
vehicle in both pixel and 3D mode. Opponents and match seeds are specified in the
script. `CAPTURE_RUN`, if supplied, selects a single run ID from that matrix.

Every tenth 120 Hz simulation frame is saved as a 960x640 JPEG, including the
countdown, goal celebrations and the final result. The last image can be a partial
ten-frame interval when the match ends. Each full match ends naturally on three
goals or 90 active seconds. There are no injected goals or early timer expirations.

The harness pauses stepping while it writes each screenshot. Goal-celebration
timers use the same simulated clock. This makes capture cadence independent of
disk/GPU speed; it is **not a real-time performance test**. Toast and impact-effect
expiration still use the browser's wall clock, so their duration in the image
sequence is not a reliable presentation measurement.

Player boost is a repeatable, geometry-based 0.3-second pulse; the opponent uses
the normal automatic policy. This is useful for repeated gameplay observations,
but it is not a human skill test or a symmetric vehicle balance experiment.

## Files and review

- `manifest.json`: revision, source hashes, setup, outcomes, image counts and errors.
- Each run's `frames/`: complete chronological screenshot sequence.
- Each run's `states.ndjson`: matching positions, velocities, planner states,
  targets, boost, score, frame number, seed and camera projection for every image.
- `progress.json`: checkpoint while a run is in progress.

Build the review pages and contact sheets after capture (or for already completed
runs while the remaining experiment continues):

```powershell
python tests/review-captures.py output/capture-matches/YOUR-EXPERIMENT
```

Python requires Pillow; Node requires Playwright and its Chromium browser, already
available in this workspace. Open the generated `index.html` through the local
server, for example `/output/capture-matches/YOUR-EXPERIMENT/index.html`.
Each run has a scrubber, playback speed, exact frame/score labels, an overview
sheet and focused sheets for goals and candidate problems.

Analysis thresholds are descriptive: slow ball means planar speed below 1 world
unit/second; near boards means `abs(x)>18` or `abs(z)>30`; a possible orbit is a
six-second window with car travel above 20 units, net ball displacement below 4,
and mean car-to-ball distance below 12. These flag images to inspect, not proven
bugs. Camera clipping metrics concern the ball's center in 3D and do not detect
occlusion by another mesh.

Debug hooks are injected into the Playwright browser's localhost `main.js`
response. Ordinary game tabs do not receive those hooks. If the source no longer
matches an instrumentation point, the runner fails instead of silently capturing
a different timing setup.
