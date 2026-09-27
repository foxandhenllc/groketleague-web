/** Local visual audit. Fixtures are injected into this browser's response, never shipped. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.GAME_URL || 'http://127.0.0.1:5198/';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Scenario injection is local-only');
const out = process.env.QA_OUT || 'output/sink-readability';
const baseline = process.env.SINK_BASELINE === '1';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const cases = [
  { name: 'desktop', width: 1440, height: 900, car: 'cybertruck' },
  { name: 'portrait', width: 390, height: 844, car: 'model3', touch: true },
  { name: 'landscape', width: 844, height: 390, car: 'cybercab', touch: true },
  { name: 'small-phone', width: 320, height: 568, car: 'semi', touch: true },
  { name: 'small-landscape', width: 568, height: 320, car: 'semi', touch: true }
];
const scenarios = ['dry-slope', 'faucet-warning', 'faucet-surge', 'faucet-ebb', 'drain-approach', 'meteor-warning', 'meteor-impact', 'lightning-warning', 'lightning-impact'];
const moduleCache = new Map(), checks = [], errors = [], failures = [];
const injection = `
const __auditSinkModule = await import('./sink.js');
window.__sinkAudit = {
  set(name) {
    window.__sinkAuditFreeze=true; playing=true; paused=false; locked=false; mode='play'; timeLeft=77;
    Object.assign(arenaState,makeArenaState('readability-audit'),{time:3,next:100,index:0,surge:0,hazard:null});
    Object.assign(P,{x:18.5,z:7,yaw:Math.PI/2,vx:0,vz:0,boosting:false,shock:0});
    Object.assign(B,{x:-6,z:-12,yaw:0,vx:0,vz:0,boosting:false,shock:0});
    Object.assign(ball,{x:20,z:-3,y:getBallRadius(),vx:0,vz:0,vy:0});
    if(name.startsWith('faucet')) {
      arenaState.time=name==='faucet-warning'?8.4:name==='faucet-surge'?11.5:13.5;
      Object.assign(P,{x:-1,z:3}); Object.assign(B,{x:7,z:11}); Object.assign(ball,{x:4,z:-2});
    }
    if(name==='drain-approach') { Object.assign(P,{x:2,z:-14,yaw:0}); Object.assign(ball,{x:2,z:-SINK.drainZ+4.4,vz:-2}); }
    if(name.includes('meteor') || name.includes('lightning')) {
      const impact=name.endsWith('impact');
      arenaState.hazard={id:name.startsWith('meteor')?101:102,kind:name.startsWith('meteor')?'meteor':'lightning',x:4,z:0,age:impact?SINK.warning+.2:SINK.warning*.6,fired:impact};
      Object.assign(P,{x:6,z:1,yaw:0,shock:impact&&name.startsWith('lightning')?.5:0}); Object.assign(ball,{x:5,z:-1});
    }
    stepSink(arenaState,[P,B],ball,0);
    return JSON.parse(window.render_game_to_text());
  },
  resume() { window.__sinkAuditFreeze=false; playing=true; paused=false; locked=false; },
  freeze() { window.__sinkAuditFreeze=true; },
  surface() { return __auditSinkModule.sinkSurface ? {car:__auditSinkModule.sinkSurface(P.x,P.z,arenaState),ball:__auditSinkModule.sinkSurface(ball.x,ball.z,arenaState)} : null; },
  projection() {
    camera.updateMatrixWorld();
    const project=(x,z)=>{const p=new THREE.Vector3(x,sinkHeight(x,z),z).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,depth:p.z};};
    return {camera:camera.position.toArray(),target:camTarget.toArray(),drains:[project(0,-SINK.drainZ),project(0,SINK.drainZ)],ball:project(ball.x,ball.z),rim:[project(-22,-34),project(22,-34),project(22,34),project(-22,34)],render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frame:renderer.info.render.frame}};
  }
};`;

function check(condition, message, context) {
  if (!condition) failures.push({ message, ...context });
}
const intersects = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

try {
  for (const gfx of ['pixel', '3d']) for (const spec of cases) {
    const id = `${gfx}-${spec.name}`;
    if (process.env.SINK_CASE && !process.env.SINK_CASE.split(',').includes(id)) continue;
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, isMobile: !!spec.touch, hasTouch: !!spec.touch, reducedMotion: process.env.SINK_REDUCED === '1' ? 'reduce' : 'no-preference', recordVideo: process.env.SINK_VIDEO === '1' ? { dir: `${out}/video`, size: { width: spec.width, height: spec.height } } : undefined });
    await context.addInitScript(() => { localStorage.setItem('gl_seen_how', '1'); localStorage.setItem('gl_mute_music', '1'); localStorage.setItem('gl_mute_sfx', '1'); });
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push({ id, error: error.message }); console.error('BROWSER', id, error.message); });
    page.on('console', message => {
      if (message.type() === 'error' && !errors.some(e => e.id === id && e.error === message.text())) errors.push({ id, error: message.text() });
    });
    await page.route('https://cdn.jsdelivr.net/**', async route => {
      const key = route.request().url();
      if (!moduleCache.has(key)) { const response = await route.fetch(); moduleCache.set(key, { body: await response.body(), status: response.status(), headers: response.headers() }); }
      await route.fulfill(moduleCache.get(key));
    });
    await page.route('**/_vercel/insights/script.js', route => route.fulfill({ body: '' }));
    await page.route('**/api/presence', route => route.fulfill({ contentType: 'application/json', body: '{"online":1,"playing":0}' }));
    await page.route('**/main.js', async route => {
      const response = await route.fetch(), source = await response.text();
      assert.ok(source.includes('function simulateMatch(dt) {'), 'Local fixture must intercept the actual simulation entry');
      await route.fulfill({ response, body: source.replace('function simulateMatch(dt) {', 'function simulateMatch(dt) { if(window.__sinkAuditFreeze)return;') + injection });
    });
    await page.goto(url);
    await page.waitForFunction(() => !!window.__sinkAudit, {}, { timeout: 60000 });
    await page.locator(`[data-id="${spec.car}"]`).click(); await page.locator('#toMatchup').click();
    await page.locator('#arenaSelect').selectOption('sink'); await page.locator(gfx === 'pixel' ? '#gfxPixel' : '#gfx3d').click(); await page.locator('#go').click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play');
    await page.evaluate(() => window.__sinkAudit.set('dry-slope'));
    await page.waitForTimeout(1800); // Let the real camera settle before measuring framing.
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#toast')).opacity === '0');
    const results = [];
    for (const scenario of scenarios) {
      const state = await page.evaluate(name => window.__sinkAudit.set(name), scenario);
      await page.waitForTimeout(100);
      const snapshot = await page.evaluate(() => {
        const rect = id => { const e = document.querySelector(id); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, text: e.textContent }; };
        const canvas = document.querySelector('#pixelView'), canvasPaint = [];
        if (canvas && getComputedStyle(canvas).display !== 'none' && canvas.width && canvas.height) {
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          for (const x of [.2, .5, .8]) for (const y of [.2, .5, .8]) { const i = (Math.floor(y * canvas.height) * canvas.width + Math.floor(x * canvas.width)) * 4; canvasPaint.push(Array.from(pixels.slice(i, i + 4))); }
        }
        return { width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth,
          field: rect('#pixelView'), notice: rect('#hazardNotice'), scoreboard: rect('#topbar'), menu: rect('#menuBtn'),
          boost: rect('#boostBtn'), special: rect('#specialBtn'), tactics: rect('#tactics') || rect('#skillControls') || rect('#tacticControls'),
          canvasPaint, projection: window.__sinkAudit.projection(), surface: window.__sinkAudit.surface(), state: JSON.parse(window.render_game_to_text()) };
      });
      await page.screenshot({ path: `${out}/${id}-${scenario}.png` });
      check(snapshot.scroll <= snapshot.width, 'No horizontal document overflow', { id, scenario });
      if (gfx === 'pixel') check(snapshot.canvasPaint.length === 9 && snapshot.canvasPaint.every(p => p[3] > 250) && new Set(snapshot.canvasPaint.map(p => p.join(','))).size > 3, 'Arena canvas contains a rendered field, not an empty HUD-only view', { id, scenario });
      for (const key of ['notice', 'scoreboard', 'menu', 'boost', 'special']) {
        const r = snapshot[key]; check(r && r.x >= -.5 && r.y >= -.5 && r.right <= snapshot.width + .5 && r.bottom <= snapshot.height + .5, `${key} remains on screen`, { id, scenario, rect: r });
      }
      if (snapshot.notice && snapshot.scoreboard) check(!intersects(snapshot.notice, snapshot.scoreboard), 'Event instructions do not cover scores', { id, scenario });
      if (gfx === '3d') for (const p of snapshot.projection.drains) {
        check(p.x > 15 && p.x < snapshot.width - 15 && p.y > 60 && p.y < snapshot.height - 70 && p.depth > -1 && p.depth < 1, 'Both drain goals stay visible', { id, scenario, point: p });
        const drain = { x: p.x - 12, y: p.y - 12, right: p.x + 12, bottom: p.y + 12 };
        for (const key of ['notice', 'scoreboard', 'menu', 'boost', 'special', 'tactics']) if (snapshot[key]) check(!intersects(drain, snapshot[key]), `Drain goals remain clear of ${key}`, { id, scenario, point: p });
      }
      if (!baseline) {
        const notice = snapshot.notice?.text || '';
        if (scenario === 'faucet-warning') check(/faucet|water|tap/i.test(notice) && /warn|ready|incoming|opens|surge/i.test(notice), 'Water warns before force begins', { id, scenario, notice });
        if (scenario === 'faucet-surge') check(/water|faucet|current|flow/i.test(notice), 'Water force has visible explanation', { id, scenario, notice });
        if (scenario === 'faucet-ebb') check(/ebb|reced|drain|dry|fading|easing/i.test(notice), 'Water ebb has visible explanation', { id, scenario, notice });
        if (scenario.startsWith('meteor')) check(/meteor/i.test(notice), 'Meteor has identifiable warning/impact', { id, scenario, notice });
        if (scenario.startsWith('lightning')) check(/lightning|zap|shock/i.test(notice), 'Lightning has identifiable warning/impact', { id, scenario, notice });
        if (scenario === 'dry-slope') check(snapshot.surface?.car.height > 0 && Math.abs(snapshot.surface.car.slopeX) > 0, 'Raised shoulder fixture is physically sloped', { id, scenario });
        if (scenario === 'faucet-warning') check(snapshot.surface?.ball.currentX === 0, 'Warning appears before current applies', { id, scenario });
        if (scenario === 'faucet-surge') check(snapshot.surface?.ball.currentX > 0 && snapshot.surface.ball.wet > 0, 'Visible water applies local current and wetness', { id, scenario });
        if (scenario === 'drain-approach') check(snapshot.surface?.ball.drainPullZ < 0, 'Drain cue coincides with pull toward the target', { id, scenario });
      }
      check(Object.keys(snapshot.state.diagnostics).length === 0, 'No simulation diagnostics', { id, scenario });
      results.push({ scenario, ...snapshot });
    }
    // Real simulation after controlled framing: move cars, witness water, and measure camera motion.
    await page.evaluate(() => { window.__sinkAudit.set('faucet-warning'); window.__sinkAudit.resume(); });
    const motion = [];
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(150);
      motion.push(await page.evaluate(() => ({ projection: window.__sinkAudit.projection(), state: JSON.parse(window.render_game_to_text()), notice: document.querySelector('#hazardNotice').textContent })));
      if (i % 5 === 0) await page.screenshot({ path: `${out}/${id}-live-${i}.png` });
    }
    await page.evaluate(() => window.__sinkAudit.freeze());
    check(motion.at(-1).state.timeLeft < motion[0].state.timeLeft - .5 || motion.at(-1).state.roundEpoch > motion[0].state.roundEpoch, 'Real simulation advances (including a scored goal)', { id });
    check(Math.hypot(motion.at(-1).state.P.x - motion[0].state.P.x, motion.at(-1).state.P.z - motion[0].state.P.z) > .1, 'Autonomous vehicle moves during live play', { id });
    if (gfx === '3d') {
      const movement = motion.slice(1).map((m, i) => Math.hypot(...m.projection.camera.map((v, k) => v - motion[i].projection.camera[k])));
      check(Math.max(...movement) < .7, 'Wide camera remains steady during water transition', { id, maximumMovement: Math.max(...movement) });
    }
    await page.evaluate(() => window.__sinkAudit.resume());
    await page.locator('#menuBtn').click();
    const pausedTime = await page.evaluate(() => JSON.parse(window.render_game_to_text()).arenaState.time);
    await page.waitForTimeout(200);
    check(await page.evaluate(() => JSON.parse(window.render_game_to_text()).arenaState.time) === pausedTime, 'Pause freezes event clock', { id });
    await page.locator('#resumeBtn').click();
    await page.waitForFunction(t => JSON.parse(window.render_game_to_text()).arenaState.time > t, pausedTime);
    checks.push({ id, viewport: spec, reducedMotion: process.env.SINK_REDUCED === '1', scenarios: results, motion });
    await fs.writeFile(`${out}/results.json`, JSON.stringify({ url, baseline, checks, errors, failures }, null, 2));
    await context.close(); console.log('CAPTURED', id);
  }
  assert.deepEqual(errors, [], 'Browser must not throw');
  if (!baseline) assert.deepEqual(failures, [], 'Readability checks failed (see results.json and screenshots)');
  console.log(`${checks.length} viewport/render cases, ${checks.length * scenarios.length} scenarios, ${failures.length} findings`);
} catch (error) {
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ url, baseline, checks, errors, failures, exception: error.message }, null, 2));
  for (const [i, context] of browser.contexts().entries()) for (const page of context.pages()) await page.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
  throw error;
} finally { await browser.close(); }
