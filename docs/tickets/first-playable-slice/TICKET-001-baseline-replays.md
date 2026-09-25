# TICKET-001: Capture reproducible baseline and failure diagnostics

Type: Task
Epic: Evidence
Priority: P0
Estimate: 1-2 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `tests/physics.test.mjs`, `tests/autopilot.test.mjs`, `main.js:render_game_to_text`; proposed recorder/replay fixtures under `tests/`
Status: Implemented; automated evidence recorded

## Context
The existing 38 simulation tests passed during research, while a ten-second hold reproduced depleted-reserve microbursts. Browser coverage included a startup timeout followed by a successful standalone rerun. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Without repeatable evidence, solver and tuning changes can hide regressions or silently repair invalid state.

## Scope
- Tick-indexed replay inputs and baseline receipts for both modes.
- Bounded opt-in contact, cap, repair and boost diagnostics.
- Breadcrumbs: `tests/physics.test.mjs`, `tests/autopilot.test.mjs`, `main.js:render_game_to_text`; proposed recorder/replay fixtures under `tests/`.

## Out of Scope
- Physics/controller behavior changes.
- CCD, real-device performance certification and human balance claims.

## Proposed Approach
- Run the three existing suites using the INDEX commands; retain initial failures and retries.
- Promote the research probe protocol from plan section 10 into a maintained fixture; do not rely on ignored output scripts being present.
- Record revision, config identity, seed, mode, tick inputs, transforms, velocities and relevant counters. Export jam and open-shot traces. Keep normal play free of per-tick JSON/logging.

## Acceptance Criteria
- [ ] Existing tests and browser results are recorded with environmental limitations.
- [ ] Repeated same-runtime replay inputs yield identical state/event outputs, excluding wall-clock timing.
- [ ] Ten-second hold records initial duration and post-depletion reactivations separately for all four cars.
- [ ] One jam and one open-shot trace per mode can be replayed; debug storage stays bounded.
- [ ] Cap/repair counters expose invalid-state recovery; no production scoring or input cheats are introduced.

## Test Plan
- Run baseline simulation suites and both browser suites sequentially.
- Repeat fixtures twice; compare deterministic fields. Run with diagnostics disabled and enabled to check identical outcomes.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-001/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: None; audit the working tree before starting.
- Risk: Diagnostics may alter timing or accidentally become production controls.
- Rollback: Remove runtime diagnostics adapter while retaining offline fixtures and receipts.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T01
- 2. Current-state audit and evidence ledger: V01-V06
- 10. Required tests and telemetry

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
