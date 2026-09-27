import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out = process.env.QA_OUT || 'output/first-playable-slice/browser-contracts';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], checks = [];
async function page(stale = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    recordVideo: { dir: out + '/video', size: { width: 390, height: 844 } } });
  await context.addInitScript(() => {
    localStorage.setItem('gl_seen_how', '1'); localStorage.setItem('gl_mute_sfx', '1'); localStorage.setItem('gl_mute_music', '1');
  });
  const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.route('**/api/presence', r => r.fulfill({ contentType: 'application/json', body: '{"online":2,"playing":0}' }));
  if (stale) await p.route('**/net-protocol.js', async r => {
    const response = await r.fetch();
    await r.fulfill({ response, body: (await response.text()).replace("return 'sha256:'", "return 'outdated:'") });
  });
  // Injected only into this localhost test response, never into production source.
  await p.route('**/main.js', async r => {
    const response = await r.fetch();
    await r.fulfill({ response, body: await response.text() + `
      window.__slice = {
        feedback(state) { P.boostState=state; P.boost=state==='release'?0:state==='recharging'?.09:state==='active'?.4:P.boostMax; P.boostReason='TURNING'; P.boosting=state==='active'; locked=true; stepGame(0); },
        input: () => readControls()
      };
    ` });
  });
  await p.goto(process.env.GAME_URL || 'http://127.0.0.1:5197');
  try { await p.waitForFunction(() => !!window.__slice); }
  catch (error) {
    await fs.writeFile(out + '/startup-failure.json', JSON.stringify({ stale, errors, resources: await p.evaluate(() => performance.getEntriesByType('resource').map(r => ({ name:r.name, duration:r.duration }))) }, null, 2));
    throw error;
  }
  await p.locator('[data-id="model3"]').click(); await p.locator('#toMatchup').click(); await p.locator('[data-arena="classic"]').click(); await p.locator('#gfxPixel').click();
  return p;
}
try {
  const p = await page(); await p.locator('#go').click();
  await p.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play');
  for (const [state, label] of [['ready','BOOST'], ['waiting','WAITING: TURNING'], ['active','BOOSTING'], ['release','RELEASE TO RECHARGE'], ['recharging','RECHARGING']]) {
    await p.evaluate(s => window.__slice.feedback(s), state);
    assert.equal(await p.locator('#boostLab').textContent(), label);
    const box = await p.locator('#boostLab').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390);
    await p.screenshot({ path: `${out}/${state}.png` });
  }
  checks.push('all five boost labels fit phone HUD');
  await p.keyboard.down('Space'); assert.equal(await p.evaluate(() => window.__slice.input().boost), true);
  await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await p.evaluate(() => window.__slice.input().boost), false); await p.keyboard.up('Space');
  const box = await p.locator('#boostBtn').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
  assert.equal(await p.evaluate(() => window.__slice.input().boost), true);
  await p.mouse.move(3, 3); await p.mouse.up(); assert.equal(await p.evaluate(() => window.__slice.input().boost), false);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
  await p.locator('#boostBtn').dispatchEvent('pointercancel', { pointerId: 1 });
  assert.equal(await p.evaluate(() => window.__slice.input().boost), false); await p.mouse.up();
  checks.push('keyboard blur, captured release and pointercancel clear intent');
  await p.context().close();
  const host = await page(), guest = await page(true);
  await host.locator('#modePrivate').click(); await guest.locator('#modePrivate').click(); await host.locator('#netCreate').click();
  await host.waitForFunction(() => /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/.test(document.querySelector('#roomCodeOut').textContent));
  await guest.locator('#roomCodeIn').fill(await host.locator('#roomCodeOut').textContent()); await guest.locator('#netJoin').click();
  await host.waitForFunction(() => JSON.parse(window.render_game_to_text()).netStatus.includes('Game versions differ'));
  await guest.waitForFunction(() => JSON.parse(window.render_game_to_text()).netStatus.includes('Game versions differ'));
  assert.equal(await host.evaluate(() => JSON.parse(window.render_game_to_text()).online), false);
  checks.push('real PeerJS mismatched config blocks start on both peers');
  await host.context().close(); await guest.context().close(); assert.deepEqual(errors, []);
  await fs.writeFile(out + '/results.json', JSON.stringify({ checks, errors, video: 'Automated input recording, not a human playtest' }, null, 2));
  console.log(checks);
} finally { await browser.close(); }
