# Deploy (Vercel CLI)

## Policy

- **CLI only** to the existing project.
- **Do not** enable Vercel Git auto-deploys for this project.
- **Pushing `main` to GitHub is fine** (Fox-approved) for source of truth; still ship with CLI so production matches the tree you intend.

## IDs

```
Project name:  groketleague
Project ID:    prj_U7ECGhUZFi7226WXWLITmVVUNypI
Team slug:     rat-benetar-team
Team ID:       team_DHrreAGGPZ2RlnCxUj3vj3o1
```

Already linked locally via `.vercel/project.json`.

## Standard prod ship

```powershell
cd C:\Users\chris\Hunnys-Development\groketleague-web
git status
git add -A
git commit -m "your message"
git push origin main

# Auth: `vercel login` once, or VERCEL_TOKEN in env
npx --yes vercel@latest --prod --yes --scope rat-benetar-team
```

If the folder is already linked, `--scope` / project flags may be optional; when in doubt:

```powershell
npx --yes vercel@latest link --yes --project groketleague --scope rat-benetar-team
npx --yes vercel@latest --prod --yes --scope rat-benetar-team
```

## vercel.json must stay static

- `"framework": null`
- `"outputDirectory": "."`
- empty build/install commands

Never replace `main.js` with a CDN stub. Both domains must serve **this repo's** `main.js`, `net.js`, `style.css`, PIXEL assets, music.

## Verify

1. Open `https://www.groketleague.com` hard-refresh
2. Garage -> PIXEL + 3D both boot
3. Optional: `tests/netplay.mjs` against production URL
4. Confirm `main.js` Content-Length is large (full game), not an ~80-byte stub

## Rollback

Redeploy a previous Ready deployment from the Vercel dashboard, or check out a known-good git SHA and CLI-deploy again.