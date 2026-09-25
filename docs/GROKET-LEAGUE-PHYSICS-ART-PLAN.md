# GROKET LEAGUE — Physics, Autonomous Driving, and Art Implementation Plan

Research date: **2026-09-25**. Baseline: **`304e880eb9541b77dd85c506033343450f6440de`**, `main`, `groketleague-web`. This is a development specification, not an implemented update or deployment. It responds to the supplied research brief using local source inspection, fresh automated experiments, browser screenshots, and primary technical sources. All recommendations and numerical targets below are **proposed starting values**, unless explicitly labeled measured or verified.

## 1. Recommended direction and priorities

Keep the static ES-module application, Canvas2D CIRCUIT, Three.js 3D, four cars, FSD steering, boost-only human control, and PeerJS host authority. Improve the custom simulation rather than replacing the stack. Three moving bodies do not justify a general engine migration before fixing observable contract and control problems.

Build a small translation-based contact solver with shared geometry, simultaneous-contact iteration, swept ball detection, explicit scoring, and structured contact events. Keep cars grounded with controlled yaw; defer suspension, collision torque, physical ball spin, articulated trailers, and full client prediction. A human should decide **when to spend a limited burst**. FSD should navigate and prevent plainly unsafe acceleration, but should not automatically convert an indefinitely held button into perfectly rationed boost.

Select **CIRCUIT: the corporate test-track league** as the art direction: recognizable toy-sized parody vehicles, quiet turf, pale physical bumpers, amber/cyan identity, and deliberately officious sports signage. Evolve the current 2D stadium. Bring its materials, markings, ownership cues, and HUD into 3D; keep castle towers as distant set dressing if they remain useful. Author procedural shapes and meshes from shared dimensions. No paid assets or generated gameplay sprites are needed.

Delivery order is: evidence/configuration → bounded contact and boost slice → continuous collision and planner work → guest presentation → full art/camera integration → balance/device/release gates. Geometry and contact markers precede decorative art because they determine whether the player sees a truthful hit. Protocol/configuration negotiation precedes any online trial of changed physics.

The first playable improvement should offer all four cars, stable contacts, one clear boost cycle, honest WAITING/BOOSTING/RECHARGING feedback, and a contact flash anchored to the actual impact. It should make Model 3's bumper touch readable in both modes without waiting for a stadium redesign. Largest risks are agency failing human tests, jam resolution introducing energy, planner changes favoring one side, and guest smoothing adding noticeable delay.

## 2. Current-state audit and evidence ledger

Evidence labels used throughout:

- **Verified in this investigation (V):** inspected source or fresh execution at the revision above.
- **Provided baseline (B):** supplied by the brief, not independently exercised here.
- **Hypothesis (H):** needs a reproducer or player evidence.
- **Proposed starting value (P):** a decision for implementation and tuning, not an optimum.
- **Blocked measurement (X):** not measured in the available environment; the later procedure is specified.

The checkout matched the requested commit. It initially contained an untracked research-prompt document; that document was preserved. Research added this plan and disposable scripts/results under ignored `output/research-2026-09-25/`. No tracked gameplay source was edited. Existing tests also write their normal ignored soak artifact. The public deployment was **not** audited, so local findings make no assertion about today's production revision.

| ID | Evidence and result | Confidence / implication |
|---|---|---|
| V01 | Node **v22.21.1**, Windows; `node --experimental-default-type=module --test tests/physics.test.mjs tests/autopilot.test.mjs`: **38 passed, 0 failed** | Existing regression invariants pass; fun, balance, suspension, and CCD completeness are not established |
| V02 | Python **3.11.4** served `http://127.0.0.1:5197`; `tests/netplay.mjs`: **9 reported checks**, no page/console errors; both modes, real private-room connection, guest boost, score/rematch, disconnect, quick match, mobile menu | Fresh integration coverage, using the suite's local endpoint stubs and injected scoring fixtures |
| V03 | `tests/arena-ui.mjs`: first run timed out at startup waiting for `render_game_to_text`, line 30; standalone rerun passed **all five cases** and resize, no page errors | Initial failure remains unexplained. Do not erase it or claim startup reliability from one retry |
| V04 | Browser **Chromium 153.0.8010.12**, headless ANGLE/SwiftShader; inspected fresh 2D desktop/small-phone and 3D desktop screenshots | Layout/render evidence, not real GPU/mobile performance or a human playtest |
| V05 | 1,024 synthetic boost-policy trials; summary and exact protocol in §5/§10 | Baseline behavior is mode-sensitive; an informed-looking heuristic is not automatically superior |
| V06 | Ten-second direct-drive held-boost probes produced **236–274 one-tick reactivations** after the first burst | Reproduced reserve cycling, not merely a suspected issue |
| V07 | `THREE.Box3` measurements of `makeVehicle` meshes, excluding team rings, below | Three cars' visible solid extents exceed their physical rectangles |
| V08 | `characters.js` declares floor restitution `-0.55`; live `stepBall` uses `-0.42`. Most drive settings are repeated literals in `drive`; AI drag is another literal | Configuration drift is verified. The runtime values are the migration baseline |
| V09 | `main.js:onState` directly assigns whole objects; no interpolation queue. `sendSnapshot` sends `_ai` and static stats with bodies | Confirmed presentation/schema limitation, not proof that every perceived hitch is network-related |
| V10 | `stepGame` adds `ball.vz * .02`/`ball.vx * .02` to mesh rotation per rendered frame without `dt` | Visual rolling rate depends on display rate; translational fixed-step tests cannot detect it |
| B01/X01 | Vercel CLI/project convention, X login, public domains, share destinations | Preserve; deployment, external identity, and share delivery were not exercised |
| X02 | Physical Android/iOS, audio perception, CPU/GPU profiles, internet latency distributions, human preferences | Run §10 device and playtest procedures; all budgets remain proposed |

Measured unrotated full solid bounds, world units; tires and lights count, ground rings do not:

| Car | Collision width × length | Visible width × length | Finding |
|---|---:|---:|---|
| CYBERT RUCKER | 2.420 × 4.850 | 2.620 × 4.990 | Width +8.3%, length +2.9% |
| MODEST 3 | 1.980 × 4.200 | 2.200 × 4.300 | Width +11.1%, length +2.4% |
| ROB TACKSY | 1.815 × 3.500 | 1.940 × 3.600 | Width +6.9%, length +2.9% |
| SEEMEE | 2.860 × 7.200 | 2.740 × 7.180 | Visible width about 4.2% inside collider |

These bounds do not prove that every point on a sculpted hull should touch the rectangle. They prove the current art contract needs explicit tolerances and physical bumper geometry.

Ranked work: **P0/high confidence** boost cycling, contact/art bounds, duplicated configuration; **P1/high confidence** guest transform steps, effect replication, frame-dependent visual roll; **P1/hypothesis** order bias, missed sweeps, post/recess traps, late defense and orbiting. Current tests protect resting/separating contact, horizontal impulse conservation, and rounded-board containment. Preserve those successes. Missing swept collision and fixed P-before-B resolution are code facts; unacceptable tunneling or competitive bias still require targeted reproduction.

Verified source anchors: [simulation and contact functions](https://github.com/foxandhenllc/groketleague-web/blob/304e880eb9541b77dd85c506033343450f6440de/sim.js#L58), [planner](https://github.com/foxandhenllc/groketleague-web/blob/304e880eb9541b77dd85c506033343450f6440de/autopilot.js#L5), [runtime contract](https://github.com/foxandhenllc/groketleague-web/blob/304e880eb9541b77dd85c506033343450f6440de/characters.js#L21), [fixed clock](https://github.com/foxandhenllc/groketleague-web/blob/304e880eb9541b77dd85c506033343450f6440de/physics-clock.js#L4), [network application](https://github.com/foxandhenllc/groketleague-web/blob/304e880eb9541b77dd85c506033343450f6440de/main.js#L387), [simulation ordering](https://github.com/foxandhenllc/groketleague-web/blob/304e880eb9541b77dd85c506033343450f6440de/main.js#L855), [vehicle authoring](https://github.com/foxandhenllc/groketleague-web/blob/304e880eb9541b77dd85c506033343450f6440de/vehicles.js#L40). `pixel_sim.js`, `game.js`, and old bitmap metadata remain historical, not implementation authorities.

## 3. Target experience and decision log

Translate feel into observable behavior. A straight hit follows its surface normal and closing speed. A glancing hit retains most tangential travel. A slow push separates without explosive re-hits. A boosted heavy car recoils less because of mass and produces a flatter, stronger hit. A save changes an otherwise threatening trajectory. A board rebound identifies the struck wall. A goal occurs only after the whole ball clears a physically valid mouth.

| Measure | P: initial target / validation |
|---|---|
| Distinct ball interactions | 15–50 per active minute; merge a persistent pair into one episode until separated >0.1 units for 100 ms; also record impulse-event counts separately |
| Inactive intervals | p95 inter-episode gap <5 s; no unresolved jam >8 s in standard scenarios; report kickoff/restart time separately |
| Ordinary / boosted shots | Typical useful launch speeds 12–28 / 22–42 units/s; >48 investigated; 55 remains a safety limit |
| Free rolling | From 20 units/s, roughly 20–24 units in 3 s; compare analytic drag and measured distance, without walls |
| Driving | Time to 90% ordinary straight-line cruising speed 0.8–1.8 s; stopping from 15 units/s within 2.5–5 units, including controller delay |
| Full-lock turn at 10 units/s | Radius approximately 4–6 units light / 8–12 heavy; keep ordering across boost and braking |
| Recovery | ≥95% of defined board/corner/recess starts return to useful pursuit within 4 s; no forced ball teleport |
| Match flow | Median 50–85 active seconds, draws 10–30%, runaway 3–0 results <25% under equal policies; diagnostic targets, not quotas to force with handicaps |
| Balance | Same-car mirrored side score 45–55%; investigate car aggregate outside 40–60% over the defined scenario mix and confidence intervals |
| Agency | Timed policy improves paired goal differential over hold; human players can explain a beneficial and wasted boost; gate in §10 |
| Response | Local button feedback ≤1 rendered frame; host movement p95 ≤33 ms; guest confirmed movement p95 ≤280 ms at 80 ms RTT, 20 Hz snapshots, 100 ms buffer |

All targets need measured baselines after event deduplication; V05 impact counts cannot be compared directly with the proposed interaction metric.

### Physics architecture decision

Ratings are engineering judgments for this project, not measured library benchmarks. Library download size and mobile CPU cost were not benchmarked. Compare production builds if the fallback is needed.

| Criterion | Focused custom solver **selected** | Planck.js + explicit vertical ball | Rapier 3D with grounded cars |
|---|---|---|---|
| Behavior control | Direct control of existing arcade rules | Good, but adapter must reconcile solver impulses with drive | Good, but rigid-body settings replace established semantics |
| Constraints / CCD | Must implement and test bounded iteration/sweeps | Contact solver; dynamic `bullet: true`; TOI limitations with rotation | Built-in constraints and CCD via `setCcdEnabled(true)` |
| Two modes | One horizontal model plus existing height adapter | Natural top-down mapping; height/contact filtering remains custom | Flat-mode constraints plus 3D, more state and tuning |
| Startup / bundle | No new engine dependency; incremental code size | JS dependency and allocation/startup work; measure pinned build | WASM initialization/download; measure chosen distribution |
| Mobile CPU | Tiny fixed pair set; bounded work | General broadphase/solver overhead; unknown actual cost | General engine overhead; unknown actual cost |
| Debugging | Small local equations; own every defect | Mature public source/debug drawing; adapter adds complexity | Debug renderer/tools; JS/WASM boundary complicates probes |
| License / maintenance | Existing project terms; no added engine | Current upstream **MIT**, package manifest **1.5.0** inspected | **Apache-2.0**, JavaScript documentation **0.21** inspected |
| Serialization | Explicit small state/replay schema | Reconstruct bodies/fixtures from own schema; verify serializer separately | `world.takeSnapshot()` / `World.restoreSnapshot()` available |
| Determinism | Repeatable same-runtime tests; no cross-browser bitwise promise | Do not assume cross-runtime determinism | Documented JS determinism has same-version/initialization constraints; game code still matters |
| Migration risk | Lowest scope; highest responsibility for collision correctness | Medium/high; height filtering and moving-car semantics must be retested | Highest; changes vehicle response, serialization, and startup together |

Verified APIs and limitations: [Planck body/CCD](https://piqnt.com/planck.js/docs/body.html), [Planck TOI](https://piqnt.com/planck.js/docs/collision.html), [Planck package/license](https://github.com/piqnt/planck.js/blob/master/package.json), [Rapier bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/), [serialization](https://rapier.rs/docs/user_guides/javascript/serialization/), [determinism](https://rapier.rs/docs/user_guides/javascript/determinism/), [license](https://rapier.rs/docs/). These are inspected versions/doc labels, not promises about future releases. If the custom solver fails the jam/CCD gate twice after isolated fixes, prototype **Planck** against the same fixtures before adding more custom machinery. Rapier remains appropriate if later scope introduces true 3D vehicle dynamics.

The Game Studio Three.js skill defaults toward Rapier for substantial 3D physics. This brief explicitly requires an evidence-based comparison within an existing mostly planar simulation; the smaller custom plan is the chosen exception, with a bounded fallback rather than an unexamined rewrite.

### Three art candidates

| Direction | Distinctiveness / parody | Small-screen and two-mode fit | Cost / decision |
|---|---|---|---|
| **CIRCUIT: corporate test track** | Orderly sports infrastructure hosting absurd autonomous appliances | Clear silhouettes, quiet ground; procedural 2D and low-poly 3D share shapes | Lowest incremental cost; **selected** |
| Toybox castle derby | Existing castle becomes a miniature arena with oversized flags | Strong 3D staging; turrets/stone must be suppressed in 2D | Moderate; loses because scenery competes with the small ball |
| Neon telemetry arena | Self-driving parody expressed as glowing test instrumentation | Strong branding but streaks/grids compete with shots and team colors | Moderate effects cost; loses on clarity and night accessibility |

Original Fire's official [Circuit Superstars imagery](https://www.originalfiregames.com/) demonstrates compact vehicle silhouettes against organized track boundaries. [art of rally's official imagery](https://www.artofrally.com/) demonstrates broad material/color groups and restrained environmental detail. Both pages were captured and inspected; borrow principles, not their assets, trade dress, or handling. Jared Cone's [2018 Rocket League slides](https://media.gdcvault.com/gdc2018/presentations/Cone_Jared_It_Is_Rocket.pdf) support simplifying vehicle systems and explicitly separating simulation decisions from presentation. They do not establish GROKET tuning or justify importing proprietary mechanics.

Mainline changes stay within the brief: clearer boost semantics, revised shared tuning, explicit posts, and eventual horizontal arena agreement between modes. Manual steering, extra abilities, overtime, engine migration, servers, rankings, and new cars remain separate future scope.

## 4. Physics specification

### Units, bodies, and geometry

Use world units, seconds, radians, and relative mass. `1 BU = 4.2 world units`; there is no claim of SI vehicle mass. Pitch coordinates are x/z, y up. Forward `f=(-sin(yaw),-cos(yaw))`; right `r=(cos(yaw),-sin(yaw))`. P attacks negative z, B positive z. Keep IDs `pixel` and `3d` stable.

Car collision shape is an OBB centered on `(x,z)`, half-width `0.55*w`, half-length `0.5*l`. Store these derivations once in `catalog.js`; retire unused padding as simulation input. Grounded cars have linear velocity and controlled yaw, not dynamic inertia. Ball is a circle in 2D and a sphere with the existing height adapter in 3D. Initially retain radii **0.9 / 0.5502**, mass **0.45**, 44×68 pitch, 11-wide mouth and 4.2-high 3D clearance.

First slice retains existing arena topology. The later geometry task makes the 3D *inner physical boards* agree with CIRCUIT: half-width 22, half-length 34, corner radius 7, goal depth 5.2; removes the extra 0.9 side allowance. Outer castle decoration moves outside that boundary. This deliberately changes 3D horizontal play and needs new AI, goal and screenshot baselines; it never hides inside an art-only change.

Use straight board segments, quarter-circle inner corner arcs, and goal-recess side/back segments. Add post radius **0.18**: centers at `x=±5.68,z=±34`, leaving the **inner clear width exactly 11**. 3D posts/crossbar use capsules, with crossbar center height **4.38** and inner clearance **4.2**. Render these exact primitives; all other beams/nets are decorative. In 2D the posts are circles, with no crossbar physics.

The first slice preserves the baseline bottom-of-ball <1.25 car-contact gate. **T06 replaces that approximation** with a small union of grounded box prisms per car, specified in §8, so a ball cannot visibly pass through the semi's high trailer. Cars still have no vertical motion or dynamic rotation; only the ball gains height-aware contacts. This is a deliberate additional custom-solver responsibility and belongs in the CCD/geometry phase, not a hidden art change. 2D retains the same projected base rectangle.

### Time and integration

Retain **120 Hz**. Add `tick`, previous/current presentation state, accumulator `alpha`, and dropped-time telemetry to `createPhysicsClock`. Accept at most 0.25 s elapsed, run at most **8 ticks per pump**, then discard excess whole ticks while preserving a fractional remainder. Log discarded seconds. Ordinary 30 Hz needs four ticks, 60 Hz two, 120 Hz one; 144/240 Hz interpolate. A 200 ms stall advances only 66.7 ms in that pump. This is an explicit simulation-time slowdown, not secretly elapsed match time. Never decrease the clock for simulation time that was discarded. Fixed stepping and render interpolation follow [Fiedler's accumulator rationale](https://gafferongames.com/post/fix_your_timestep/); eight ticks is this project's proposed budget.

Offline pause/hidden/resume clears accumulator and inputs. An online host may use one scheduler for visible/background pumping, but a browser cannot guarantee background execution. On a detected >250 ms scheduler gap, mark suspension, clear stale input, reset presentation history, and publish a resynchronization state; do not simulate seconds of unseen goals. Guests show reconnecting and freeze once the horizon is exhausted. Preserve the existing 12 s connection-loss exit; do not infer forfeits from throttling. Actual device suspension remains a release gate. [Browser visibility and throttling documentation](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

Integrate vehicle acceleration/drag before movement; integrate contacts during movement. For rolling ball drag `k=-ln(0.986)*60≈0.846 s^-1`, use `v1=v0*exp(-k*h)` and `Δp=v0*(1-exp(-k*h))/k`, with `Δp=v0*h` when k≈0. Airborne ball uses `y1=y0+vy0*h-g*h²/2`, `vy1=vy0-g*h`, g=22. Split at the exact floor root, bounce with e=0.42, and integrate the remainder; settle when outgoing vertical speed <1.1. This removes a frame-boundary floor approximation without changing its nominal bounce.

### Contacts, constraints, and continuous detection

There are only two car/ball pairs, one car/car pair, and a small boundary list. Use a fixed pair array and swept AABB rejection against boundary segments; no spatial tree or engine-style island system.

Narrowphase keeps closest-point circle/OBB and OBB/OBB SAT. For car/car use up to two clipped support contacts for diagnostics but a translation-only manifold with one separating normal/combined impulse; do not double the impulse because two corners touch. An internal ball selects the nearest exit face. Ties use previous contact normal, then relative velocity, then a stable geometry-axis tie break. Zero-length normals use an explicit branch, not division by epsilon.

Let n point from A toward B; `vn=(vB-vA)·n` in units/s. Inverse mass w=1/m, static geometry w=0. For an isolated frictionless, non-rotating, approaching impact:

```text
e = 0 if -vn < 1; otherwise the material restitution
j = -(1+e)*vn/(wA+wB)             [relative-mass * units/s]
vA -= wA*j*n
vB += wB*j*n
```

For T06's 3D ball/prism contact, use the actual 3D normal. The grounded car has inverse-mass tensor `diag(wCar,0,wCar)` and the ball `wBall*I`, so the impulse denominator is `wBall+wCar*(nx*nx+nz*nz)`. Apply the ball impulse in xyz and the car's opposite impulse in x/z only. Use the same tensor weighting for positional correction. The floor supplies the missing vertical reaction; do not assert conservation of the pair's vertical momentum. Passive no-drive/no-assist kinetic energy must still not increase. Use sphere-to-oriented-prism closest points, discard faces internal to the prism union, and merge coincident contacts to avoid double impulses. No simplified lift on roof normals.

Record pre-solve `vn0` once when a new impact manifold activates. For coupled contacts use **4 velocity iterations** and accumulated nonnegative normal impulse: target separation speed `bounce=max(0,-e*vn0)`; `newLambda=max(0,oldLambda+(bounce-vn)/(wA+wB))`; apply only the difference. Reuse that target only within this impact solve; a persistent resting manifold has target zero on subsequent ticks. Never carry the initial bounce target through a pinned contact. Alternate traversal direction by tick parity, with stable pair/feature IDs. Do not recompute restitution every iteration. Initially do not warm-start across ticks; add it only for a measured persistent-contact problem. The accumulated-clamp and split-position rationale comes from [Catto's Solver2D](https://box2d.org/posts/2024/02/solver2d/); these counts and simplifications are our adaptation.

Default tangential contact friction **0** for car/ball and car/car, preserving predictable glances and current horizontal momentum behavior. Tire grip remains an external drive force. Board tangential friction also starts at 0. A later μ=0.05–0.15 experiment is allowed only with a defined dissipative tangent impulse `|λt|≤μλn`; do not introduce unmodeled spin implicitly. Board restitution stays **0.62**, car/board **0.18**, car/car **0.25**, car/ball **0.72**. Proposed heavy boosted restitution becomes **0.86**, replacing 0.972 to reduce near-elastic pinball while mass/boost acceleration preserve weight.

Use **2 position iterations**, recomputing geometry each time. Penetration correction `C=min(0.20,0.8*max(depth-0.005,0))` world units is split by inverse mass. It changes position only. Include boards in the same iteration so solving a car/ball overlap cannot push a car outside the field. For a ball squeezed by simultaneous opposing contact normals with dot product <-.8, use zero restitution for that constrained batch; propulsion may push but must not repeatedly energize a jam. Deep invalid starts get an explicit bounded stabilization pass with no impact effects; fail the fixture if residual overlap >0.01 after 20 ticks. Do not add correction distance to impact strength or score a goal because of correction.

Swept policy:

1. Sweep the ball against moving OBBs (the exposed prism union in T06's 3D mode), straight/curved boards, post capsules, and floor/crossbar in 3D. A box expanded by r is only a broadphase: its square corners are not the circle/OBB Minkowski boundary. Extend face/edge/corner candidates to sphere/prism sweeps in 3D, including vertical motion and roof normals.
2. For straight translation use exact segment/rounded-rectangle candidates (face crossings and corner quadratics). For controlled car rotation use conservative advancement of shape distance, with closure bound `|vBall-vCar|+|yawRate|*carBoundingRadius+|aRelative|*remainingTime`. Advance at most `0.8*gap/bound`; re-evaluate the actual oriented shape.
3. Sweep moving car/car SAT and car/board support points when relative displacement or rotational corner travel exceeds **0.25 of the smaller half-width**. Otherwise use discrete manifolds. For curved boards, sweep vertex paths against the inset arc and verify edge support; never constrain centers alone.
4. Order the earliest impacts and goal-plane candidates within a segment. Resolve all contacts within **1e-5 s** of the earliest time as one set, then advance the remainder. Use a contact tolerance **1e-4 units**, at most **12 conservative-advance evaluations** per candidate and **4 impact splits per tick**.
5. If an iteration budget is exhausted, subdivide the unresolved remainder into at most **4 conservative microsteps**, with distance-bounded advances. If still unresolved, stop the affected bodies' remaining movement, emit `ccdExhausted`, and fail the release fixture. Never silently integrate the untested remainder or claim a discrete fallback guarantees CCD.

Rotation contributes to collision *geometry*, but not contact-point impact velocity in this initial translation-only model. This avoids creating torque energy without a corresponding angular response. A rotating resting bumper may displace a ball through position correction; it must not manufacture a kick or hit effect. Dynamic yaw torque and physical ball spin are deferred because FSD currently needs predictable recovery more than spin-out spectacle. Visual wheel/ball rolling derives from traveled distance and elapsed time.

### Goals, repeated contact, and numeric safety

For attacked sign q∈{-1,+1}, whole-ball crossing occurs at `q*z-r=34`, moving outward from a previously unscored position. At the swept crossing require `abs(x)+r < 5.5-1e-4`, and in 3D `y+r < 4.2-1e-4`. Earlier post/crossbar/end-board collisions take precedence. A high-speed path is evaluated at crossing time, not only its final coordinates. A ball already beyond the plane at spawn/reset is invalid state, not a retroactive goal. Keep a `(matchId,roundEpoch)` goal latch. A legal goal before or exactly at the active-time expiry wins the timestamp tie; no later goal counts. This makes the final-tick rule explicit.

On goal, lock gameplay immediately, emit one event, advance score once, and freeze the active match clock. Phase timers advance separately. Kickoff increments `roundEpoch`, clears contact caches, planner histories, pending boost, and render trails. Keep first-to-3, 90 active seconds and draws. Preserve baseline post-goal restart placement for the first slice; test its ±4 offset/±3 velocity bias separately before changing it.

Do not sleep cars. Set the grounded, rolling ball's horizontal velocity to zero only below 0.05 units/s for 0.25 s with no driving contact; always keep it collision-queryable. A pair may constrain every tick, but a new impact event needs re-entry or a fresh closing-speed peak and its pair cooldown. 3D lift is a separate bounded gameplay assist on bumper contacts with `abs(ny)<.2`: `vy=max(vy,min(cap,0.2*closingSpeed))`, cap 5.5 ordinary /1.2 boosted heavy. Trigger on a genuine new contact episode, never on whether a sound played. Horizontal momentum checks exclude this deliberately added vertical energy. Roof contacts use ordinary impulse response and gravity; no roof rolling drag, sticky attachment or bonus lift.

```js
function simulateTick(state, input, h) { // proposed orchestration
  advancePhaseTimers(state, h);
  if (!activePlay(state)) return;
  const activeH = Math.min(h, state.timeLeft);
  const commands = planBothFromSameStartState(state, input, activeH);
  integrateDriveVelocities(state, commands, activeH);
  let remaining = activeH;
  while (remaining > 1e-7) {
    const batch = findEarliestContactsAndGoal(state, remaining);
    advanceAllBodies(state, batch.time); // exact ball drag/floor subsegments
    remaining -= batch.time;
    solveVelocityContacts(batch.contacts, 4);
    solvePositionConstraints(state, 2);
    collectImpulseEvents(batch);        // no sound or mesh mutation here
    if (acceptGoalAfterEarlierContacts(batch)) { latchGoal(state); break; }
    consumeOrBoundZeroTimeContacts(batch, remaining);
  }
  state.timeLeft -= activeH - remaining;
  assertFiniteAndBounds(state); persistTickAndEvents(state);
}
```

The loop must implement the split/microstep budgets above. Exclude a zero-time separating manifold from repeat impact processing until velocity changes toward it or a new feature enters; retain its resting constraint for the iterative solve. This prevents a zero-time loop without skipping the remaining swept motion. Development assertions include finite input/state, normalized normals, nonnegative reserve, residual overlap, legal goals, and impulse-energy checks in isolated no-drive fixtures. Log pre-cap speeds before the existing 55/28/-40/18 ball safety bounds. Any safety cap or repair in a normal scenario is a defect counter, not evidence of stability. In development, stop and export the fixture instead of `repairCar`/`repairBall` silently repairing authoritative state. Production retains a guarded recovery screen/resync for invalid state.

## 5. Driving, boost and autonomous-play specification

### Shared tuning sheet

Every arrow is **live baseline → proposed starting value**. Brackets are bounded experimental ranges, not random per-match variation. Unchanged dimensions/masses are locked for the first release; retune behavior before body size. All values apply equally to offline humans, CPU, host and guest simulation, across both graphics modes.

| Parameter / units | CYBERT RUCKER | MODEST 3 | ROB TACKSY | SEEMEE | Effect, interaction, verification |
|---|---|---|---|---|---|
| Relative mass | 3.1→3.1 [locked] | 1.3→1.3 [locked] | 1.05→1.05 [locked] | 4.6→4.6 [locked] | Preserve recoil hierarchy; isolated identical-speed impact/momentum fixture |
| Catalog width, units | 2.2→2.2 [locked] | 1.8→1.8 [locked] | 1.65→1.65 [locked] | 2.6→2.6 [locked] | Full physical width remains 1.1×; bounds overlay and corridor checks |
| Length, units | 4.85→4.85 [locked] | 4.2→4.2 [locked] | 3.5→3.5 [locked] | 7.2→7.2 [locked] | Reach/blocking vs turning room; rotated containment/recess tests |
| Acceleration, units/s² | 24→26 [24–29] | 38→38 [34–40] | 34→34 [30–37] | 16→18 [16–21] | Help heavy recovery; measure t90 with proposed drag/curve |
| Ordinary speed ceiling, units/s | 19.5→19.5 [18–21] | 28→28 [26–30] | 26→26 [24–28] | 15→15 [14–17] | Cap propulsion, not instantaneous collision velocity; straight-lane probe |
| Turn rate, rad/s | 1.55→1.65 [1.5–1.8] | 2.7→2.7 [2.5–2.9] | 3.15→3.15 [2.9–3.3] | 1.15→1.25 [1.15–1.4] | Preserve cab agility; radius/recovery test at 5/10/15 units/s |
| Lateral grip coefficient, s^-1 | 6.2→7 [6–8] | 10→10 [9–11] | 12→12 [11–13] | 5.2→6 [5–7] | Heavy turns recover sooner; measure lateral speed half-life and glancing recovery |
| Boost reserve capacity, reserve units | 1→1 [0.9–1.1] | 0.75→0.75 [0.7–0.85] | 0.7→0.7 [0.65–0.8] | 1.15→1.15 [1.05–1.25] | Heavy commitment vs light repeat opportunities; policy matrix |
| Explicit service brake, units/s² | no separate value→30 [26–34] | none→44 [40–48] | none→42 [38–46] | none→26 [23–30] | Baseline braking uses negative accel/throttle plus drag; stop-distance test |

| Global or class setting / units | Baseline → proposal [range] | Intended effect, interactions and verification |
|---|---|---|
| Heavy/light drive drag, s^-1 | 1.85/1.45→1.45/1.25 [1.3–1.6 /1.15–1.4] | Reduce hidden heavy speed loss; retest arrival estimates and brake distance |
| Acceleration curve multiplier | constant 1→`clamp(1-.15*(u/cap)^2,.75,1)` [.10–.20 coefficient] | Mild speed taper, not a gearbox; log steady cruise instead of treating cap as measured speed |
| Lateral damping | `1-min(1,grip*h*1.12)`→`exp(-grip*1.12*h)` [factor 1–1.2] | Stable damping under microsteps; match analytical decay |
| Low-speed steer fraction | .55→.55 [.5–.65] | Existing recognizable slow turn; signed forward/reverse tests |
| Heavy turn reduction | abrupt ×.7 above 11→smooth 1→.7 over 8–14 units/s [endpoints ±2] | Avoid steering discontinuity near 11; constant-speed circle sweep |
| Heavy/light boost acceleration, units/s² | 40/30→32/24 [28–36 /22–28] | Strong controlled acceleration with lower drag; shot-speed and hold-policy comparison |
| Heavy/light boost speed factor | 1.42/1.28→1.30/1.22 [1.25–1.4 /1.18–1.28] | Boost remains a commitment; braking/reachability uses actual boosted speed |
| Heavy/light reserve drain, units/s | .8/1.05→.75/.9 [.7–.9 /.85–1] | First full bursts ≈1.33/.83/.78/1.53 s in roster order; measure actual authorized duration |
| Reserve recharge, units/s | .28→.25 [.22–.30] | Released-only recharge prevents free rationing; policy and spam tests |
| Recharge delay after active boost, s | 0→.25 [.15–.35] | Releases under delay gain no reserve; display honest recharge state |
| Start threshold / continued cutoff, reserve | planner >.08, drive >.05→start ≥.18, continue to 0 [.15–.22 start] | Distinct starting threshold avoids microscopic retries; integrate final fractional drain |
| Rearm release, s | none→.12 [.10–.18] | Depletion requires deliberate release; not a new button |
| Human heading safety gate, rad | .28→.9 [.75–1.05] | FSD no longer reserves boost only for almost-perfect aim; gate on immediate safety, not shot quality |
| Absolute car invalid-speed guard, units/s | propulsion cap used as clamp→80 [locked diagnostic bound] | Legal collision-induced overspeed coasts/brakes down; dump a fixture at the guard rather than clipping to the propulsion ceiling |
| Planning / control rate | both 120 Hz→15 Hz tactics, 120 Hz control [10–20 Hz tactics] | Bounded decisions and consistent steering; rerun urgency and CPU timing probes |

Ball/environment contract, including unchanged values needed for a complete implementation:

| Setting / units | Baseline → proposal [range] | Effect / verification |
|---|---|---|
| Radius pixel /3D, units; mass | .9/.5502;.45→same [locked] | Preserve initial geometry; projected-size and contact tests; larger 3D radius only as §12 experiment |
| Car/ball restitution; heavy boosted | .72/.972→.72/.86 [.65–.78 /.80–.90] | Reduce extreme heavy rebound; launch velocity, recoil and no-drive energy fixtures |
| Restitution closing threshold, units/s | 1→1 [.8–1.5] | Quiet pushing; repeated-contact tests |
| Rolling k, s^-1 | `-ln(.986)*60`→same [.75–.90] | One shared predictor/integrator coefficient; 3-second distance fixture |
| Board /floor /car-car /car-board e | .62/.42/.25/.18→same [.55–.7 /.35–.5 /.15–.3 /.1–.22] | Preserve rebound vocabulary; verify oblique and pinned cases |
| Gravity, units/s²; settle vertical speed | 22;1.1→same [20–24;.8–1.3] | Ball flight remains mode-specific; analytic floor-root and airborne intercept tests |
| Contact lift speed, ordinary/heavy caps | 5.5/1.2→same [4–6 /.8–1.5] | Preserve loft vs flat heavy shot; trigger by physical episode instead of sound cooldown |
| Lift coefficient | closing speed ×.2→same [.15–.25] | Explicit arcade assistance; energy accounting excludes added lift |
| Horizontal/vertical/height safety limits | 55; +28/-40;18→same [locked] | Diagnostics only in normal play; any activation rejects ordinary fixture |
| Effect cooldown, s | .08 per car→.08 per pair [.06–.12] | Several objects can sound independently; never gates solving |
| Position slop /max correction, units | almost-full correction +1e-5→.005/.20 [.002–.01 /.1–.3] | Iterated, non-energetic separation; residual-depth checks |
| Field width/length; clear mouth/height | 44/68;11/4.2→same [locked] | Geometry-derived renderer, goal and predictor assertions |
| 3D side offset; corner; recess | .9;0;0→0;7;5.2 [locked after migration] | Intentional later horizontal unification; §4 geometry/regression gate |
| Posts/crossbar | decorative/no explicit primitives→radius .18 [.15–.22] | Inner clear opening remains 11×4.2; grazing and high-speed fixtures |
| 3D car contact height, units | shared bottom<1.25 gate→§8 prism profiles [locked initially] | Match visible roof/trailer, preserve 2D footprint; falling/side/roof sweeps and passive-energy fixtures |

Apply tuning in small groups: contract-only first, boost semantics second, heavy response third. Do not land every arrow simultaneously and lose attribution. Model 3 remains the fast attacking reference; cab trades reach/mass for repositioning; truck trades turning for recoil resistance and flatter boosted hits; semi trades speed/turn radius for reach, reserve and blocking. These tradeoffs are intended, not proven balanced.

### Vehicle controller and player information

Separate path choice, speed control, and boost authorization. Resolve velocity into forward u and lateral v. Use a speed-control time constant **0.25 s**, drag feed-forward, and bounded accel/brake commands. Apply exact exponential drag, tire damping, then controlled yaw and swept movement. Positive drive acceleration tapers with speed as above. Reverse speed limit **5 units/s**; enter reverse only after braking below 0.5 units/s. Steering direction follows signed longitudinal velocity, not throttle sign. When boosting, raise the propulsion target and avoid a normal-cruise controller immediately braking away the boost; only a path/board safety brake overrides it.

Do not snap velocity down to the ordinary cap on button release. Stop adding overspeed propulsion and let drag/braking settle it. Log speed above **1.1× boosted ceiling** with its contact cause, but permit legitimate collision-induced overspeed; only the **80 units/s** invalid-state guard is a hard failure. A faster light car can legitimately push a heavy car above its own propulsion ceiling. Use actual speed to compute turn/brake needs. At speed u, nominal stop distance is `u²/(2*aBrake)` plus `u*reactionDelay + .8` units of margin; verify against the actual damped controller.

Before pressing boost, the player must see car nose, ball travel, opponent position, reserve, and an unobtrusive advisory **SHOT / RACE / SAVE** opportunity indicator beside the reserve. Advisory windows should generally last **450–800 ms**, derived from predicted opportunity rather than pulsing every AI tick. It never promises a goal and does not authorize boost automatically. Near-full steering at high speed incurs wider turns; spending early can lose reserve before contact or pull the car beyond a useful approach. Mistakes have visible cost.

Precise held-input semantics:

| State | Transition / behavior | Player feedback |
|---|---|---|
| READY | Released, reserve ≥.18, rearm satisfied; press can start on next simulation tick | Reserve and BOOST label |
| WAITING | Held but reversing, heading error >.9, or unavoidable board collision within braking envelope | Button depresses immediately; WAITING: TURNING/BRAKING; no exhaust, drain or recharge |
| ACTIVE | Held, safe, and started with ≥.18; continuous drain until release, safety interruption, or zero | BOOSTING plus steady exhaust and one onset sound |
| RELEASE TO RECHARGE | Depleted, or remaining reserve below start threshold after interruption | No automatic reactivation while held; explicit release instruction |
| RECHARGING | Released ≥.12 s; recharge starts after .25 s since last active boost | Meter visibly fills; READY when ≥.18 |

Holding through WAITING is a live request, not a stored future tap. Release cancels immediately, including queued/gated intent. Keyboard repeat does not generate new starts. `blur`, `pointercancel`, menu entry and disconnect clear input. Touch uses pointer capture so leaving the button does not strand boost. No recharge occurs while held, even if gated. There is no minimum forced active burst after release. Spam under 120 ms cannot rearm depletion, and under 250 ms cannot gain recharge. CPU uses the same state machine and reserve economy.

### Measured baseline agency experiment

At the unmodified baseline, tested 16 ordered car pairings × 4 initial ball scenarios × 2 mirrored controlled sides × 4 boost policies × 2 modes = **1,024 trials**. Each policy/mode cell contains **128 trials** against the existing auto-boost CPU. This is a deterministic scenario sample, not 128 independent human observations. Outcomes below are descriptive; no significance or general balance claim is made.

| Mode | Controlled policy | Wins / draws / losses | Mean goals for minus against | Mean active seconds | Mean boost-active seconds |
|---|---|---:|---:|---:|---:|
| 2D | None | 43 /36 /49 | -0.211 | 78.414 | 0 |
| 2D | Continuous hold | 63 /35 /30 | +0.531 | 71.869 | 12.136 |
| 2D | Random bursts | 72 /25 /31 | +0.805 | 66.417 | 6.537 |
| 2D | Timed heuristic | 45 /30 /53 | -0.156 | 79.007 | 3.696 |
| 3D | None | 25 /56 /47 | -0.648 | 59.960 | 0 |
| 3D | Continuous hold | 31 /37 /60 | -0.625 | 44.776 | 7.098 |
| 3D | Random bursts | 41 /47 /40 | -0.008 | 58.767 | 4.162 |
| 3D | Timed heuristic | 49 /36 /43 | 0.000 | 50.802 | 3.152 |

Hold was useful in these 2D scenarios but was not the best policy, and its benefit did not transfer cleanly to 3D. The rudimentary timed policy failed in 2D. This **does not prove** timing lacks skill potential or that random play is optimal. It rejects claiming the current planner already guarantees comprehensible agency.

The isolated 10-second `drive(...,true,1/120)` probe reset car position each tick to exclude walls, preserving velocity/reserve. First continuous bursts lasted truck **1.192 s**, Model 3 **0.667 s**, cab **0.625 s**, semi **1.375 s**, then produced respectively **274,236,237,269 single-tick bursts**. The full planner adds its own gates; these direct-drive figures isolate reserve logic. Full trials also recorded frequent sub-50 ms active intervals, which may arise from both reserve and planner gating.

### Autonomous decision model

Use a small priority FSM plus bounded candidate evaluation. Reynolds' [steering hierarchy](https://www.red3d.com/cwr/steer/gdc99/) supports separating action selection from locomotion; Coulter's [pure-pursuit derivation](https://publications.ri.cmu.edu/storage/publications/pub_files/pub3/coulter_r_craig_1992_1/coulter_r_craig_1992_1.pdf) supports a lookahead path controller. Neither supplies soccer tactics or proves our thresholds.

Reject a large behavior-tree framework, learned policy, exhaustive game search or inference service. A pure seek/arrive controller is cheap but cannot choose which side of the ball to approach. A fully general MPC controller adds tuning and CPU complexity; instead simulate a few reachable candidates using the actual shared controller.

At 15 Hz, predict a cloned ball for **1.5 s** in 1/60 s segments using the same drag, gravity, floor and board geometry, with no scoring side effects. Sample interception candidates every **0.1 s**. For shots, require a reachable bumper-height contact, not an arbitrary point below an airborne ball. Before T06 eligibility uses the baseline 1.25 gate; afterward use the actual prism/contact normal in candidate rollouts. Roof interceptions may qualify as defensive blocks, but are not treated as equivalent aimed bumper shots. Otherwise choose landing/defensive position. Board rebounds remain in the prediction. Reject a path requiring the car to cross outside the footprint-safe arena.

For each candidate, cheaply test center/left/right goal targets inside `±(5.5-r-.4)` and a safe midfield clearance using travel/turn lower bounds. Refine only the **best three candidates per car**, with at most **45 rollout steps each** at 1/30 s. A boosted alternative consumes one of those three slots; it does not double the budget. This estimates arrival without pretending acceleration or turning is instantaneous; 30 Hz rollouts are planning approximations and never authoritative physics. Reuse one shared ball forecast and bounded scratch arrays; never mutate live actors. Choose the earliest feasible intercept, allowing **0.12 s** timing margin. Score feasible options using normalized terms: goal alignment .35, intercept lead .25, post-contact field progress .20, open lane .20, minus own-goal risk 1.0 and route obstruction .5. Normalize angles/distances to [0,1]; reject impossible options before scoring. These are initial weights.

| Priority/state | Enter | Exit / hysteresis / action |
|---|---|---|
| RESET/KICKOFF | New epoch | Plan both cars from the same state; reserve identical by car; no privileged ball impulse |
| EMERGENCY DEFEND | Predicted ball crosses own valid mouth within 1.2 s | Exit after no threat for .3 s; choose reachable interception or goal-side block, never retreat through the ball |
| RECOVER | Useful progress <.5 units in .8 s with throttle demand and obstruction | Brake, reverse ≤1 s with signed steering toward free space, then reassess; .5 s refractory time |
| CLEAR | Ball/reachable approach trapped near board/recess, or no useful play for 3 s | Hold clear lane .6 s unless own-goal threat; seek open midfield/along-board pass, not a perfect shot |
| STRIKE | Reachable intercept; approach alignment <.22 rad and ball-side offset within .8 units | Commit .2 s; exit if heading >.45, lane invalid, or interception slips >.25 s |
| SETUP | Intercept exists but car is on wrong side | Route to ball minus shot direction ×(half-length+r+2.5); retain detour side ≥.6 s |
| INTERCEPT | Moving ball reachable before opponent | Track reachable contact point; switch only for ≥15% score improvement or safety |
| SUPPORT | No safe immediate contact | Move goal-side of likely landing point; avoid sitting inside mouth unless threat requires it |

Detours test two side waypoints around a ball exclusion disc `halfLength+r+1`, plus car half-width clearance. Keep one side until setup reached or blocked for .6 s; near a board reject the outside waypoint. Project targets using the complete rotated footprint/geometry, not coordinate clamping with width alone. Wrong-side defense chooses a lateral corridor first, then moves goal-side; reject a proposed contact whose estimated outgoing ray enters the own mouth within 1.5 s.

Track **useful progress** as decreasing path distance to an attainable contact, increasing goal-side alignment, an actual contact episode, or reducing defensive threat. Car speed and two units of ball displacement alone do not reset the timeout. After 3 s without progress, change lane/clear; after 6 s attempt a different recovery; after 8 s emit a jam failure for analysis. No hidden teleport or extra impulse. Goal-recess recovery heads through the center of the mouth with its long axis aligned, reversing if the rear exit is closer. A multi-body jam first yields/reverses one car according to time-to-clear and a mirrored geometry tie break; seeded ties must be matched across sides, never hardcoded P priority.

For path tracking use lookahead `L=clamp(2.5+.25*abs(u),3,8)` units and local-right target coordinate xR. Curvature is `κ=-2*xR/L²` with this repository's yaw sign; desired yaw rate `u*κ`, clamped by the car turn model. If retaining `drive`'s steer interface, divide desired yaw rate by `turn*speedFactor*heavyFactor*reverseSign` before clamping steer to [-1,1]; do not apply reverse twice. Below 1 unit/s use the existing proportional heading controller to avoid a zero-speed deadlock. Desired speed is limited by `sqrt(aLat/max(abs(κ),.02))`, with aLat **18 light /12 heavy units/s²**, arrival braking and board stop distance. Feed actual speed/turn limits into candidate evaluation.

Opponent avoidance uses predicted swept OBB occupancy over .6 s, with .5-unit clearance. It is a cost, not an absolute ban on intentional ball contests. Do not continuously steer away from the opponent when the goal is a fair challenge. CPU difficulty changes reaction delay (**easy 200 ms**, normal **100 ms**) and candidate count, never mass, acceleration, collider size, hidden ball correction or access to a human's pending input. Evaluate human FSD symmetrically; CPU boost timing obeys the same public state/limitations.

## 6. Shared data and multiplayer specification

### Configuration and module ownership

`characters.js` becomes a versioned, validated configuration: canonical car stats, controller limits, boost economy, ball/material settings, and explicit per-mode geometry. `catalog.js` derives collision dimensions and immutable render descriptors. `sim.js` owns bodies/contacts and accepts a config object; eliminate global-mode leakage when multiple simulation instances are tested. `autopilot.js` consumes the same config and pure prediction helpers. `main.js` owns lifecycle and input scheduling, not equations. `net.js` owns transport, validation and queues, not authoritative scoring.

Proposed new files: `contacts.js` for manifolds/sweeps, `sim-events.js` for event records, `net-protocol.js` for schema/validation, `snapshot-buffer.js` for presentation interpolation, `art-contract.js` for bounds/palette, and research/debug fixtures under `tests/`. Extract only when the task needs the boundary; do not first move the whole application into a new framework.

```js
// Shape of proposed immutable config; populated with every value in §§4–5.
{
  schemaVersion: 2, simVersion: 'fsd-contact-2', fixedHz: 120,
  cars: { cybertruck: { mass:3.1, width:2.2, length:4.85,
    acceleration:26, maxSpeed:19.5, turnRate:1.65, grip:7,
    brakeAccel:30, boostCapacity:1 } /* other three required */ },
  drive: { /* class values and boost state-machine thresholds */ },
  ball: { mass:.45, rollingRetentionAt60Hz:.986,
    restitution:.72, heavyBoostRestitution:.86 },
  modes: { pixel:{ ballRadius:.9, airborne:false, geometryId:'circuit-2' },
           '3d':{ ballRadius:.5502, airborne:true, geometryId:'circuit-2' } },
  geometry: { width:44,length:68,goalWidth:11,goalHeight:4.2,
    cornerRadius:7,goalDepth:5.2,postRadius:.18 }
}
```

The snippet illustrates shape, not a replacement for the complete tuning tables. Produce a deterministic canonical JSON representation with sorted object keys, explicit finite numeric literals and stable array order; hash its UTF-8 bytes with SHA-256. Hash source coefficients such as .986, not platform-derived transcendental results; `catalog.js` derives rolling k. Include all simulation-affecting mode, planner, boost and geometry/prism values; exclude palette, local quality and accessibility preferences. Peers exchange protocol version, sim version and config hash before ready, then confirm selected mode. A mismatch blocks start with “Game versions differ — refresh both players”; do not silently fall back to incompatible physics. New versions do not mutate an ongoing match.

### Wire records and authority

Host owns simulation, AI, reserve, goals, scores and timers. Guest sends only intent; remove v2's manual throttle/steer fallback. Both local renderers consume a separate `presentationState`; interpolation never writes into collision state or feeds the host's planner.

```js
// Examples; names are protocol fields, not telemetry-only comments.
{t:'hello',protocol:2,simVersion:'fsd-contact-2',configHash:'sha256:...',car:'model3'}
{t:'setup',matchId:'...',roundEpoch:1,gfx:'pixel',configHash:'sha256:...',seed:8124}
{t:'input',matchId:'...',roundEpoch:1,seq:42,seenTick:180,boostHeld:true}
{t:'state',protocol:2,matchId:'...',roundEpoch:1,seq:31,tick:186,
 hostTimeMs:1550,ackInputSeq:42,phase:'play',phaseTicksLeft:0,
 activeTimeLeft:88.45,score:[0,0],
 cars:[{id:'P',kind:'cybertruck',x:0,z:10,yaw:0,vx:0,vz:-15,
        boost:.6,boostState:'active'}, /* B in same schema */],
 ball:{x:0,y:.9,z:0,vx:0,vy:0,vz:-22},
 events:[{id:91,tick:184,subTick:.4,type:'ballHit',pair:'P:ball',
          x:0,y:.9,z:1,nx:0,ny:0,nz:-1,closing:18,impulse:10,
          heavyBoost:false}]}
{t:'eventAck',matchId:'...',roundEpoch:1,lastEventId:91}
```

Validate finite coordinates, bounded numbers, allowed car IDs/enums, exactly two cars/one ball, maximum message sizes, session/epoch and monotonic sequence numbers. Do not `Object.assign` unknown properties. Stat/AI objects never travel in state snapshots. Reset sequence counters only with a new match/session ID; retain a monotonically increasing epoch on kickoffs. Disconnect clears buffers, inputs and pending effects. Rematch retains the PeerJS connection but negotiates a new match ID/config and flushes old records.

Send input on change immediately plus a 20 Hz level heartbeat; ignore keyboard autorepeat. Host neutralizes boost after **250 ms** without an accepted input, replacing the baseline 500 ms. Reject stale positive input whose referenced newest received host tick is >60 ticks old; a fresh higher-sequence release remains safe to accept. This prevents delayed held packets from reviving boost after a stall. `seenTick` is the newest network state, not delayed presentation time. Acknowledgments let the HUD distinguish requested from host-confirmed boost, not rewrite past physics.

### Smooth presentation and latency tradeoffs

Keep snapshots at **20 Hz**. Start a guest buffer **100 ms** behind estimated host time, clamp adaptation to **75–150 ms** using recent delivery jitter. Estimate monotonic-clock offset with ping/pong timestamps and low-RTT samples; log uncertainty, never claim exact one-way latency from unsynchronized clocks. Buffer at most 32 states, sorted by tick/sequence; discard duplicates, old epochs and states older than the committed render cursor.

Use linear interpolation for positions and shortest-arc yaw: `a+wrapPi(b-a)*alpha`. Keep all cars and ball on the same presentation timeline. Hermite interpolation can reduce curvature artifacts but may overshoot boards and contacts, so defer it. Host/offline presentation interpolates adjacent physics states with the accumulator, adding at most one 8.33 ms tick of visual lag.

If a newer sample is missing, extrapolate at most **50 ms** using current velocity/known drag, without simulating contacts, scores or effects. Then freeze transforms and show a connection indicator. New states correct presentation over **80 ms** only when error <1 unit and no collision/phase discontinuity; otherwise snap with a short neutral resync veil. Near boards prefer freeze over extrapolation. Goal/reset epoch changes clear histories/trails and snap to the new state; do not interpolate across the pitch. Schedule goal visuals, scoreboard and confirmed effects on the same delayed event timeline, while an authoritative lock immediately suppresses input.

This adapts [snapshot interpolation](https://gafferongames.com/post/snapshot_interpolation/) to three bodies. It adds buffer delay. At 80 ms RTT, immediate input + host tick + next snapshot + 100 ms buffer + render can approach **255 ms**, hence the 280 ms p95 starting budget. Immediate local button depression means “request sent,” not confirmed thrust. Use ≥450 ms opportunity cues; investigate role advantage instead of claiming host/guest latency equality.

Predict only local button/HUD intent initially. Predicting a car against an interpolated ball creates different timelines; predicting the whole world requires replay of planner state, contact episodes and both inputs. Cone's [networking slides, especially pages 105–176](https://media.gdcvault.com/gdc2018/presentations/Cone_Jared_It_Is_Rocket.pdf) explain why full prediction is substantial work. Our boost-only game should first test the simpler consistent timeline. No client-predicted ball hit, goal or reserve debit is authoritative.

Host events have stable IDs; include unacknowledged events for up to .5 s, capped at 32, and deduplicate by match/epoch/event ID. Drop overdue cosmetic hits after 250 ms if they cannot align with the rendered scene; reconcile scores from state even if the goal effect record was missed. Never infer a collision from a snapshot correction. Goal/restart events cannot be discarded as ordinary particles.

### Transport behavior and impairment tests

Retain the existing connection initially. Check both PeerJS `bufferSize` (messages) and `dataChannel.bufferedAmount` (bytes); coalesce unsent snapshots to the newest state when queued bytes exceed **4096**, retaining critical transitions. Resume below **1024**. Report persistent queueing after 250 ms. Already-enqueued SCTP messages cannot be unsent; application coalescing does not eliminate reliable head-of-line delay. [PeerJS API](https://peerjs.com/client/api/data-connection), [WebRTC specification](https://www.w3.org/TR/webrtc/#rtcdatachannel).

Crucial version detail: inspected [PeerJS 1.5.4 negotiator](https://raw.githubusercontent.com/peers/peerjs/v1.5.4/lib/negotiator.ts) passes `{ordered: !!options.reliable}` to `createDataChannel`; it does **not** set `maxRetransmits` or `maxPacketLifeTime`. Simply changing `reliable:false` must not be described as guaranteed lossy/unreliable delivery. A later partially reliable channel needs an explicitly scoped transport adapter and real tests; it is not required for the first release.

Test a seeded application harness around send/delivery with 0/40/80/150 ms **one-way** delay, ±20/50 ms jitter, 1/5% message drops, duplicated/reordered snapshots, 300 ms bursts, and a 2 s stall. For reliable-channel emulation add an ordered queue with deliberate blocked delivery; arbitrary message loss is a robustness test, not a faithful SCTP model. Measure physical key/pointer event → host input acknowledgment → rendered response. Validate actual WebRTC using OS/network impairment on a second machine when available. HTTP throttling does not establish data-channel behavior.

## 7. Art bible and camera/interface plan

**Thesis:** an improbably serious sports facility built for cars with questionable judgment. Comedy lives in vehicle silhouettes, short garage copy and stadium signs; play remains quiet enough to read. A brushed-steel fridge with a confident bumper belongs. Lens flares, animated turf, competing neon colors and dense dashboard telemetry clash.

### Palette, materials, and recognition

| Semantic role | Day | Night | Rule |
|---|---|---|---|
| Surround /panel | `#090f18` /`#111b27` | same | Opaque HUD backing, no scene-dependent text contrast |
| Main /secondary text | `#eaf4f4` /`#a2b4c3` | same | Main text for score/action; secondary for names/status |
| Team A /team B | `#ffc268` /`#62dbe8` | same | Identity, not generic decoration; dark text on filled team controls |
| Turf alternating bands | `#245247` /`#28594c` | `#183d36` /`#1c453b` | Broad bands, texture variation ≤5% luminance; suppress fine noisy grass |
| Physical bumper/goal edges | `#c9d8d1` | `#c9d8d1` | Continuous clear edge; separate from low-contrast painted field lines |
| Ball /panel marks | `#f5f4df` /`#172632` | same | Light body, three large dark panel groups; tiny face only in close views |
| Warning | `#ff8b76` | same | Depletion/error; paired with words/icon, never replaces team assignment |

Calculated flat-color contrast in this investigation: main/secondary text on panel **15.49:1 /8.14:1**; team amber/cyan on panel **10.88:1 /10.59:1**; ball on base day/night turf **7.96:1 /10.73:1**. These are sRGB swatch calculations, not measured antialiased/illuminated screen contrast. Target normal text ≥4.5:1, meaningful non-text edges ≥3:1; verify actual rendered pixels. Use at least **44×44 CSS-pixel** touch targets as a product choice; WCAG 2.2 AA minimum target-size provisions are 24×24 with exceptions, not universally 44. [WCAG reference](https://www.w3.org/WAI/WCAG22/quickref/).

Vehicles use at most three large material groups plus glass, tires and team marks. Truck: angular steel wedge, long straight nose light, rear red bar. Model 3: cobalt compact capsule, dark roof, short pale nose. Cab: warm ivory shell, gold roof tile, shorter wheelbase; no extra steering-wheel graphic. Semi: dark/red tractor in front, long pale trailer; front/rear lengths match the rigid rectangle, no fake articulating joint. Keep vehicle personality independent of team color.

Team A gets one solid roof/sill stripe and triangle badge; B two short bars and diamond badge. Local car adds a white outlined rear chevron; opponent has no chevron. The same shapes appear beside score labels and at defended goals. Same-car mirrors must remain identifiable in grayscale and simulated protan/deutan/tritan views. Front light and rear brake bar remain distinct in monochrome by shape and placement.

The ball's body radius stays physical. In 2D require **≥8 CSS-pixel diameter** at 320×568 after layout revision. Remove face detail below 14 pixels; keep panels and a dark ≤1-pixel rim. In 3D target ≥8 pixels near action; when distance/framing makes that impossible, use a hollow ground marker and edge locator, not a silently enlarged solid ball. Ball shadow changes offset/softness with height so airborne 3D motion is visible. Trails never resemble a second solid ball.

### Stadium and screens

Retain quiet stripes, readable center circle and recessed goals. Painted lines are **0.10–0.16 units**, board facing **0.30 units** thick outward from the collision boundary. Posts use §4 primitives. Nets have dark backing, sparse .6-unit grid and low opacity; no net strand looks like a solid wall across the mouth. Seats repeat as low-contrast blocks; no moving spectators during decisive play. Day uses one broad key plus hemisphere fill; night changes turf/sky and adds decorative lamp emissives, preserving ball/bumper brightness. Avoid flashing lights and bloom as identity cues.

Carry the same panel corners, stripe badges, materials and wording into garage, faceoff, results and goal-share cards. Use existing Black Ops One only for the wordmark and short celebratory headlines; Arial/Helvetica bold for score/control labels and normal weight for help. This preserves an existing asset while removing the conflicting all-military 3D HUD. Suggested text: score 28–36 px, clock 22–28, action 14–16, names/status ≥12. Tabular numerals prevent clock movement; no new font download is required.

Reserve DOM bands in **both** modes. At 320×568 allocate approximately 80 px top, 88 px bottom and the remaining 400 px to play, before safe-area insets; use compact one-line reserve/status. With eight-pixel canvas padding and the existing 83-unit long framing envelope, ball diameter is about **8.33 CSS pixels**, a calculated layout target. In short landscape use side rails, preserve both goal recesses, and let long car names truncate while YOU/team symbols remain visible. Desktop keeps a compact scoreboard and controls outside play; optional help/chat collapses. Transient chat occupies a reserved margin, expires after 2 s, and never covers a goal mouth or ball. Opening an online menu clears local boost but leaves play running.

### Camera and motion comfort

2D keeps one uniform scale and the existing landscape/portrait transform: amber left/bottom, cyan right/top, even for the guest. Add clear defended-goal badges and attack arrows during faceoff; avoid surprise reorientation on a goal. Orientation changes snap layout once with cleared trails, not animated field rotation.

For 3D replace immediate car-heading chase with an elevated, attack-oriented follow camera. Target `0.45*car + 0.55*ball`, with velocity lookahead capped at .3 s and 4 units. Start height **12**, distance **18**, vertical FOV **52°**; fit player/ball with 12% screen margins by raising height to 22 and distance to 30. Keep yaw aligned to the local attack direction, allowing car-heading influence only within ±35° and at ≤90°/s. A reverse/recovery must not spin the camera 180°. Use critically damped target motion with .25 s response; do not lerp authoritative actors to fix camera discomfort.

Ray-test target→camera against decorative blockers; fade only the obstructing tower/wall, never the ball or actual near-side collision edge. If a close contest is still hidden, raise camera or reduce near-side board opacity with a visible boundary outline. Reduced motion removes shake/FOV kicks and offers fixed attack-axis elevated framing. No auto-switch during live play; save the preference. Capture close wall fights, ball behind the car, own-goal retreat and both local teams before accepting the camera.

## 8. Asset production and art/physics integration

The implementation agent authors reusable geometry/palette descriptors; the owner reviews a contact sheet and short playable slice at the phase gate. Procedural drawing/meshes are editable source assets. Do not commission paid work or produce AI images just to satisfy an asset count.

**Coordinate contract:** origin at footprint center, y=0 on the floor; canonical model nose points **-Z**. New Three.js objects use `rotation.y=yaw`. Existing meshes point +Z and `syncMesh` adds π: migrate model orientation and adapter together, never only one. Canvas uses local nose at negative local y and its existing `rotate(-yaw)` mapping. At yaw 0, π/2, π and -π/2 assert nose direction against `forwardXZ`. Transform view coordinates only after world-space drawing.

All opaque ground-contact bodywork/tires fit within `2*hx × 2*hz`. Add a thin visible bumper reaching the intended rectangle's leading/side contact zones so the rectangle does not appear to touch thin air. Permit at most **0.03 world units** or **1 screen pixel**, whichever is smaller, of edge discrepancy at a contact point. Sculpted corners may recede from the rectangle only if the bumper makes that collision edge visible. Shadows, exhaust, team markers and glows are separate named children with `decoration:true`; exclude them from bounds and do not render them as solid body panels. Upper 3D bodywork and roof contact surfaces follow T06's same editable prism descriptors; verify their overlay with lofted balls.

Proposed 3D prism profiles: every car has a base occupying the full physical rectangle at y=0–.75. Additional prisms below use **local -Z forward**, catalog w/l, symmetric x half-width, and vertical interval .75→listed top. They form a compound union, not independently duplicated masses. Author visible simplified cabin/trailer blocks to these profiles; small bevels stay inside the tolerance at contact surfaces.

| Profile part | x half-width | z interval | Top y, units /tuning range |
|---|---:|---|---|
| Truck cabin /bed | .46w /.46w | [-.36l,.08l] /[.08l,.45l] | 1.85 /1.10 [locked for initial art match] |
| Model 3 cabin | .40w | [-.26l,.24l] | 1.30 [locked] |
| Cab cabin | .42w | [-.30l,.30l] | 1.35 [locked] |
| Semi tractor /trailer | .45w /.48w | [-.46l,0] /[.02l,.49l] | 2.20 /2.50 [locked] |

These replace the uniform 1.25 eligibility approximation rather than claiming the old meshes had roof colliders. Upper trim must be drawn inside the union; maintain its silhouette using flat panels/colors instead of unmodeled protruding solids. Roof defense changes 3D tactics, so test it separately from the 2D projection and keep the geometry version in the handshake.

Ball radius derives from the same selected config in mesh and physics. Remove `makeBall`'s independent .55/.56 radii. Surface panel lines remain inside the sphere; no wire shell enlarges its body. Goal/board paths are generated from `arena-geometry.js`, never hand-traced to approximate physics. Debug view draws body rectangles, ball radius, contact normals/points, swept segments, goal planes and art bounds on the actual camera transform.

| Priority /asset | Variants /creation | Consumer /reuse | Acceptance |
|---|---|---|---|
| P0 four vehicle descriptors | Four IDs; shared day/night materials, A/B stripe overlays; procedural paths/meshes | `pixel.js`, `vehicles.js`, garage preview, share capture | All yaw/bounds checks; recognizable nose and mirror ownership at phone size |
| P0 ball | Flat /airborne render adapters; procedural circle/icosphere | Both renderers and share | Exact radius; panel LOD; height shadow; no frame-dependent spin |
| P0 contact marks and boost | Normal-aligned flash/lines; one pooled style family | Proposed `sim-events.js` consumers | Real contact position, no duplicate guest effects; §9 thresholds |
| P1 arena and goals | Day/night; 2D cached path, 3D reusable strips/capsules | `pixel.js`, `field.js`, common geometry | Inner openings/rounded corners coincide; near-goal visibility |
| P1 identity/HUD kit | A/B/local/opportunity/recharge icons as SVG paths and CSS tokens | Garage, HUD, faceoff/results/share | Same meaning across modes; grayscale/focus/44px targets |
| P1 audio set | Existing hit/thunk/boost/goal roles, trimmed and gain-balanced; new quiet depletion tick only if needed | `audio.js` | Distinct impulse classes, mute respected, no rapid repeated starts |
| P2 stadium flavor | ≤4 static signs, seats/towers as reused meshes | Background cache /`field.js` | No gameplay occlusion; no new per-frame background drawing |

Production order: reference Model 3 → all-car bounds contact sheet → ball/goal truth → team/boost feedback → day/night arena → garage/results/share consistency. Store editable sources under proposed `assets/source/`; exported SVG icons under `assets/ui/`, optional models under `assets/models/<id>.glb`, and a manifest with ID, source path, dimensions, pivot, forward, version/hash, author/provenance and license. Existing procedural JS can remain the source of truth without an unnecessary binary export.

If authored 3D later helps, use GLB/glTF 2.0, Y-up, baked transforms, no cameras/lights/hidden collision meshes, one unit per world unit. Budget **≤2,000 triangles/car**, ball ≤320, arena ≤20,000, ≤4 material groups/car, shared wheel geometry; instanced seats, one key shadow at 1024² desktop/512² mobile, blob shadows fallback. Detail drops below 24 projected pixels; no roof text then. Share materials/geometries with reference counts and dispose when their final consumer closes, including garage swaps/rematches. [Three.js r169 resource cleanup](https://raw.githubusercontent.com/mrdoob/three.js/r169/manual/en/cleanup.html).

Canvas/SVG colors are sRGB; transparent exports use straight-alpha PNG without colored matte. Color textures use `SRGBColorSpace`; data maps use `NoColorSpace`, and Three.js lighting remains linear with sRGB output. Verify palette in unlit swatches separately from lit materials. [Three.js r169 color management](https://raw.githubusercontent.com/mrdoob/three.js/r169/docs/manual/en/introduction/Color-management.html).

No runtime atlas is selected. If a later sprite experiment is requested: export **16 evenly spaced views**, nose convention recorded, scale **64 source pixels/world unit**, full untrimmed canvas from collision bounds plus 8 pixels transparent margin, center pivot metadata, four-pixel edge extrusion in an atlas, names `<id>_yaw_00..15`. Never rotate an eight-view perspective sprite as if it were a top-down vector. Compare bilinear and nearest filtering at actual phone size; reject halo/scale drift. Such a migration needs its own evidence.

Example procedural art brief: “MODEST 3, cobalt capsule body inside 1.98×4.2 world-unit bumper rectangle, nose -Z, dark single roof group, four tires fully inside bounds, white nose bar and split rear bar; one amber stripe or two cyan bars; no baked team-colored shadow.” This is sufficient for editable geometry; generative raster prompts are unnecessary. External assets, if ever used, require source URL, explicit license, attribution/modification obligations and editable source review before integration. Reference screenshots are inspiration only.

## 9. Effects and feedback specification

Simulation emits records; renderer/audio interpret them. Define intensity `m=clamp((closingSpeed-1)/24,0,1)`. Position is the manifold contact point, direction n points into the ball or receiving body. Default hit cooldown **80 ms per pair**, max **4 audible impacts/s** using strongest-first priority; physical resolution continues. No authoritative hit stop, time dilation, ball squash or goal-seeking visual displacement. This avoids unsynchronized clocks and misleading contacts.

In the matrix, “RM” means reduced motion; **all camera amplitudes are cosmetic screen translation**, independent of physics. Sounds are roles for the existing system, not mandatory new files. One contact chooses one impact class, in priority order boosted heavy →hard →glancing →ordinary/slow push; it never stacks all matching rows.

| Event /trigger | Position, direction, appearance /magnitude | Duration /sound /camera | Cooldown, budget, RM |
|---|---|---|---|
| Glancing hit: closing ≥1, tangential speed >normal closing | Contact; 2 ivory tangent flecks plus a short normal tick, opacity .3+.5m | 80 ms; light click scaled by m; no shake | 80 ms/pair; ≤2 flecks/event; RM static tick 100 ms |
| Hard ball hit: closing ≥8, otherwise ordinary hit ≥1 | Contact; ivory arc facing n, radius .3+.6m, 4–8 flecks | 120 ms; medium thump; shake ≤1.5m CSS px for 90 ms | 80 ms/pair; ≤8; RM fixed arc, no camera |
| Boosted heavy hit: verified heavyBoost and closing ≥8 | Contact normal; broad cream plate flash with small team edge, 8 flecks | 140 ms; lower thunk, not louder than mix cap; ≤2 px/110 ms | 100 ms/pair; ≤8; RM one 120 ms plate |
| Slow push: persistent contact, closing <1 | Contact edge faintly lightens; no burst or false impact | Fade 100 ms after separation; no sound/camera | Continuous one mark/pair; RM same |
| Car collision: closing ≥2 | Shared contact; 2–4 muted steel flecks in ±n | 100 ms; short chassis knock; ≤1 px only if closing ≥10 | 150 ms/pair; ≤4; RM small static mark |
| Board rebound: closing ≥4 | Actual wall point; 2 pale flecks inward along reflection | 90 ms; dry tap; no camera | 120 ms/feature; ≤2; RM boundary pulse |
| Boost start | Two rear exhaust slots; team outer wedges, cream core | 80 ms onset into sustain; one rising motor accent; no FOV kick | Once per active episode; ≤4 particles; RM steady wedges |
| Boost sustain | Rearward velocity trail, length ≤2.5 units, opacity ≤.45 | While active; smooth quiet motor loop; no camera | ≤12 live particles/car; RM steady short exhaust |
| Boost end /depletion | Exhaust fades; depletion adds warning icon and RELEASE label | 100 ms end; quiet down-tick once on depletion | One per episode; no burst; RM same UI |
| Save, new derived event | Defender badge near HUD; never a ball explosion | 350 ms badge; restrained positive chirp; no camera | 1.5 s/car; one badge; RM same |
| Goal | Inside crossed goal recess; team chevrons directed inward, ball remains traceable | 450 ms burst then score celebration; goal/crowd; optional ≤2 px/140 ms | Once per epoch; ≤24 particles replacing lower-priority effects; RM static goal border/badge |
| Restart | Center spot and both team badges; clear trails and old effects | 250 ms appearance; whistle once; camera settles before unlock | Once per new epoch; zero particles; RM immediate clear placement |

Save qualification is new: a pre-contact predicted trajectory must enter the defended mouth within 1 s, a defending car contact must occur, and post-contact prediction must remove that threat for .5 s. Record uncertain/contested cases but do not label them SAVE until confirmed. This is cosmetic credit only, with no hidden scoring or difficulty effect.

Pool **48 total particles desktop /24 mobile**, prioritizing goal→ball contact→boost→boards. Keep ≤2 contact flashes and one goal effect; merge simultaneous weaker sounds. Ball trail requires speed >8 units/s, keeps .16 s of history and ≤3 units of length; disabled in RM. Audio voice budget **6 SFX plus existing music/crowd**, gain ceilings tested with headphones and phone speaker. Honor mute independently; all crucial state changes remain visible. Guest effects are event-ID-driven on the presentation timeline; correction alone never makes sparks or sound.

## 10. Performance, validation and playtest plan

### Budgets and measurement

Assumed test classes: desktop **Core i5-1240P/Iris Xe, 16 GB**, 1440×900 Chrome/Edge; constrained mobile **Pixel 6a-class Android Chrome, 6 GB**, plus **iPhone SE 2020-class Safari**. These are proposed reference classes, not machines profiled here. Record actual device, OS, browser build, thermal state and power mode. SwiftShader screenshots do not satisfy these budgets.

| Budget | Desktop P | Mobile P | Method /fallback |
|---|---:|---:|---|
| Playable startup on defined 10 Mbit/s, 100 ms RTT cold-cache profile | ≤3 s | ≤5 s | Resource Timing including CDN and fonts; separate music download; lazy-load optional audio |
| Critical compressed download /increment | ≤1.5 MB total /≤150 KB added | same | Measure transferred bytes, not repository size; retain static app and procedural art |
| Physics tick p95 /p99 | .20 /.50 ms | .50 /1.0 ms | `performance.now` around complete authoritative tick; 10-minute trace incl. jams |
| Tactics update, both cars, p95 | .35 ms | .8 ms | Include all candidate rollouts; reduce candidates before lowering simulation Hz |
| Frame p95 /p99 at 60 Hz | 16.7 /25 ms | 16.7 /33 ms | Real rAF distribution and GPU tools; report CPU/render/GC separately |
| Severe frames | <1 frame >50 ms/minute after warmup | <2/minute | Long-task trace; eliminate allocation/shader churn |
| Canvas render p95 /3D CPU submission | 2 /4 ms | 4 /6 ms | Cached stadium, no per-frame background rebuild; lower decorative work |
| 3D draw calls /triangles | ≤100 /30k | ≤65 /20k | `renderer.info`; instance repeated meshes, reduce shadows |
| JS heap /GPU texture estimate | ≤100 /64 MB | ≤70 /32 MB | Plateau after 20 rematches; <5 MB monotonic heap growth after settled GC |
| Snapshot/input payload | typical ≤768 B at 20 Hz; ≤1536 B event burst /≤96 B input | same | Actual serialized application bytes; state average ≤20 KB/s, input ≤3 KB/s including edges, excludes transport overhead |

Target 60 FPS; do not promise 120/144/240 FPS on these devices. Verify their presentation rates do not change simulation outcomes for the same tick-indexed inputs when no time is dropped. Start 3D rendering at scale .75–1 and DPR capped at 1.5; degrade shadows→decorative details→scale .5. Change scale after ≥2 s sustained cost, recover after ≥5 s headroom. Keep text DOM resolution and ball/ownership cues. Canvas DPR remains capped at 2, falling to 1 if measured necessary. [WebGL batching/resolution guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) supports these mechanisms, not our budget numbers.

### Required tests and telemetry

| Area | Fixtures /invariant or quality gate |
|---|---|
| Ball contact | All four cars × yaw 0/15/45/90/135/180°; resting/separating/deep overlap, face/side/corner/glance, low/full boost. No separating impulse; analytic isolated momentum/energy tolerance 1e-6 relative; no effect from position repair |
| Multiple constraints | Symmetric P/ball/B squeeze and swapped order; ball/board/car pin; rotating semi/corner; both recesses. Finite state, residual depth ≤.01, no cap activation, recover ≤4 s in ≥95% of fixture variants |
| Goals | Both signs, full crossing, outside/inside post by .001, crossbar clearance by .001, high-speed diagonal crossing, floor bounce at mouth, duplicate event/reset. Exact one score; same result when subdividing time |
| Time | 30/60/120/144/240 Hz, jitter, 200 ms/1 s stalls, offline menu/hidden/resume and true mobile suspension. Equal tick-input outcomes; expected dropped-time accounting; no unseen multi-goal catch-up |
| AI | Open/wrong-side shot, moving/airborne intercept, near own goal, keeper covering each lane, side/corner/recess escape, moving orbit with no useful progress. Record reason transitions and reject forbidden trajectories |
| Balance/agency | 16 ordered pairs, both sides/host roles, no/hold/random/timed policies, both modes; at least 12 fixture families ×10 small deterministic perturbations. Report per-car and per-fixture distributions, paired intervals and draws |
| Online | Shared mode/hash, mixed versions, stale seq/epoch, duplicate/reordered/malformed states, release dropped/stalled, buffered transport, hidden host/guest, disconnect, connected rematch. One authoritative outcome, no obsolete event replay |
| Visual contract | Collider/art overlays, circular ball, four cardinal noses, same-car mirrors, both themes, grayscale/color-vision simulation, reduced motion. Bounds ≤§8 tolerance; render motion cannot fabricate a hit |
| Layout /flow | 320×568,390×844,844×390,1280×900,1440×900; DPR 1/2/3, resize/rotation/safe areas; garage→faceoff→play→goal→result→rematch; keyboard/touch, menus/chat/share/X identity/presence |

Extend existing physics/autopilot suites with invariant fixtures. Preserve approaching-only response, conservation where applicable, finite state and full-ball scoring assertions. Update only deliberately changed geometry, 3D height-response and clock-overflow expectations, with explicit before/after fixtures; do not delete invariant checks to make a migration pass. Add proposed `tests/contacts-continuous.test.mjs`, `tests/boost-policy.mjs`, `tests/net-protocol.test.mjs`, and a browser impairment harness only for behavior not currently covered. Expand `arena-ui.mjs` to check the 3D HUD and small-ball size, not just DOM non-overlap. Keep scenario injection in intercepted localhost responses as the existing suite does; do not ship production scoring cheats.

Each replay stores revision/config hash, fixture/seed, mode, tick inputs, dropped time, actor transforms/velocities, contact feature/normal/impulse/depth, pre/post ball velocity, phase/goal events, planner state/reason/target/predicted contact time, boost request/accepted state/drain, CPU timing and cap/repair counters. Network traces add seq/ack, send/receive/render times, buffer occupancy and correction magnitude. Use bounded typed/ring buffers and export on demand; no per-tick JSON allocation or console logging in normal play.

Diagnose a missed opportunity by replay: **planner failure** if a feasible contact existed but no attainable route was chosen; **physics failure** if swept shapes crossed without a resolved contact; **presentation failure** if an authoritative event existed but the body bounds/camera/delivery hid it. Record event-to-render delay separately from key-to-host delay. Do not combine these into one “bad physics” counter.

Baseline policy experiment reproduction: integrate 1/120; initial P `(0,14,0)`, B `(0,-14,π)`; ball `(x,z,vx)` in `[(0,0,0),(3,0,-4),(-3,0,4),(0,4,0)]`, y=radius, vy=0 in 2D/6 in 3D. Mirror x,z,vx and controlled side; assign each of 16 car pairs in turn. Plan P then B, solve carCar then both carBall then stepBall, matching baseline order. Stop at first-to-3 or 90 active seconds; immediate post-goal resets preserve baseline toward offset/velocity. No faceoff/celebration/network/reaction delay.

Policies sampled every .1 s: NONE false; HOLD true; RANDOM alternates approximately .3 s holds and `.3+U*.8` s releases, decrementing a timer by .1 (quantized), using LCG `s=(1664525*s+1013904223) mod 2^32`, seed `501+scenarioIndex`. TIMED starts .3 s holds when reserve>.25, ball bottom<1.25, heading-to-ball<.25 rad, ball goalward of car, and distance in `(reach+.5,reach+8)`, reach=half-length+radius. It can renew while conditions hold. Opponent uses undefined intent, i.e. baseline automatic boost. Count goals from the controlled side. Table §5 embeds all aggregate results; optional local script/JSON supports exact auditing but is not needed to understand the experiment. Future agency tests add 100–200 ms reaction delay and noisy observations to the timed policy.

### Human playtest and acceptance

Run a **15-minute, 6–8-person exploratory session** per participant, including at least two touch players; seek a mix of first-time and returning players. Counterbalance build order. Give one minute of controls explanation, then two 90-second matches each with ordinary play, instructed holding, and instructed timing, switching car/mode/host role across participants. Use remaining time for short replay questions; never coach the desired answer. Record consented input/event traces and observed misunderstandings, not identifying account data.

Ask: Where did that hit land? Why did boost help or fail? Which car felt heavier? Which goal were you defending? Could you always find your car and the ball? Did the camera make you uncomfortable? Would you voluntarily rematch? Ask players to point to one wasted and one useful boost in replay.

Accept agency only if the paired informed policy improves mean goal differential by **≥0.25 goal/match** over hold in the declared mix, with a 95% paired bootstrap interval above zero across scenario families, and no mode-level reversal hidden by aggregation. Treat this as an engineering gate, not proof of population preference. Human gate: at least **6 of 8** can explain both useful/wasted timing, ≥6 prefer the revised response, and no unresolved repeatable ownership/camera failure. With six participants use ≥5, clearly reporting the small sample. If failed, revise gates/economy/cues before adding input complexity; do not quietly lower thresholds after inspecting results.

Performance and invariant gates are mandatory; subjective target misses invite a specific design decision rather than forced score correction. Test release candidates on real mobile Safari/Chrome and a genuine second network. Preserve room/invite/rematch, pause rules, quick chat, sound/music, goal stills, optional X login and presence. The eventual release uses the existing Vercel CLI project and verifies deployed module/config hashes and hard-refresh play on both domains. This research performs no deployment or configuration change.

## 11. Phased implementation backlog

Sizes are relative: **S** a focused change, **M** several coupled functions, **L** a subsystem with significant fixtures. Confidence describes implementation uncertainty, not an invented completion date. Each task is a separate reviewable change; future implementation should use a `codex/` branch and preserve unrelated files. No implementation work or release is performed by this document.

### Phase A — establish evidence and compatibility

| Task | T01 — P0: reproducible diagnostics |
|---|---|
| Player-visible outcome | Future fixes target identifiable missed contacts/decisions instead of unexplained tuning |
| Prerequisites | Baseline commit and this plan |
| Files /symbols | `tests/physics.test.mjs`, `tests/autopilot.test.mjs`, `main.js:render_game_to_text`; proposed fixture recorder under `tests/` |
| Implementation /starting interface | Tick-indexed input replays, cap/repair/contact counters, seed/config metadata; bounded debug ring buffer, disabled in normal play |
| Acceptance /verification | Reproduce V01 and boost microburst probe; export one jam and one open-shot trace; repeated same-runtime fixture output identical |
| Regression risks | Instrumentation alters timing or leaks test controls |
| Rollback /fallback | Remove instrumentation adapter; keep offline fixture scripts and recorded baseline |
| Effort /confidence | S–M /high |

| Task | T02 — P0: single configuration and version handshake |
|---|---|
| Player-visible outcome | Both players run the same car/mode rules; stale clients get a clear refresh instruction |
| Prerequisites | T01 |
| Files /symbols | `characters.js`, `catalog.js`, `sim.js:getField/drive/stepBall`, `autopilot.js:planDrive`, `main.js:onHello/onStart`, `net.js`; new `net-protocol.js` |
| Implementation /starting interface | Migrate **live** constants unchanged first; positive restitution magnitudes; immutable derived shapes; protocol 2 and canonical config hash (§6), legacy geometry ID until T06 |
| Acceptance /verification | All 38 regressions plus deliberate hash/mode/version mismatch; unchanged tick fixtures agree before/after migration |
| Regression risks | Accidentally activating legacy fields or changing floor bounce to .55 |
| Rollback /fallback | Revert config and protocol together; mixed versions remain blocked |
| Effort /confidence | M /high |

### Phase B — first playable contact/agency slice

| Task | T03 — P0: contact iteration and truthful events |
|---|---|
| Player-visible outcome | Pushes and simultaneous hits remain stable; impacts identify actual touch points |
| Prerequisites | T02 |
| Files /symbols | `sim.js:carBall/carCar/clampFieldCar`, `main.js:simulateMatch/sendSnapshot/onState`; new `contacts.js`, `sim-events.js` |
| Implementation /starting interface | 4 velocity/2 position iterations, .005 slop, .20 correction cap, restitution-once handling, physical event records and minimal ID-deduplicated guest delivery; keep discrete topology and original restitution until isolated comparison |
| Acceptance /verification | Rest/separate/rotated/momentum tests stay green; P/ball/B squeeze and board pins stay finite without escalating energy; no event from correction |
| Regression risks | Iteration re-applies bounce, moves actors outside boards, changes lift cadence |
| Rollback /fallback | Keep prior solver selectable only by a negotiated development config; compare fixtures, then remove losing path before release |
| Effort /confidence | M /medium |

| Task | T04 — P0: explicit boost cycle and controllable driving |
|---|---|
| Player-visible outcome | Holding spends a clear burst; releasing recharges; no accidental flicker or hidden automatic rationing |
| Prerequisites | T02–T03 |
| Files /symbols | `input.js:readControls`, `autopilot.js:planDrive`, `sim.js:drive`, `characters.js` |
| Implementation /starting interface | §5 boost FSM (.18 start, zero cutoff, .12 rearm, .25 recharge delay), immediate release, no held recharge; separate safety gate; then staged heavy/drag tuning |
| Acceptance /verification | Ten-second hold has zero post-depletion auto-restarts; release cancels within one sim tick; repeat/blur/cancel cannot strand input; 1,024-policy rerun reported by mode |
| Regression risks | “Ignored button” confusion, CPU advantage, planner braking cancels thrust |
| Rollback /fallback | Revert numeric tuning independently; retain observable FSM and release handling; failed agency keeps build experimental |
| Effort /confidence | M /medium |

| Task | T05 — P0: matching bumper art and first feedback |
|---|---|
| Player-visible outcome | Visible bumper contact matches the kick and boost state is understandable |
| Prerequisites | T03–T04 |
| Files /symbols | `vehicles.js:makeVehicle/makeBall`, `pixel.js:vehicle`, `main.js:syncMesh/stepGame`, `audio.js`, `arena.css`; new `art-contract.js` |
| Implementation /starting interface | Correct all four bounds, radius-derived ball, -Z model contract with adapter migration, dt/distance-based roll, normal tick/flash and reserve FSM labels; polish Model 3 first |
| Acceptance /verification | Cardinal-yaw overlay/contact sheet for all cars in both modes; §8 tolerance; no duplicate local/guest effect; player can distinguish WAITING from ACTIVE |
| Regression risks | Double π rotation, garage/share orientation, effects mistaken for body size |
| Rollback /fallback | Retain corrected bounds and simple static marks if richer effects fail budget/readability |
| Effort /confidence | M /high bounds, medium feel |

**Gate A:** stop feature expansion after T05 until the slice preserves both modes/all cars, passes contact invariants, eliminates microbursts, and survives a short human agency check. Online slice testing requires T02 compatibility; final guest smoothing is T08. This gate reviews a concrete playable result, not a moodboard.

### Phase C — stronger simulation and autonomous contests

| Task | T06 — P1: sweeps and physical arena agreement |
|---|---|
| Player-visible outcome | Fast shots respect posts/corners; goals are unambiguous; 3D boards match what is drawn |
| Prerequisites | Gate A, T02 config migration |
| Files /symbols | `contacts.js`, `sim.js:stepBall`, `arena-geometry.js`, `field.js`, `vehicles.js`, `pixel.js:stadium`, `main.js:onGoal/resetKick`, `physics-clock.js` |
| Implementation /starting interface | §4 CCD/floor roots/goal latches, 8 catch-up ticks, diagnostic overflow; separately land circuit-2 horizontal geometry, .18 posts and §8 height-aware car prisms |
| Acceptance /verification | High-speed/mouth-edge/crossbar/roof fixtures and split-step equivalence; no CCD budget exhaustion; grounded-car tensor conserves passive energy; overlays show matching physical boundaries |
| Regression risks | Rotational grazing, changed 3D reachability, duplicate last-tick goals |
| Rollback /fallback | Separate geometry from CCD commits; restore previous negotiated geometry if planner gate fails; Planck spike only after bounded custom fixes fail |
| Effort /confidence | L /medium-low; highest algorithmic risk |

| Task | T07 — P1: reachable tactics and recovery |
|---|---|
| Player-visible outcome | Cars intercept, make space for a shot, defend sensibly and leave jams |
| Prerequisites | T06 geometry/predictor; T04 controller |
| Files /symbols | `autopilot.js:planDrive`, `sim.js:botAI`, shared config; new AI fixtures |
| Implementation /starting interface | 15 Hz FSM, shared 1.5 s forecast, ≤3×45 rollout steps/car/update, .6 s lane commitment, 3/6/8 s useful-progress escalation, normal CPU 100 ms reaction |
| Acceptance /verification | Defined attack/defense/airborne/recess fixtures; ≥95% recovery ≤4 s; mirror-side and 16-pair report; no hidden impulses or privileged boost |
| Regression risks | Solver defects masked by avoidance, planner budget blowup, goal-side bias |
| Rollback /fallback | Reduce candidates to two, keep current waypoint tactics for unproven states; retain explicit reasons/recovery counters |
| Effort /confidence | L /medium |

### Phase D — online and final visual integration

| Task | T08 — P1: separate guest presentation and event delivery |
|---|---|
| Player-visible outcome | Guest motion is smooth, scores/effects agree, and connection stalls are understandable |
| Prerequisites | T02 schema, T03 events; baseline performance captured |
| Files /symbols | `main.js:onState/sendSnapshot/stepGame`, `net.js:send/wire`, `net-protocol.js`; new `snapshot-buffer.js` |
| Implementation /starting interface | §6 records, 100 ms buffer, 50 ms extrapolation ceiling, epoch resets, immediate input edges, 250 ms neutralization, queue metrics/coalescing, event dedup |
| Acceptance /verification | All existing real PeerJS flows; impairment suite; no interpolation writes to sim; zero double goals; response/queue metrics within declared connection budget |
| Regression risks | Added latency, stale held input, duplicate effects, rematch residue |
| Rollback /fallback | Disable extrapolation first; fixed 100 ms interpolation if adaptation unstable; keep v2 schemas/epoch safety |
| Effort /confidence | L /medium |

| Task | T09 — P1: procedural art family and asset lifecycle |
|---|---|
| Player-visible outcome | Four distinct cars and both arenas belong to one recognizable game |
| Prerequisites | T05 contract, T06 geometry |
| Files /symbols | `art-contract.js`, `vehicles.js`, `pixel.js`, `field.js`, `audio.js`, proposed source/manifest assets |
| Implementation /starting interface | §§7–9 palette/material/shape inventory, day/night mappings, pooled effects, shared mesh disposal and low-detail variants |
| Acceptance /verification | Roster/theme/mirror contact sheet at phone scale; swatch and rendered contrast; 20 rematches without growing retained resources; draw/particle budgets |
| Regression risks | Visual noise, material recoloring hides teams, disposal breaks shared meshes |
| Rollback /fallback | Flat materials, blob shadows, static marks; no paid/generated asset dependency |
| Effort /confidence | M–L /high production, medium recognition |

| Task | T10 — P1: camera, responsive HUD and flow consistency |
|---|---|
| Player-visible outcome | Ball and goal remain visible; touch controls and chat do not cover play |
| Prerequisites | T05, T08–T09 |
| Files /symbols | `main.js:stepGame/share/garage/results`, `arena-layout.js`, `arena.css`, `style.css`, `net.css`, `index.html`, `tests/arena-ui.mjs` |
| Implementation /starting interface | Attack-oriented camera §7, reduced-motion preference, 80/88 px small-phone bands, 44px controls, team-shape ownership, reserved transient-message area |
| Acceptance /verification | Five required viewports plus DPR/safe areas; ≥8px 2D ball; no decisive occlusion; keyboard focus; camera-comfort playtest; share card preserves same identity |
| Regression risks | Short landscape squeeze, cyan orientation confusion, online menu accidentally pauses |
| Rollback /fallback | Fixed elevated camera, collapsed secondary controls; retain whole-arena uniform fit |
| Effort /confidence | M /medium |

### Phase E — validate and release only an accepted result

| Task | T11 — P0 release gate: evidence, balance and deployment verification |
|---|---|
| Player-visible outcome | A tested update with preserved rooms/rematches and credible timing/clarity |
| Prerequisites | T06–T10, invariant gates green |
| Files /symbols | All existing suites, proposed policy/impairment tests, `docs/04-PIXEL-MODE.md`, `docs/05-NETWORK.md`, `docs/06-DEPLOY.md`, `docs/08-AGENT-PLAYBOOK.md` |
| Implementation /starting interface | §10 matrix, real device/network runs, counterbalanced playtest, versioned evidence manifest and rollback artifact; update docs around actual shipped behavior |
| Acceptance /verification | Zero unresolved invariants/cap repairs; agency and real-device gates met; all existing feature flows; eventual CLI deployment checked by module/config hash and browser play on both domains |
| Regression risks | Treating local success as production coverage; cached mixed versions; obsolete instructions |
| Rollback /fallback | Redeploy recorded last-good full application through existing CLI project, reverting sim/config/protocol together; retain diagnostics |
| Effort /confidence | M–L /high procedure, unknown balance/device outcome |

## 12. Risks, experiments and unresolved decisions

| Uncertainty | Recommended default /bounded experiment | Pass/fail and consequence /owner decision point |
|---|---|---|
| Release-to-recharge feels punitive | Keep explicit FSM; compare two recharge delays (.15/.25 s) without changing other stats | Agency gate plus no recurring “ignored button” confusion; owner chooses feel after Gate A footage |
| Heavy stat changes overcorrect | Compare contract-only, boost-only, then heavy tuning in matched scenarios | Maintain pair/side limits and no mode reversal; revert individual arrows before adding handicaps |
| 3D ball too small | Keep .5502 first; compare .70 with identical mass and fully derived art/goal/predictor config | ≥6/8 prefer tracking, no unacceptable shot/goal shift; owner decides before final art polish; never visual-only enlargement |
| Roof contact changes 3D balance | T06 uses the specified visible prism profiles; compare 3D defense/shot distributions before and after | No unearned repeated lift or dominant semi roof block; tune shared mass/driving or visible profile dimensions together, with owner review if identity changes |
| Custom CCD remains fragile | Two isolated repair attempts against minimized failing fixtures, then small Planck adapter spike | No tunneling/energy/corner failures and mobile budget; engine migration requires a separate scope decision |
| 100 ms guest buffer weakens timing | Compare 75/100/125 ms under identical measured impairments, both host roles | Meet delay/visual gates; if no setting does, retain honest limited-latency release or separately scope full prediction |
| 3D horizontal geometry change harms legacy feel | Separate geometry commit; test current vs rounded/recessed boards | Improved recovery/clarity without extra own-goal bias; owner reviews before merging geometry |
| Background host cannot sustain play | Explicit stall/resync and existing disconnect timeout | Actual mobile suspension never invents scores; dedicated server remains future work, not a claimed local fix |
| Art/performance targets conflict | Remove decoration/shadows before body/ball/ownership cues | Real-device p95/p99 and recognition pass together; owner chooses acceptable quality floor |

Optional future experiments: manual steering toggle, ball spin/torque, articulated semi, overtime, additional vehicles, ranked service or dedicated host. They are not prerequisites and must not absorb the mainline backlog. There is no paid tooling assumption. Budget/time estimates for external art remain unavailable until the owner requests that work.

## 13. Handoff to the implementation agent

Start with **T01, then T02**, at the pinned baseline or a separately audited newer revision. Read live imports; preserve the untracked research prompt and unrelated work. Reproduce the 38 simulation tests and both browser suites. Capture startup failures rather than silently retrying them away. Preserve a last-good config/replay set before modifying constants.

Build T03–T05 as the first playable branch: translation-based custom solver, 120 Hz, four/two iterations, .005 slop, .18 boost start, release-to-recharge, actual contact events, all-car bounds and Model 3 reference polish. Keep initial geometry and core mass/dimensions unchanged. Version compatibility comes first. Do not replace Canvas2D, Three.js, PeerJS, or static deployment with a framework migration.

Required artifacts per gate: code/config hash, deterministic fixture inputs/results, boost-policy table by mode/car/side, debug contact screenshots, a short real-play recording, test logs including failures, and a plain statement of unmeasured hardware/latency. Keep these local until the authorized implementation workflow calls for publication. Gate A must prove understandable boost/contact feedback before deeper tactics and scenery. T06 geometry/CCD and T07 planning must pass minimized fixtures before long soaks. T08 establishes a separate render timeline before guest effects are considered complete. T09–T10 must match collision contracts at phone size. T11 requires real device and human evidence, then verified release through the existing project convention.

Do not interpret proposed coefficients, synthetic wins or attractive screenshots as proof of fun. Record each tuning group, test its hypothesis, keep the smallest successful change, and update this plan's proposed/verified labels in the implementation handoff. The owner should review a concrete playable phase result, not choose a physics architecture again.

## 14. Annotated sources

All external material below was accessed **2026-09-25**. Versioned sources are identified explicitly; unversioned documentation can change. Equations/techniques inform the design; numerical gameplay/performance thresholds are original proposals. Source pages and slides were inspected; no claim is made to have watched complete talks or played the reference games.

| Source | Decision supported /limit |
|---|---|
| [1. Glenn Fiedler, Fix Your Timestep! (2004)](https://gafferongames.com/post/fix_your_timestep/) | Fixed accumulator, bounded catch-up, interpolation. Does not establish our 120 Hz/eight-tick budget |
| [2. Erin Catto, Solver2D (2024)](https://box2d.org/posts/2024/02/solver2d/) | Accumulated impulses, iterative constraints and position/velocity separation; adapt to three translation-based bodies, not a general engine clone |
| [3. Planck official documentation](https://piqnt.com/planck.js/docs/), [body CCD](https://piqnt.com/planck.js/docs/body.html), [TOI](https://piqnt.com/planck.js/docs/collision.html), [manifest](https://github.com/piqnt/planck.js/blob/master/package.json) | Credible 2D alternative, actual bullet/step APIs, rotation caveats; upstream manifest 1.5.0/MIT inspected. No downloaded-size or mobile benchmark claim |
| [4. Rapier JavaScript rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/), [snapshot API](https://rapier.rs/docs/user_guides/javascript/serialization/), [determinism](https://rapier.rs/docs/user_guides/javascript/determinism/), [license](https://rapier.rs/docs/) | 0.21-labelled JS docs, CCD/axis constraints, `takeSnapshot` and same-initialization limits. Apache-2.0. No migration experiment performed |
| [5. Craig Reynolds, Steering Behaviors for Autonomous Characters (1999)](https://www.red3d.com/cwr/steer/gdc99/) | Separate tactical intent, steering and locomotion; no supplied soccer policy or hidden assistance |
| [6. R. Craig Coulter, Pure Pursuit (1992)](https://publications.ri.cmu.edu/storage/publications/pub_files/pub3/coulter_r_craig_1992_1/coulter_r_craig_1992_1.pdf) | Lookahead/curvature control; our sign convention and low-speed fallback adapt it to controlled yaw, not a real steering axle |
| [7. Jared Cone, It IS Rocket Science! (GDC 2018 slides)](https://media.gdcvault.com/gdc2018/presentations/Cone_Jared_It_Is_Rocket.pdf) | Public evidence for simplifying car response and acknowledging prediction complexity; not a source of proprietary coefficients or a requirement to copy Rocket League |
| [8. Glenn Fiedler, Snapshot Interpolation (2014)](https://gafferongames.com/post/snapshot_interpolation/) | Buffered render state and interpolation tradeoffs; our reliable WebRTC connection differs from its transport assumptions |
| [9. PeerJS DataConnection API](https://peerjs.com/client/api/data-connection) | `dataChannel`, bufferSize, serialization/event surfaces; byte and message queues are different measurements |
| [10. PeerJS v1.5.4 negotiator source](https://raw.githubusercontent.com/peers/peerjs/v1.5.4/lib/negotiator.ts) | Pinned implementation confirms ordered flag mapping; turning off `reliable` alone does not configure retransmission limits |
| [11. W3C WebRTC, RTCDataChannel](https://www.w3.org/TR/webrtc/#rtcdatachannel) | Channel queue/reliability semantics; not an HTTP-throttling recipe or latency guarantee |
| [12. MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | Hidden-page timer/rAF limitations; must still validate real suspension on devices |
| [13. Three.js r169 color-management source](https://raw.githubusercontent.com/mrdoob/three.js/r169/docs/manual/en/introduction/Color-management.html) | sRGB inputs/output and linear lighting; matches baseline library generation, no upgrade assumed |
| [14. Three.js r169 cleanup guide](https://raw.githubusercontent.com/mrdoob/three.js/r169/manual/en/cleanup.html) | Explicit resource disposal; reference counting policy here is our integration decision |
| [15. MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) | Batching, resource and resolution control; budget values require profiling |
| [16. W3C WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/) | Contrast, color-independent communication, target sizing and motion requirements; this plan is not a completed accessibility conformance audit |
| [17. Original Fire Games official imagery](https://www.originalfiregames.com/), [Circuit Superstars description](https://www.originalfiregames.com/circuit-superstars) | Verified visual reference for compact cars and organized boundaries; no assets licensed for reuse by visiting the page |
| [18. Funselektor, art of rally official site](https://www.artofrally.com/) | Verified visual reference for grouped forms/materials and environmental restraint; source site credits community gallery images, so do not treat them as a free asset pack |

Local measurement ledger (optional audit receipts; all essential outcomes are embedded above):

| Receipt | What was actually performed /limits |
|---|---|
| V01 | Direct Node test invocation in §2; 38/38 pass. `tests/autopilot.test.mjs` also rewrote its normal `output/arena-rebuild/ai-soak.json` |
| `output/research-2026-09-25/gameplay/results.json` | Local browser suite, nine checks, no errors; real PeerJS integration, localhost scoring/endpoint fixtures; background-throttling launch flags mean no suspension proof |
| `output/research-2026-09-25/ui-retry/arena-ui-results.json` | Five fresh layout cases passed; initial separate run timed out at startup. Screenshots inspected: `gameplay/pixel-desktop.png`, `gameplay/3d-desktop.png`, `ui-retry/circuit-small-phone.png` |
| `output/research-2026-09-25/probes.mjs` and `probes.json` | Baseline-only synthetic policy/boost experiment, protocol and full aggregate table in §§5/10; no gameplay module modifications, network or human measurements |
| `output/research-2026-09-25/bounds.mjs` and `bounds.json` | Chromium/Three.js computed mesh AABBs, values in §2; includes solid mesh details, excludes added team markers |
| `output/research-2026-09-25/circuit-reference.png` and `rally-reference.png` | Captured official reference pages and visually inspected them; research screenshots, not production assets |
| Palette arithmetic in §7 | Standard sRGB relative-luminance calculation on chosen hex swatches; not a rendered accessibility or lighting measurement |

Open measurements remain exactly X01/X02: production parity and external identity/share flows, real device performance/suspension, actual impaired internet play, audio perception and human agency. Their absence does not prevent beginning T01–T05; it prevents claiming the final experience or release is already validated.
