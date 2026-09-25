# TICKET-010: Show boost states and actual impact feedback

Type: Task
Epic: Truthful presentation
Priority: P0
Estimate: 1-3 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `main.js:stepGame` and HUD, `pixel.js`, `vehicles.js`, `audio.js`, `arena.css`, `sim-events.js`
Status: Implemented; automated evidence recorded

## Context
The first slice requires understandable WAITING versus ACTIVE feedback and a flash at the actual impact. The full camera/effect redesign belongs to later phases. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Without visible state and contact cues the player cannot assess whether timing helped.

## Scope
- Reserve state labels, WAITING reason and release/recharge cues.
- Small normal-aligned contact mark/flash and boost onset/sustain/end feedback.
- Breadcrumbs: `main.js:stepGame` and HUD, `pixel.js`, `vehicles.js`, `audio.js`, `arena.css`, `sim-events.js`.

## Out of Scope
- Advisory SHOT/RACE/SAVE prediction indicators, derived save credit, camera shake, final effect matrix and full HUD redesign (T07/T09/T10).

## Proposed Approach
- Show immediate local pressed intent, then authoritative ACTIVE/WAITING state; guest UI must not present requested boost as confirmed thrust.
- Consume event IDs once; remove legacy duplicate hit consumers. Use actual contact point/normal and section 9 intensity/cooldowns.
- Use a minimal static-tick/flash subset first, pooled and within section 9 budgets; mute and reduced-motion cues remain informative.
- Keep Model 3 the polished reference while providing truthful basic feedback for all four cars.

## Acceptance Criteria
- [ ] READY, WAITING with reason, BOOSTING, RELEASE TO RECHARGE and RECHARGING are distinguishable in both modes.
- [ ] Local press appears within one rendered frame; gated boost has no false exhaust or drain indication.
- [ ] Each impact yields at most one effect/audio class per consumer; correction produces none.
- [ ] Mute and reduced motion preserve visible information; feedback is readable at 320x568 and 844x390.

## Test Plan
- Browser fixtures exercise each state and contact class, local and guest.
- Capture short real-input playback and screenshots; count effects against emitted events.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-010/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-005, TICKET-006, TICKET-009
- Risk: Exhaust or flash can look like enlarged bodywork; labels may crowd the phone HUD.
- Rollback: Use static contact ticks and text labels if richer effects fail clarity/budgets.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T05
- 5. Vehicle controller and player information
- 9. Effects and feedback specification

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
