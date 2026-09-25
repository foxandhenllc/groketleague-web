# TICKET-003: Reject incompatible multiplayer configurations

Type: Task
Epic: Compatibility
Priority: P0
Estimate: 1-2 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `net.js:wire`, `main.js:onHello/onStart`, proposed `net-protocol.js`, proposed `tests/net-protocol.test.mjs`
Status: Implemented; automated evidence recorded

## Context
Changed physics must not start a match against stale rules. Current room/start handlers are the integration boundary for a version handshake. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Mismatched clients can display different rules or silently consume incompatible state.

## Scope
- Protocol 2, simulation version, canonical SHA-256 config identity and selected-mode confirmation.
- Compatibility checks for private rooms, quick match and connected rematches.
- Breadcrumbs: `net.js:wire`, `main.js:onHello/onStart`, proposed `net-protocol.js`, proposed `tests/net-protocol.test.mjs`.

## Out of Scope
- Guest interpolation and full transport impairment handling (T08).

## Proposed Approach
- Sort object keys, retain stable array order and hash UTF-8 source coefficients, including all simulation-affecting settings. Exclude palette/accessibility settings.
- Keep explicit legacy geometry IDs until T06. Block missing/invalid version/hash and disagreeing setup mode before simulation starts.
- Show a refresh-both-players message; never mutate config during an ongoing match.

## Acceptance Criteria
- [ ] Equal config with different key insertion order hashes identically; one physics coefficient change changes the hash.
- [ ] Cosmetic preference changes do not change the hash.
- [ ] Missing/old protocol, sim version, hash or mode mismatch prevents start and shows actionable UI.
- [ ] Matching peers complete private-room/quick-match starts and connected rematch in both modes.

## Test Plan
- Unit-test canonicalization and malformed/mismatch records.
- Run real two-context PeerJS flows and intentionally stale-client fixtures.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-003/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-002
- Risk: Partial protocol rollout may strand old clients without an explanation.
- Rollback: Revert protocol and configuration as one compatible application; never bypass mismatch checks.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T02
- 6. Configuration and module ownership
- 6. Wire records and authority

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
