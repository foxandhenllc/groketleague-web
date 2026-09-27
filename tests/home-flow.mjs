import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.GAME_URL||'http://127.0.0.1:5198/',local=['localhost','127.0.0.1'].includes(new URL(url).hostname);
const out=process.env.QA_OUT||'output/home-flow';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
try{
  for(const [name,width,height] of [['desktop',1440,900],['phone',390,844],['small-phone',320,568],['landscape',844,390],['small-landscape',568,320]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900});
    await context.addInitScript(()=>{localStorage.setItem('gl_gfx','pixel');localStorage.setItem('gl_mute_music','1');localStorage.setItem('gl_mute_sfx','1');});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    if(local){await page.route('**/api/presence',r=>r.fulfill({contentType:'application/json',body:'{"online":1,"playing":0}'}));await page.route('**/_vercel/insights/script.js',r=>r.fulfill({body:''}));}
    await page.goto(url);await page.waitForFunction(()=>!!window.render_game_to_text,{}, {timeout:60000});
    await page.locator('#homeArenaImage').evaluate(img=>img.decode());
    assert.equal((await state(page)).mapMode,'sink');assert.equal((await state(page)).gfxMode,'3d');
    assert.equal(await page.locator('select').count(),0);assert.equal(await page.locator('#howLayer').isVisible(),false);
    const layout=await page.evaluate(()=>{const r=document.querySelector('#playNow').getBoundingClientRect(),panel=document.querySelector('#garageShell').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,panelBottom:panel.bottom,play:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},images:[...document.querySelectorAll('#stepVehicle img')].every(i=>i.complete&&i.naturalWidth>0)};});
    assert.ok(layout.scroll<=width);assert.ok(layout.images);
    assert.ok(layout.play.y>=0&&layout.play.bottom<=height,'Primary play action must be visible without scrolling');
    assert.ok(layout.play.bottom<=layout.panelBottom-8,'Primary play action must not be clipped by the panel');
    await page.screenshot({path:`${out}/${name}-home.png`});
    if(name==='desktop'){
      await page.locator('[data-id="model3"]').focus();await page.keyboard.press('Space');
      assert.equal(await page.locator('[data-id="model3"]').getAttribute('aria-pressed'),'true');
      await page.locator('#playNow').focus();await page.keyboard.press('Enter');
    }else{await page.locator('[data-id="model3"]').click();await page.locator('#playNow').click();}
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
    const play=await state(page);assert.equal(play.P.kind,'model3');assert.equal(play.gfxMode,'3d');assert.equal(play.mapMode,'sink');assert.ok(play.ball.soap);
    await page.screenshot({path:`${out}/${name}-play.png`});
    await page.locator('#menuBtn').click();await page.locator('#newGameBtn').click();
    assert.equal(await page.locator('#stepVehicle').isVisible(),true);assert.equal(await page.locator('#stepMatchup').isVisible(),false);
    await page.locator('#toMatchup').click();await page.screenshot({path:`${out}/${name}-options.png`});
    await page.locator('[data-arena="classic"]').click();await page.locator('#gfxPixel').click();await page.locator('[data-light="night"]').click();
    assert.equal(await page.locator('[data-arena="classic"]').getAttribute('aria-pressed'),'true');
    await page.locator('#backVehicle').click();assert.match(await page.locator('#playNow').innerText(),/Stadium/);
    assert.match(await page.locator('#homeModeTag').textContent(),/2D.*NIGHT/);
    if(name==='desktop'){
      await page.locator('#playNow').click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
      const classic=await state(page);assert.equal(classic.mapMode,'night');assert.equal(classic.gfxMode,'pixel');
      await page.locator('#menuBtn').click();await page.locator('#newGameBtn').click();
      await page.locator('#howOpen').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#howLayer').isVisible(),true);
      await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'howGotIt');
      await page.keyboard.press('Escape');assert.equal(await page.locator('#howLayer').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'howOpen');
      await page.locator('#settingsToggle').click();assert.equal(await page.locator('#garageSettings').isVisible(),true);await page.locator('#settingsToggle').click();
      await page.locator('#specsToggle').click();assert.equal(await page.locator('#inspStats').isVisible(),true);
      await page.goto(url+'?room=ABCD');await page.waitForFunction(()=>!!window.render_game_to_text);
      assert.equal(await page.locator('#privatePane').isVisible(),true);assert.equal(await page.locator('#roomCodeIn').inputValue(),'ABCD');
      assert.equal((await state(page)).gfxMode,'3d');assert.equal((await state(page)).mapMode,'sink');
      await page.screenshot({path:`${out}/invite-ready.png`});
    }
    checks.push({name,layout});console.log('PASS',name);await context.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({url,checks,errors},null,2));
}catch(e){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${out}/failure.png`}).catch(()=>{});console.error(errors);throw e;}finally{await browser.close();}
