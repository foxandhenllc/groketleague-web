import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL||'http://127.0.0.1:5198/';
const out=process.env.QA_OUT||'output/skills-browser';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];
try {
for(const gfx of ['pixel','3d']) for(const [i,car] of ['cybertruck','model3','cybercab','semi'].entries()) {
 const viewport=[{width:1280,height:800},{width:390,height:844},{width:844,height:390},{width:320,height:568}][i];
 const context=await browser.newContext({viewport});await context.addInitScript(()=>{localStorage.setItem('gl_seen_how','1');localStorage.setItem('gl_mute_music','1');});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>!!window.render_game_to_text);
 await p.locator(`[data-id="${car}"]`).click();await p.locator('#toMatchup').click();await p.locator(gfx==='pixel'?'#gfxPixel':'#gfx3d').click();await p.locator('#go').click();
 await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
 await p.locator('[data-tactic="defend"]').click();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).P.tactic==='defend');
 await p.keyboard.press('KeyA');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).P.tactic==='attack');
 await p.locator('#specialBtn').click();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).P.move?.cooldown>0);
 await p.screenshot({path:`${out}/${gfx}-${car}.png`});
 const layout=await p.evaluate(()=>{
  const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
  return {strip:rect('#skillControls'),boost:rect('#boostBtn'),menu:rect('#menuBtn'),field:rect('#pixelView'),width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth};
 });
 const separate=(a,b)=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y;
 assert.ok(layout.strip.x>=0&&layout.strip.right<=viewport.width&&layout.strip.bottom<=viewport.height);
 assert.ok(separate(layout.strip,layout.boost));assert.ok(separate(layout.strip,layout.menu));
 if(gfx==='pixel')assert.ok(separate(layout.strip,layout.field));
 assert.ok(layout.scroll<=viewport.width);
 await p.keyboard.press('KeyS');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).P.tactic==='auto');
 checks.push({gfx,car,viewport,layout});console.log('PASS',gfx,car);await context.close();
}
assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
