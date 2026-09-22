# Networking (PeerJS)

## Model

- **Host** runs authoritative sim + clock.
- **Guest** sends controls; renders host state; camera follows guest car.
- Offline: local sim + bot AI in `sim.js`.

## Code

- `net.js` - PeerJS session, quick match claim, private 4-char rooms, message types
- `main.js` - wires NET into garage / match / rematch / disconnect

## Features to preserve

- Quick Match + CREATE/JOIN room
- Invite URL `https://groketleague.com/?room=ABCD`
- Rematch without tearing PeerJS (`rm` / `rx` style messages)
- Online menu does **not** pause physics
- Each peer's own FSD toggle; guest AI executed on host
- Disconnect returns the other player to garage

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