import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL||'http://127.0.0.1:5198/';
assert.ok(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const out=process.env.QA_OUT||'output/tactics-framing';await fs.mkdir(out,{recursive:true});
const root='output/capture-matches/improvements-20260925';
const runs=JSON.parse(await fs.readFile(root+'/manifest.json','utf8')).runs.filter(r=>r.mode==='3d');
const samples=[];
for(const r of runs){const rows=(await fs.readFile(`${root}/${r.id}/states.ndjson`,'utf8')).trim().split('\n').map(JSON.parse);
 samples.push(...rows.filter(s=>s.mode==='play'&&!s.locked).filter((s,i)=>i%6===0).map(s=>({...s,run:r.id})));}
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('gl_seen_how','1');localStorage.setItem('gl_mute_music','1');localStorage.setItem('gl_mute_sfx','1');});
 await page.route('**/api/presence',r=>r.fulfill({contentType:'application/json',body:'{"online":1,"playing":0}'}));
 await page.route('**/_vercel/insights/script.js',r=>r.fulfill({body:''}));
 await page.route('**/main.js',async r=>{const response=await r.fetch();let source=await response.text();
  source=source.replace('function tick(now) {','function tick(now) { return;');
  source=source.replace('function pickBot() {','function pickBot() { if(window.__framingBot)return window.__framingBot;');
  await r.fulfill({response,body:source+`
  window.__framing=(row,render=false)=>{
   if(render){selectedId=row.P.kind;window.__framingBot=row.B.kind;setGfxMode('3d');startGame(false);kickoffNow(true);}
   Object.assign(P,row.P);Object.assign(B,row.B);Object.assign(ball,row.ball);
   camera.position.set(row.camera.x,row.camera.y,row.camera.z);
   camTarget.set(P.x*.55+ball.x*.45,1,P.z*.55+ball.z*.45);
   constrainChase(camera.position,22,34);
   framePlay(camera,camTarget,P,ball,getBallRadius(),p=>new THREE.Vector3(p.x,p.y,p.z).project(camera));
   const q=new THREE.Vector3(ball.x,ball.y,ball.z).project(camera);
   if(render){preview.visible=false;playerMesh.visible=true;botMesh.visible=true;ballMesh.visible=true;
    syncMesh(playerMesh,P);syncMesh(botMesh,B);ballMesh.position.set(ball.x,ball.y,ball.z);renderer.render(scene,camera);}
   return {x:q.x,y:q.y,z:q.z,cameraY:camera.position.y};
  };`});});
 for(const viewport of [{width:960,height:640},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.goto(url);await page.waitForFunction(()=>!!window.__framing);
  const results=await page.evaluate(rows=>rows.map(r=>window.__framing(r)),samples);
  assert.ok(results.every(q=>Math.abs(q.x)<=.78&&q.y>=-.68&&q.y<=.58&&q.z>-1&&q.z<1));
  checks.push({viewport,samples:results.length,maxHeight:Math.max(...results.map(q=>q.cameraY))});
  const row=samples.find(s=>s.run==='6-3d-model3'&&s.captureSeconds>=16);
  await page.evaluate(r=>window.__framing(r,true),row);await page.screenshot({path:`${out}/framing-${viewport.width}.png`});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/results.json',JSON.stringify({checks,errors},null,2));console.log(checks);
}finally{await browser.close();}
