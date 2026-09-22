# PIXEL mode

## Purpose

SNES/LTTP castle pitch so the OG image matches what players can play. 3D remains available; PIXEL is not a toy stub.

## Key files

| File | Role |
|------|------|
| `pixel.js` | Canvas renderer, chroma, integer letterbox, draw loop |
| `sim.js` `setPixelTight` | Clamp-aspect field + tighter walls |
| `characters.js` `modes.pixel` | `physics_clamp_xyxy`, pixel drive hints |
| `assets/pixel/pitch.png` | 384x216 rich night-castle art |
| `assets/pixel/pitch_physics_bounds.json` | Documented clamp |
| `assets/pixel/vehicles_8dir.png` | 8-dir cars |
| `assets/pixel/vehicles_boost.png` | Boost variants |
| `assets/pixel/ball_vfx.png` | Ball + VFX strip |
| `CHARACTER_PHYSICS_SPEC.md` | Design contract |

## Hard-won rules

1. **Never stretch sprite cells** (`drawImage` dest w!=h on a square source). That was the "warped cars" bug.
2. **Integer CSS scale** of 384x216 only (`layoutPixelCanvas`). Fractional upscale looks mushy.
3. **Uniform field aspect** - `fieldW = FL * playW/playH`. Do not map old 44x68 anisotropically onto the clamp.
4. **Hot-pink gutters** in pitch art may be ~(198,19,173), not pure `#FF00FF`. Scrub thresholds must catch both.
5. **CASTLE DAY** label can still show night art until Pixel Forge ships a day pitch - do not "fix" with a stripped flat green field.
6. Cars/ball should **read close to physics footprint**; oversized blits made hits feel mushy.

## Toggle

Garage gfx control -> `localStorage` gfx mode -> `main.js` calls `setPixelTight` + `pixelView.setActive`.

## Working with Pixel Forge

- Drop art under `/workspace/groket-pixel/` on the shared box when collaborating, then copy into `assets/pixel/` on the Windows repo.
- Ask for: single center circle, N/S goals+boxes, bronze south `#8C4E24`, blue north, no magenta frame on final PNG.
- Day variant: same layout, daylight sky.

## Debugging checklist

- Pink bars? Sample edge pixels; loosen chroma; repaint pitch.
- Oval center circle on screen? Canvas CSS aspect wrong - verify integer letterbox.
- Cars look like sticks? Square blit regressed - check car blit in `pixel.js`.
- Ghost double-cars? Boost VFX stacked on boost sheet - do not blit boost VFX under cars if sheet already has flames.