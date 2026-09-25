# Match variety follow-up

The user's playtest found that the first playable slice worked better but repeated
the same goal patterns. This follow-up adds bounded variation to the current
planner and restarts, without changing vehicle physical stats or boost controls.

## Behavior

- Five shuffled faceoffs: central, diagonal, wide, crossfield and longer approach.
  Each appears once before the rotation repeats. Both cars face a stationary
  ball on the halfway line, at equal travel distances. Scoring no longer supplies
  the same directional ball velocity at every restart.
- Cybertruck pressures with shorter setups; Model 3 takes wider flanking routes;
  Cybercab retreats earlier and counters; Semi defends earlier and uses shorter
  automatic boost approaches.
- Each match seeds a persistent passing-side preference, setup offset and contest
  patience. Each round picks a shooting lane inside the goal. A visible goalkeeper
  still takes precedence over that preference.
- A slow, close contest can trigger a committed 1.5-second re-approach. Incoming
  threats and the own-goal area disable this maneuver.
- Human boost remains explicit. Online simulation remains host-authoritative.
  Both peers derive the seed from the match ID; local games use a fresh UUID.
  Whole-body snapshots carry the driver's personality. Rematches get new seeds.
  Config hashing and simulation version `fsd-variety-3` reject incompatible peers.

## Validation

Run:

```powershell
node --experimental-default-type=module --test tests/physics.test.mjs tests/autopilot.test.mjs tests/slice.test.mjs tests/variety.test.mjs
node --experimental-default-type=module tests/variety-baseline.mjs
$env:GAME_URL='http://127.0.0.1:5198'
$env:QA_OUT='output/match-variety/browser-final'
node tests/netplay.mjs
```

The variety simulation covers all 16 ordered vehicle pairs, both arenas and five
faceoffs (160 contests). Each runs until its first goal or 90 simulated seconds,
with automatic boost on both sides. All five sampled trajectories differ in
every pairing. Final sample: 85/160 scored, finite motion throughout, zero ball
safety-cap events. The historical `08fa7b3` central-start comparison scored in
16/32 contests. This is a diagnostic sample, not statistically established
balance or a test of human enjoyment. Equal start distances do not prove equal
win rates; 75/160 sampled contests still had no goal within 90 seconds.

Initial wider layouts produced only 74/160 scoring contests and were narrowed.
The final goal-lane range is +/-1.25 world units. Vehicle performance stats and
the contact solver are unchanged.

Browser coverage includes offline rounds with different faceoff names, fresh
rematch seeds, shared host/guest seed and personality, actual PeerJS rooms,
rematches, guest boost, disconnect, quick match and mobile controls. Local preview
is served at port 5198. This follow-up is not a production deployment.
