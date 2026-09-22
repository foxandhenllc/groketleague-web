# Architecture

## High-level

```
index.html          UI chrome (garage, HUD, menus, quick chat)
main.js             App shell: scenes, match loop, wires modules
sim.js              Shared physics (cars, ball, goals, bot AI, PIXEL clamp)
physics-clock.js    Fixed 120 Hz simulation clock, bounded catch-up after suspension
catalog.js          CATALOG view over characters.js + field constants
characters.js       SOURCE OF TRUTH for car/ball/mode numbers
pixel.js            2D PIXEL renderer (canvas #pixelView)
pixel_sim.js        Reference clamp-native sim (docs/reference; live path uses sim.js)
field.js            Three.js pitch / lamps
vehicles.js         Three.js car + ball meshes
input.js            Keyboard / touch -> controls (boost is the human verb)
net.js              PeerJS lobby, rooms, host/guest messages
audio.js            Music beds + SFX + mute prefs
x-auth.js / x-config.js   X OAuth PKCE client
api/*               Vercel serverless helpers
assets/pixel/*      Pitch + atlases + bounds JSON
music/*             garage / day / night beds
```

## Mode split

| Concern | 3D | PIXEL |
|---------|----|-------|
| Render | Three.js in `main.js` + `field.js` + `vehicles.js` | `pixel.js` canvas blit |
| Physics | `sim.js` with default FW/FL | `sim.setPixelTight(true)` widens fieldW to match grass clamp aspect |
| Car stats | `characters.js` via `catalog.js` | same |
| Art | procedural meshes | `assets/pixel/*.png` |

**Do not** fork mass/turn/accel per mode. Change `characters.js` (and keep `assets/pixel/characters.json` aligned if you use it as export).

## Match simulation flow (simplified)

1. `main.js` tick -> `physics-clock.js` -> `simulateMatch` at 120 Hz; read controls (`input.js`)
2. Host (or offline) steps `drive` / `carBall` / `carCar` / `stepBall` in `sim.js`
3. Goals update score / faceoff reset
4. Render:
   - 3D: sync meshes, camera
   - PIXEL: `pixelView.draw({ player, bot, ball, ... })`
5. Online: host broadcasts state; guest applies + sends input packets

## PIXEL coordinate mapping

- Pitch bitmap **384x216**
- Playable grass clamp from `characters.js` -> typically `[52, 28, 321, 202]`
- `pixelFieldSize()` keeps **FL** from 3D and uses boundary spans: `fieldW = FL * (x1-x0)/(y1-y0)`. `pixelsPerUnit` is shared by both axes and ball sizing.
- World mapping puts sim x/z into the clamp rectangle
- Car sprites are **square cell blits** (do not stretch dest w != h - that warps SNES art)
- Canvas CSS size should be **integer multiples of 384x216** (`layoutPixelCanvas`)

## Ball contacts and timing

- `catalog.js` `ballRadius(pixel)` supplies collision and draw dimensions. PIXEL is 9px in diameter; 3D uses the shared BU radius.
- Car/ball collision is a circle against the oriented car rectangle, with closest-point normals and positional separation.
- Only approaching contacts exchange an impulse. The 80ms cooldown limits hit sounds/lift, never physical collision resolution.
- Rolling friction is exponential in elapsed seconds, calibrated from the original 0.986 at 60 Hz.
- PIXEL stays on the ground; 3D retains gravity and floor bounce. Walls and goal checks include the radius; scoring requires the whole ball over the line.
- Online setup and rematch packets include `gfx`; guests adopt host geometry. Their inputs still run only on the host.

## Auth / presence

- `x-auth.js` - PKCE against X; tokens via `api/x-token.js` (CORS proxy)
- `api/presence.js` - best-effort in-memory online/playing counts
- `api/x-me.js` - fetch X profile with access token

## Persistence (client)

localStorage keys include gfx mode, mute flags, X auth blob. Never put secrets in the repo.
