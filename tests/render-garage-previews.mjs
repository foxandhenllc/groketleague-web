// Render truthful menu thumbnails from the game's own meshes; no external artwork.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
await fs.mkdir('assets/menu',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5198/');
  await page.waitForFunction(()=>!!window.render_game_to_text);
  const images=await page.evaluate(async()=>{
    const THREE=await import('three'),{makeVehicle,makeBall}=await import('./vehicles.js'),{makeField}=await import('./field.js');
    const {makeSinkScene}=await import('./sink-scene.js'),{makeArenaState,stepSink}=await import('./sink.js');
    const {makeSoap,updateSoap}=await import('./soap-scene.js'),{initSoap}=await import('./soap-physics.js');
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    const images={};
    function light(scene){scene.add(new THREE.HemisphereLight('#e3faff','#615041',2));const key=new THREE.DirectionalLight('#fff2d5',2.2);key.position.set(-16,32,18);scene.add(key);}
    for(const id of ['cybertruck','model3','cybercab','semi']){
      renderer.setSize(224,128,false);const scene=new THREE.Scene();light(scene);const car=makeVehicle(id);scene.add(car);
      const bounds=new THREE.Box3().setFromObject(car),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      const camera=new THREE.PerspectiveCamera(34,224/128,.1,100),d=Math.max(size.z,size.x)*1.35;
      camera.position.copy(center).add(new THREE.Vector3(.78,.52,.86).normalize().multiplyScalar(d));camera.lookAt(center);renderer.render(scene,camera);
      images[id]=renderer.domElement.toDataURL('image/webp',.9);
    }
    for(const arena of ['sink','classic']){
      renderer.setSize(720,400,false);const scene=new THREE.Scene();scene.background=new THREE.Color(arena==='sink'?'#354b59':'#395e86');light(scene);
      const camera=new THREE.PerspectiveCamera(42,720/400,.1,250);
      const cars=[makeVehicle('model3'),makeVehicle('cybertruck')];cars[0].position.set(-6,0,11);cars[1].position.set(8,0,-13);cars[0].rotation.y=.7;cars[1].rotation.y=-2;cars.forEach(c=>scene.add(c));
      if(arena==='sink'){
        const sink=makeSinkScene(scene);sink.root.visible=true;const state=makeArenaState('menu');state.time=10;state.next=100;
        const ball={x:3,z:4,y:1,vx:8,vz:0,vy:0};initSoap(ball);stepSink(state,[],ball,0);sink.update(state,{cars:[],ball,reducedMotion:false});
        const soap=makeSoap();scene.add(soap);updateSoap(soap,ball,{time:10});camera.position.set(51,67,29);
      }else{const field=new THREE.Group(),night=new THREE.Group();scene.add(field,night);makeField(scene,field,night);night.visible=false;const ball=makeBall();ball.position.set(1,.55,3);scene.add(ball);camera.position.set(40,54,46);}
      camera.lookAt(0,0,0);renderer.render(scene,camera);images[arena]=renderer.domElement.toDataURL('image/webp',.9);
    }
    renderer.dispose();return images;
  });
  for(const [name,data] of Object.entries(images))await fs.writeFile(`assets/menu/${name}.webp`,Buffer.from(data.split(',')[1],'base64'));
  console.log('Rendered',Object.keys(images).length,'menu previews');
}finally{await browser.close();}
