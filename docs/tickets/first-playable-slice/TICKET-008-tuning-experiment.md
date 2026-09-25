# TICKET-008: Compare isolated heavy-response and economy tuning

Type: Spike
Epic: Boost
Priority: P0
Estimate: 1-2 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `characters.js`, proposed `tests/boost-policy.mjs`, replay fixtures from TICKET-001
Status: Implemented; automated evidence recorded

## Context
The tuning arrows are proposals and the research policy experiment was mode-sensitive. A controlled comparison is required before retaining changed coefficients. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Landing all coefficients together would obscure whether gains came from controls, mass response or boost economy.

## Scope
- Matched contract-only, boost/controller and candidate tuning receipts.
- Separate heavy handling, boost economy and heavy restitution experiments.
- Breadcrumbs: `characters.js`, proposed `tests/boost-policy.mjs`, replay fixtures from TICKET-001.

## Out of Scope
- Final balance certification, full 12-family perturbation campaign and final human/device release gate T11.

## Proposed Approach
- Run the exact 1,024-trial protocol from section 10 for baseline and candidate builds, preserving seeds/scenarios and baseline receipts.
- Test section 5 heavy acceleration/turn/grip/drag, boost accel/factor/drain/recharge and .86 heavy restitution as individually reversible groups. Lock body dimensions/masses/radii.
- Report wins/draws/losses, goal differential, duration, boost time and cap/repair counts per mode/car/side. Retain only supported groups; reverted or inconclusive is a valid documented outcome.

## Acceptance Criteria
- [ ] Reproducible policy runner and all 1,024 results are saved for each compared configuration.
- [ ] No mode reversal or car/side imbalance is hidden in pooled results.
- [ ] Chosen/reverted coefficients and reasons are explicit; normal scenarios have no cap/repair activations.
- [ ] Synthetic results are labelled diagnostic and do not claim human fun or the final section 10 agency gate.

## Test Plan
- Reproduce the research protocol first; compare identical seed/scenario pairs.
- Rerun focused contact/controller invariants for each changed coefficient group.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-008/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-007, TICKET-005
- Risk: A heuristic policy may favor the wrong behavior; no optimization to a single aggregate score.
- Rollback: Return rejected groups to their pre-experiment values while keeping FSM and diagnostics.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T04
- 5. Shared tuning sheet
- 5. Measured baseline agency experiment
- 12. Risks, experiments and unresolved decisions

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. All three experimental tuning groups were evaluated and reverted; the retained control still has a negative 3D timed-versus-hold result.
