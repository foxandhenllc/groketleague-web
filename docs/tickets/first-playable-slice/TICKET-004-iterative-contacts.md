# TICKET-004: Resolve coupled contacts without repeated bounce energy

Type: Task
Epic: Contacts
Priority: P0
Estimate: 2-3 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `sim.js:carBall/carCar/clampFieldCar`, `main.js:simulateMatch`, proposed `contacts.js`
Status: Implemented; automated evidence recorded

## Context
Current pair-by-pair resolution needs bounded simultaneous-contact handling. The first slice retains discrete geometry, current restitution and the 3D bottom-of-ball <1.25 eligibility gate. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Pins and simultaneous hits can become order-sensitive or gain artificial energy when restitution is reapplied.

## Scope
- Translation-only manifolds, including existing boards, with stable pair/feature IDs.
- Four velocity and two position iterations; persistent-contact handling.
- Breadcrumbs: `sim.js:carBall/carCar/clampFieldCar`, `main.js:simulateMatch`, proposed `contacts.js`.

## Out of Scope
- CCD, posts, new goal rules, 3D roof prisms, clock catch-up changes and restitution tuning.

## Proposed Approach
- Capture pre-solve normal speed once, accumulate nonnegative impulse and apply only its delta. Set subsequent persistent-tick bounce target to zero; no cross-tick warm start.
- Use position correction min(.20,.8*max(depth-.005,0)), split by inverse mass and recompute geometry each position iteration.
- Alternate traversal by tick parity. Opposing normals with dot < -.8 suppress restitution for the constrained batch. Keep tangential friction zero.
- Handle zero normals and embedded-ball exit faces explicitly; correction changes position only and cannot generate goals/effects.

## Acceptance Criteria
- [ ] Resting/separating, rotated contact and isolated momentum/energy invariants remain green (1e-6 relative tolerance where applicable).
- [ ] P/ball/B squeeze, reversed actor order and board pins stay finite without escalating passive energy or safety-cap/repair activations.
- [ ] Deep-overlap stabilization leaves residual penetration <=.01 after 20 ticks.
- [ ] Boards remain enforced after actor separation; all four cars and both modes pass.
- [ ] Baseline restitution values remain unchanged, including .972 boosted-heavy restitution.

## Test Plan
- Add targeted approach/separate/glance/deep-overlap fixtures for four cars at 0/15/45/90/135/180 degrees.
- Compare symmetric and swapped-order fixtures; isolate drive/lift when checking passive energy.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-004/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-002, TICKET-003
- Risk: Iteration can reapply bounce or push bodies through boards.
- Rollback: Use a negotiated development-only baseline solver for comparisons if needed; remove the losing path before release.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T03
- 4. Contacts, constraints, and continuous detection

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
