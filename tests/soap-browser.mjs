/** Local-only 3D soap, halfpipe, goal-continuity and camera audit. No shipped hooks. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.GAME_URL || 'http://127.0.0.1:5198/';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Fixture injection is local-only');
const out = process.env.QA_OUT || 'output/soap-browser';
await fs.mkdir(out, { recursive: true });
const cases = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'portrait', width: 390, height: 844, touch: true },
  { name: 'landscape', width: 844, height: 390, touch: true },
  { name: 'small-landscape', width: 568, height: 320, touch: true }
];
const scenes = ['slide', 'bank-climb', 'airborne', 'landing', 'drain-entry'];
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], failures = [], checks = [], moduleCache = new Map();
const check = (condition, message, details = {}) => { if (!condition) failures.push({ message, ...details }); };

const fixture = `
const __soapPhysics=await import('./soap-physics.js');
const __soapNearGoal=${process.env.SOAP_OPPOSITE === '1'};
window.__soapAuditFreeze=false;
window.__soapAuditHoldAge=null;
window.__soapAudit={
  set(name) {
    window.__soapAuditFreeze=true; window.__soapAuditHoldAge=null; playing=true; paused=false; locked=false; mode='play'; timeLeft=77;
    if(typeof goalCelebration!=='undefined')goalCelebration=null;
    if(typeof goalPresentation!=='undefined')goalPresentation=null;
    resetContacts();
    Object.assign(arenaState,makeArenaState('soap-browser'),{time:3,next:100,hazard:null});
    P=bodyFrom(selectedId,-15,22,0);B=bodyFrom(botId,-14,-22,Math.PI);
    ball={x:-5,z:0,y:getBallRadius(),vx:9,vy:0,vz:3,flat:0};
    if(name==='bank-climb')Object.assign(ball,{x:18.5,z:7,vx:20,vz:1});
    if(name==='airborne')Object.assign(ball,{x:18,z:4,y:6,vy:2,vx:-10,vz:-2});
    if(name==='landing')Object.assign(ball,{x:10,z:5,y:getBallRadius()+.08,vy:-4,vx:10,vz:1});
    if(name==='drain-entry')Object.assign(ball,{x:1.2,z:(__soapNearGoal?1:-1)*(SINK.drainZ-6.5),vx:-1,vy:0,vz:__soapNearGoal?14:-14});
    __soapPhysics.initSoap(ball,{drop:true});
    Object.assign(ball.soap,{airborne:name==='airborne'||name==='landing',worldY:sinkHeight(ball.x,ball.z)+ball.y,
      pitch:name==='airborne'?.8:0,yaw:.2,roll:name==='airborne'?.3:0,spinX:0,spinY:.3,spinZ:0,
      launches:name==='airborne'||name==='landing'?1:0,landings:0,releaseT:0,stallT:0,goalEntry:null});
    stepSink(arenaState,[P,B],ball,0);
    stepBall(ball,1/120); // Use the actual ground/air pose rather than hand-tilting the visual.
    if(name==='drain-entry'){P.x=-7;P.z=-16;P.vx=5;P.vz=-3;B.x=9;B.z=10;B.vx=-3;B.vz=1;}
    return this.snapshot();
  },
  resume(){window.__soapAuditFreeze=false;},
  freeze(){window.__soapAuditFreeze=true;},
  holdAt(age){window.__soapAuditHoldAge=age;window.__soapAuditFreeze=false;},
  snapshot(){
    camera.updateMatrixWorld();
    const state=JSON.parse(window.render_game_to_text());
    const body=typeof soapMesh!=='undefined'?(soapMesh.userData.body||soapMesh):ballMesh;
    const center=body.getWorldPosition(new THREE.Vector3()), screen=center.clone().project(camera);
    const projected=(x,z)=>{const p=new THREE.Vector3(x,sinkHeight(x,z),z).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,depth:p.z};};
    const box=new THREE.Box3().setFromObject(body);
    return {now:performance.now(),state,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov},
      mesh:{position:center.toArray(),quaternion:body.getWorldQuaternion(new THREE.Quaternion()).toArray(),visible:body.visible,size:box.getSize(new THREE.Vector3()).toArray()},
      soapScreen:{x:(screen.x+1)*innerWidth/2,y:(1-screen.y)*innerHeight/2,depth:screen.z},drains:[projected(0,-SINK.drainZ),projected(0,SINK.drainZ)]};
  },
  recording:[],recordingOn:false,
  record(){this.recording=[];this.recordingOn=true;const take=frameTime=>{if(!this.recordingOn)return;const sample=this.snapshot();sample.frameTime=frameTime;this.recording.push(sample);requestAnimationFrame(take);};requestAnimationFrame(take);},
  stop(){this.recordingOn=false;return this.recording;},
  shareCard(){
    if(!lastGoalCard)return null;
    const pixels=lastGoalCard.getContext('2d').getImageData(0,130,lastGoalCard.width,lastGoalCard.height-130).data;
    const colors=new Set();let opaque=0;
    for(let i=0;i<pixels.length;i+=160){colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);if(pixels[i+3])opaque++;}
    return {data:lastGoalCard.toDataURL('image/png'),colors:colors.size,opaque};
  },
  winningGoal(){scoreA=2;scoreB=0;scoreAEl.textContent='2';scoreBEl.textContent='0';}
};`;

async function snapshot(page) { return page.evaluate(() => window.__soapAudit.snapshot()); }
async function capture(page, path) { await page.screenshot({ path: `${out}/${path}.png` }); }
function distance(a, b) { return Math.hypot(...a.map((v, i) => v - b[i])); }
function assessCamera(samples, context) {
  let maxVelocity = 0, maxAngularVelocity = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = ((samples[i].frameTime ?? samples[i].now) - (samples[i - 1].frameTime ?? samples[i - 1].now)) / 1000;
    if (dt <= .002) continue;
    const speed = distance(samples[i].camera.position, samples[i - 1].camera.position) / dt;
    const dot = Math.abs(samples[i].camera.quaternion.reduce((sum, v, k) => sum + v * samples[i - 1].camera.quaternion[k], 0));
    const turn = 2 * Math.acos(Math.min(1, dot)) / dt;
    maxVelocity = Math.max(maxVelocity, speed); maxAngularVelocity = Math.max(maxAngularVelocity, turn);
  }
  check(maxVelocity < 100, 'Camera translation stays continuous without a hard cut', { ...context, maxVelocity });
  check(maxAngularVelocity < 2, 'Camera rotation stays continuous without a hard cut', { ...context, maxAngularVelocity });
  if(process.env.SOAP_REDUCED === '1') check(samples.every(s=>distance(s.camera.position,samples[0].camera.position)<.0001), 'Reduced motion keeps a stable wide camera', context);
  return { maxVelocity, maxAngularVelocity };
}

try {
  for (const spec of cases) {
    if (process.env.SOAP_CASE && !process.env.SOAP_CASE.split(',').includes(spec.name)) continue;
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, isMobile: !!spec.touch, hasTouch: !!spec.touch,
      reducedMotion: process.env.SOAP_REDUCED === '1' ? 'reduce' : 'no-preference', recordVideo: process.env.SOAP_VIDEO === '1' ? { dir: `${out}/video`, size: { width: spec.width, height: spec.height } } : undefined });
    await context.addInitScript(() => { localStorage.setItem('gl_seen_how', '1'); localStorage.setItem('gl_mute_music', '1'); localStorage.setItem('gl_mute_sfx', '1'); });
    const page = await context.newPage();
    const error = message => { if (!errors.some(e => e.case === spec.name && e.message === message)) { errors.push({ case: spec.name, message }); console.error('BROWSER', spec.name, message); } };
    page.on('pageerror', e => error(e.message)); page.on('console', m => { if (m.type() === 'error') error(m.text()); });
    await page.route('https://cdn.jsdelivr.net/**', async route => {
      const key = route.request().url();
      if (!moduleCache.has(key)) { const response = await route.fetch(); moduleCache.set(key, { body: await response.body(), status: response.status(), headers: response.headers() }); }
      await route.fulfill(moduleCache.get(key));
    });
    await page.route('**/_vercel/insights/script.js', route => route.fulfill({ body: '' }));
    await page.route('**/api/presence', route => route.fulfill({ contentType: 'application/json', body: '{"online":1,"playing":0}' }));
    await page.route('**/main.js', async route => {
      const response = await route.fetch(), source = await response.text();
      assert.ok(source.includes('function simulateMatch(dt) {'), 'Fixture intercepts actual simulation entry');
      await route.fulfill({ response, body: source.replace('function simulateMatch(dt) {', 'function simulateMatch(dt) { if(window.__soapAuditHoldAge!=null&&goalCelebration?.age>=window.__soapAuditHoldAge){window.__soapAuditFreeze=true;window.__soapAuditHoldAge=null;} if(window.__soapAuditFreeze)return;') + fixture });
    });
    await page.goto(url); await page.waitForFunction(() => !!window.__soapAudit, {}, { timeout: 60000 });
    await page.locator('[data-id="model3"]').click(); await page.locator('#toMatchup').click();
    await page.locator('[data-arena="sink"]').click(); await page.locator('#gfx3d').click(); await page.locator('#go').click();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play');
    const result = { case: spec, reducedMotion: process.env.SOAP_REDUCED === '1', staged: [], flight: [], goal: [], winning: [] };
    checks.push(result);
    const staged = result.staged;
    const fullScenes = process.env.SOAP_ONLY_GOALS !== '1' || (process.env.SOAP_FULL_CASES || '').split(',').includes(spec.name);
    const controls = await page.evaluate(() => Array.from(document.querySelectorAll('#menuBtn,#boostBtn,#qcToggle,#skillControls button')).map(e => { const r=e.getBoundingClientRect();return { id:e.id||e.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom }; }));
    for (const [i,a] of controls.entries()) {
      check(a.right-a.x>=44 && a.bottom-a.y>=44, 'Gameplay controls retain 44px touch targets', {case:spec.name,control:a});
      check(a.x>=0 && a.y>=0 && a.right<=spec.width+1 && a.bottom<=spec.height+1, 'Gameplay controls remain in the viewport', {case:spec.name,control:a});
      for (const b of controls.slice(i+1)) check(Math.min(a.right,b.right)-Math.max(a.x,b.x)<=1 || Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<=1, 'Gameplay controls do not overlap', {case:spec.name,controls:[a.id,b.id]});
    }
    result.controls=controls;
    for (const scene of fullScenes ? scenes : []) {
      await page.evaluate(name => window.__soapAudit.set(name), scene); await page.waitForTimeout(700);
      const s = await snapshot(page);
      const ui = await page.evaluate(() => { const rect = id => { const e = document.querySelector(id); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }; return { width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth, header: rect('#topbar'), skills: rect('#skillControls'), notice: rect('#hazardNotice') }; });
      check(ui.scroll <= ui.width, 'No horizontal document overflow', { case: spec.name, scene });
      check(s.soapScreen.depth > -1 && s.soapScreen.depth < 1 && s.soapScreen.x > 0 && s.soapScreen.x < ui.width && s.soapScreen.y > 0 && s.soapScreen.y < ui.height, 'Soap remains visible in staged action', { case: spec.name, scene, projection: s.soapScreen });
      check(s.mesh.position.every(Number.isFinite), 'Visible soap transform is finite', { case: spec.name, scene });
      check(Math.abs(s.mesh.position[1] - (s.state.ball.soap.worldY - .65)) < .08, 'Soap model follows authoritative height through banks and flight', { case: spec.name, scene });
      check(s.state.gfxMode === '3d' && s.state.mapMode === 'sink', 'Audit runs the requested 3D kitchen mode', { case: spec.name, scene });
      await capture(page, `${spec.name}-${scene}`); staged.push({ scene, snapshot: s, ui });
    }

    // Let the actual bank solver launch and land the soap; no hand-animation or state teleport during this trajectory.
    if (fullScenes) {
    await page.evaluate(() => window.__soapAudit.set('bank-climb')); await page.waitForTimeout(900);
    await page.evaluate(() => { window.__soapAudit.record(); window.__soapAudit.resume(); });
    await page.waitForFunction(() => { const b=JSON.parse(window.render_game_to_text()).ball; return b.soap?.airborne && b.y>3; }, {}, { timeout: 30000 });
    await capture(page, `${spec.name}-live-bank-flight`);
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).ball.soap?.landings > 0, {}, { timeout: 30000 });
    await capture(page, `${spec.name}-live-bank-landing`);
    const flight = await page.evaluate(() => { window.__soapAudit.freeze(); return window.__soapAudit.stop(); });
    check(flight.some(s => s.state.ball.soap?.launches > 0), 'Real bank motion produces a launch', { case: spec.name });
    check(flight.some(s => s.state.ball.soap?.landings > 0), 'Real airborne soap returns to the surface', { case: spec.name });
    const airborne = flight.filter(s => s.state.ball.soap?.airborne);
    const airtime = airborne.length > 1 ? airborne.at(-1).state.arenaState.time - airborne[0].state.arenaState.time : 0;
    const clearance = Math.max(0, ...flight.map(s => s.state.ball.y - 1));
    check(airtime > .25 && clearance > .5, 'Bank airtime and clearance are visible, not a one-frame launch counter', { case: spec.name, airtime, clearance });
    assessCamera(flight, { case: spec.name, phase: 'bank-flight' });
    result.flight = flight;
    }

    // Score by travelling into the drain, then follow presentation age through the actual return to play.
    await page.evaluate(() => window.__soapAudit.set('drain-entry')); await page.waitForTimeout(900);
    const before = await snapshot(page);
    await page.evaluate(() => { window.__soapAudit.record(); window.__soapAudit.holdAt(.1); });
    const scoreKey = process.env.SOAP_OPPOSITE === '1' ? 'scoreB' : 'scoreA';
    await page.waitForFunction(({key,score}) => JSON.parse(window.render_game_to_text())[key] === score + 1, { key: scoreKey, score: before.state[scoreKey] }, { timeout: 30000 });
    for (const age of [.1, .7, 1.4, 2.2]) {
      if (age !== .1) await page.evaluate(age => window.__soapAudit.holdAt(age), age);
      // Deterministic simulation holds keep screenshot encoding from missing a short phase.
      // The winning goal below runs continuously with no fixture holds.
      await page.waitForFunction(age => { const g = JSON.parse(window.render_game_to_text()).goalCelebration; return window.__soapAuditFreeze && g && g.age >= age; }, age, { timeout: 30000 });
      const phase = await snapshot(page), drain = phase.drains[process.env.SOAP_OPPOSITE === '1' ? 1 : 0];
      check(drain.x>0&&drain.y>0&&drain.x<spec.width&&drain.y<spec.height, 'Scoring drain stays in view throughout celebration', {case:spec.name,age,drain});
      check(controls.every(c=>drain.x<c.x-6||drain.x>c.right+6||drain.y<c.y-6||drain.y>c.bottom+6), 'Scoring drain remains clear of gameplay controls', {case:spec.name,age,drain});
      await capture(page, `${spec.name}-goal-${String(age).replace('.', '-')}`);
      if (spec.name === 'desktop' && age === .7) {
        await page.locator('#menuBtn').click();
        await page.evaluate(() => window.__soapAudit.resume());
        const paused = await snapshot(page); await page.waitForTimeout(200);
        const still = await snapshot(page);
        check(still.state.paused && still.state.goalCelebration?.age === paused.state.goalCelebration?.age, 'Pausing freezes the celebration clock', { case: spec.name });
        check(distance(still.camera.position, paused.camera.position) < .01, 'Pausing freezes the camera composition', { case: spec.name });
        check(distance(still.mesh.position, paused.mesh.position) < .001 && distance(still.mesh.quaternion, paused.mesh.quaternion) < .001, 'Pausing freezes the visible soap pose', { case: spec.name });
        result.pause = { before: paused, after: still };
        await page.evaluate(() => window.__soapAudit.freeze());
        await page.locator('#resumeBtn').click();
      }
    }
    await page.evaluate(() => window.__soapAudit.resume());
    await page.waitForFunction(epoch => { const s = JSON.parse(window.render_game_to_text()); return s.mode === 'play' && !s.locked && s.roundEpoch > epoch; }, before.state.roundEpoch, { timeout: 30000 });
    await capture(page, `${spec.name}-goal-return`); await page.waitForTimeout(700);
    const goal = await page.evaluate(() => { window.__soapAudit.freeze(); return window.__soapAudit.stop(); });
    const celebrating = goal.filter(s => s.state.goalCelebration && s.state.locked);
    check(celebrating.length > 3, 'Goal has an observable presentation timeline', { case: spec.name });
    check(goal.at(-1).state[scoreKey] === before.state[scoreKey] + 1 && goal.every(s => s.state[scoreKey] <= before.state[scoreKey] + 1), 'Drain entry scores exactly once', { case: spec.name });
    if (celebrating.length > 3) {
      const a = celebrating[0], z = celebrating.at(-1);
      check(z.state.goalCelebration.age > a.state.goalCelebration.age + 1.5, 'Celebration clock advances while scoring is locked', { case: spec.name });
      check(Math.hypot(z.state.P.x - a.state.P.x, z.state.P.z - a.state.P.z) + Math.hypot(z.state.B.x - a.state.B.x, z.state.B.z - a.state.B.z) > .1, 'Cars coast during the goal instead of freezing', { case: spec.name });
      check(celebrating.some(s => distance(s.mesh.position, a.mesh.position) > 1), 'Soap visibly travels into the drain during celebration', { case: spec.name });
    }
    assessCamera(goal, { case: spec.name, phase: 'goal-and-return' });
    check(goal.at(-1).state.mode === 'play' && !goal.at(-1).state.locked, 'Goal returns to active play', { case: spec.name });
    result.goal = goal;
    const shareCard = await page.evaluate(() => window.__soapAudit.shareCard());
    check(!!shareCard && shareCard.colors > 30 && shareCard.opaque > 500, 'Goal share card contains rendered scene detail below the title', { case: spec.name, colors: shareCard?.colors, opaque: shareCard?.opaque });
    if (shareCard) { await fs.writeFile(`${out}/${spec.name}-share-card.png`, Buffer.from(shareCard.data.split(',')[1], 'base64')); result.shareCard = { colors: shareCard.colors, opaque: shareCard.opaque }; }
    if (spec.name === 'desktop' && process.env.SOAP_OPPOSITE !== '1') {
      // Real-time, uninterrupted winning goal: a third score must not skip the drain show.
      await page.evaluate(() => { window.__soapAudit.set('drain-entry'); window.__soapAudit.winningGoal(); });
      await page.waitForTimeout(800);
      await page.evaluate(() => { window.__soapAudit.record(); window.__soapAudit.resume(); });
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'results', {}, { timeout: 30000 });
      const winning = await page.evaluate(() => { window.__soapAudit.freeze(); return window.__soapAudit.stop(); });
      result.winning = winning;
      const show = winning.filter(s => s.state.goalCelebration && s.state.mode === 'play');
      check(show.length > 3 && show.at(-1).state.goalCelebration.age > 2.5, 'Winning goal completes its celebration before results', { case: spec.name, lastAge: show.at(-1)?.state.goalCelebration.age });
      check(winning.at(-1).state.scoreA === 3 && winning.every(s => s.state.scoreA <= 3), 'Winning drain capture scores only once', { case: spec.name });
      assessCamera(winning, { case: spec.name, phase: 'continuous-winning-goal' });
      await capture(page, `${spec.name}-winning-results`);
    }
    await fs.writeFile(`${out}/results.json`, JSON.stringify({ url, checks, errors, failures }, null, 2));
    await context.close(); console.log('COMPLETE', spec.name, `${failures.filter(f=>f.case===spec.name).length} failures`);
  }
  assert.deepEqual(errors, [], 'Browser must not throw or log caught render exceptions');
  assert.deepEqual(failures, [], 'Soap/camera audit failed; inspect results.json');
} catch (error) {
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ url, checks, errors, failures, exception: error.message }, null, 2));
  for (const [i, context] of browser.contexts().entries()) for (const page of context.pages()) await page.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
  throw error;
} finally { await browser.close(); }
