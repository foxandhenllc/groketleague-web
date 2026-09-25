# TICKET-009: Match all car bumpers and ball art to physics

Type: Task
Epic: Truthful presentation
Priority: P0
Estimate: 2-3 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `vehicles.js:makeVehicle/makeBall`, `pixel.js:vehicle`, `main.js:syncMesh/stepGame`, proposed `art-contract.js`
Status: Implemented; automated evidence recorded

## Context
Three car meshes overhang their physical footprints and the semi is narrower than its collider. Ball rotation also currently advances per render frame. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Visible misses and floating contacts make correct physics difficult to trust.

## Scope
- Four-car bumper/bounds correction in both modes; Model 3 reference polish.
- Shared ball radius, canonical nose orientation and elapsed/distance-based visual roll.
- Breadcrumbs: `vehicles.js:makeVehicle/makeBall`, `pixel.js:vehicle`, `main.js:syncMesh/stepGame`, proposed `art-contract.js`.

## Out of Scope
- Roof prism collision/profile migration (T06), stadium rebuild and ball-radius experiment.

## Proposed Approach
- Author solid bodywork/tires inside physical footprints; add visible collision-edge bumpers. Mark shadows/rings/exhaust as decorative and exclude them from bounds.
- Migrate Three model nose to -Z and remove syncMesh pi adapter in the same change; retain Canvas negative-local-y nose mapping.
- Derive ball mesh/panels from selected radius without an outer wire shell. Accumulate rotation from distance/radius or velocity*dt.
- Generate a cardinal-yaw contact sheet at desktop and phone scale; check garage/share consumers for orientation regressions.

## Acceptance Criteria
- [ ] All four cars at four cardinal yaws in both modes show aligned nose vectors and bumpers.
- [ ] Contact-edge discrepancy <= min(.03 world units, one projected pixel); decorative children are excluded explicitly.
- [ ] Ball displayed radius equals .9/.5502 by mode; equivalent travel produces equivalent roll at 30/60/120/144/240 render Hz.
- [ ] Garage and share orientation remains correct; no doubled pi rotation.

## Test Plan
- Geometry bounds assertions and contact overlays in both renderers.
- Inspect Model 3 contact then all-car contact sheets and phone screenshots.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-009/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-002, TICKET-004
- Risk: Sculpted corners can still imply empty-space contact unless bumper edges are visible.
- Rollback: Keep corrected simple bumpers and flat materials if polish obscures the contract.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T05
- 8. Asset production and art/physics integration
- 2. Current-state audit and evidence ledger: V07, V10

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
