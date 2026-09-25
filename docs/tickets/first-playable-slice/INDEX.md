# First playable slice - ticket index

## Summary

Implementation-ready grooming of source-plan T01-T05, plus their Gate A review. TICKET-001 through TICKET-010 are implemented on `codex/first-playable-slice`; TICKET-011 has automated evidence and awaits human review. See [Gate A evidence](GATE-A.md) for results and open limitations. Unrelated work is preserved. These are local tickets. The implementation is committed on its review branch; it has not been pushed or deployed.

Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md), especially sections 4-6, 8-11 and 13. Verified checkout on 2026-09-25: `304e880eb9541b77dd85c506033343450f6440de`. The research plan and earlier research prompt were untracked and are preserved.

The plan's T01-T11 identifiers identify broad parent tasks; TICKET-001 through TICKET-011 identify the smaller implementation changes here. Proposed coefficients remain experiments. Current live values, including .42 floor restitution and .972 heavy boosted restitution, are preserved through configuration/contact migration. Tuning receives its own comparison ticket.

## Sprint 1

Evidence and compatible rules, in order:

- [TICKET-001: Capture reproducible baseline and failure diagnostics](TICKET-001-baseline-replays.md)
- [TICKET-002: Centralize live physics and driving configuration](TICKET-002-shared-live-config.md)
- [TICKET-003: Reject incompatible multiplayer configurations](TICKET-003-version-handshake.md)

## Sprint 2

Stable contacts and boost, in dependency order:

- [TICKET-004: Resolve coupled contacts without repeated bounce energy](TICKET-004-iterative-contacts.md)
- [TICKET-005: Emit truthful impacts and deduplicate guest feedback](TICKET-005-contact-events.md)
- [TICKET-006: Make boost hold, release and recharge explicit](TICKET-006-boost-state-machine.md)
- [TICKET-007: Separate propulsion targets, braking and collision overspeed](TICKET-007-speed-controller.md)
- [TICKET-008: Compare isolated heavy-response and economy tuning](TICKET-008-tuning-experiment.md)

## Sprint 3

Truthful presentation and integrated review:

- [TICKET-009: Match all car bumpers and ball art to physics](TICKET-009-art-contact-contract.md)
- [TICKET-010: Show boost states and actual impact feedback](TICKET-010-boost-impact-feedback.md)
- [TICKET-011: Assemble the first playable slice and Gate A evidence](TICKET-011-gate-a-review.md)

Sprint labels express logical batches, not calendar commitments. Each ticket is sized at roughly 1-3 focused engineering days; durations are planning estimates and exclude participant/device availability. TICKET-009 can begin once configuration and contacts pass; it does not require completion of tuning.

## Prioritized List by Epic

All tickets are P0 within this slice because they deliver or validate the core contact/boost promise. These priorities do not promote deferred polish into release blockers.

### Evidence

- [TICKET-001: Capture reproducible baseline and failure diagnostics](TICKET-001-baseline-replays.md)
- [TICKET-011: Assemble the first playable slice and Gate A evidence](TICKET-011-gate-a-review.md)

### Compatibility

- [TICKET-002: Centralize live physics and driving configuration](TICKET-002-shared-live-config.md)
- [TICKET-003: Reject incompatible multiplayer configurations](TICKET-003-version-handshake.md)

### Contacts

- [TICKET-004: Resolve coupled contacts without repeated bounce energy](TICKET-004-iterative-contacts.md)
- [TICKET-005: Emit truthful impacts and deduplicate guest feedback](TICKET-005-contact-events.md)

### Boost

- [TICKET-006: Make boost hold, release and recharge explicit](TICKET-006-boost-state-machine.md)
- [TICKET-007: Separate propulsion targets, braking and collision overspeed](TICKET-007-speed-controller.md)
- [TICKET-008: Compare isolated heavy-response and economy tuning](TICKET-008-tuning-experiment.md)

### Truthful presentation

- [TICKET-009: Match all car bumpers and ball art to physics](TICKET-009-art-contact-contract.md)
- [TICKET-010: Show boost states and actual impact feedback](TICKET-010-boost-impact-feedback.md)

## Dependency Notes

| Ticket | Parent plan task | Dependencies | Handoff |
|---|---|---|---|
| TICKET-001 | T01 | Baseline checkout | Capture reproducible baseline and failure diagnostics |
| TICKET-002 | T02 | TICKET-001 | Centralize live physics and driving configuration |
| TICKET-003 | T02 | TICKET-002 | Reject incompatible multiplayer configurations |
| TICKET-004 | T03 | TICKET-002, TICKET-003 | Resolve coupled contacts without repeated bounce energy |
| TICKET-005 | T03 | TICKET-003, TICKET-004 | Emit truthful impacts and deduplicate guest feedback |
| TICKET-006 | T04 | TICKET-003, TICKET-004 | Make boost hold, release and recharge explicit |
| TICKET-007 | T04 | TICKET-006 | Separate propulsion targets, braking and collision overspeed |
| TICKET-008 | T04 | TICKET-007, TICKET-005 | Compare isolated heavy-response and economy tuning |
| TICKET-009 | T05 | TICKET-002, TICKET-004 | Match all car bumpers and ball art to physics |
| TICKET-010 | T05 | TICKET-005, TICKET-006, TICKET-009 | Show boost states and actual impact feedback |
| TICKET-011 | Gate A | TICKET-001 through TICKET-010 completed; TICKET-008 may conclude with reverted tuning | Assemble the first playable slice and Gate A evidence |

Contact events and boost state work can be developed independently after the contact solver, but share `sim.js`/`main.js`; keep integration ownership explicit and land sequentially when working in one checkout. This document does not dispatch parallel agents.

TICKET-008 is complete when comparisons are reproducible and coefficient decisions are recorded, including reverting all candidates. Rejected tuning is not a reason to discard the verified FSM or conceal the result. TICKET-011 requires integrated presentation even if the numeric experiment concludes with unchanged settings.

## Definition of Ready

- Each ticket has an explicit outcome, verified module breadcrumbs, exclusions, dependencies, observable acceptance criteria, test procedure, rollback and exact source-plan labels.
- The baseline commit is verified. Audit any later changes before starting; retain the research plan and unrelated prompt. Create the implementation branch before source edits.
- Existing Node/Python/Playwright commands and baseline receipts are identified below. Verify availability at implementation start; no paid service or engine migration is required.
- Shared invariants remain 120 Hz, four car IDs, boost-only human control, Canvas2D/Three.js modes, host-authoritative PeerJS, first-to-3/90 active seconds and current arena geometry.
- A ticket is ready to start when its dependencies pass; readiness does not mean its tests have already run or its behavior has shipped.
- The short human Gate A check requires a participant later. It does not prevent implementing the slice. Missing human evidence must be labelled pending and cannot be fabricated from automation.

## Validation commands and evidence

From the repository root, start a local server in a separate terminal:

```powershell
python -m http.server 5197 --bind 127.0.0.1
```

Then run the baseline suites sequentially in another terminal:

```powershell
node --experimental-default-type=module --test tests/physics.test.mjs tests/autopilot.test.mjs
$env:GAME_URL = 'http://127.0.0.1:5197'
$env:QA_OUT = 'output/first-playable-slice/baseline/gameplay'
node tests/netplay.mjs
$env:QA_OUT = 'output/first-playable-slice/baseline/ui'
node tests/arena-ui.mjs
```

Inspect each exit status before proceeding. Use ticket-specific output folders for subsequent runs and preserve failed attempts separately from retries. Stop the server after checks. Run newly added fixtures using their documented commands; do not claim hypothetical filenames already exist.

Research receipts are under ignored `output/research-2026-09-25/`: gameplay/results.json, ui-retry/arena-ui-results.json, probes.json and bounds.json. They are historical local evidence, not portable dependencies or fresh tests from this grooming turn. The plan records 38 simulation tests, 9 gameplay checks and the unexplained UI startup timeout before its successful retry. Reproduce the protocol from the plan if ignored research scripts are unavailable.

Every implemented ticket records command, revision/config hash, result, failures and residual limits. Keep generated heavy artifacts ignored; keep concise conclusions alongside the ticket or linked Gate A report. Browser emulation and SwiftShader screenshots do not certify real mobile performance.

## Scope boundaries and later backlog

| Later plan task | Work retained behind the gate |
|---|---|
| T06 | CCD, swept goals/floor roots, catch-up budget, posts, unified arena geometry and height-aware roof prisms |
| T07 | 15Hz tactics, forecast/candidate rollouts, reachable attack/defense and recovery |
| T08 | Full validated narrow snapshot schema, separate guest presentation timeline, interpolation, fresh input/transport impairment handling |
| T09 | Complete procedural art family, final effect matrix and resource lifecycle |
| T10 | Camera, responsive HUD/flow consistency and advisory opportunity presentation |
| T11 | Full policy/perturbation campaign, 6-8-person human agency gate, real devices/second network and authorized release verification |

Minimal compatibility and deduplicated event delivery belong to this slice; final guest smoothing does not. Basic boost/contact feedback belongs here; SHOT/RACE/SAVE advice and derived save credit depend on later prediction/presentation work. Existing floor/roof eligibility and arena topology remain until T06; the slice must not silently activate the final config example's geometry.

## Gate A exit

TICKET-011 assembles the concrete playable result for review. Acceptance requires preserved modes/roster, contact invariants, zero held microbursts, matching bumpers, understandable boost/contact feedback and a short human check. If evidence is missing, report pending. If a repeatable failure remains, reopen the smallest relevant ticket. Do not expand into the later backlog or imply production readiness from this preliminary gate.
