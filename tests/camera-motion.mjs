// Same recorded world trajectory, old versus new rendering; localhost hooks only.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL||'http://127.0.0.1:5198/';
assert.ok(['localhost','127.0.0.1'].includes(new URL(url).hostname));
const before=process.env.CAMERA_BEFORE==='1',out=process.env.QA_OUT||`output/camera-motion-${before?'before':'after'}`;
await fs.mkdir(out,{recursive:true});
const rows=JSON.parse(await fs.readFile('tests/fixtures/camera-semi-trajectory.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('gl_seen_how','1');localStorage.setItem('gl_mute_music','1');localStorage.setItem('gl_mute_sfx','1');});
 await page.route('**/api/presence',r=>r.fulfill({contentType:'application/json',body:'{"online":1,"playing":0}'}));
 await page.route('**/_vercel/insights/script.js',r=>r.fulfill({body:''}));
 if(before)await page.route('**/chase-camera.js',r=>r.fulfill({contentType:'text/javascript',path:'output/camera-motion-before/chase-camera.js'}));
 await page.route('**/main.js',async r=>{
  const response=await r.fetch();let s=before?await fs.readFile('output/camera-motion-before/main.js','utf8'):await response.text();
  s=s.replace('function tick(now) {','function tick(now) { return;');
  s=s.replace('function pickBot() {','function pickBot() { return \"model3\";');
  await r.fulfill({response,body:s+`
   const realRender=renderer.render.bind(renderer);
   window.__motion={
    setup(){mapMode='day';applyMap();selectedId='semi';setGfxMode('3d');startGame(false);kickoffNow(true);playing=false;camera.position.set(0,12.5,24);camTarget.set(0,.6,0);camera.lookAt(camTarget);if(typeof playCamera!=='undefined')playCamera.reset();renderer.render=()=>{};},
    frame(row,dt,draw=false){Object.assign(P,row.P);Object.assign(B,row.B);Object.assign(ball,row.ball);stepGame(dt);
      if(draw)realRender(scene,camera);
      return {p:camera.position.toArray(),q:camera.quaternion.toArray(),cue:document.querySelector('#ballCue')?.hidden===false};},
    cueFixture(edge=false){paused=false;mode='play';Object.assign(P,{x:0,z:0,yaw:0});Object.assign(B,{x:15,z:15});Object.assign(ball,{x:edge?100:0,y:.9,z:-5});syncMesh(playerMesh,P);syncMesh(botMesh,B);ballMesh.position.set(ball.x,ball.y,ball.z);camera.position.set(0,6,15);camera.lookAt(0,1,-5);updateBallCue(.2);realRender(scene,camera);return {visible:!ballCue.hidden,edge:ballCue.classList.contains('edge'),x:parseFloat(ballCue.style.left),y:parseFloat(ballCue.style.top)};},
    pauseCue(){paused=true;updateBallCue(.2);return ballCue.hidden;}

   };`});
 });
 for(const size of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);await page.goto(url);await page.waitForFunction(()=>!!window.__motion);await page.evaluate(()=>window.__motion.setup());
  const samples=await page.evaluate(rows=>{
   const samples=[];
   for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];
    // Keep discontinuities at faceoff resets: the camera must ease through them too.
    for(let f=1;f<=5;f++){
     const r={};for(const key of ['P','B','ball']){r[key]={...b[key]};for(const axis of ['x','y','z','yaw'])if(Number.isFinite(a[key][axis])){const delta=b[key][axis]-a[key][axis];r[key][axis]=a[key][axis]+(axis==='yaw'?Math.atan2(Math.sin(delta),Math.cos(delta)):delta)*f/5;}}
     samples.push(window.__motion.frame(r,1/60));
    }
   }return samples;
  },rows);
  let maxStep=0,maxAngle=0,maxHeight=0;
  for(let i=1;i<samples.length;i++){
   const a=samples[i-1],b=samples[i];
   maxStep=Math.max(maxStep,Math.hypot(...b.p.map((v,j)=>v-a.p[j])));
   const dot=Math.abs(b.q.reduce((sum,v,j)=>sum+v*a.q[j],0));maxAngle=Math.max(maxAngle,2*Math.acos(Math.min(1,dot))*180/Math.PI);
   maxHeight=Math.max(maxHeight,b.p[1]);
  }
  results.push({size,samples:samples.length,maxStep,maxAngle,maxHeight});
  console.log(JSON.stringify(results.at(-1)));
  await fs.writeFile(`${out}/trajectory-${size.width}.json`,JSON.stringify(samples));
  if(!before){assert.ok(maxStep<1,'no position cuts at 60 Hz');assert.ok(maxAngle<4,'no abrupt pan at 60 Hz');assert.ok(maxHeight<=48.1,'bounded portrait zoom');}
  // Render every other 60 Hz update: a real 30 fps screenshot sequence.
  await page.evaluate(()=>window.__motion.setup());
  let shot=0;
  for(let i=1;i<rows.length && rows[i].captureSeconds<=12;i++){
   const a=rows[i-1],b=rows[i];
   for(let f=1;f<=5;f++){
    const row={};for(const key of ['P','B','ball']){row[key]={...b[key]};for(const axis of ['x','y','z','yaw'])if(Number.isFinite(a[key][axis])){const delta=b[key][axis]-a[key][axis];row[key][axis]=a[key][axis]+(axis==='yaw'?Math.atan2(Math.sin(delta),Math.cos(delta)):delta)*f/5;}}
    const draw=b.captureSeconds>=10 && ((i*5+f)%2===0);
    await page.evaluate(({row,draw})=>window.__motion.frame(row,1/60,draw),{row,draw});
    if(draw)await page.screenshot({path:`${out}/clip-${size.width}-${String(shot++).padStart(3,'0')}.jpg`,type:'jpeg',quality:80});
   }
  }
  if(!before){
   const hiddenBall=await page.evaluate(()=>window.__motion.cueFixture());assert.ok(hiddenBall.visible&&!hiddenBall.edge,'occluded ball has a ring');
   await page.screenshot({path:`${out}/occluded-${size.width}.jpg`});
   const edgeBall=await page.evaluate(()=>window.__motion.cueFixture(true));assert.ok(edgeBall.visible&&edgeBall.edge&&edgeBall.x>=24&&edgeBall.x<=size.width-24,'offscreen ball has an inset arrow');
   assert.ok(await page.evaluate(()=>window.__motion.pauseCue()),'cue hidden while paused');
  }
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({before,results,errors},null,2));
}finally{await browser.close();}
