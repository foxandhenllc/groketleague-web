const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url = process.env.GAME_URL || 'http://localhost:5173';
const local = ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
const out = process.env.QA_OUT || 'output/netplay';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [], checks = [], logs = [];
const state = p => p.evaluate(() => JSON.parse(window.render_game_to_text()));
const until = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 30000 });
const playing = p => until(p, () => JSON.parse(window.render_game_to_text()).mode === 'play');
const pass = label => { checks.push(label); console.log('PASS', label); };

async function page({ gfx = '3d', car = 'cybertruck', mobile = false } = {}) {
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('gl_seen_how', '1');
    localStorage.setItem('gl_mute_music', '1'); localStorage.setItem('gl_mute_sfx', '1');
  });
  const p = await context.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  if (local) {
    await p.route('**/_vercel/insights/script.js', r => r.fulfill({ body: '' }));
    await p.route('**/api/presence', r => r.fulfill({ contentType: 'application/json', body: '{"online":2,"playing":0}' }));
    // Score fixtures exist only in this browser's intercepted local response.
    await p.route('**/main.js', async r => {
      const response = await r.fetch();
      await r.fulfill({ response, body: await response.text() + `
        window.__scenario = {
          goal: () => { Object.assign(P, { x: 20, z: 0 }); Object.assign(B, { x: -20, z: 0 }); Object.assign(ball, { x: 0, y: getBallRadius(), z: -33, vx: 0, vy: 0, vz: -18 }); },
          expire: () => { timeLeft = 0.001; }
        };
      ` });
    });
  }
  await p.goto(url);
  await until(p, () => typeof window.render_game_to_text === 'function');
  await p.locator(`[data-id="${car}"]`).click(); await p.locator('#toMatchup').click();
  await p.locator(gfx === 'pixel' ? '#gfxPixel' : '#gfx3d').click();
  return p;
}

try {
  for (const gfx of ['pixel', '3d']) {
    const p = await page({ gfx });
    await p.locator('#go').click(); await playing(p);
    const initial = await state(p);
    await until(p, () => JSON.parse(window.render_game_to_text()).timeLeft < 88);
    const running = await state(p);
    assert.equal(running.fsd, true);
    assert.ok(Math.hypot(running.P.x - initial.P.x, running.P.z - initial.P.z) > .1);
    if (gfx === 'pixel') assert.equal(running.ball.vy, 0);
    await p.keyboard.down('Space');
    await until(p, () => JSON.parse(window.render_game_to_text()).P.boosting);
    await p.keyboard.up('Space');
    await p.screenshot({ path: `${out}/${gfx}-desktop.png` });
    await p.locator('#menuBtn').click();
    const paused = await state(p);
    assert.equal(paused.paused, true); assert.equal(await p.locator('#fsdToggle').isDisabled(), true);
    await p.waitForTimeout(250);
    assert.equal((await state(p)).timeLeft, paused.timeLeft);
    await p.locator('#resumeBtn').click();
    await until(p, t => JSON.parse(window.render_game_to_text()).timeLeft < t, paused.timeLeft);
    if (local) {
      for (let score = 1; score <= 3; score++) {
        await until(p, () => !JSON.parse(window.render_game_to_text()).locked);
        await p.evaluate(() => window.__scenario.goal());
        await until(p, score => JSON.parse(window.render_game_to_text()).scoreA === score, score);
      }
      await until(p, () => JSON.parse(window.render_game_to_text()).mode === 'results');
      await p.locator('#again').click(); await playing(p);
      assert.equal((await state(p)).scoreA, 0);
      pass(`${gfx}: goals, kickoffs, result and offline rematch`);
    }
    pass(`${gfx}: boot, FSD, boost, timer, pause and resume`);
    await p.context().close();
  }
  const host = await page({ gfx: 'pixel' }), guest = await page({ gfx: '3d', car: 'model3' });
  await host.locator('#modePrivate').click(); await guest.locator('#modePrivate').click();
  await host.locator('#netCreate').click();
  await until(host, () => /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/.test(document.querySelector('#roomCodeOut').textContent));
  const code = await host.locator('#roomCodeOut').textContent();
  await guest.locator('#roomCodeIn').fill(code.toLowerCase()); await guest.locator('#netJoin').click();
  await Promise.all([playing(host), playing(guest)]);
  let h = await state(host), g = await state(guest);
  assert.equal(h.role, 'host'); assert.equal(g.role, 'guest'); assert.equal(g.cameraFollows, 'B');
  assert.equal(h.matchId, g.matchId); assert.equal(h.B.kind, 'model3');
  assert.equal(g.gfxMode, 'pixel'); assert.equal(g.ball.y, h.ball.y);
  await guest.keyboard.down('Space');
  await until(host, () => JSON.parse(window.render_game_to_text()).B.boosting);
  await guest.keyboard.up('Space');
  await guest.locator('#qcToggle').click(); await guest.locator('#qcMenu [data-cat]').first().click();
  await guest.locator('#qcMenu [data-chat="0"]').click();
  await until(host, () => document.querySelector('#matchChat').textContent.length > 0);
  await guest.locator('#menuBtn').click();
  const beforeMenu = (await state(host)).timeLeft;
  await until(host, t => JSON.parse(window.render_game_to_text()).timeLeft < t - .3, beforeMenu);
  assert.equal((await state(guest)).paused, false); await guest.locator('#resumeBtn').click();
  await guest.screenshot({ path: `${out}/pixel-online-guest.png` });
  pass('private room: handshake, cars, shared pixel field, guest boost, quick chat, live menu');
  if (local) {
    await host.evaluate(() => window.__scenario.goal());
    await until(guest, () => JSON.parse(window.render_game_to_text()).scoreA === 1);
    await until(host, () => !JSON.parse(window.render_game_to_text()).locked);
    await host.evaluate(() => window.__scenario.expire());
    await Promise.all([host, guest].map(p => until(p, () => JSON.parse(window.render_game_to_text()).mode === 'results')));
    await host.locator('#again').click(); await guest.locator('#again').click();
    await Promise.all([playing(host), playing(guest)]);
    h = await state(host); g = await state(guest);
    assert.equal(h.matchId, g.matchId); assert.equal(h.scoreA, 0); assert.equal(g.gfxMode, 'pixel');
    pass('authoritative score, results and rematch preserve field and peer session');
  }
  await guest.locator('#menuBtn').click(); await guest.locator('#newGameBtn').click();
  await until(host, () => JSON.parse(window.render_game_to_text()).mode === 'garage');
  pass('disconnect returns opponent to garage');
  await Promise.all([host.context().close(), guest.context().close()]);
  const a = await page(), b = await page({ car: 'cybercab' });
  await Promise.all([a.locator('#modeQuick').click(), b.locator('#modeQuick').click()]);
  await Promise.all([playing(a), playing(b)]);
  const sa = await state(a), sb = await state(b);
  assert.equal(sa.matchId, sb.matchId); assert.notEqual(sa.role, sb.role);
  pass('simultaneous quick match in 3D');
  await Promise.all([a.context().close(), b.context().close()]);
  const mobile = await page({ gfx: 'pixel', mobile: true });
  await mobile.locator('#go').tap(); await playing(mobile);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await mobile.locator('#boostBtn').isVisible(), true);
  await mobile.screenshot({ path: `${out}/pixel-mobile.png` });
  await mobile.locator('#menuBtn').tap(); assert.equal((await state(mobile)).paused, true);
  await mobile.locator('#resumeBtn').tap(); assert.equal((await state(mobile)).paused, false);
  pass('mobile pixel layout and touch menu');
  assert.deepEqual(errors, []); assert.deepEqual(logs, []);
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ url, passed: true, checks, errors, consoleErrors: logs }, null, 2));
} catch (error) {
  console.error(error);
  for (const [i, context] of browser.contexts().entries()) for (const p of context.pages()) {
    console.log('STATE', i, await state(p).catch(() => 'unavailable'));
    await p.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
  }
  console.error('ERRORS', errors, logs); process.exitCode = 1;
} finally { await browser.close(); }
