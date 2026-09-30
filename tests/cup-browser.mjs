import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.GAME_URL||'http://127.0.0.1:5198/', local=['localhost','127.0.0.1'].includes(new URL(url).hostname);
const natural=process.env.CUP_NATURAL==='1', out=process.env.QA_OUT||'output/fsd-cup';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[],checks=[]; const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const until=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:30000});
const cases=natural?[['natural',1280,900,'model3']]:[['desktop',1440,900,'cybertruck'],['phone',390,844,'model3'],['small-phone',320,568,'semi'],['landscape',844,390,'cybercab'],['small-landscape',568,320,'model3'],['reduced-motion',390,844,'cybercab']];
try{
 for(const [name,width,height,car] of cases){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,reducedMotion:name==='reduced-motion'?'reduce':'no-preference'});
  await context.addInitScript(()=>{localStorage.setItem('gl_mute_music','1');localStorage.setItem('gl_mute_sfx','1');});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  if(local){
   await page.route('**/api/presence',r=>r.fulfill({contentType:'application/json',body:'{"online":1,"playing":0}'}));
   await page.route('**/_vercel/insights/script.js',r=>r.fulfill({body:''}));
   if(!natural) await page.route('**/main.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+`
    // These fixtures exist only in the intercepted local response, never in shipped code.
    window.__cupFixture={
     result:(a,b)=>{scoreA=a;scoreB=b;timeLeft=.001;},
     goal:()=>onGoal('A'),
     repeat:()=>finishCupHeat(),
     hasDecal:()=>!!playerMesh.getObjectByName('earned-decal'),
     opening:()=>{Object.assign(P,{x:0,z:8,yaw:0,vx:0,vz:-3});Object.assign(B,{x:8,z:-10,vx:0,vz:0});Object.assign(ball,{x:0,z:0,vx:0,vz:0});}
    };
   `});});
  }
  await page.goto(url);await until(page,()=>!!window.render_game_to_text);
  await page.evaluate(()=>document.fonts.ready);
  await page.locator(`[data-id="${car}"]`).click();await page.locator('#cupLaunch').click();
  const draft=await state(page); assert.equal(draft.cup.rival,null); assert.equal(draft.cup.allowances,null);
  if(!natural)await page.screenshot({path:`${out}/${name}-draft.png`});
  await page.locator('[data-directive="attack"]').click();await until(page,()=>JSON.parse(window.render_game_to_text()).cup.phase==='heat');
  await until(page,()=>JSON.parse(window.render_game_to_text()).timeLeft<59);
  const start=await state(page);assert.equal(start.mapMode,'day');assert.equal(start.gfxMode,'pixel');assert.equal(start.coaches.B.type,'cpu');
  assert.equal(start.P.kind,car);assert.ok(start.timeLeft<=60&&start.timeLeft>55);
  const layout=await page.evaluate(()=>{const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return {scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,field:rect('#pixelView'),coach:rect('#cupHud'),menu:rect('#menuBtn'),score:rect('#topbar'),buttons:[...document.querySelectorAll('#cupActions button')].map(b=>b.getBoundingClientRect().height)};});
  const separate=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
  assert.ok(layout.scroll<=width); assert.ok(layout.coach.x>=0&&layout.coach.right<=width&&layout.coach.bottom<=height);
  assert.ok(separate(layout.field,layout.coach),'coach controls must stay outside field');
  assert.ok(separate(layout.score,layout.menu),'menu must not cover scoreboard');assert.ok(layout.buttons.every(h=>h>=44));
  await page.keyboard.press('KeyD');assert.equal((await state(page)).P.tactic,'attack','directive stays fixed during heat');
  const observation=await page.evaluate(()=>JSON.parse(window.coach_observation_to_text()));
  assert.equal(JSON.stringify(observation).includes('_ai'),false);assert.equal(JSON.stringify(observation).includes('matchSeed'),false);
  if(natural){
   const deadline=Date.now()+360000; let lastPhase='',lastLog=-1;const trace=[];
   while(Date.now()<deadline){
    const s=await state(page),key=`${s.cup.heat}:${s.cup.phase}`;
    assert.ok(s.cup.phase!=='heat'||s.coaches?.A.charges>=0);
    if(key!==lastPhase){console.log('NATURAL',key,s.scoreA,s.scoreB);lastPhase=key;await page.screenshot({path:`${out}/natural-${s.cup.heat}-${s.cup.phase}.png`});}
    if(s.cup.phase==='complete'){checks.push({name,layout,heats:s.cup.heats,standings:s.cup.standings,profile:s.progression});break;}
    if(s.cup.phase==='summary')await page.locator('[data-cup="next"]').click();
    if(s.cup.phase==='draft')await page.locator(`[data-directive="${['attack','auto','defend'][s.cup.heat-1]}"]`).click();
    if(s.cup.phase==='heat'){
     const mark=s.cup.heat*100+Math.floor(s.timeLeft/15);
     if(mark!==lastLog){console.log('CLOCK',s.cup.heat,Math.ceil(s.timeLeft),'charges',s.coaches.A.charges,'score',s.scoreA,s.scoreB);lastLog=mark;}
     if(s.coaches.A.offer?.legal.includes('boost')&&!s.coaches.A.reserved)await page.keyboard.press('Space');
     trace.push({heat:s.cup.heat,timeLeft:s.timeLeft,score:[s.scoreA,s.scoreB],own:s.coaches.A,opponent:s.coaches.B});
    }
    await page.waitForTimeout(350);
   }
   const result=await state(page);assert.equal(result.cup.phase,'complete');assert.equal(result.progression.cups,1);assert.ok(result.progression.unlocked.includes('beta'));
   await fs.writeFile(`${out}/natural-trace.json`,JSON.stringify(trace,null,2));
  }else{
   await page.evaluate(()=>window.__cupFixture.opening());
   await until(page,()=>!!JSON.parse(window.render_game_to_text()).coaches.A.offer);
   const allowance=(await state(page)).coaches.A.charges;
   await page.keyboard.press('Space');
   await until(page,()=>['armed','activated','cancelled'].includes(JSON.parse(window.render_game_to_text()).coaches.A.status));
   const armed=await state(page);assert.ok(armed.coaches.A.charges===allowance||armed.coaches.A.charges===allowance-1);
   await until(page,()=>!JSON.parse(window.render_game_to_text()).coaches.A.reserved);
   const spent=(await state(page)).coaches.A.charges;
   assert.ok(spent>=allowance-1);assert.ok(spent<=allowance);
   await page.locator('#menuBtn').click();const paused=await state(page);await page.waitForTimeout(250);
   assert.equal((await state(page)).timeLeft,paused.timeLeft);await page.locator('#resumeBtn').click();
   await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}-play.png`});
   await page.evaluate(()=>window.__cupFixture.goal());await until(page,()=>!JSON.parse(window.render_game_to_text()).locked);
   assert.equal((await state(page)).coaches.A.charges,spent,'goal does not replenish charges');
   for(let heat=1;heat<=3;heat++){
    await page.evaluate(([a,b])=>window.__cupFixture.result(a,b),heat===2?[0,0]:[2,1]);
    await until(page,()=>['summary','complete'].includes(JSON.parse(window.render_game_to_text()).cup.phase));
    if(heat<3){await page.locator('[data-cup="next"]').click();await page.locator('[data-directive="auto"]').click();await until(page,()=>JSON.parse(window.render_game_to_text()).cup.phase==='heat');}
   }
   const result=await state(page);assert.equal(result.cup.phase,'complete');assert.equal(result.cup.standings.a,7);assert.equal(result.progression.cups,1);assert.equal(result.progression.claims,75);
   await page.evaluate(()=>window.__cupFixture.repeat());assert.equal((await state(page)).progression.claims,75);
   await page.locator('[data-equip="beta"]').first().click();assert.equal((await state(page)).progression.equipped,'beta');
   await page.screenshot({path:`${out}/${name}-reward.png`});
   await page.locator('[data-cup="exit"]').click();await page.locator('#collectionToggle').click();
   assert.equal(await page.locator('.collectionItem[data-equip="beta"]').getAttribute('aria-pressed'),'true');
   await page.screenshot({path:`${out}/${name}-collection.png`});
   await page.reload();await until(page,()=>!!window.render_game_to_text);assert.equal((await state(page)).progression.equipped,'beta');assert.equal((await state(page)).progression.cups,1);
   await page.locator('#cupLaunch').click();await page.locator('[data-cup="exit"]').click();assert.equal((await state(page)).progression.cups,1,'abandoning a cup grants nothing');
   if(name==='desktop'){
    await page.locator('#toMatchup').click();await page.locator('[data-arena="classic"]').click();await page.locator('#gfx3d').click();await page.locator('#go').click();
    await until(page,()=>JSON.parse(window.render_game_to_text()).mode==='play');assert.equal(await page.evaluate(()=>window.__cupFixture.hasDecal()),true);
    await page.screenshot({path:`${out}/earned-decal-3d.png`});
   }
   checks.push({name,layout,allowance,spent,result:result.cup.standings});console.log('PASS',name);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/${natural?'natural':'browser'}-results.json`,JSON.stringify({url,natural,checks,errors},null,2));
}catch(e){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${out}/failure.png`}).catch(()=>{});console.error(errors);throw e;}finally{await browser.close();}
