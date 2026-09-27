import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url=process.env.GAME_URL||'http://127.0.0.1:5198/';
const local=['localhost','127.0.0.1'].includes(new URL(url).hostname);
const out=process.env.QA_OUT||'output/quick-chat';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[],checks=[];
const pass=label=>{checks.push(label);console.log('PASS',label);};
const messages=p=>p.locator('#matchChat .msg').allTextContents();
const visible=p=>p.locator('#qcMenu').isVisible();
const state=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const playing=p=>p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play',{}, {timeout:30000});
async function page({width=1440,height=900,path=''}={}){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900});
  await context.addInitScript(()=>{localStorage.setItem('gl_mute_music','1');localStorage.setItem('gl_mute_sfx','1');});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(local){await p.route('**/api/presence',r=>r.fulfill({contentType:'application/json',body:'{"online":2,"playing":0}'}));await p.route('**/_vercel/insights/script.js',r=>r.fulfill({body:''}));}
  await p.goto(url+path);await p.waitForFunction(()=>!!window.render_game_to_text,{}, {timeout:60000});return p;
}
async function sent(p,expected){
  assert.equal(await p.locator('#matchChat .msg').last().textContent(),expected);
  assert.equal(await visible(p),false);
}
async function peerReceived(p,expected){await p.waitForFunction(text=>document.querySelector('#matchChat .chatline:last-child .msg')?.textContent===text,expected);}

try{
  const p=await page();
  await p.keyboard.press('1');assert.equal(await visible(p),false);
  await p.locator('#playNow').click();await playing(p);
  const seen=[];
  for(let category=1;category<=4;category++){
    const count=category===4?7:4;
    for(let line=1;line<=count;line++){
      const before=await messages(p);
      await p.keyboard.press(String(category));
      assert.equal(await visible(p),true);assert.deepEqual(await messages(p),before,'Selecting a category must not send a message');
      assert.equal(await p.locator('#qcMenu [data-chat]').count(),count);
      const expected=(await p.locator(`#qcMenu [data-qc-key="${line}"]`).textContent()).replace(/^\d+ - /,'');
      if(category===4&&line===7)await p.screenshot({path:`${out}/desktop-potpourri.png`});
      await p.keyboard.press(String(line));await sent(p,expected);
      assert.deepEqual(await messages(p),[...before,expected].slice(-6),'One key sends exactly one current-folder message');seen.push(expected);
    }
  }
  assert.equal(new Set(seen).size,19);assert.equal(seen[4],'the ball is a psyop');assert.equal(seen[18],"Where'd u learn to drive, @threads?");
  pass('All 19 messages use category then message numbers, including Potpourri 5-7');

  await p.locator('#qcToggle').click();
  assert.deepEqual(await p.locator('#qcMenu [data-cat]').allTextContents(),['1 - INSULTS','2 - MORE INSULTS','3 - SOME INSULTS','4 - POTPOURRI']);
  await p.screenshot({path:`${out}/desktop-categories.png`});
  await p.keyboard.press('9');assert.equal(await p.locator('#qcMenu [data-cat]').count(),4);
  await p.keyboard.press('3');await p.keyboard.press('0');assert.equal(await p.locator('#qcMenu [data-cat]').count(),4);
  await p.keyboard.press('4');await p.keyboard.press('Backspace');assert.equal(await p.locator('#qcMenu [data-cat]').count(),4);
  await p.keyboard.press('Backspace');assert.equal(await visible(p),false);
  await p.keyboard.press('Numpad4');await p.keyboard.press('Numpad7');await sent(p,seen[18]);
  await p.keyboard.press('2');const invalidBefore=await messages(p);await p.keyboard.press('7');assert.deepEqual(await messages(p),invalidBefore);assert.equal(await visible(p),true);
  await p.keyboard.press('Escape');assert.equal(await visible(p),false);assert.equal((await state(p)).paused,false);
  const repeatBefore=await messages(p);await p.keyboard.down('2');await p.keyboard.down('2');await p.keyboard.up('2');
  assert.deepEqual(await messages(p),repeatBefore,'Holding a category key must not auto-send');
  await p.keyboard.press('2');await sent(p,seen[5]);
  await p.keyboard.press('Control+1');assert.equal(await visible(p),false);
  await p.evaluate(()=>{const input=document.createElement('input');input.id='qaChatInput';document.body.appendChild(input);input.focus();});
  await p.keyboard.press('1');await p.keyboard.press('2');assert.equal(await p.locator('#qaChatInput').inputValue(),'12');assert.equal(await visible(p),false);
  await p.locator('#qaChatInput').evaluate(el=>el.remove());
  await p.keyboard.press('1');await p.locator('#menuBtn').click();assert.equal(await visible(p),false);
  await p.keyboard.press('1');assert.equal(await visible(p),false);await p.locator('#resumeBtn').click();
  await p.keyboard.press('4');assert.equal(await p.locator('#qcMenu [data-chat]').count(),7);await p.keyboard.press('Escape');
  pass('Root labels, numpad, back, invalid keys, held keys, browser shortcuts, typing and pause guards');
  await p.locator('#menuBtn').click();await p.locator('#newGameBtn').click();
  await p.locator('#toMatchup').click();await p.locator('#gfxPixel').click();await p.locator('#go').click();await playing(p);
  assert.equal(await visible(p),false);await p.keyboard.press('3');await p.screenshot({path:`${out}/2d-folder.png`});await p.keyboard.press('4');await sent(p,seen[11]);
  pass('Fresh matches reset chat navigation; 2D uses the same folder shortcuts');
  await p.context().close();

  for(const [name,width,height] of [['phone',390,844],['landscape',568,320]]){
    const touch=await page({width,height});await touch.locator('#playNow').tap();await playing(touch);
    const boostBefore=await touch.locator('#boostBtn').boundingBox(),toggleBefore=await touch.locator('#qcToggle').boundingBox();
    await touch.locator('#qcToggle').tap();await touch.locator('[data-cat="pot"]').tap();
    await touch.screenshot({path:`${out}/${name}-potpourri.png`});
    const bounds=await touch.locator('#qcMenu').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=height,'The full folder must stay inside the viewport');
    assert.deepEqual(await touch.locator('#boostBtn').boundingBox(),boostBefore,'Opening chat must not move boost');
    assert.deepEqual(await touch.locator('#qcToggle').boundingBox(),toggleBefore,'Opening a folder must not move the chat toggle');
    await touch.locator('[data-qc-key="7"]').tap();await sent(touch,seen[18]);
    pass(`${name}: numbered folder remains readable and touch still sends the selected message`);await touch.context().close();
  }

  const host=await page();await host.locator('#toMatchup').click();await host.locator('#modePrivate').click();await host.locator('#netCreate').click();
  await host.waitForFunction(()=>/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/.test(document.querySelector('#roomCodeOut').textContent),{}, {timeout:30000});
  const code=await host.locator('#roomCodeOut').textContent(),guest=await page({path:'?room='+code});
  await guest.locator('#netJoin').click();await Promise.all([playing(host),playing(guest)]);
  await host.keyboard.press('2');await host.keyboard.press('1');await sent(host,seen[4]);await peerReceived(guest,seen[4]);
  await guest.keyboard.press('4');await guest.keyboard.press('7');await sent(guest,seen[18]);await peerReceived(host,seen[18]);
  assert.deepEqual(await messages(host),[seen[4],seen[18]]);assert.deepEqual(await messages(guest),[seen[4],seen[18]]);
  await guest.locator('#menuBtn').click();await guest.keyboard.press('1');await guest.keyboard.press('1');
  assert.equal(await visible(guest),false);assert.deepEqual(await messages(guest),[seen[4],seen[18]]);await guest.locator('#resumeBtn').click();
  await guest.keyboard.press('3');await guest.keyboard.press('4');await peerReceived(host,seen[11]);
  await host.screenshot({path:`${out}/private-chat.png`});
  pass('Private host/guest send the selected folder message exactly once; online menu blocks chat keys');
  await Promise.all([host.context().close(),guest.context().close()]);
  assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({url,checks,errors},null,2));
}catch(error){for(const [i,c] of browser.contexts().entries())for(const p of c.pages())await p.screenshot({path:`${out}/failure-${i}.png`}).catch(()=>{});console.error(errors);throw error;}finally{await browser.close();}
