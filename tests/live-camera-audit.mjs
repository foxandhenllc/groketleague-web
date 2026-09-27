// Observe the unmodified public game; no intercepted source or scenario hooks.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const url=process.env.GAME_URL||'https://www.groketleague.com/';
const out=process.env.QA_OUT||'output/live-camera-audit-20260927';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const cases=[
 {id:'desktop-truck',car:'cybertruck',width:1280,height:800},
 {id:'portrait-semi',car:'semi',width:390,height:844},
 {id:'landscape-model3',car:'model3',width:844,height:390},
 {id:'small-phone-cab',car:'cybercab',width:320,height:568}
].filter(c=>!process.env.CAMERA_CASES||process.env.CAMERA_CASES.split(',').includes(c.id));
const results=[];
async function run(spec){
 const dir=`${out}/${spec.id}`;await fs.mkdir(dir,{recursive:true});
 const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:spec.width<1000,hasTouch:spec.width<1000});
 await context.addInitScript(()=>{localStorage.setItem('gl_seen_how','1');localStorage.setItem('gl_mute_music','1');localStorage.setItem('gl_mute_sfx','1');});
 const page=await context.newPage(),errors=[],rows=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>console.log('REQUEST FAILED',spec.id,r.url(),r.failure()?.errorText));
 await page.goto(url);await page.waitForFunction(()=>!!window.render_game_to_text,null,{timeout:60000}).catch(async error=>{
  await page.screenshot({path:`${dir}/startup-failure.png`});
  await fs.writeFile(`${dir}/startup-errors.json`,JSON.stringify(errors));throw error;
 });
 await page.locator(`[data-id="${spec.car}"]`).click();await page.locator('#toMatchup').click();
 await page.locator('#gfx3d').click();await page.locator('#go').click();
 const start=Date.now();let lastBoost=false;
 for(let i=0;Date.now()-start<240000;i++){
  const s=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const file=`frame-${String(i).padStart(3,'0')}.jpg`;
  await page.screenshot({path:`${dir}/${file}`,type:'jpeg',quality:80});
  rows.push({file,elapsedMs:Date.now()-start,...s});
  if(s.mode==='results')break;
  const boost=i%12===8;
  if(boost!==lastBoost){await page.keyboard[boost?'down':'up']('Space');lastBoost=boost;}
  if(i%10===0)console.log(spec.id,'screens',i+1,'clock',s.timeLeft,'score',s.scoreA,s.scoreB);
  await page.waitForTimeout(1800);
 }
 await page.keyboard.up('Space');
 const final=rows.at(-1);
 const result={...spec,url,images:rows.length,completed:final.mode==='results',score:[final.scoreA,final.scoreB],errors};
 await fs.writeFile(`${dir}/states.json`,JSON.stringify(rows));
 await fs.writeFile(`${dir}/result.json`,JSON.stringify(result,null,2));
 results.push(result);console.log('COMPLETE',JSON.stringify(result));await context.close();
}
try{
 for(const spec of cases)await run(spec);
 await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
 if(results.some(r=>!r.completed||r.errors.length))process.exitCode=1;
}finally{await browser.close();}
