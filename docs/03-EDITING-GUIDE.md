# How to edit things

## Change car stats / names / memes

1. Edit **`characters.js`** (canonical).
2. Mirror into **`assets/pixel/characters.json`** if that file is used as an export artifact.
3. `catalog.js` remaps into `CATALOG` + `spec` - usually no edit unless you add fields.
4. PIXEL row order in atlases must match `ROW_OF` in `pixel.js`:
   `cybertruck=0, model3=1, cybercab=2, semi=3`.
5. 3D mesh branching in `vehicles.js` uses the same ids.

## Change 3D arena look

- Geometry / materials: `field.js`, `vehicles.js`
- Lighting / camera: `main.js`
- Map day/night labels and palette hooks: search `mapMode` / day / night in `main.js` + `field.js`

## Change PIXEL pitch / sprites

See [04-PIXEL-MODE.md](./04-PIXEL-MODE.md). Short version:

- Pitch: `assets/pixel/pitch.png` (384x216), bounds JSON beside it
- Cars: `vehicles_8dir.png`, `vehicles_boost.png` (32px cells, 1px magenta gutters)
- Ball/VFX: `ball_vfx.png`
- Prefer Pixel Forge for new art; wire paths in `pixel.js`

## Change physics feel

- Shared: `characters.js` ball + per-car mass/accel/max/turn/grip/boostMax
- Runtime: `sim.js` (`drive`, `carBall`, `carCar`, `stepBall`, `setPixelTight`)
- Impact effects cooldown: `characters.js` -> `ball.no_rehit_s` (0.08); this must never disable separation or collision response.
- Ball sizes: `catalog.js` `ballRadius(pixel)` reads the shared sheet; PIXEL rendering uses this same radius.
- Timing: `physics-clock.js` advances `main.js` `simulateMatch` at 120 Hz. Keep rendering outside that loop.
- Reference alternate: `pixel_sim.js` (keep as reference unless you intentionally switch main over)

## Change UI / HUD / garage

- Markup: `index.html`
- Styles: `style.css` (PIXEL HUD overrides under `body.pixel-mode`)
- Behavior / wiring: `main.js`
- Quick chat strings: search quick-chat / qc in `main.js` - prefer **ASCII** (` - `, `< BACK`) to avoid mojibake

## Change audio

- Files: `music/garage.mp3`, `day.mp3`, `night.mp3`
- Logic: `audio.js` (local path first, CDN fallback)
- Mute prefs persist in localStorage

## Change networking

See [05-NETWORK.md](./05-NETWORK.md). Entry points: `net.js`, call sites in `main.js`.

## Change X login

- Client id / scopes: `x-config.js`
- PKCE flow: `x-auth.js`
- Token proxy: `api/x-token.js`
- Never commit client secrets (public PKCE client only)

## Add a new car (checklist)

1. Stats + copy in `characters.js`
2. Atlas rows (normal + boost) - update Pixel Forge sheet + `ROW_OF`
3. 3D mesh branch in `vehicles.js`
4. Garage card / selection UI in `index.html` + `main.js` if not fully data-driven
5. Smoke 3D + PIXEL offline, then one online room
