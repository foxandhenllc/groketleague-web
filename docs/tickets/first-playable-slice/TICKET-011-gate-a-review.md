# TICKET-011: Assemble the first playable slice and Gate A evidence

Type: Task
Epic: Evidence
Priority: P0
Estimate: 1-2 plus participant availability focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: Existing test suites, new slice fixtures, `docs/tickets/first-playable-slice/INDEX.md`; proposed Gate A evidence summary
Status: Pending human Gate A review

## Context
Gate A stops feature expansion after the bounded contact/boost/art slice. Automated invariants and a short human agency check must support the next phase. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
A passing synthetic run or attractive contact sheet cannot establish that boost timing is understandable.

## Scope
- Integrated regression receipts, contact sheet, policy comparison and real-play recording.
- Explicit pass/fail/unmeasured assessment and unresolved issue list.
- Breadcrumbs: Existing test suites, new slice fixtures, `docs/tickets/first-playable-slice/INDEX.md`; proposed Gate A evidence summary.

## Out of Scope
- T06-T11 implementation, production deployment and final release certification.

## Proposed Approach
- Run all slice tests and the three existing suites on the integrated revision. Include both modes/all cars and host/guest input, room/rematch/disconnect and menu semantics.
- Bundle code/config hashes, fixtures, policy table, overlays, recording and all failures/retries in an evidence manifest.
- Conduct a short participant check: have the player show useful and wasted boost and distinguish WAITING from ACTIVE without coached answers. Record participant count and observations; this is preliminary, not the final 6-8-person gate.
- If no participant is available, mark human evidence pending and keep Gate A unaccepted. Do not expand to T06-T10 or deploy based solely on automated success.

## Acceptance Criteria
- [ ] Contact invariants pass, held microbursts are eliminated and visual bounds meet tolerance for both modes/all cars.
- [ ] Local/guest feedback survives real PeerJS play and lifecycle resets without duplicate events.
- [ ] Short human check and recording exist; misunderstandings are documented and repeatable failures block acceptance.
- [ ] Evidence distinguishes local browser coverage from unmeasured real hardware/network and final human balance.
- [ ] Gate A verdict states accepted, failed or pending with concrete next actions.

## Test Plan
- Use INDEX validation commands, new targeted fixtures and human real-input play.
- Retain startup failures even if retries pass; report reason if established, otherwise unknown.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-011/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-001 through TICKET-010 completed; TICKET-008 may conclude with reverted tuning
- Risk: Human/device availability can delay acceptance; it does not block starting implementation.
- Rollback: Retain the last passing integrated revision and reopen the smallest failing ticket; no release rollback is needed because this slice is local.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T05; Gate A
- 13. Handoff to the implementation agent
- 10. Human playtest and acceptance

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. Automated assembly is complete; the human check and recording remain pending. Gate A is not accepted.
