const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url = process.env.GAME_URL || 'http://localhost:5173';
const out = process.env.QA_OUT || 'output/netplay';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding'] });
const errors = [], logs = [];
async function page(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const p = await context.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  // Analytics is absent on the plain local static server.
  if (url.includes('localhost')) await p.route('**/_vercel/insights/script.js', r => r.fulfill({ body: '' }));
  if (url.includes('localhost')) await p.route('**/main.js', async r => {
    const response = await r.fetch();
    const body = await response.text();
    await r.fulfill({ response, body: body + '\nwindow.__scenario = { goal: () => { Object.assign(ball, { x: 0, y: 0.55, z: 27.9, vx: 0, vy: 0, vz: 12 }); }, expire: () => { timeLeft = 0.01; } };' });
  });
  await p.goto(url);
  await p.waitForFunction(() => typeof window.render_game_to_text === 'function');
  return p;
}
const state = p => p.evaluate(() => JSON.parse(window.render_game_to_text()));
const until = (p, fn, timeout = 30000) => p.waitForFunction(fn, null, { timeout });
const playing = p => until(p, () => JSON.parse(window.render_game_to_text()).mode === 'play');
try {
  const host = await page(), guest = await page();
  await host.screenshot({ path: `${out}/desktop-lobby.png` });
  await guest.locator('[data-id="model3"]').click();
  await host.locator('#netCreate').click();
  await until(host, () => /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/.test(document.querySelector('#roomCodeOut').textContent));
  const code = await host.locator('#roomCodeOut').textContent();
  console.log('Created private room', code);
  await guest.locator('#roomCodeIn').fill(code.toLowerCase());
  await guest.locator('#netJoin').click();
  await Promise.all([playing(host), playing(guest)]);
  let h = await state(host), g = await state(guest);
  assert.equal(h.role, 'host'); assert.equal(g.role, 'guest'); assert.equal(g.cameraFollows, 'B');
  assert.equal(h.matchId, g.matchId); assert.equal(h.B.kind, 'model3'); assert.equal(g.P.kind, 'cybertruck');
  // With no input, neither online player may be driven by a bot.
  await host.waitForTimeout(400);
  h = await state(host); assert.ok(Math.abs(h.B.z + 14) < .01); assert.ok(Math.abs(h.P.z - 14) < .01);
  await guest.keyboard.down('w'); await guest.keyboard.down('Shift');
  await guest.waitForTimeout(600);
  await guest.keyboard.up('Shift'); await guest.keyboard.up('w');
  await host.waitForTimeout(150);
  h = await state(host); g = await state(guest);
  assert.ok(h.B.z > -13, 'Guest input moves authoritative B');
  assert.ok(h.B.boost < h.B.boostMax, 'Guest boost consumes boost');
  assert.ok(Math.abs(h.B.z - g.B.z) < 3, 'Both peers see B movement');
  await host.keyboard.down('w'); await host.keyboard.down('a'); await host.waitForTimeout(500); await host.keyboard.up('w'); await host.keyboard.up('a');
  h = await state(host); assert.ok(Math.abs(h.P.yaw) > .01);
  await guest.locator('[data-chat="0"]').click();
  await until(host, () => document.querySelector('#chatLog').textContent.includes('P2'));
  await guest.keyboard.press('Escape');
  const timeBefore = (await state(host)).timeLeft;
  await host.waitForFunction(t => JSON.parse(window.render_game_to_text()).timeLeft < t, timeBefore, { timeout: 4000 });
  await guest.locator('#resumeBtn').click();
  await host.screenshot({ path: `${out}/private-host.png` });
  await guest.screenshot({ path: `${out}/private-guest.png` });
  if (url.includes('localhost')) {
    // Deterministic ball trajectories exercise real scoring/replication without
    // depending on a particular browser's frame rate or adding production cheats.
    while ((await state(host)).scoreB < 3) {
      await until(host, () => !JSON.parse(window.render_game_to_text()).locked);
      await host.evaluate(() => window.__scenario.goal());
      await until(host, () => JSON.parse(window.render_game_to_text()).locked);
      await host.waitForTimeout(1100);
    }
    await until(host, () => JSON.parse(window.render_game_to_text()).mode === 'results');
    await until(guest, () => JSON.parse(window.render_game_to_text()).mode === 'results');
    h = await state(host); g = await state(guest);
    assert.equal(h.scoreB, 3); assert.equal(g.scoreB, h.scoreB);
    assert.equal(await host.locator('#resTitle').textContent(), await guest.locator('#resTitle').textContent());
    await guest.screenshot({ path: `${out}/online-results.png` });
    console.log('PASS authoritative goals, kickoff resets and shared match results (controlled local ball trajectories)');
  }
  await guest.close();
  await until(host, () => JSON.parse(window.render_game_to_text()).mode === 'garage');
  assert.match(await host.locator('#netStatus').textContent(), /DISCONNECTED/);
  console.log('PASS private room, handshake, car selection, host/guest inputs, boost, camera, chat, live menu, disconnect');
  const second = await page();
  await Promise.all([host.locator('#netQuick').click(), second.locator('#netQuick').click()]);
  await Promise.all([playing(host), playing(second)]);
  h = await state(host); g = await state(second);
  assert.equal(h.matchId, g.matchId); assert.notEqual(h.role, g.role);
  await host.screenshot({ path: `${out}/quick-match.png` });
  console.log('PASS simultaneous quick match');
  await second.close();
  await until(host, () => JSON.parse(window.render_game_to_text()).mode === 'garage');
  await host.locator('#roomCodeIn').fill('BAD'); await host.locator('#netJoin').click();
  await until(host, () => document.querySelector('#netStatus').textContent.includes('valid 4-character'));
  await host.locator('#netCreate').click();
  await host.locator('#netCancel').click();
  await host.waitForTimeout(800);
  assert.equal(await host.locator('#roomCodeOut').textContent(), '');
  console.log('PASS invalid code and cancel');
  await host.locator('#go').click(); await host.locator('#faceoffLayer').click(); await playing(host);
  await host.keyboard.down('w'); await host.waitForTimeout(400); await host.keyboard.up('w');
  assert.ok((await state(host)).P.z < 14);
  await host.keyboard.press('Escape'); assert.equal((await state(host)).paused, true);
  await host.locator('#newGameBtn').click();
  await host.locator('#goFsd').click(); await host.locator('#faceoffLayer').click(); await playing(host);
  await host.waitForTimeout(500); h = await state(host); assert.equal(h.fsd, true); assert.ok(h.P.z < 14); assert.ok(h.B.z > -14);
  await host.screenshot({ path: `${out}/offline-fsd.png` });
  console.log('PASS offline manual movement, pause, garage, Full Self-Driving');
  const mobile = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const id of ['netQuick', 'netCreate', 'netJoin', 'go', 'goFsd']) assert.equal(await mobile.locator('#' + id).isVisible(), true);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: `${out}/mobile-lobby.png` });
  await mobile.locator('#go').click(); await mobile.locator('#faceoffLayer').tap(); await playing(mobile);
  assert.equal(await mobile.locator('#touch').isVisible(), true);
  const beforeTouch = (await state(mobile)).P.z;
  const pad = await mobile.locator('#pad').boundingBox();
  await mobile.mouse.move(pad.x + pad.width / 2, pad.y + 15);
  await mobile.mouse.down(); await mobile.waitForTimeout(500); await mobile.mouse.up();
  assert.ok((await state(mobile)).P.z < beforeTouch, 'Touch pad drives the car');
  await mobile.screenshot({ path: `${out}/mobile-game.png` });
  assert.deepEqual(errors, []);
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ url, passed: true, errors, consoleErrors: logs, privateRoom: code, checks: ['private rooms','simultaneous quick match','authoritative inputs','car selection','boost','guest camera','chat','disconnect','invalid code','cancel','manual','FSD','pause','mobile'] }, null, 2));
  console.log('PASS mobile layout and touch UI; no uncaught errors', JSON.stringify(logs));
} catch (e) {
  console.error(e);
  for (const [i, c] of browser.contexts().entries()) for (const p of c.pages()) {
    console.log('STATE', i, await state(p).catch(() => 'unavailable'));
    await p.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
  }
  console.error('ERRORS', errors, logs);
  process.exitCode = 1;
} finally { await browser.close(); }
