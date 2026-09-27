import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const url=process.env.GAME_URL||'http://127.0.0.1:5198/',out=process.env.QA_OUT||'output/sink-browser';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errors=[],checks=[],moduleCache=new Map();
try{
for(const gfx of ['pixel','3d'])for(const [i,car] of ['cybertruck','model3','cybercab','semi'].entries()){
 if(process.env.SINK_CASE && process.env.SINK_CASE!==gfx+'-'+car)continue;
 const viewport=[{width:1280,height:800},{width:390,height:844},{width:844,height:390},{width:320,height:568}][i];
 const c=await browser.newContext({viewport});await c.addInitScript(()=>{localStorage.setItem('gl_seen_how','1');localStorage.setItem('gl_mute_music','1');localStorage.setItem('gl_mute_sfx','1');});
 const p=await c.newPage();
 await p.route('https://cdn.jsdelivr.net/**',async r=>{const u=r.request().url();if(!moduleCache.has(u)){const response=await r.fetch();moduleCache.set(u,{body:await response.body(),headers:response.headers(),status:response.status()});}await r.fulfill(moduleCache.get(u));});
 p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>!!window.render_game_to_text,{},{timeout:60000});
 await p.locator(`[data-id="${car}"]`).click();await p.locator('#toMatchup').click();await p.locator('#arenaSelect').selectOption('sink');await p.locator(gfx==='pixel'?'#gfxPixel':'#gfx3d').click();await p.locator('#go').click();
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
 await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.arenaState.hazard&&!s.arenaState.hazard.fired;});
 await p.screenshot({path:`${out}/${gfx}-${car}-warning.png`});
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).arenaState.hazard?.fired);
 await p.screenshot({path:`${out}/${gfx}-${car}-impact.png`});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const s=await p.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(s.mapMode,'sink');assert.deepEqual(s.diagnostics,{});
 if(i===0){await p.waitForFunction(()=>{const h=JSON.parse(window.render_game_to_text()).arenaState.hazard;return h?.kind==='lightning'&&h.fired;},{},{timeout:60000});await p.screenshot({path:`${out}/${gfx}-lightning.png`});}
 await p.locator('#menuBtn').click();const t=(await p.evaluate(()=>JSON.parse(window.render_game_to_text()))).arenaState.time;await p.waitForTimeout(100);assert.equal((await p.evaluate(()=>JSON.parse(window.render_game_to_text()))).arenaState.time,t);
 checks.push({gfx,car,viewport});console.log('PASS',gfx,car);await c.close();
}
assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
