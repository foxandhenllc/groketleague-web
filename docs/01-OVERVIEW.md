# Product overview

## What it is

**GROKET LEAGUE** is parody FSD car-soccer:

- You mostly hold **boost / Ludicrous**; **FSD drives** the car (offline bot + online each peer's own FSD toggle).
- Two presentation modes:
  - **3D Arena** - Three.js field + extruded cars (`field.js`, `vehicles.js`).
  - **PIXEL** - SNES/LTTP-style castle pitch blit (`pixel.js` + `assets/pixel/*`).
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

Garage (pick car, gfx 3D/PIXEL, day/night map) -> Faceoff -> Match -> Results -> Rematch or Garage.

Online: host simulates; guest sends inputs; both render. Menus offline pause; online menus leave the match running.