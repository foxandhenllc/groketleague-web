# GROKET LEAGUE

> **Maintainers / agents:** start at [docs/00-START-HERE.md](./docs/00-START-HERE.md) - architecture, editing, PeerJS, PIXEL rules, and Vercel CLI deploy (push to `main` OK; no Vercel Git integration).


Static Three.js car soccer with PeerJS online 1v1, private four-character rooms,
quick match, and the original manual / Full Self-Driving CPU modes.

Choose a car before finding a match. The host controls physics and the match clock;
the guest sends controls and follows the blue car. Online menus keep the match live.
Use the in-game MENU button (desktop or touch) to switch FSD on or off without restarting.
Each online player controls FSD for their own car; manual steering/throttle takes over.
Offline menus pause the match, while online menus leave it running.
Leaving a match returns the other player to the garage. Rematches start from the garage.

## Local development and checks

Serve the repository with `python3 -m http.server 5173`.
Install Playwright locally with `npm install --no-save playwright` and, if needed,
`npx playwright install chromium`. Run `node tests/netplay.mjs`.
The suite opens separate browser contexts and uses real PeerJS signaling / WebRTC.
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
