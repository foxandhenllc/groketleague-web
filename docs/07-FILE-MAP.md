# File map

## Root (runtime)

| File | Purpose |
|------|---------|
| `index.html` | Shell markup, meta/OG, import map for three |
| `style.css` / `net.css` | Game + net UI styles; PIXEL letterbox / HUD |
| `main.js` | App orchestration, render loop, garage, match |
| `game.js` | Historical incomplete stub; not imported by the live app |
| `sim.js` | Physics + bot AI + `setPixelTight` |
| `physics-clock.js` | Fixed 120 Hz simulation clock, independent of rendering |
| `catalog.js` | `CATALOG`, `byId`, `FW`/`FL`, `pixelFieldSize` |
| `characters.js` | Shared character / ball / mode contract |
| `pixel.js` | PIXEL canvas view |
| `pixel_sim.js` | Reference PIXEL-native sim (not always the live path) |
| `field.js` | 3D pitch |
| `vehicles.js` | 3D cars + ball |
| `input.js` | Keys / touch / boost |
| `net.js` | PeerJS netplay |
| `audio.js` | Beds + SFX + mute |
| `x-auth.js` | X OAuth PKCE |
| `x-config.js` | X client id / scopes |
| `vercel.json` | Static deploy config + cache headers |
| `favicon.svg` / `og.png` / `og-square.png` | Brand / social |

## assets/pixel/

| File | Purpose |
|------|---------|
| `pitch.png` | 384x216 castle pitch |
| `pitch_physics_bounds.json` | Clamp documentation |
| `vehicles_8dir.png` | Car atlas |
| `vehicles_boost.png` | Boost atlas |
| `ball_vfx.png` | Ball + VFX |
| `characters.json` | JSON export of shared sheet |

## api/

| File | Purpose |
|------|---------|
| `presence.js` | Online/playing counts |
| `x-token.js` | OAuth token proxy |
| `x-me.js` | X user proxy |

## music/

`garage.mp3`, `day.mp3`, `night.mp3` (+ README)

## tests/

`physics.test.mjs` - dependency-free collision, bounce, friction, scaling and timing regressions.

`netplay.mjs` - compatibility entry point for `gameplay.mjs`, the Playwright offline/PeerJS/mobile suite.

## Docs / notes

| File | Purpose |
|------|---------|
| `docs/*` | This maintainer pack |
| `CHARACTER_PHYSICS_SPEC.md` | Physics/art contract |
| `progress.md` | Historical ship log |
| `README.md` | Short entry + deploy stub |
