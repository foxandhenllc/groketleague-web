# Eight full-match screenshot experiments

The main problem is no longer identical kickoffs. Different openings still
converge on wall stalemates, while an open central lane can produce repeated
straight-line goals. The capture experiment also exposed a serious 3D camera
obstruction that position-only tests missed.

## Evidence and method

All eight matches used game revision `fa32261`, four player vehicles in both
renderers, different opponents and fixed seeds. No gameplay changes were made
between runs. Seven reached 90 active seconds; the last ended naturally at three
goals after 68.375 active seconds. The experiment saved **8,809 screenshots**,
one every ten 120 Hz simulation frames, plus the final partial interval where
needed. Captures include countdowns, celebrations and results.

The complete local evidence is in
`output/capture-matches/review-20260925/` (approximately 488 MB with metadata and
review sheets). Open the [sequence gallery](http://127.0.0.1:5198/output/capture-matches/review-20260925/index.html).
Each sequence has playback, a scrubber, frame labels and raw game state.

Visual review covered all eight whole-match overview sheets, detailed slow-ball
sequences for every run, extra orbit sequences, all three Semi scoring sequences,
and selected full-resolution frames. This is a review across each entire match,
not a claim to have individually inspected every screenshot at full resolution.
All retained screenshot files and capture intervals were checked. Browser error
lists were empty, sampled positions/velocities were finite, and no simulation
diagnostic counters were raised.

The player uses a repeatable geometry-based boost pulse; the opponent uses its
normal automatic policy. These are not symmetric balance trials or human
playtests. Capture pauses stepping during image writes, so wall-clock performance
and transient toast/effect durations cannot be judged from this experiment.

## Results

Scores are player–CPU. Percentages use active sampled play only. "Slow" means
ball planar speed below 1 world unit/second. "Near board" means `abs(x)>18` or
`abs(z)>30`; it does not alone establish a defect. Longest slow spans include
one sampling interval and are approximate.

| Run | Mode | Player / CPU | Score | Images | Slow ball | Near board | Longest slow span |
|---|---|---|---|---:|---:|---:|---:|
| 1 | 2D | Cybertruck / Model 3 | 2–0 | 1,144 | 44.9% | 78.3% | 10.7 s |
| 2 | 2D | Model 3 / Cybercab | 1–0 | 1,132 | 37.4% | 60.7% | 13.3 s |
| 3 | 2D | Cybercab / Semi | 2–0 | 1,144 | 29.0% | 60.6% | 6.0 s |
| 4 | 2D | Semi / Cybertruck | 1–0 | 1,132 | 58.2% | 78.9% | 13.7 s |
| 5 | 3D | Cybertruck / Cybercab | 0–0 | 1,120 | 62.9% | 92.6% | 18.4 s |
| 6 | 3D | Model 3 / Semi | 0–0 | 1,120 | 79.4% | 88.8% | 24.4 s |
| 7 | 3D | Cybercab / Cybertruck | 0–0 | 1,120 | 66.9% | 88.1% | 23.2 s |
| 8 | 3D | Semi / Model 3 | 3–0 | 897 | 53.0% | 5.0% | 9.8 s |

## Findings, in recommended implementation order

### 1. Align the ball, car and planner side boundaries in 3D

This is a confirmed geometry inconsistency, with its exact causal contribution
to stalemates still requiring an isolated before/after experiment. `sim.js` and
`contacts.js` allow the ball an additional 0.9 units at the side board. The planner
clamps its predicted ball position to `halfW - radius`, without that allowance.
With the current radius this means a ball can sit at x=22.3498 while the planner
targets a predicted x no greater than 21.4498. Cars use another footprint clamp.

In runs 5 and 6, the actual ball was beyond the planner's x envelope in 75.7% and
81.9% of active samples respectively. Run 6 at capture time 57.17 s records
ball x=22.3498. Fix the shared playable geometry and verify that a legal ball
position can be approached with the full car footprint.

### 2. Recovery needs to change the route, not repeat the failed setup

Run 1, 53.67–64.25 s: both cars repeatedly approach/reverse around a slow ball
in the corner. At 59 s the opponent sits around (12.42, -31.89), targeting
(12.43, -32.60), while the ball is around (20.65, -29.31). It is close to its
target but far from the ball. The stuck detector requires target distance above
2, so this kind of waiting can escape detection until the separate seven-second
stale-ball timer fires.

Run 4, 27.75–41.33 s: repeated low-progress attempts at the goal mouth. Run 6,
30.42–54.75 s: the ball remains slow while both vehicles switch among approach,
clear and recovery. The new peel-away behavior sometimes returns to the same
blocked route. Width-only target margins also do not guarantee a reachable
rotated footprint or a path through a rounded corner.

Use footprint-aware reachable targets, detect lack of *ball/contact progress*,
and commit to a different exit angle after a failed approach. Test stationary
corner balls and goal-mouth pins for every vehicle and side.

### 3. Defense reacts too late to straight powered shots

Run 8 stayed mostly away from the boards and scored at capture times 50.00,
67.92 and 73.58 s. All three scoring sequences show a fairly direct powered
run; the lighter opponent ends up chasing or retreating alongside it.

For the first goal, at 47.92 s the ball is already moving goalward at roughly
21.5 units/second, but the defender is still in `approach`. At 48.75 s it is
in `defend`, with the ball already past its longitudinal position. The existing
threat trigger waits for a fast incoming ball within a limited own-end region.
Anticipate the opponent's lined-up shot and select an interception point before
the shot has already passed. These eight trials do not establish that the Semi
is universally overpowered: vehicle, opponent, seed and boost policy differ.

### 4. The 3D camera needs obstruction handling

Run 6 at 57.17 s, frame 6860: the camera is at approximately (25.97, 8.2, -42.02),
behind castle geometry. The tower fills almost the entire gameplay view and
hides both the ball and cars. Yet the ball's projected x/y remain inside the
viewport. Similar obstruction appears in later frames and in run 7.

The chase camera follows a fixed offset without a wall/tower visibility test.
Shorten or move the chase position when blocked, or fade obstructing scenery;
verify actual rendered visibility, not just projected coordinates.

[Full-resolution obstruction example](../output/capture-matches/review-20260925/6-3d-model3/frames/006860.jpg)

### 5. Minor HUD overlap

At the captured 960x640 viewport, the 3D Menu button overlaps the lower-right
part of the player's score panel. Give the controls separate layout space.
This is visible in the same full-resolution evidence frame.

## Next verification pass

Implement shared boundaries and reachable wall escape routes first, then the
camera visibility fix and anticipatory defense. Rerun the same eight seeds,
opponents and boost policy, comparing scoring sequences, low-progress spans,
time spent near boards and screenshots. Add mirrored-policy/side trials before
claiming vehicle balance. More kickoff randomness should follow those fixes,
not substitute for them.

The reusable capture commands and timing limitations are in
[CAPTURE-DEBUG-MODE.md](CAPTURE-DEBUG-MODE.md). This report and the harness are
local; no production deployment was performed.
