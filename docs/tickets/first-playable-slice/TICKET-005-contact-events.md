# TICKET-005: Emit truthful impacts and deduplicate guest feedback

Type: Task
Epic: Contacts
Priority: P0
Estimate: 1-3 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `sim.js:carBall/carCar`, `main.js:simulateMatch/sendSnapshot/onState`, proposed `sim-events.js`, `net-protocol.js`
Status: Implemented; automated evidence recorded

## Context
Physics and effects currently share contact timing concerns. The playable slice needs an actual impact record that both local and guest presentation can consume once. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Sound cooldowns must not govern separation or lift, and positional correction must not look like a new hit.

## Scope
- Physical event records with pair/feature, tick, point, normal, closing speed, impulse and boost classification.
- Minimal bounded host-to-guest event delivery with match/round identity and event IDs.
- Breadcrumbs: `sim.js:carBall/carCar`, `main.js:simulateMatch/sendSnapshot/onState`, proposed `sim-events.js`, `net-protocol.js`.

## Out of Scope
- Full snapshot slimming/interpolation, transport coalescing and latency guarantees (T08).

## Proposed Approach
- Trigger lift from genuine physical contact episodes independently of sound, retaining current lift caps/coefficient.
- Specify new episode/re-entry and fresh closing-speed peak behavior with fixtures; use .08s per-pair effect cooldown without suppressing the solver.
- Validate the event envelope, deduplicate IDs, acknowledge/prune bounded pending records, and clear them at kickoff/rematch/disconnect. Discard wrong-session records.
- Use current received-state presentation for this slice; document that synchronized buffered presentation arrives in T08.

## Acceptance Criteria
- [ ] Correction-only, separating and persistent resting contacts emit no fresh impact or repeated lift.
- [ ] One genuine hit supplies a finite normalized normal and actual contact point.
- [ ] Duplicate/reordered event records produce one local/guest effect per ID; old epochs cannot replay.
- [ ] Event storage remains bounded when a guest stalls; no unbounded retry queue.
- [ ] Score authority and goal/rematch counts remain unchanged.

## Test Plan
- Unit-test episode transitions, duplicate IDs, invalid payloads and stale epochs.
- Two-browser hit/reset/rematch/disconnect exercise in both modes; count emitted versus consumed IDs.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-005/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-003, TICKET-004
- Risk: Events can leak across rounds or duplicate existing immediate effect calls.
- Rollback: Retain physics and disable richer consumers; revert event wire changes with matching protocol changes.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T03
- 4. Goals, repeated contact, and numeric safety
- 6. Wire records and authority
- 9. Effects and feedback specification

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
