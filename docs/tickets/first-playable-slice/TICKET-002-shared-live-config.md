# TICKET-002: Centralize live physics and driving configuration

Type: Task
Epic: Compatibility
Priority: P0
Estimate: 1-3 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `characters.js`, `catalog.js`, `sim.js:getField/drive/stepBall`, `autopilot.js:planDrive`
Status: Implemented; automated evidence recorded

## Context
The character sheet and live simulation disagree on floor restitution and repeat drive constants. The migration must preserve values actually used by the current runtime. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Accidentally enabling stale sheet values would mix a refactor with an unmeasured gameplay change.

## Scope
- Validated immutable configuration and derived collision descriptors.
- Explicit per-instance mode/config consumption in simulation and prediction.
- Breadcrumbs: `characters.js`, `catalog.js`, `sim.js:getField/drive/stepBall`, `autopilot.js:planDrive`.

## Out of Scope
- Boost FSM, controller tuning and arena unification.

## Proposed Approach
- Inventory each consumed literal with its live value, units and reader before moving it.
- Migrate unchanged values first: floor restitution magnitude .42, heavy boosted car/ball restitution .972, existing dimensions/masses and distinct arena topologies.
- Store source rolling coefficient .986; derive k in catalog. Reject non-finite values and invalid IDs. Remove global mode leakage between independent fixtures.

## Acceptance Criteria
- [ ] Before/after tick fixtures agree within existing documented numeric tolerances; explain any floating-point-only difference.
- [ ] No proposed tuning arrows are activated.
- [ ] Alternating two simulation instances in different modes leaves each identical to an isolated run.
- [ ] Physics, planner and render descriptors derive dimensions/radii from the same source.

## Test Plan
- Run 38 existing regression tests plus configuration validation and cross-instance tests.
- Compare baseline open-shot, floor-bounce and drive traces.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-002/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-001
- Risk: Legacy fields may look authoritative despite being bypassed.
- Rollback: Revert consumers and config migration together; keep baseline fixtures.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T02
- 2. Current-state audit and evidence ledger: V08
- 6. Configuration and module ownership

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
