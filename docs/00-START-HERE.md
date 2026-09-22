# GROKET LEAGUE - Maintainer start here

Welcome. This folder is the handoff pack for humans and coding agents who will keep **GROKET LEAGUE** alive.

**Repo (correct one):** `C:\Users\chris\Hunnys-Development\groketleague-web`  
**GitHub:** `https://github.com/foxandhenllc/groketleague-web`  
**Live:** `https://www.groketleague.com` (also `https://groketleague.com`)

There is no separate `groketleague` app folder for the site - **`groketleague-web` is the game.**

## Read in this order

1. [00-START-HERE.md](./00-START-HERE.md) (this file)
2. [01-OVERVIEW.md](./01-OVERVIEW.md) - what the product is
3. [02-ARCHITECTURE.md](./02-ARCHITECTURE.md) - how modules fit together
4. [07-FILE-MAP.md](./07-FILE-MAP.md) - every important file in one page
5. Then jump by task:
   - Edit cars / physics / PIXEL art -> [03-EDITING-GUIDE.md](./03-EDITING-GUIDE.md), [04-PIXEL-MODE.md](./04-PIXEL-MODE.md)
   - Online / rooms -> [05-NETWORK.md](./05-NETWORK.md)
   - Ship to prod -> [06-DEPLOY.md](./06-DEPLOY.md)
6. Agent norms -> [08-AGENT-PLAYBOOK.md](./08-AGENT-PLAYBOOK.md)

Also see repo-root:
- `CHARACTER_PHYSICS_SPEC.md` - shared BU / PIXEL physics contract notes
- `README.md` - short product + deploy stub
- `progress.md` - historical restore / ship log (context, not current SOP)

## Non-negotiables (Fox)

- **Push to `main` is allowed** when the change is ready. Do not invent a long-lived PR culture unless Fox asks.
- **Deploy with Vercel CLI only.** Do **not** turn on Vercel Git integration for this project.
- Prefer **PIXEL** and **3D** sharing `characters.js` so modes do not fork stats.
- Pixel art teammate: **Pixel Forge**. Design/physics contract teammate: **Game Art Director**.

## Quick local run

```powershell
cd C:\Users\chris\Hunnys-Development\groketleague-web
python -m http.server 5173
# open http://localhost:5173
```

Static site - no `npm run build` required for normal play.