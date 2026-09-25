# Board recovery, interception and camera follow-up

Implementation revision: `0f4cd45`. This follows the findings in
[the original eight-match review](./CAPTURE-REVIEW-2026-09-25.md).

## Changes

- Both arenas use 7-unit rounded corners. The 3D ball's extra 0.9 units of side
  space are removed, and low rails show the physical boundary. Goal recess
  behavior remains mode-specific; this is not the entire geometry roadmap.
- Setup targets fit the full car footprint. Near boards, drivers select a bank
  approach that can be reached from inside the field. A stalled car reverses,
  commits to an inward escape, then chooses a fresh approach. Low ball progress
  triggers clearing after 2.5 seconds rather than seven.
- Defenders react to an opponent lining up a shot and intercept incoming balls
  sooner. Vehicle-specific defensive ranges remain. Equal-distance opening
  contests do not make both cars hang back merely because they face the ball.
- The chase camera stays inside the outer castle scenery, with a higher view
  near boards. This prevents the old viewpoint behind a tower. It is not a
  general mesh-occlusion detector.
- The 3D Menu button sits below the score boxes. Host authority is unchanged;
  the updated simulation version rejects incompatible peers.

## Automated validation

- 87 simulation tests passed. These include footprint checks at 24 headings in
  all four corners for every car in both modes; all 32 stationary-corner cases
  move the ball at least five units without boost within 15 seconds; an
  anticipatory defense fixture; camera bounds; and existing physics, replay,
  boost and variety checks.
- The broad variety test sampled 160 CPU contests across all ordered vehicle
  pairs and five openings in both arenas. 84 scored within 90 seconds. This is
  coverage of finite, distinct trajectories, not proof of balanced vehicles.
- Nine browser integration checks passed, including offline goals/rematches,
  private-room score synchronization, guest controls, quick match and mobile.
  Browser/page error lists were empty.
- Eight responsive layout cases passed: five Arcade 2D sizes/themes and three
  3D sizes, including the recording viewport and portrait/landscape phones.
  Screenshots of the three 3D cases were inspected for the Menu/score fix.

The first integration attempt exposed a fixture race: the online forced-goal
check could run during an existing goal celebration and assumed the score was
still zero. It now waits for unlocked play and checks the next score. The final
integration run passed; the failure was not hidden by relaxing game behavior.

## Full-match comparison

The comparison uses the original eight seeds, vehicles, opponents and boost
policy, with every tenth 120 Hz frame saved through natural results. Baseline
evidence remains under `output/capture-matches/review-20260925/`; new evidence
is under `output/capture-matches/improvements-20260925/`. Each manifest records
source hashes. These are local ignored outputs, not uploaded assets.

The screenshot loop pauses simulation during writes. It is not a frame-rate
benchmark; wall-clock toast/effect durations are not comparable. The player and
CPU have different boost policies, so match scores are not a balance study.

All eight matches completed naturally and saved **8,249 screenshots**. Every
retained file and capture interval was checked, all sampled positions/velocities
were finite, source hashes matched, and browser error lists and diagnostic
counters were empty. All 3,487 active 3D camera samples stayed within the new
viewpoint bounds. Visual review covered every run's overview and longest-slow
sequence, run 3's goal, all goals in runs 6 and 8, and selected full-resolution
frames. It did not inspect every image individually at full resolution.

The mean slow-ball percentage across the eight matches fell from **54.0% to
32.2%**. Each individual run improved on both slow-ball percentage and longest
slow span. The worst span across the set fell from **24.4 to 11.4 seconds**.
This is a descriptive comparison of these eight setups, not a statistical claim
about every match. The two experiments have different match lengths because a
game ends when either side scores three goals.

## Remaining problems

1. **Movement is not always useful attack.** Five of eight runs spend a larger
   share near boards, despite shorter stalls. Model 3 and Semi in 2D now draw
   these setups. Future routing should choose an exit into a shooting lane and
   remember failed board approaches, instead of accepting repeated end-to-end
   board exchanges. Retain these recordings as regression cases.
2. **Fast faceoff goals still occur.** Run 6's final two player goals follow
   rapid central shots; earlier defense alone does not guarantee a save. Test
   defensive approach selection against arrival time and braking/turning limits.
   Do not claim vehicle balance from these asymmetric boost policies. Total
   goals changed only from nine to ten; both experiments have three draws.
3. **Camera obstruction and framing are different.** Reviewed corners no longer
   disappear behind the castle towers. The ball can still leave the viewport
   while the camera follows a turning/reversing car: the longest new offscreen
   episode is about 4.2 seconds in run 6 (15.00-19.08 capture seconds). A future
   framing pass should include the ball and local car in the view, preserving
   the new scenery bounds. Other vehicles can also briefly obscure the ball.
4. **Recovery is improved, not eliminated.** The longest remaining low-motion
   episode is run 4 at 65.33-76.67 seconds, with the Semi working a board ball.
   The 15-second isolated-corner test is not the earlier roadmap's stricter
   four-second recovery target; this pass does not claim to meet that target.

The changes are a measurable reduction in dead time and fix the confirmed
boundary mismatch, tower viewpoint and Menu overlap. They are not a complete
solution to tactical variety or the full physics/art roadmap.

Open the [new recording gallery](http://127.0.0.1:5198/output/capture-matches/improvements-20260925/index.html)
or the [original gallery](http://127.0.0.1:5198/output/capture-matches/review-20260925/index.html)
while the local server is running.

## Per-match comparison

Scores are player-CPU. Slow means planar ball speed below one world unit per
second. Near boards means `abs(x)>18` or `abs(z)>30`. Values are rounded; neither
metric alone establishes whether play is interesting.

| Mode / player | Score before -> after | Slow ball before -> after | Longest slow span before -> after | Near boards before -> after |
|---|---|---|---|---|
| pixel / cybertruck | 2-0 -> 0-1 | 44.9% -> 19.1% | 10.7s -> 6.2s | 78.3% -> 58.8% |
| pixel / model3 | 1-0 -> 0-0 | 37.4% -> 20.2% | 13.2s -> 7.2s | 60.7% -> 84.6% |
| pixel / cybercab | 2-0 -> 1-0 | 29.0% -> 25.6% | 6.0s -> 4.2s | 60.6% -> 87.8% |
| pixel / semi | 1-0 -> 0-0 | 58.2% -> 47.5% | 13.7s -> 11.4s | 78.9% -> 89.2% |
| 3d / cybertruck | 0-0 -> 0-0 | 62.9% -> 22.6% | 18.4s -> 7.4s | 92.6% -> 96.6% |
| 3d / model3 | 0-0 -> 3-1 | 79.4% -> 36.8% | 24.4s -> 1.8s | 88.8% -> 6.5% |
| 3d / cybercab | 0-0 -> 1-0 | 66.9% -> 39.4% | 23.2s -> 9.0s | 88.1% -> 74.5% |
| 3d / semi | 3-0 -> 2-1 | 53.0% -> 46.8% | 9.8s -> 8.4s | 5.0% -> 60.4% |
