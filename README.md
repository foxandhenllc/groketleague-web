# GROKET LEAGUE

> **Maintainers / agents:** start at [docs/00-START-HERE.md](./docs/00-START-HERE.md) - architecture, editing, PeerJS, PIXEL rules, and Vercel CLI deploy (push to `main` OK; no Vercel Git integration).


Static car soccer with Three.js and a procedural Arcade 2D stadium, PeerJS online 1v1,
private four-character rooms, quick match, and offline CPU matches.

Choose a car before finding a match. The host controls physics and the match clock;
the guest sends controls and follows the cyan car in 2D (blue in 3D). Online menus keep the match live.
FSD always drives; hold Space, Shift, or the touch BOOST button for Ludicrous Mode.
The host selects the field/graphics mode for both peers so ball and field geometry agree.
Gameplay advances at 120 Hz independently of rendering. Arcade 2D uses a flat rolling
ball, rounded boards, and car silhouettes drawn at their collision size. Its scoreboard
and controls sit outside the playing field. The view rotates for portrait/landscape
without stretching the arena. 3D retains vertical bounce.
Offline menus pause the match, while online menus leave it running.
Leaving a match returns the other player to the garage. Online rematches reuse the connection.

## Local development and checks

Serve the repository with `python3 -m http.server 5173`.
Run the dependency-free physics checks with `node --experimental-default-type=module --test tests/physics.test.mjs tests/autopilot.test.mjs`.
Install Playwright locally with `npm install --prefix . --no-save --package-lock=false playwright` and, if needed,
`npx playwright install chromium`. Run `node tests/netplay.mjs` and `node tests/arena-ui.mjs`.
The 2D UI suite defaults to port 5174; set `GAME_URL` for your local server.
The suite opens separate browser contexts and uses real PeerJS signaling / WebRTC.
It covers both graphics modes, boost, pause, scoring, rematches, shared online geometry,
quick match, disconnect, and mobile layout. `tests/netplay.mjs` runs `tests/gameplay.mjs`.
For repeatable scoring checks only, localhost tests inject controlled ball trajectories;
no scenario controls are included in the deployed game.

Use `GAME_URL=https://www.groketleague.com QA_OUT=output/production node tests/netplay.mjs`
for production smoke checks. Screenshots and JSON results are written under `output/`.
`PLAYWRIGHT_MODULE` can point to an existing Playwright installation instead.

## Production deployment

Use only the existing Vercel project, without Git integration:

```sh
vercel link --yes --project groketleague --scope rat-benetar-team
vercel --prod --yes --scope rat-benetar-team
```

Expected project: `prj_U7ECGhUZFi7226WXWLITmVVUNypI`.
Expected team: `team_DHrreAGGPZ2RlnCxUj3vj3o1`.
`vercel.json` explicitly selects static output (`.`), no framework, no build.
Do not replace `main.js` with a CDN import stub. Both domains must serve this local
full game file and the local `/net.js` and `/style.css` assets.
