# Player agency release - September 27, 2026

## Controls and mechanics

FSD still steers. A chooses Attack, S restores Auto, and D chooses Defend. Attack commits sooner but still reacts to an imminent own-goal threat. Defend takes a goal-side guard position and intercepts incoming shots. Matching touch buttons show the selected tactic. The selection persists through goals and resets for a new match.

Space/Shift/BOOST accelerates. A fresh, safely authorized boost press followed by a front contact within 240ms earns Perfect Touch: added contact restitution, a short callout and a distinct sound. A mistimed hit retains ordinary contact physics. Sustained holds beyond 550ms drain 35% faster. Unsafe waiting does not bank a timing bonus; taps must release for the existing 120ms rearm. The launch envelope still bounds high-speed impacts.

E or the named move button activates a signature move:

| Vehicle | Move | Tradeoff | Cooldown |
|---|---|---|---|
| Cybert Rucker | Charge | Forward surge with heavily reduced steering, then recovery | 7s |
| Modest 3 | Dash | Short forward burst, then recovery slowdown | 5s |
| Rob Tacksy | Sidestep | Lateral dodge toward the ball or open midfield | 5s |
| Seemee | Brace | Stops and resists displacement for one second | 7s |

All moves have windup and recovery, a visible orange/white vehicle outline or ring, and an on-screen cooldown. Held input cannot repeatedly fire or bypass cooldown. Holding boost cannot bypass recovery. CPU drivers obey the same move mechanics. The host validates guest tactics and move requests; snapshots carry move state and reliable impact events carry Perfect Touch/save feedback. Simulation version is `player-skills-6` so older clients must refresh.

Initial faceoff is 1.6s (formerly 3.2s), post-goal reset 700ms (formerly 1000ms), and existing rematches reuse the session. Saves and Perfect Touch have distinct feedback. Camera motion is unchanged; no shake or impact zoom was introduced.

## Evidence and limitations

- 103 unit/regression checks pass, including 14 new skill tests: stronger timed contact, ordinary late/side contact, tactics, all four move effects in both modes, cooldown/release, brace resistance, and recovery behavior.
- Eight arena layout cases pass; eight vehicle/control cases pass locally and on the staged deployment, with inspected desktop, portrait and landscape screenshots. A 3D landscape overlap found during testing was corrected.
- Local nine-check gameplay/netplay suite passes including goals/rematches, guest boost/tactics/signature moves, quick match and disconnect. The final follow-up also confirms that tactics persist through goals.
- Eight 90-second synthetic matches, one per vehicle and graphics mode, finish without diagnostic repairs or safety caps. These are stability experiments, not evidence that balance or human enjoyment is solved. Goal counts vary substantially, including scoreless runs.
- Keyboard/touch controls and effects are implemented in the shared simulation. No runtime QA injection ships; browser score fixtures stay in intercepted local test responses.

Screenshots and test receipts are under ignored `output/skills-*`. The next human playtest should assess whether timing feedback is readable, tactics feel responsive, moves create useful choices, and players want a rematch. Tuning may still be needed.

Production deployment: https://groketleague-hz2381muk-rat-benetar-team.vercel.app (`dpl_WwaC4XfYN8PHD5c3sQqenYvu8H8a`). Promoted to both public domains; 19 source-file hashes match and presence responds on each.
