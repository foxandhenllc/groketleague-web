import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url = process.env.GAME_URL || 'http://localhost:5174';
const local = ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
const out = process.env.QA_OUT || 'output/arena-rebuild';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], checks = [];
const cases = [
  { name: 'desktop', width: 1440, height: 900, car: 'cybertruck' },
  { name: 'night', width: 1440, height: 900, car: 'model3', night: true },
  { name: 'mobile', width: 390, height: 844, car: 'cybercab', mobile: true },
  { name: 'small-phone', width: 320, height: 568, car: 'semi', mobile: true },
  { name: 'landscape-phone', width: 844, height: 390, car: 'model3', mobile: true }
];
try {
  for (const spec of cases) {
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, isMobile: !!spec.mobile, hasTouch: !!spec.mobile, deviceScaleFactor: spec.mobile ? 2 : 1 });
    await context.addInitScript(() => {
      localStorage.setItem('gl_seen_how', '1'); localStorage.setItem('gl_mute_music', '1'); localStorage.setItem('gl_mute_sfx', '1');
    });
    const p = await context.newPage();
    p.on('pageerror', e => errors.push(e.message));
    if (local) {
      await p.route('**/_vercel/insights/script.js', r => r.fulfill({ body: '' }));
      await p.route('**/api/presence', r => r.fulfill({ contentType: 'application/json', body: '{"online":1,"playing":0}' }));
    }
    await p.goto(url);
    await p.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await p.locator(`[data-id="${spec.car}"]`).click(); await p.locator('#toMatchup').click();
    await p.locator('#gfxPixel').click(); if (spec.night) await p.locator('#mapBtn').click();
    await p.locator('#go').click();
    await p.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play');
    await p.waitForFunction(() => getComputedStyle(document.querySelector('#toast')).opacity === '0');
    const layout = await p.evaluate(() => {
      const rect = id => { const r = document.querySelector(id).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      return { width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth,
        field: rect('#pixelView'), header: rect('#topbar'), menu: rect('#menuBtn'), boost: rect('#boostHud'),
        button: rect('#boostBtn'), chat: rect('#qcToggle'), amber: rect('.scorebox.p1'), cyan: rect('.scorebox.cpu'),
        name: document.querySelector('#hudP1Who').textContent, theme: document.querySelector('#maptag').textContent };
    });
    assert.ok(layout.scroll <= layout.width);
    const separate = (a, b) => a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y;
    assert.ok(separate(layout.header, layout.field), 'scoreboard stays outside arena');
    assert.ok(layout.header.right < layout.menu.x, 'menu does not overlap scoreboard');
    assert.ok(separate(layout.boost, layout.field), 'boost reserve stays outside arena');
    assert.ok(separate(layout.button, layout.field) && separate(layout.chat, layout.field), 'controls stay outside arena');
    assert.ok(layout.amber.width > 60 && layout.cyan.width > 60, 'team score boxes fill their columns');
    assert.ok(layout.button.height >= 44 && layout.chat.height >= 44);
    assert.equal(layout.name, 'YOU'); assert.equal(layout.theme, spec.night ? 'AFTER HOURS' : 'CIRCUIT 01');
    await p.screenshot({ path: `${out}/circuit-${spec.name}.png` });
    await p.locator('#qcToggle').click();
    assert.equal(await p.locator('#qcMenu').isVisible(), true);
    await p.locator('#qcToggle').click();
    await p.locator('#menuBtn').click();
    assert.equal(JSON.parse(await p.evaluate(() => window.render_game_to_text())).paused, true);
    await p.locator('#resumeBtn').click();
    if (spec.name === 'desktop') {
      // Inspect multiple actual frames, including boost, rather than only kickoff.
      await p.keyboard.down('Space');
      for (let frame = 0; frame < 3; frame++) {
        const time = JSON.parse(await p.evaluate(() => window.render_game_to_text())).timeLeft;
        await p.waitForFunction(t => { const s = JSON.parse(window.render_game_to_text()); return s.timeLeft < t - 2 && !s.locked; }, time);
        await p.screenshot({ path: `${out}/circuit-play-${frame}.png` });
      }
      await p.keyboard.up('Space');
      await p.setViewportSize({ width: 390, height: 844 });
      await p.waitForFunction(() => document.querySelector('#pixelView').getBoundingClientRect().width === 390);
      assert.equal(JSON.parse(await p.evaluate(() => window.render_game_to_text())).gfxMode, 'pixel');
      await p.screenshot({ path: `${out}/circuit-resized.png` });
    }
    checks.push({ name: spec.name, layout }); console.log('PASS', spec.name);
    await context.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(`${out}/arena-ui-results.json`, JSON.stringify({ url, checks, errors }, null, 2));
} finally { await browser.close(); }
