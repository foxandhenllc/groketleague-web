# Agent playbook (for GrokBot / Cursor-class agents)

## You are maintaining

Windows repo **`groketleague-web`** on Fox's machine, shipped to **Vercel project `groketleague`** on team **`rat-benetar-team`**.

## Defaults

1. **Act in the Windows checkout** (Chris's PC). Do not invent a second game repo.
2. **Push `main` when the fix is ready** - Fox explicitly allows this for this project.
3. **Deploy with Vercel CLI** (`vercel --prod --yes --scope rat-benetar-team`). Do not enable Git integration.
4. Prefer **small static diffs**. No bundler migration unless Fox asks.
5. Keep **3D + PIXEL on one characters sheet**.
6. After PIXEL visual changes: **hard-refresh verify** or screenshot via box browser.
7. Coordinate art with **Pixel Forge**; physics/character contract with **Game Art Director** when touching shared BU/clamp.

## Safety / product

- No secrets in git. X auth is public PKCE + serverless proxy.
- Do not break host authority or rematch session reuse casually.
- Do not "fix" pitch art by replacing the rich castle with a flat green stub.
- Avoid UTF-8 mojibake in UI strings (prefer ASCII punctuation in chat UI).

## Recurring bugs (fix these first)

| Symptom | Likely cause |
|---------|----------------|
| Garage white-screen | Duplicate `export` of same binding in `sim.js` |
| Warped skinny cars | Non-square `drawImage` dest on 32x32 cells |
| Pink side bars | Hot-pink gutters != `#FF00FF`; loosen scrub / repaint pitch |
| Mushy ball hits | Sprite/collider scale mismatch or incorrect contact normals; cooldown must not disable collision response |
| Oval field / shimmer | Non-integer canvas CSS scale |
| Tiny `main.js` in prod | CDN stub redeployed - restore full file + CLI deploy |

## Definition of done for a typical change

- [ ] Runs on `python -m http.server 5173`
- [ ] 3D and PIXEL still boot from garage
- [ ] `node --experimental-default-type=module --test tests/physics.test.mjs` passes after physics/timing changes
- [ ] If net touched: private room smoke (or `tests/netplay.mjs`)
- [ ] Committed + pushed `main`
- [ ] `vercel --prod` Ready on both domains
- [ ] Fox told what is live + how to verify
