# Product overview

## What it is

**GROKET LEAGUE** is parody FSD car-soccer:

- **FSD always steers**. Players time boost bursts, choose Attack/Auto/Defend (A/S/D), and activate a signature move (E). Matching touch buttons are available. A front contact within 240ms of a fresh boost press earns Perfect Touch; sustained holds spend more reserve.
- Two presentation modes:
  - **3D Arena** - Three.js field + extruded cars (`field.js`, `vehicles.js`).
  - **Arcade 2D** - CIRCUIT top-down stadium, procedural cars and a separate match HUD (`pixel.js`, `arena.css`). Internal mode ID remains `pixel`.
- **Kitchen Sink** is the default arena, available in either view: colored drain goals, visible curved banks, a slippery wet lane with localized faucet flow, meteors and lightning. Warnings precede force changes and the environmental cycle continues across goals. The host selects the arena for online play. See the [surface and presentation report](KITCHEN-SINK-READABILITY-2026-09-27.md).
- **3D Kitchen Sink** now plays with a glossy bar of soap: low-friction slides, bank launches, tumbling flight and sliding landings. Goals spiral into the drain and burst into team-colored bubbles while the camera eases closer and returns. See the [soap arcade report](SOAP-ARCADE-2026-09-27.md). New sink work targets 3D; 2D keeps its existing ball mechanics.
- Online **1v1** via **PeerJS** (host-authoritative physics) - quick match + 4-character private rooms.
- Optional **Sign in with X** (OAuth PKCE) for handles / presence flavor.

## Tone / brand

Parody Tesla/xAI vibes, meme car names (CYBERT RUCKER, MODEST 3, ROB TACKSY, SEEMEE). Keep OG/meta copy honest: built with Grok; not affiliated.

## Domains and project

| Item | Value |
|------|-------|
| Domains | `groketleague.com`, `www.groketleague.com` |
| Vercel project name | `groketleague` |
| Project ID | `prj_U7ECGhUZFi7226WXWLITmVVUNypI` |
| Team slug | `rat-benetar-team` |
| Team ID | `team_DHrreAGGPZ2RlnCxUj3vj3o1` |
| Framework | **None** - static output `.` (see `vercel.json`) |

## Stack (deliberately small)

- Browser ES modules + import map for `three`
- No bundler / no `package.json` required to ship the game
- Tiny Vercel serverless under `api/` (presence + X token proxy)
- PeerJS for netplay
- Assets: PNG atlases, MP3 beds under `music/`

## Player loop

Home (pick a car -> Play Kitchen Sink) -> Faceoff -> Match -> Results -> Rematch or Home.

Fresh visits default to **3D Kitchen Sink vs Grok**, including browsers with an old saved 2D preference. **Match options** provides arena image buttons, 3D/2D and stadium Day/Night buttons, plus Solo, Find a match and With a friend. Choices remain active for the current session and rematches. Invite links open the private-room panel with their code filled in. Help, car details, audio and account settings are optional buttons; no setup dropdowns or automatic tutorial popup. See the [home flow report](HOME-FLOW-2026-09-27.md).

Online: host simulates; guest sends inputs; both render. Menus offline pause; online menus leave the match running.

Host graphics mode also selects the shared field and ball geometry. PIXEL has a flat rolling ball;
Classic 3D has vertical bounce; 3D Kitchen Sink has soap flight above the curved basin. The simulation runs at 120 Hz independently of display refresh rate.
