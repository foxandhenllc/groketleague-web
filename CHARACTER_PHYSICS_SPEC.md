# Groket League — Character & Physics Contract

## Runtime amendment: CIRCUIT rebuild, 2026-09-23

This amendment supersedes conflicting bitmap/clamp proposals below. Fox authorized
rebuilding the 2D presentation and driving logic. See `docs/04-PIXEL-MODE.md`.

- 2D now uses procedural car silhouettes and a 44x68 arena. Internal `pixel` IDs remain compatible.
- Logical pitch 270x420, boundary spans 220x340, uniform 5 logical pixels/world unit.
- Ball radius is 0.9 world units. Screen pixels vary with viewport; render and contacts use one radius.
- Car dimensions/stats remain shared. Low-speed steering authority starts at 0.55 of turn rate.
- Both contact types use oriented car footprints, mass-weighted separation, and approaching-only impulses.
- 2D boards have 7-unit rounded corners and 5.2-unit goal recesses, shared with the renderer.
- `autopilot.js` owns goal-directed routing, turn braking, defense and progress-based recovery.
- Human boost requests are honored when aligned; autonomous CPU boost is separate.

## Runtime amendment: ball repair, 2026-09-22

The older design proposal below is historical where it conflicts with this amendment.
`characters.js`, `catalog.js`, `sim.js`, and `physics-clock.js` define the live behavior:

- Car mass, dimensions, acceleration, turning and boost remain shared and unchanged.
- PIXEL deliberately uses a 9px ball with a 4.5px physical radius, converted by the same uniform scale as its drawing. The earlier 16px proposal is superseded.
- Ball mass is 0.45; contact restitution is 0.72, with the existing 1.35 heavy-boost multiplier capped at 1. Only approaching contacts exchange momentum.
- Sphere/rectangle closest-point contact replaces the padded-AABB kick. Separation uses the rotated contact normal and also runs during cooldown.
- The 80ms no-rehit value gates impact sound/lift only, not collision resolution. Resting/separating contacts add no energy.
- PIXEL is flat and rolling. 3D retains gravity 22 and floor restitution 0.42. Ground friction uses `exp(log(0.986) * 60 * dt)` and exact rolling displacement.
- Fixed simulation rate is 120 Hz, with up to 250ms catch-up after a stalled frame. Both foreground and background host paths use the same clock.
- Walls include ball radius; the whole ball must fit the goal mouth and cross the goal line to score.
- Host graphics/field mode is shared with the guest at setup and rematch.

Run `node --experimental-default-type=module --test tests/physics.test.mjs` and `node tests/netplay.mjs` after changes.

## Original design proposal

Source of truth for every mode that reuses these four cars. 3D Arena and PIXEL both map into this; neither invents its own mass/turn/hit ratios.

Dated: 2026-09-22. Numbers from live `catalog.js`, `sim.js`, Pixel Forge atlases, `pitch_physics_bounds.json`.

## 1. Decision

**Character-first units, mode-second fields.**

- Cars and ball are defined once in **body units (BU)**.
- Each mode only supplies: field size, gravity feel knobs, and `units_per_BU` (meters in 3D, pixels in PIXEL).
- Do **not** stretch the 3D field (44×68) to fill the PIXEL grass clamp (270×175). That stretch is ~2.75× anisotropic and will break any later mode that shares these characters.

PIXEL owns the clamp rectangle as its playable field (wider top-down pitch). 3D keeps FW×FL. Characters stay the same ratios in both.

## 2. Shared character sheet (do not fork)

Reference: **Model 3 length = 1.0 BU**. All sizes scale from catalog `w` / `l`.

| id | name | mass | accel | max | turn | grip | boostMax | w (BU) | l (BU) | special |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| cybertruck | CYBERTRUCK | 3.1 | 24 | 19.5 | 1.55 | 6.2 | 1.00 | 0.524 | 1.155 | pancake (boost hit ×1.35) |
| model3 | MODEL 3 | 1.3 | 38 | 28 | 2.70 | 10 | 0.75 | 0.429 | 1.000 | snap turn |
| cybercab | CYBERCAB | 1.05 | 34 | 26 | 3.15 | 12 | 0.70 | 0.393 | 0.833 | soap shoes (high grip) |
| semi | SEMI | 4.6 | 16 | 15 | 1.15 | 5.2 | 1.15 | 0.619 | 1.714 | wall / goalie |

BU from catalog: `l_BU = l / 4.2`, `w_BU = w / 4.2`.

### Ball (shared)

| | value | note |
|---|---|---|
| radius | 0.131 BU | = 0.55 world / 4.2; PIXEL target **16px diameter** (bible BALL 16) |
| floor restitution | −0.42 | from `stepBall`; prefer **−0.55 to −0.62** in PIXEL so it rolls |
| wall restitution | −0.62 | keep |
| gravity | 22 (3D y-up) | PIXEL: soft or flat bounce only if you stay top-down 2D |
| hit impulse | `max(9, 11/mass + \|rel\|×1.15)` | keep formula; add **0.12s no-rehit** per car |

### Drive (shared feel)

From `drive()` — keep across modes:

- Boost punch: heavy (`mass > 3`) **40**, else **30**
- Boost drain: heavy **0.8**/s, else **1.05**/s; regen **0.28**/s
- Boost speed cap: heavy **×1.42**, else **×1.28**
- Drag: heavy **1.85**, else **1.45**
- Lateral grip kill: `grip × dt × 1.12`
- Turn speed factor: `0.35 + 0.65×(sp/max)`; heavy slow **×0.7** when `sp > 11`
- Car-car min separation: `(l_a + l_b) × 0.38`

### Hitbox (shared shape)

Axis-aligned in car local space (from `carBall`):

- half-width = `w × 0.55 + pad`
- half-length = `l × 0.5 + pad`
- pad = 0.131 BU in 3D (was +0.55 world); in PIXEL use **+2px** after converting

Collision must track **BU**, not the 32px cell. The cell is a draw budget, not a physics body.

## 3. Art vs physics debt (fix for shared characters)

N-facing opaque bounds measured on `vehicles_8dir_atlas.png` (32×32 cells):

| id | opaque px | bbox size | fill |
|---|---:|---|---:|
| cybertruck | 675 | 24×32 | 0.66 |
| model3 | 671 | 25×32 | 0.66 |
| cybercab | 362 | 25×32 | 0.35 |
| semi | 573 | 20×32 | 0.56 |

Catalog says Semi is longest (1.71× Model 3). Art currently packs every car into the same 32-tall box, so Semi does not read longer.

**Rule for every mode:** physics uses the BU table above. Draw scale per car:

`draw_px_per_BU = 22` → Model 3 ≈ 22px long, Semi ≈ **38px** (may exceed one cell).

Options (pick one, stick to it):

1. **Preferred:** blit with per-car scale from BU (Semi larger than cell; Cybercab smaller). Atlas stays 32 for authoring; draw is not 1:1.
2. Or redraw Semi longer / Cybercab shorter so 1:1 blit matches BU.
3. Do **not** shrink Semi’s physics to the 20×32 sprite — that forks characters by mode.

Atlas meta must say `"cell": 32` (file is 263×131; meta still wrongly says 64).

Yaw: 8 columns `N NE E SE S SW W NW`, **N faces screen-down**. Pick column from yaw; never `ctx.rotate`.

## 4. Mode: 3D Arena

| | value |
|---|---|
| field | FW=44, FL=68 (world) |
| meters_per_BU | 4.2 |
| car sizes | catalog `w`,`l` as today |
| goals | GOAL_W=11, GOAL_H=4.2 |
| render | Three.js meshes; unchanged |

## 5. Mode: PIXEL (SNES)

| | value |
|---|---|
| pitch | 384×216 `pitch_384x216.png` |
| grass inclusive | [49,25]→[324,205] |
| **playable clamp** | **[52,28]→[321,202]** = **270×175 px** |
| field aspect | **270:175 ≈ 1.54** (PIXEL-native; do not force 44:68) |
| px_per_BU | **22** (Model 3 ≈ 22px long; ball diameter 16px ≈ 1.14× radius×2 with r=0.131×22≈2.9… use **fixed ball 16px** instead of pure BU for readability) |
| ball | **16×16** sprite; physics radius **8px** |
| goals | N = top of clamp, S = bottom; mouth width ≈ **25% of clamp width** → **~68px** (mirrors GOAL_W/FW = 11/44) |
| goal depth | ~8–12px into clamp; bronze S `#8C4E24`, team blue N `#3a6fff` |
| walls | clamp edges; `setPixelTight` stays |
| sky/towers | visual only — no collision |

### PIXEL motion tuning (same formulas, pixel units)

Convert by `px = BU × 22` for cars; ball radius fixed at 8px.

Suggested PIXEL caps (start here, tune in play):

| | Cybertruck | Model 3 | Cybercab | Semi |
|---|---:|---:|---:|---:|
| max px/s | 140 | 200 | 185 | 110 |
| accel px/s² | 170 | 270 | 240 | 115 |
| turn rad/s | keep catalog turn | same | same | same |

Boost punch / drain / regen ratios unchanged.

**No-rehit:** 120ms after a car-ball impulse from that car.

**Floor:** if PIXEL is flat 2D, replace y-bounce with ground friction `vx,vz *= 0.986` only (already in `stepBall` on ground).

## 6. Future modes (same characters)

Any new mode only adds:

1. Field rect + goal mouths  
2. `units_per_BU` (or fixed px sizes that preserve **l_BU / w_BU** ratios)  
3. Optional gravity / drag multipliers  

It must **not** retune mass, turn, or relative lengths. If a mode needs a “tiny car” variant, add a new catalog id; do not rescale one id per mode.

## 7. Implementation order

1. Fix `atlas_meta.json` → `cell: 32`.  
2. One shared `characters.json` (this table) imported by 3D and PIXEL.  
3. PIXEL: sim in clamp pixels with uniform scale; drop anisotropic map from FW/FL.  
4. PIXEL draw: yaw column + per-car `l_BU × px_per_BU` scale.  
5. Add no-rehit; verify Semi blocks more mouth than Cybercab.  
6. Then palette lock / recolor (visual only; does not unlock gameplay).

## 8. Acceptance checks

- Semi stop-distance and mouth coverage > Model 3 > Cybercab in both modes.  
- Ball never gains speed from sitting inside a car AABB (no-rehit).  
- Cars never enter starfield / wall pixels outside clamp.  
- Same car id → same mass and length ratio in 3D and PIXEL.  
- Switching garage 3D ↔ PIXEL does not rewrite catalog stats.
