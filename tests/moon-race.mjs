// Browser-only local injection advances the real race/camera; no mutable QA hooks ship.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=process.env.GAME_URL||'http://127.0.0.1:5198/';
const local=['localhost','127.0.0.1'].includes(new URL(root).hostname);
const out=process.env.QA_OUT||'output/playwright/moon';await fs.mkdir(out,{recursive:true});
const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const errors=[],checks=[];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const cases=[['desktop',1440,900,'comet'],['phone',390,844,'mops'],['small-phone',320,568,'budget'],['landscape',844,390,'gators'],['small-landscape',568,320,'comet'],['reduced-motion',1280,800,'mops'],['desktop-boost',1440,900,'budget'],['phone-boost',390,844,'gators']];
try{
  for(const [name,width,height,team] of (local?cases:cases.slice(0,1))){
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:name==='reduced-motion'?'reduce':'no-preference'});
    await context.addInitScript(()=>{localStorage.setItem('gl_mute_sfx','1');localStorage.setItem('gl_mute_music','1');});
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    if(local)await p.route('**/moon.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
window.__moonQA={advance(seconds){const samples=[];const render=view.renderer.render;view.renderer.render=()=>{};
try{for(let i=0;i<Math.round(seconds*60);i++){
if(mode==='racing'&&!paused){fixed.advance(1/60);if(race.phase==='results')showResults();}
if(i%6===0)updateHud();if(celebration>0&&!paused)celebration+=1/60;
renderState=view.update(race,{dt:1/60,cameraMode,focus:focusId(),reducedMotion:reducedMotion.matches,celebration:celebration<7?celebration:0});
if(i%60===0)samples.push({time:race.time,...renderState});
}updateHud();}finally{view.renderer.render=render;}view.renderer.render(view.scene,view.camera);last=performance.now();return samples;},
preview(){view.update(race,{dt:1/60,cameraMode:'showcase',focus:focusId()});return view.renderer.domElement.toDataURL('image/webp',.9);}};
`});});
    await p.goto(new URL('moon.html?seed=browser-'+name,root).href);await p.waitForFunction(()=>!!window.render_game_to_text);assert.equal((await state(p)).error,'');
    await p.locator('[data-team="'+team+'"]').click();assert.equal(await p.locator('[data-team="'+team+'"]').getAttribute('aria-pressed'),'true');
    if(name.includes('boost'))await p.locator('#boostMode').click();
    await p.screenshot({path:`${out}/${name}-setup.png`});
    const setup=await p.locator('#startRace').boundingBox();checks.push({name,setupButton:setup});
    assert.ok(setup.y>=0&&setup.y+setup.height<=height-10,'Start action is visible without scrolling');
    assert.ok(await p.locator('#startRace').isEnabled());assert.equal(await p.locator('select').count(),0);
    if(name==='desktop'&&local){const image=await p.evaluate(()=>window.__moonQA.preview());await fs.writeFile('assets/menu/moon.webp',Buffer.from(image.split(',')[1],'base64'));}
    await p.locator('#startRace').click();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='racing');
    if(local)await p.evaluate(()=>window.__moonQA.advance(9));else await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).time>5,null,{timeout:30000});
    await p.screenshot({path:`${out}/${name}-pack.png`});
    await p.locator('#raceMenu').click();const frozen=(await state(p)).time;await p.waitForTimeout(250);assert.equal((await state(p)).time,frozen);await p.keyboard.press('Escape');assert.equal((await state(p)).paused,false);
    if(name.includes('boost')){
      await p.keyboard.down('Space');await p.keyboard.down('Shift');if(local)await p.evaluate(()=>window.__moonQA.advance(.5));
      assert.equal((await state(p)).cars.find(c=>c.team===team).boosting,true);
      await p.keyboard.up('Space');if(local)await p.evaluate(()=>window.__moonQA.advance(.1));assert.equal((await state(p)).cars.find(c=>c.team===team).boosting,true);
      await p.keyboard.up('Shift');if(local)await p.evaluate(()=>window.__moonQA.advance(.1));assert.equal((await state(p)).cars.find(c=>c.team===team).boosting,false);
    }
    const samples=[];
    if(local){
      samples.push(...await p.evaluate(()=>window.__moonQA.advance(9)));await p.screenshot({path:`${out}/${name}-skyway.png`});
      for(const camera of ['leader','track','team']){await p.locator('[data-camera="'+camera+'"]').click();samples.push(...await p.evaluate(()=>window.__moonQA.advance(4)));await p.screenshot({path:`${out}/${name}-${camera}.png`});}
      for(const stop of [45,65,80,110]){const t=(await state(p)).time;samples.push(...await p.evaluate(s=>window.__moonQA.advance(s),Math.max(0,stop-t)));await p.screenshot({path:`${out}/${name}-t${stop}.png`});}
    }
    else await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='results',null,{timeout:180000});
    let final=await state(p);assert.equal(final.mode,'results');assert.equal(final.heat,1);assert.ok(final.cars.every(c=>c.finishTime!==null));assert.equal(Object.values(final.cup).reduce((a,b)=>a+b,0),58);
    await p.screenshot({path:`${out}/${name}-results.png`});
    if(local){
      for(let h=2;h<=3;h++){await p.locator('#nextHeat').click();await p.evaluate(()=>window.__moonQA.advance(140));final=await state(p);assert.equal(final.heat,h);assert.equal(final.mode,'results');assert.equal(Object.values(final.cup).reduce((a,b)=>a+b,0),58*h);}
      await p.screenshot({path:`${out}/${name}-cup.png`});await p.locator('#nextHeat').click();assert.equal((await state(p)).heat,1);assert.equal(Object.values((await state(p)).cup).reduce((a,b)=>a+b,0),0);
      await p.locator('#raceMenu').click();await p.locator('#changeTeam').click();assert.equal((await state(p)).mode,'setup');assert.equal((await state(p)).team,team);
    }
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    checks.at(-1).final=final;checks.at(-1).cameraSamples=samples;
    assert.ok(samples.every(s=>s.position.every(Number.isFinite)&&s.target.every(Number.isFinite)));
    console.log('PASS',name,'three-heat cup, controls, cameras, results');await context.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({root,checks,errors},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${out}/failure.png`}).catch(()=>{});console.error(errors);throw error;}finally{await browser.close();}
