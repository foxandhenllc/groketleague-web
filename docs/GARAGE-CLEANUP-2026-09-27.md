# Garage cleanup - September 27, 2026

The home screen now groups setup into a compact panel, with consistent text and button styling, four keyboard-accessible vehicle choices, and a single Continue action. Vehicle specs and audio/account controls expand on demand. Match setup shares the panel; the match HUD and physics are unchanged.

## What the numbers mean

The old mass/speed/turn ratings were hand-written character labels. The new spec display reads the actual values returned by `bodyFrom`, including simulation-config overrides: mass, speed, acceleration, turning, grip, boost reserve, and size. These values affect driving and contact physics.

The old named specials did not represent four separate activated abilities. Heavy boosted contact is implemented for both Cybertruck and Semi; Snap Turn, Soap Shoes, and Wall are not separate activated abilities. The garage now describes real physical differences and explains the shared heavy-contact effect.

## Validation

- Local gameplay/netplay suite: all nine checks passed, including goals, rematches, private rooms, quick match, disconnect, and mobile controls.
- Arena UI suite: all eight desktop/mobile/landscape and 2D/3D cases passed.
- Garage checks: five viewport sizes passed locally and on the deployment, including vehicle selection, actual spec values, match setup, and audio toggles; no page errors or document overflow.
- Signed-in account layout inspected using a synthetic display fixture at 320px; settings remain reachable by scrolling. This does not constitute a fresh OAuth login test.
- All 12 checked source files match on both public domains, including the new garage stylesheet; presence API responds.

Deployment: https://groketleague-8yrukase2-rat-benetar-team.vercel.app
Promoted to https://www.groketleague.com/ and https://groketleague.com/.
Local screenshots and receipts: `output/garage-cleanup*` (ignored).
