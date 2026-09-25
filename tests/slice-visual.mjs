import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.QA_OUT||'output/first-playable-slice/visual';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
 const p=await browser.newPage({viewport:{width:1000,height:1100}});p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/pixel.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nexport { vehicle };'});});
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:5197');await p.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const bounds=await p.evaluate(async()=>{
  const THREE=await import('three'),{makeVehicle}=await import('./vehicles.js'),{vehicleBounds}=await import('./art-contract.js');
  const result=[];
  for(const id of ['cybertruck','model3','cybercab','semi']){
   const g=makeVehicle(id);g.children.filter(c=>c.userData.decoration).forEach(c=>g.remove(c));
   const b=new THREE.Box3().setFromObject(g),expected=vehicleBounds(id);
   result.push({id,x:[b.min.x,b.max.x],z:[b.min.z,b.max.z],expected});
  }
  // This is a view-only contact sheet, not a different gameplay renderer.
  const sheet=document.createElement('canvas');sheet.width=1000;sheet.height=1100;sheet.style.cssText='position:fixed;inset:0;z-index:999999;width:1000px;height:1100px';document.body.append(sheet);
  const ctx=sheet.getContext('2d');ctx.fillStyle='#14232d';ctx.fillRect(0,0,1000,1100);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(240,230);renderer.setClearColor('#203b3b');
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#ffffff','#33443a',3));const light=new THREE.DirectionalLight('#ffffff',2);light.position.set(3,9,4);scene.add(light);
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);camera.position.set(0,15,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
  const ids=['cybertruck','model3','cybercab','semi'];
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const g=makeVehicle(ids[row]);g.rotation.y=col*Math.PI/2;scene.add(g);
   const {hx,hz}=vehicleBounds(ids[row]);const pts=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz],[-hx,-hz]].map(([x,z])=>new THREE.Vector3(x,.05,z));
   const outline=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#ff7799'}));outline.rotation.y=g.rotation.y;scene.add(outline);
   renderer.render(scene,camera);ctx.drawImage(renderer.domElement,col*250,row*270+30);
   ctx.fillStyle='#edf4ed';ctx.font='14px sans-serif';ctx.fillText(ids[row]+' / '+col*90+' deg',col*250+8,row*270+22);
   scene.remove(g,outline);
  }
  window.__contactSheet=sheet;return result;
 });
 for(const b of bounds){assert.ok(Math.abs(b.x[0]+b.expected.hx)<1e-5);assert.ok(Math.abs(b.x[1]-b.expected.hx)<1e-5);assert.ok(Math.abs(b.z[0]+b.expected.hz)<1e-5);assert.ok(Math.abs(b.z[1]-b.expected.hz)<1e-5);}
 await p.screenshot({path:out+'/3d-contact-sheet.png'});
 await p.evaluate(async()=>{
  const {vehicle}=await import('./pixel.js'),{bodyFrom}=await import('./sim.js');const sheet=window.__contactSheet,ctx=sheet.getContext('2d');
  ctx.fillStyle='#14232d';ctx.fillRect(0,0,1000,1100);
  const ids=['cybertruck','model3','cybercab','semi'];
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   ctx.fillStyle='#edf4ed';ctx.font='14px sans-serif';ctx.fillText(ids[row]+' / '+col*90+' deg',col*250+8,row*270+22);
   ctx.save();ctx.translate(col*250+125,row*270+145);ctx.scale(22,22);
   const c=bodyFrom(ids[row],0,0,col*Math.PI/2);vehicle(ctx,c,'#ffc268',false,0,true);
   ctx.rotate(-c.yaw);ctx.strokeStyle='#ff7799';ctx.lineWidth=.025;ctx.strokeRect(-c.w*.55,-c.l/2,c.w*1.1,c.l);ctx.restore();
  }
 });
 await p.screenshot({path:out+'/2d-contact-sheet.png'});
 await fs.writeFile(out+'/bounds.json',JSON.stringify(bounds,null,2));
 assert.deepEqual(errors,[]);console.log('PASS all-car bounds and cardinal-yaw contact sheets');
}finally{await browser.close();}
