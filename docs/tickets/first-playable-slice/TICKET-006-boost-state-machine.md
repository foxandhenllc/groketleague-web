# TICKET-006: Make boost hold, release and recharge explicit

Type: Task
Epic: Boost
Priority: P0
Estimate: 1-3 focused engineering days (planning range, not a delivery promise)
Owner: Unassigned
Components: `input.js:bindInput/bindBoost/readControls`, `sim.js:drive`, `autopilot.js:planDrive`, `characters.js`, `main.js` lifecycle
Status: Implemented; automated evidence recorded

## Context
Research reproduced hundreds of one-tick restarts after reserve depletion. The selected design makes releasing the button necessary to recharge and rearm. The source plan is a proposed specification, not shipped behavior. This ticket belongs to the first playable slice and preserves the static ES-module architecture and host authority.

## Problem / Why
Automatic microbursts undermine timing decisions and produce confusing feedback.

## Scope
- READY, WAITING, ACTIVE, RELEASE TO RECHARGE and RECHARGING states.
- Safe keyboard/touch clearing and equal CPU/human reserve rules.
- Breadcrumbs: `input.js:bindInput/bindBoost/readControls`, `sim.js:drive`, `autopilot.js:planDrive`, `characters.js`, `main.js` lifecycle.

## Out of Scope
- New tactical planner, client prediction and remote stale-input redesign (T08).

## Proposed Approach
- Start at reserve >=.18; continue to zero with final fractional drain. Rearm after .12s continuous release; recharge only while released and after .25s since last active boost.
- WAITING retains only live held intent; release cancels it immediately. No held recharge, forced minimum burst or keyboard-repeat restart.
- Apply .9rad heading safety threshold, reversing and unavoidable-board braking gates; do not gate on perfect-shot quality.
- Use pointer capture and clear on blur, cancellation, visibility/menu/disconnect; remove listeners correctly. Preserve existing drain/recharge rates until the tuning experiment.

## Acceptance Criteria
- [ ] Ten-second hold produces zero post-depletion restarts for every car in both modes.
- [ ] Release cancels local authoritative boost within one simulation tick; guest intent clears locally immediately and on host receipt.
- [ ] Held WAITING neither drains nor recharges and cannot fire after release.
- [ ] Sub-.12s release cannot rearm depletion; release inside .25s delay gains no recharge.
- [ ] CPU has the same thresholds, drain and recharge economy; all clear/cancel paths leave no stuck input.

## Test Plan
- Table-driven state transitions at threshold boundaries and fractional depletion.
- Keyboard autorepeat and pointer capture/cancel/blur/menu tests; host and guest flows.
- Save revision/config identifier, exact command, exit status and failures with results under ignored `output/first-playable-slice/TICKET-006/`; summarize evidence in this ticket when implemented.

## Rollout / Risks
- Blockers/Dependencies: TICKET-003, TICKET-004
- Risk: Players may mistake WAITING for ignored input; UI completion is required before Gate A.
- Rollback: Revert numerical economy independently; preserve verified clearing behavior and do not label an incomplete UI slice accepted.
- Implement on the shared `codex/` slice branch in a separate reviewable change; preserve unrelated files. No deployment is part of this ticket.

## Traceability (Report)
- Source: [GROKET LEAGUE implementation plan](../../GROKET-LEAGUE-PHYSICS-ART-PLAN.md).
- T04
- 5. Vehicle controller and player information

## Implementation evidence

See [Gate A evidence](GATE-A.md) for exact results, failed attempts, configuration identity and remaining limitations. The acceptance checklist remains available for hands-on review; implementation status is not a claim of production or final human validation.
