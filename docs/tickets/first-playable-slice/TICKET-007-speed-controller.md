# TICKET-007: Separate propulsion targets, braking and collision overspeed

Type: Task
Epic: Boost
Priority: P0
Estimate: 2-3 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `sim.js:drive`, `autopilot.js:planDrive`, `characters.js`
Status: Implemented; automated evidence recorded

## Context
Boost thrust must not be cancelled by ordinary-cruise braking. Collision-induced speed and commanded propulsion speed have different meanings. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Clamping velocity on release erases physical impulses and hides whether boost helped.

## Scope
- Forward/lateral speed controller, service braking and explicit reverse transitions.
- Collision-overspeed diagnostics and controlled decay.
- Breadcrumbs: `sim.js:drive`, `autopilot.js:planDrive`, `characters.js`.

## Out of Scope
- 15Hz tactics, reachable rollouts and geometry changes.

## Proposed Approach
- Use .25s speed-control constant, drag feed-forward and class/car brake limits from section 5. Raise target while active; only path/board safety braking overrides boost.
- Introduce the specified mild acceleration taper, exponential lateral damping, reverse cap 5 and reverse entry below .5 speed as a separate controller change.
- Stop adding propulsion beyond its ceiling rather than clipping collision velocity. Log >1.1 times boosted ceiling with cause; 80 units/s is an invalid-state guard.
- Keep heavy stat/drag/boost numeric retuning in TICKET-008 and label controller-formula changes separately in evidence.

## Acceptance Criteria
- [ ] Boost increases propulsion target without simultaneous ordinary-cruise braking.
- [ ] Release does not snap velocity to ordinary cap; valid collision overspeed decays via drag/braking.
- [ ] Reverse entry, signed steering, braking and finite-state guard pass boundary fixtures.
- [ ] Per-car acceleration time, stopping distance and turn radius are reported against section 3 targets; misses remain visible.

## Test Plan
- Straight acceleration/release, light-car shove into heavy car, braking, reverse and constant-speed turn probes.
- Run existing physics/autopilot tests and compare traces before/after controller formulas.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-007/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-006
- Risk: New speed control may change AI arrival estimates before the later planner migration.
- Rollback: Revert this controller group independently, retain boost FSM, and mark target misses for Gate A.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T04
- 5. Shared tuning sheet
- 5. Vehicle controller and player information

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
