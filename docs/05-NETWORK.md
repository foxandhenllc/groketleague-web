# Networking (PeerJS)

## Model

- **Host** runs authoritative sim + clock.
- **Guest** sends controls and renders host state. Classic 3D follows the guest car; Kitchen Sink uses a shared arena/soap composition.
- Offline: local sim + bot AI in `sim.js`.

## Code

- `net.js` - PeerJS session, quick match claim, private 4-char rooms, message types
- `main.js` - wires NET into garage / match / rematch / disconnect

## Features to preserve

- Quick Match + CREATE/JOIN room
- Invite URL `https://groketleague.com/?room=ABCD`
- Rematch without tearing PeerJS (`rm` / `rx` style messages)
- Online menu does **not** pause physics
- FSD always drives; each peer sends its own boost intent; guest AI executes on host
- Host `gfx` mode is included in setup/ready and rematch packets; both peers use the same field and ball geometry
- Disconnect returns the other player to garage

## First playable slice protocol

Protocol 2 exchanges a simulation version and SHA-256 hash of canonical simulation settings before starting. Mode is confirmed in setup/ready. Incompatible peers see a refresh-both-players message. Connected rematches keep PeerJS but receive a new match ID.

Host impact records carry pair, point, normal, impulse, tick and an event ID. A bounded 64-event resend window is acknowledged by explicit IDs; the guest deduplicates by round epoch and ID. Kickoff/rematch/disconnect clears effects. This is minimal feedback delivery: guest interpolation, narrow state records, fresh-input sequences and transport impairment work remain T08. Current state/input cadence remains 20 Hz and stale input cutoff remains 500 ms.

3D Kitchen Sink uses compatibility version `soap-arcade-9`. `ball.soap` carries authoritative world height, airborne state, orientation and motion counters. Goal snapshots include a stable ID, swept entry transform/velocity, team, age, duration and winning flag. The host alone advances the 2.65-second goal clock, coasts cars and resets the round or shows results. Guests smooth the live soap transform over roughly 50ms and advance only the displayed goal age, at most 100ms ahead of the latest snapshot. This is visual interpolation, not client physics prediction. Classic cars remain on the previous snapshot path.

## Testing

```powershell
# from repo root - needs Playwright installed locally
npm install --no-save playwright
npx playwright install chromium
node tests/netplay.mjs
```

Production smoke (optional):

```powershell
$env:GAME_URL="https://www.groketleague.com"; $env:QA_OUT="output/production"; node tests/netplay.mjs
```

Do not ship test-only scenario hooks in production paths.
