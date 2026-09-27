// Local-only screenshot debugger. Injects stepping hooks into this browser's
// main.js response; the shipped game and its controls do not expose these hooks.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const url=process.env.GAME_URL || 'http://127.0.0.1:5198/';
if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Capture hooks require localhost');
const out=path.resolve(process.env.QA_OUT || `output/capture-matches/${new Date().toISOString().replace(/[:.]/g,'-')}`);
await fs.mkdir(out,{recursive:true});
const ids=['cybertruck','model3','cybercab','semi'];
const runs=['pixel','3d'].flatMap((mode,m)=>ids.map((car,i)=>({
  id:`${m*4+i+1}-${mode}-${car}`,mode,car,opponent:ids[(i+(m?2:1))%4],seed:`capture-review-${m}-${i}-20260925`
})));
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sources=Object.fromEntries(await Promise.all(['main.js','autopilot.js','sim.js','simulation-config.js','match-variety.js','arena-geometry.js','contacts.js','drive-geometry.js','chase-camera.js','field.js','style.css','tests/capture-matches.mjs'].map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const manifest={revision,sources,url,out,captureEveryFrames:10,frameHz:120,viewport:{width:960,height:640},
  screenshot:'JPEG quality 65; full browser viewport',
  policy:'P uses a 0.3-second boost pulse when goalward, aligned within 0.25 radians, with reserve >0.25 and ball within reach+8; B uses normal CPU boost.',
  timing:'Manual fixed 1/120-second steps, including countdown and celebrations. Game goal timers follow this clock. Browser UI toast/FX timers remain wall-clock based; screenshot cadence is not a performance benchmark.',runs:[]};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log('CAPTURE_OUTPUT',out);

const hooks=`
let captureFrame=0, captureHold=0;
const captureTimers=[];
function captureDelay(callback,ms){captureTimers.push({at:captureFrame+Math.ceil(ms*120/1000),callback});}
function captureWait(ms){return new Promise(resolve=>captureDelay(resolve,ms));}
window.__capture = {
 setup(options){
  window.__captureBot=options.opponent; window.__captureSeed=options.seed;
  selectedId=options.car;setGfxMode(options.mode); startGame(false);
  captureFrame=0;captureHold=0;captureTimers.length=0;setQaKeys([]);stepGame(0);
  return this.state();
 },
 async advance(count=10){
  for(let i=0;i<count && mode!=='results';i++){
   captureFrame++;
   for(let j=captureTimers.length-1;j>=0;j--)if(captureTimers[j].at<=captureFrame){const t=captureTimers.splice(j,1)[0];t.callback();}
   await Promise.resolve();
   captureHold=Math.max(0,captureHold-1/120);
   if(playing&&!locked&&!paused){
    const distance=Math.hypot(ball.x-P.x,ball.z-P.z),reach=P.l/2+getBallRadius();
    const a=Math.atan2(-(ball.x-P.x),-(ball.z-P.z))-P.yaw;
    const heading=Math.abs(Math.atan2(Math.sin(a),Math.cos(a)));
    if(captureHold===0 && P.boost>.25 && ball.z<P.z && heading<.25 && distance>reach+.5 && distance<reach+8 && ball.y-getBallRadius()<1.25)captureHold=.3;
    setQaKeys(captureHold>0?['Space']:[]);
   }else {captureHold=0;setQaKeys([]);}
   stepGame(1/120);
  }
  return this.state();
 },
 state(){
  const state=JSON.parse(window.render_game_to_text());
  const projected=new THREE.Vector3(ball.x,ball.y,ball.z).project(camera);
  return {...state,captureFrame,simTick,captureSeconds:captureFrame/120,
    ballScreen:{x:projected.x,y:projected.y,z:projected.z},camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z}};
 }
};`;

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const run of runs){
  if(process.env.CAPTURE_RUN && run.id!==process.env.CAPTURE_RUN)continue;
  const dir=path.join(out,run.id);await fs.mkdir(path.join(dir,'frames'),{recursive:true});
  const errors=[];const context=await browser.newContext({viewport:manifest.viewport});
  await context.addInitScript(()=>{localStorage.setItem('gl_seen_how','1');localStorage.setItem('gl_mute_music','1');localStorage.setItem('gl_mute_sfx','1');});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
  await page.route('**/api/presence',r=>r.fulfill({contentType:'application/json',body:'{"online":1,"playing":0}'}));
  await page.route('**/_vercel/insights/script.js',r=>r.fulfill({body:''}));
  await page.route('**/main.js',async r=>{
   const response=await r.fetch();let source=(await response.text()).replace(/\r\n/g,'\n');
   const replace=(old,next)=>{if(!source.includes(old))throw Error('Capture hook no longer matches main.js: '+old);source=source.replace(old,next);};
   replace('function tick(now) {','function tick(now) { return;');
   replace('function pickBot() {','function pickBot() { if(window.__captureBot)return window.__captureBot;');
   replace('matchSeed = online ? matchId : crypto.randomUUID();','matchSeed = online ? matchId : window.__captureSeed || crypto.randomUUID();');
   replace('await new Promise((r) => setTimeout(r, 700));','await captureWait(700);');
   replace('setTimeout(() => {\n      if (serial !== sessionSerial) return;\n      finishMatch();','captureDelay(() => {\n      if (serial !== sessionSerial) return;\n      finishMatch();');
   await r.fulfill({response,body:source+'\n'+hooks});
  });
  await page.goto(url);await page.waitForFunction(()=>!!window.__capture,{},{timeout:60000}).catch(async error=>{
    await page.screenshot({path:path.join(dir,'startup-failure.png')});
    await fs.writeFile(path.join(dir,'startup-errors.json'),JSON.stringify(errors,null,2));
    console.error('Capture startup errors:',errors);throw error;
  });
  let state=await page.evaluate(run=>window.__capture.setup(run),run);
  const cdp=await context.newCDPSession(page), rows=[];
  const start=Date.now();
  while(true){
   const file=`frames/${String(state.captureFrame).padStart(6,'0')}.jpg`;
   const shot=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:65,fromSurface:true});
   await fs.writeFile(path.join(dir,file),Buffer.from(shot.data,'base64'));
   rows.push({...state,image:file});
   if(rows.length%120===0){await fs.writeFile(path.join(dir,'progress.json'),JSON.stringify({frames:rows.length,seconds:state.captureSeconds,score:[state.scoreA,state.scoreB]}));console.log(run.id,rows.length,'images',state.captureSeconds.toFixed(1)+'s',state.scoreA+':'+state.scoreB);}
   if(state.mode==='results')break;
   if(state.captureFrame>12500)throw Error('Match did not complete within debug frame budget');
   state=await page.evaluate(()=>window.__capture.advance(10));
  }
  await fs.writeFile(path.join(dir,'states.ndjson'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  const result={...run,completed:state.mode==='results',images:rows.length,finalFrame:state.captureFrame,score:[state.scoreA,state.scoreB],activeSeconds:90-state.timeLeft,wallSeconds:(Date.now()-start)/1000,errors};
  manifest.runs.push(result);await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
  await context.close();console.log('COMPLETE',JSON.stringify(result));
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
 }
}finally{await browser.close();}
