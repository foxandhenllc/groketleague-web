import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=process.env.GAME_URL||'http://127.0.0.1:5198/';
const local=['localhost','127.0.0.1'].includes(new URL(root).hostname);
const out=process.env.QA_OUT||'output/playwright/moon-audio';await fs.mkdir(out,{recursive:true});
const errors=[],checks=[];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const cases=[
  {name:'soccer',width:1280,height:800,music:'0',sfx:'0',soccer:true},
  {name:'moon-desktop',width:1280,height:800,music:'0',sfx:'0'},
  {name:'moon-phone',width:390,height:844,music:'1',sfx:'0'},
  {name:'moon-landscape',width:568,height:320,music:'0',sfx:'1'},
  ...(local?[{name:'delayed-music',width:1000,height:700,music:'0',sfx:'0',delayed:true}]:[])
];
try{
  for(const spec of cases.filter(s=>!process.env.AUDIO_CASE||s.name===process.env.AUDIO_CASE)){
    const c=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.width<600});
    await c.addInitScript(({music,sfx})=>{
      if(localStorage.getItem('gl_mute_music')===null)localStorage.setItem('gl_mute_music',music);
      if(localStorage.getItem('gl_mute_sfx')===null)localStorage.setItem('gl_mute_sfx',sfx);localStorage.setItem('gl_seen_how','1');
      window.__audioProbe={players:[],gains:[],contexts:[],oscillators:0};
      const NativeAudio=window.Audio,NativeContext=window.AudioContext;
      window.Audio=class extends NativeAudio{constructor(...args){super(...args);window.__audioProbe.players.push(this);}};
      window.AudioContext=class extends NativeContext{
        constructor(...args){super(...args);window.__audioProbe.contexts.push(this);}
        createGain(){const node=super.createGain();if(!window.__audioProbe.gains.length){const analyser=super.createAnalyser();analyser.fftSize=512;node.connect(analyser);window.__audioProbe.analyser=analyser;}window.__audioProbe.gains.push(node);return node;}
        createOscillator(){window.__audioProbe.oscillators++;return super.createOscillator();}
      };
    },spec);
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    let releaseMusic;
    if(spec.delayed){const gate=new Promise(resolve=>{releaseMusic=resolve;});await p.route('**/music/*.mp3',async r=>{await gate;await r.continue();});}
    if(local){
      await p.route('**/api/presence',r=>r.fulfill({contentType:'application/json',body:'{"online":1,"playing":0}'}));
      await p.route('**/_vercel/insights/script.js',r=>r.fulfill({body:''}));
      if(!spec.soccer)await p.route('**/moon.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+`
window.__audioFinishHeat=()=>{while(race.phase!=='results')stepMoonRace(race,1/120);showResults();};`});});
    }
    await p.goto(new URL(spec.soccer?'':'moon.html',root).href);await p.waitForFunction(()=>!!window.render_game_to_text);
    const ids=spec.soccer?{start:'playNow',menu:'menuBtn',music:'muteMusicBtn',sfx:'muteSfxBtn',resume:'resumeBtn'}:{start:'startRace',menu:'raceMenu',music:'raceMusic',sfx:'raceSfx',resume:'resumeRace'};
    const click=id=>p.locator('#'+id).click();
    const read=()=>p.evaluate(()=>({music:localStorage.getItem('gl_mute_music'),sfx:localStorage.getItem('gl_mute_sfx'),master:window.__audioProbe.gains[0]?.gain.value,oscillators:window.__audioProbe.oscillators,players:window.__audioProbe.players.map(a=>({paused:a.paused,volume:a.volume,time:a.currentTime,ready:a.readyState,error:a.error?.code}))}));
    const waitOn=()=>p.waitForFunction(()=>window.__audioProbe.players.some(a=>!a.paused&&a.volume>.35&&a.readyState>=2),null,{timeout:20000});
    const waitOff=()=>p.waitForFunction(()=>window.__audioProbe.players.every(a=>a.paused&&a.volume===0),null,{timeout:5000});
    await click(ids.start);if(spec.music==='0'&&!spec.delayed)await waitOn();await click(ids.menu);
    if(spec.delayed){await click(ids.music);releaseMusic();await p.waitForTimeout(1200);await waitOff();}
    let before=await read();assert.equal(before.music,spec.delayed?'1':spec.music);assert.equal(before.sfx,spec.sfx);
    if(!spec.soccer){assert.equal(await p.locator('#'+ids.music).getAttribute('aria-pressed'),String(before.music==='0'));assert.equal(await p.locator('#'+ids.sfx).getAttribute('aria-pressed'),String(spec.sfx==='0'));}
    await p.screenshot({path:`${out}/${spec.name}-settings.png`});
    if(before.music==='1')await click(ids.music);await waitOn();
    // Real media playback must survive off/on while an earlier fade is still active.
    await p.evaluate(async id=>{document.getElementById(id).click();await new Promise(r=>setTimeout(r,40));document.getElementById(id).click();},ids.music);
    await p.waitForTimeout(900);await waitOn();let after=await read();assert.equal(after.sfx,spec.sfx);assert.equal(after.music,'0');
    const time=after.players.find(a=>!a.paused).time;await p.waitForTimeout(250);assert.ok((await read()).players.some(a=>!a.paused&&a.time>time+.1),'actual media clock advances after re-enabling');
    await p.evaluate(async id=>{for(let i=0;i<3;i++){document.getElementById(id).click();await new Promise(r=>setTimeout(r,30));}},ids.music);
    await p.waitForTimeout(900);await waitOff();assert.equal((await read()).sfx,spec.sfx);
    // Effects can be changed without restarting muted music, even though the UI unlocks audio.
    await click(ids.sfx);await p.waitForTimeout(350);await waitOff();assert.equal((await read()).music,'1');
    await click(ids.music);await waitOn();
    if((await read()).sfx==='1')await click(ids.sfx);
    // Sample an active effect at the shared output while toggling mute.
    await p.evaluate(async()=>{(await import('./audio.js')).SFX.crowd(true);});
    await p.waitForFunction(()=>{const a=new Float32Array(512);window.__audioProbe.analyser.getFloatTimeDomainData(a);return a.some(v=>Math.abs(v)>.0001);});
    await click(ids.sfx);
    await p.waitForFunction(()=>{const a=new Float32Array(512);window.__audioProbe.analyser.getFloatTimeDomainData(a);return a.every(v=>Math.abs(v)<1e-7);},null,{timeout:450});
    const muted=await read();assert.equal(muted.master,0);assert.equal(muted.music,'0');
    const count=muted.oscillators;await p.evaluate(async()=>{(await import('./audio.js')).SFX.goal();});await p.waitForTimeout(450);assert.equal((await read()).oscillators,count);await waitOn();
    await click(ids.sfx);await p.waitForFunction(()=>window.__audioProbe.gains[0].gain.value===1);assert.ok((await read()).oscillators>count);
    // Both choices survive pause/resume. Muting must not leave a fading player behind.
    await click(ids.music);await click(ids.sfx);await waitOff();await click(ids.resume);await p.waitForTimeout(1000);await waitOff();
    assert.equal(JSON.parse(await p.evaluate(()=>window.render_game_to_text())).paused,false);
    if(local&&!spec.soccer){await p.evaluate(()=>window.__audioFinishHeat());await click('nextHeat');await p.waitForTimeout(1000);await waitOff();assert.equal(JSON.parse(await p.evaluate(()=>window.render_game_to_text())).heat,2);}
    const resumed=await read();await p.reload();await p.waitForFunction(()=>!!window.render_game_to_text);await click(ids.start);await p.waitForTimeout(750);await waitOff();assert.equal((await read()).music,'1');assert.equal((await read()).sfx,'1');
    checks.push({name:spec.name,before,afterRapidOn:after,afterMutedResume:resumed,afterReload:await read()});console.log('PASS',spec.name,'independent toggles, actual playback, rapid changes, effects mute, resume and reload');
    await c.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({root,checks,errors},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${out}/failure.png`}).catch(()=>{});console.error(errors);throw error;}finally{await browser.close();}
