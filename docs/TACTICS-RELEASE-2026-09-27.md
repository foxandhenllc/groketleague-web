# Tactical routing and camera release

The instant camera framing described here was subsequently replaced by the
[continuous camera follow-up](./CAMERA-MOTION-2026-09-27.md) after live motion
and visibility problems were found. The results below describe that earlier release.

Game source: `feec7cd`. This release follows the
[September 25 recovery comparison](./RECOVERY-IMPROVEMENTS-2026-09-25.md).

## Player-visible changes

- Drivers remember a failed board route briefly, choose a reachable shot when
  room opens along the side, and try steeper rebounds after prolonged moving
  board exchanges. The existing stationary-ball recovery remains available.
- A defender already between the ball and its goal holds the shot lane. The
  old retreat detour now applies only when actually retreating from the wrong
  side. Incoming-shot interception also considers turning and acceleration time.
- All five faceoffs retain equal approach distances but use lateral offsets.
  A straight launch along either starting approach misses the goal mouth;
  scoring requires redirecting the ball. Boost and vehicle stats are unchanged.
- The camera checks the local car footprint and ball against viewport margins.
  It widens immediately when necessary and eases back toward the chase view,
  while retaining the castle-scenery bounds. This deliberately becomes a higher
  view when the car and ball are far apart, especially on portrait phones.
- Simulation version `fsd-tactics-5` rejects incompatible online peers. Both
  players should refresh after release. Host authority is unchanged.

## Checks

- 89 simulation tests passed, including existing contact, boost, replay, corner
  recovery and scoring cases, plus new shot-lane and faceoff geometry regressions.
- The broad 160-contest variety check scored in 110 contests, versus 84 at the
  preceding revision. It is a deterministic regression sample, not a balance
  study or human playtest.
- The camera test reprojected 582 active states from the preceding 3D recordings
  at each of 960x640, 390x844 and 844x390: 1,746 checks passed. The test uses the
  actual Three.js projection, and representative desktop/phone screenshots were
  visually inspected.
- The local browser suite passed nine integration checks, including authoritative
  scoring/rematches, private rooms, quick match, mobile and both renderers.
- The hosted candidate passed six smoke checks with no page or console errors.
  Remote smoke tests do not inject synthetic goals; local scoring fixtures are
  deliberately unavailable on the deployed site.

The first recording attempt timed out at startup before a match began. Its cause
was not established. The harness now retains startup screenshots/error messages
for diagnosis; the replacement experiment uses a separate output directory.

## Release process

The existing Vercel project and team were verified before uploading. The candidate
deployment is `dpl_BVmXj8d3bmbZ95FfJMbVYgXUyv7A`, at
`https://groketleague-pdpi68t48-rat-benetar-team.vercel.app`. It was prepared using
`--prod --skip-domain` for verification before promotion to the public domains.
The prior production deployment is `dpl_CQmnu3v71NgTqstNpLff7Mp4cDoM`.

Internal docs, tests, local recordings, environment files and node_modules are
excluded from uploads. Vercel's static configuration remains in effect; there
is no new package installation/build step or Git deployment integration.

## Recorded matches

The new experiment is under `output/capture-matches/tactics-final-20260927/`.
It uses the same eight vehicle/opponent/seed combinations and boost policy as
before, but the revised faceoff geometry intentionally changes the openings.
Every tenth 120 Hz simulation frame is captured through natural results.
Capture timing is not a performance benchmark, and the player and CPU boost
policies are asymmetric. Individual match outcomes do not establish balance.


All eight matches completed naturally, producing 8,275 screenshots. Capture
cadence, source hashes, finite simulation values and diagnostic counters passed;
there were no browser errors. All 3,465 active 3D samples kept the ball within
the specified camera margins. This checks framing, not occlusion by another car.
Overview and longest-slow-span contact sheets were visually reviewed for every
match, plus selected scoring sequences. The complete frame scrubbers remain local.

The equal-weight mean slow-ball share changed from 32.2% to 30.0%; the worst
continuous slow span fell from 11.42 to 7.17 seconds. Total goals changed from
10 to 14. Board proximity barely changed overall (69.8% to 69.2%), with meaningful
regressions in some pairings. The 2D Cybercab match became a goalless draw, and
2D Model 3 remained goalless. These results support a modest overall improvement,
not a claim that board congestion or car balance is solved.

Three of the 14 goals followed rallies shorter than five seconds (3.33, 3.92
and 4.67 seconds). Offset faceoffs remove the straight starting-line goal path,
but AI redirection and boost can still produce fast goals. The camera's higher
view when players separate is a deliberate readability tradeoff.

| Mode / car | Score before -> after | Slow ball before -> after | Near boards before -> after | Longest slow span before -> after |
|---|---|---|---|---|
| pixel / cybertruck | 0-1 -> 2-0 | 19.1% -> 23.9% | 58.8% -> 82.7% | 6.25s -> 4.50s |
| pixel / model3 | 0-0 -> 0-0 | 20.2% -> 23.9% | 84.6% -> 88.7% | 7.25s -> 6.08s |
| pixel / cybercab | 1-0 -> 0-0 | 25.6% -> 29.9% | 87.8% -> 92.7% | 4.25s -> 5.92s |
| pixel / semi | 0-0 -> 1-1 | 47.5% -> 45.8% | 89.2% -> 71.1% | 11.42s -> 7.08s |
| 3d / cybertruck | 0-0 -> 0-1 | 22.6% -> 32.4% | 96.6% -> 59.0% | 7.42s -> 4.25s |
| 3d / model3 | 3-1 -> 0-1 | 36.8% -> 29.7% | 6.5% -> 41.2% | 1.83s -> 4.92s |
| 3d / cybercab | 1-0 -> 3-1 | 39.4% -> 22.4% | 74.5% -> 41.5% | 9.00s -> 1.67s |
| 3d / semi | 2-1 -> 1-3 | 46.8% -> 32.3% | 60.4% -> 77.1% | 8.42s -> 7.17s |

## Public release verification

On September 27, 2026, the tested candidate was promoted successfully. Both
https://www.groketleague.com and https://groketleague.com serve the tested
game: SHA-256 checks match all 11 checked source files, and both presence API
requests passed. Vercel inspection resolves the public site to the Ready
deployment `dpl_BVmXj8d3bmbZ95FfJMbVYgXUyv7A`.

The production browser suite passed all six checks: both renderers, FSD/boost,
pause/resume, private rooms with mixed renderer selections, guest controls and
chat, disconnect, simultaneous quick match, and mobile controls. It recorded no
page or console errors. The separate production layout suite passed all eight
desktop, night, phone and landscape cases with no page errors. Representative
production desktop and phone screenshots were visually inspected.

Receipts are local under `output/tactics-production/` and
`output/tactics-production-layout/`. All eight recording galleries also passed
image loading, keyboard stepping and scrubbing to their final frame. Source
files were unchanged between the candidate checks, recordings and promotion.

Players should refresh existing tabs before starting a match. Online opponents
must both load this simulation version. Remaining limitations are the board
congestion and occasional fast goals quantified above; the release does not
claim to eliminate either in every pairing.
