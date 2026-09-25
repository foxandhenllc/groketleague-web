# Gate A - first playable slice

Status: **implementation ready for hands-on review; Gate A not yet accepted**. Local branch: `codex/first-playable-slice`. Base: `304e880eb9541b77dd85c506033343450f6440de`. No push or production deployment.

## What changed

- An immutable runtime configuration (`simulation-config.js`, sourced from character stats) feeds per-instance simulation, derived footprints and the compatibility hash. The initial configuration-only migration matched four baseline traces exactly before behavior changes.
- Protocol 2 blocks mismatched rules/modes before play. Connected rematches retain PeerJS while changing match ID. Impact events have bounded resend, explicit acknowledgments, epoch isolation and guest deduplication.
- Matches use a translation-only coupled contact solver: four velocity/two position passes, accumulated impulses, one restitution target per activation, zero bounce for opposing constraints, and separate positional correction. Contact points drive small visible marks; correction never generates a hit effect.
- Boost has explicit hold/release/recharge states. Holding cannot recharge or restart after depletion. Keyboard/touch cancellation clears intent. The speed controller separates boost targets, service braking and physical overspeed.
- Four-car bumpers match collision footprints in Canvas and Three.js. Three model nose is -Z with the old pi adapter removed. Model 3 receives a clear roof treatment. Ball geometry derives from the physical radius, and rolling is elapsed-time based.
- Bounded opt-in replay diagnostics, maintained policy/visual/browser fixtures, and current source documentation accompany the implementation.

## Verification

| Check | Result / receipt relative to repository root |
|---|---|
| Original simulation baseline | 38/38; `output/first-playable-slice/baseline/simulation.txt` |
| Current original + added unit/invariant tests | 66/66; `output/first-playable-slice/final-unit.txt` |
| Repeatable jam/open-shot traces, both modes | Four repeat identically; `output/first-playable-slice/final-replays/` |
| Existing PeerJS/gameplay suite | 9/9 reported checks; `output/first-playable-slice/final-browser/results.json` |
| Responsive UI | Five viewport/theme cases and resize; `output/first-playable-slice/review-ui-retry/arena-ui-results.json` |
| New browser contracts | Five boost labels, keyboard blur, captured pointer release/cancel, real two-client config mismatch; `output/first-playable-slice/review-contracts/results.json` |
| Geometry / visual review | All four cars at four cardinal yaws in both modes; `output/first-playable-slice/final-visual/bounds.json` and contact sheets |
| Controller measurements | `output/first-playable-slice/controller/measurements.json`; direct acceleration t90 1.13-1.36 s, turn-radius estimates 4.4-10.3 units at speed 10 |
| Synthetic policy comparison | Four matched configurations of 1,024 trials each, all with zero ball-cap activations after response correction; `output/first-playable-slice/final-{control,heavy,economy,restitution}/probes.json` |
| Final control repeat | 1,024 trials, zero cap/repair counters, one uninterrupted direct held burst/car and zero post-depletion restarts; `output/first-playable-slice/review-control/probes.json` |

Commands are in [INDEX](INDEX.md); added tests are `tests/slice.test.mjs`, `tests/slice-browser.mjs`, `tests/slice-visual.mjs`, `tests/replay.mjs`, `tests/boost-policy.mjs`, and `tests/controller-probes.mjs`. Evidence is ignored local output, not a portable dependency. Runners regenerate it. Browser recordings under the contract suite are explicitly automated, including injected state-label fixtures; they are not human playtests.

The direct service-brake distances from speed 15 are 1.89-2.54 units, excluding decision/reaction delay. Three cars stop shorter than the plan's 2.5-unit lower target. This is a recorded feel deviation, not a claim that all proposed handling targets passed. Real hardware timing, audio perception, second-network latency and the final 6-8-person agency gate remain unmeasured.

## Collision-response refinement discovered during implementation

Constant baseline restitution caused genuine fast powered return shots to exceed the 55-unit/s safety bound. The first captured case was two boosted trucks returning the ball at 68.77 units/s. The initial unbounded control matrix counted 798 cap activations; simply trying lower boost economy or .86 heavy restitution did not eliminate them.

The solver now reduces the bounce target for extreme car/ball returns using the remaining normal-speed allowance under a **48-unit/s launch envelope**. It applies one equal-and-opposite impulse, preserving horizontal momentum and passive energy bounds; it does not clip the post-hit ball velocity. It never reduces below the zero-restitution constraint solution. The 55-unit/s guard remains diagnostic, and pathological imposed tangential/actor speeds can still fail it. This is an explicit refinement to the source plan's initially constant material response, covered by a minimized return-shot regression and the zero-cap policy matrix.

Physics lift is independent of effect cooldown. Pair effect cooldown survives brief separation, and persistent contacts cannot repeatedly reuse a bounce target. Standalone legacy pair helpers remain only for existing baseline regression compatibility; live matches and the new replay/policy harness use `solveContacts`.

## Tuning decision

The following are mean controlled-side goal differences under the specified synthetic opponent and scenario mix. They are not human win rates or a balanced competitive population. The opponent uses the same boost FSM; the four policies differ only in intent scheduling. Rows retain the plan's seeds, ordered car pairings, modes and mirrored sides.

| Configuration | Pixel HOLD | Pixel TIMED | Timed minus hold | 3D HOLD | 3D TIMED | Timed minus hold | Decision |
|---|---:|---:|---:|---:|---:|---:|---|
| Control | 0.594 | 0.781 | +0.187 | 0.727 | 0.547 | -0.180 | Retain as review baseline |
| Heavy handling / drag | 0.336 | 0.609 | +0.273 | 0.242 | 0.750 | +0.508 | Reject: semi wrong-side approach regression |
| Boost economy | 0.508 | 0.320 | -0.188 | 0.430 | -0.219 | -0.649 | Reject: timing metric worsens in both modes |
| Nominal heavy restitution .86 | 0.672 | 0.758 | +0.086 | 0.922 | 0.570 | -0.352 | Reject: inconsistent timing benefit |

All experimental stat/economy groups were reverted. Their runners remain reproducible via `TUNING=heavy`, `economy`, or `restitution`. Per-trial and per-car/side results are retained in JSON; pooled means must not hide mode reversals. No bootstrap confidence or final agency pass is claimed. The retained control's 3D timing comparison is negative: this remains an open design problem before broader acceptance/release.

## Failures retained and resolved or bounded

- Initial configuration extraction left an obsolete variable reference; corrected before accepting the exact baseline trace comparison.
- Initial controller duplicated service braking after computing the speed-controller command. The semi failed its wrong-side approach test. Removing the duplicate restored the original regression suite.
- Extreme return-shot safety caps were reproduced and corrected as described above; earlier failing matrices remain in local output.
- The heavy tuning candidate improved aggregate timing metrics but reintroduced the semi approach regression. It was reverted, not excused or hidden by updating the test.
- Browser contract startup intermittently failed (one localhost connection refusal and later module startup timeouts). Failed attempts are retained in `browser-contracts*` / `final-contracts/startup-failure.json`; a standalone diagnostic run passed all checks. Timeout captures contained no page exceptions and incomplete resource completion. The original attached local server was replaced with a detached hidden server writing logs to files; the latest contract run passed on port 5198. A final UI rerun on the original server also timed out and is retained. The UI suite also passed all five cases on the detached server. Root cause is not established; successful retries do not prove startup reliability.

## Review and next action

Start a local server from the repo root (`python -m http.server 5198 --bind 127.0.0.1`) or use the running preview if available. Choose ARCADE 2D or 3D, select any car, and play normally with Space/Shift or the boost button. Try spending a full held burst, releasing to recharge, and timing a subsequent press. Check whether WAITING makes sense and whether the bumper visibly meets the ball.

Gate A still needs a short hands-on check and a real human-input recording: point to one useful boost and one wasted boost, distinguish WAITING from BOOSTING, and report repeatable confusing contacts. No participant response has been collected. This is why TICKET-011 is pending; automated footage cannot substitute for it. The 3D synthetic timing weakness and shorter direct braking distances should inform that review.

Keep T06-T11's broader CCD, geometry, planner, guest smoothing, stadium/HUD and release work behind this gate. No roof-prism or arena-topology change, engine migration, or production release is included here.

For debugging, open the local page with `#diagnostics`; `window.exportSimulationTrace()` returns the bounded last 600 ticks, counters and rule identity. Debug cap failures stop simulation instead of concealing the failure. Default play does not record per-tick traces.

Current simulation configuration hash: `sha256:500bac8669fb92d828d3a186b5e93e4f7f6e62fd2f99c4a24d48c83b0eeabbb0`.

Preview server for this review: `http://127.0.0.1:5198`, Python PID 40152 (local only; stop with `Stop-Process -Id 40152` after review, checking that it is still this server).
