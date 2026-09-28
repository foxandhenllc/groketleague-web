import * as THREE from 'three';
import {makeVehicle} from './vehicles.js';
import {TRACK_LENGTH,TRACK_WIDTH,trackFrame,TRACK_SAMPLES,moonHazards,JET_AT,CARGO_AT,JUMP_AT} from './moon-track.js';
import {TEAMS,seededRandom,raceOrder} from './moon-sim.js';

const Y=new THREE.Vector3(0,1,0);
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...extra});
function mesh(geo,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,size,pos,color){return mesh(new THREE.BoxGeometry(...size),typeof color==='string'?mat(color):color,parent,...pos);}
function textTexture(lines,{bg='#112030',color='#e9f2ff',accent='#ffbd72',width=768,height=256}={}){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);ctx.fillStyle=accent;ctx.fillRect(0,0,14,height);
  lines.forEach((line,i)=>{ctx.fillStyle=i===0?color:accent;ctx.font=`${i===0?'800':'600'} ${i===0?height*.28:height*.13}px Segoe UI,Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(line,width/2,height*(i===0?.39:.77),width-50);});
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function sign(parent,lines,w,pos,accent='#ffbd72'){
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture(lines,{accent}),depthWrite:false}));sprite.position.set(...pos);sprite.scale.set(w,w/3,1);sprite.userData.signWidth=w;parent.add(sprite);return sprite;
}
function stripGeometry(left,right,step=3){
  const positions=[],colors=[];
  for(let s=0;s<TRACK_LENGTH;s+=step){
    const end=Math.min(TRACK_LENGTH,s+step),points=[trackFrame(s,left),trackFrame(s,right),trackFrame(end,left),trackFrame(end,right)];
    const u=s/TRACK_LENGTH,color=new THREE.Color(u>.48&&u<.62?'#777078':u>.22&&u<.33?'#435764':'#414d5a');
    for(const i of [0,1,2,1,3,2]){const p=points[i];positions.push(p.x,p.y+.06,p.z);colors.push(color.r,color.g,color.b);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function railGeometry(lane){
  const positions=[];
  for(let s=0;s<TRACK_LENGTH;s+=3){const a=trackFrame(s,lane),b=trackFrame(Math.min(TRACK_LENGTH,s+3),lane);
    for(const [p,h] of [[a,0],[b,0],[a,.8],[a,.8],[b,0],[b,.8]])positions.push(p.x,p.y+h,p.z);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
const craterData=[[10,-11,27],[-173,32,31],[157,-105,35],[-60,154,22],[130,141,38],[-155,-130,21],[12,-171,19]];
function terrainY(x,z){let y=-1.8+Math.sin(x*.09)*Math.cos(z*.06)*.65+Math.sin(x*.31+z*.19)*.12-Math.max(0,Math.hypot(x,z)-190)**2*.0004;for(const [cx,cz,r] of craterData){const d=Math.hypot(x-cx,z-cz)/r;if(d<1.4)y+=Math.exp(-(((d-1)*7)**2))*2.8-Math.max(0,1-d*d)*5;}return y;}
function equipment(scene){
  const cream=mat('#c3c7c7'),dark=mat('#24313c'),steel=mat('#9da6af',{metalness:.6,roughness:.35}),yellow=mat('#e5ba64'),orange=mat('#d7824e');
  function facility(at,lane){const p=trackFrame(at*TRACK_LENGTH,lane),g=new THREE.Group();g.position.set(p.x,Math.max(0,p.y-2),p.z);g.rotation.y=p.yaw;scene.add(g);return g;}
  const yard=facility(.078,31);
  box(yard,[31,13,20],[0,6.5,0],cream);box(yard,[33,1.5,22],[0,13.5,0],dark);box(yard,[22,9,.3],[0,4.6,-10.2],dark);
  for(let x=-9;x<=9;x+=3)box(yard,[.15,9,.5],[x,4.6,-10.4],steel);
  box(yard,[25,.3,3],[0,14.5,0],yellow);sign(yard,['SPACE-ISH','PROBABLY ORBITAL'],29,[0,17,0]);
  sign(yard,['NEXT LAUNCH','Soon. Subject to vibes.'],13,[21,6,-6]);
  const launch=facility(.15,-27);
  mesh(new THREE.CylinderGeometry(12,14,1.3,24),dark,launch,0,.65,0);
  mesh(new THREE.CylinderGeometry(3.6,3.9,29,12),steel,launch,0,15,0);
  mesh(new THREE.ConeGeometry(3.6,8,12),cream,launch,0,33.5,0);
  for(let i=0;i<4;i++){const fin=box(launch,[.45,7,5],[0,5.2,4],orange);fin.rotation.y=i*Math.PI/2;fin.position.set(Math.sin(i*Math.PI/2)*4,5.2,Math.cos(i*Math.PI/2)*4);}
  box(launch,[8,.7,8],[0,24,0],dark);box(launch,[8,.6,8],[0,13,0],yellow);
  box(launch,[3,31,3],[10,15.5,0],dark);box(launch,[12,1,2],[6,26,0],yellow);
  sign(launch,['TALL-ISH','Now with additional fins.'],21,[0,41,0]);
  for(let i=0;i<3;i++){mesh(new THREE.CylinderGeometry(2.6,2.6,10,12),cream,launch,-15-i*6,5,1);box(launch,[5.5,.65,5.5],[-15-i*6,7,1],orange);}
  const naps=facility(.706,28);
  box(naps,[33,9,21],[0,4.5,0],cream);box(naps,[35,1.3,23],[0,9.4,0],dark);
  for(let i=-3;i<=3;i++)box(naps,[2.9,2.8,.2],[i*4,5.7,-10.6],mat('#60bdd0',{emissive:'#153b47',emissiveIntensity:.5}));
  box(naps,[6,13,8],[-12,6.5,2],yellow);sign(naps,['N.A.P.S.','National Agency for Procrastinated Spaceflight'],32,[0,14,0],'#b7ed72');
  sign(naps,['HOLD PLEASE','Moon permit pending.'],14,[20,7,-4],'#b7ed72');
  for(let i=0;i<3;i++){const g=facility(.675+i*.016,55);mesh(new THREE.SphereGeometry(8,16,10,0,Math.PI*2,0,Math.PI/2),cream,g,0,0,0);box(g,[4,3,5],[0,1.5,-8],dark);}
  for(let i=0;i<6;i++){const g=facility(.84+i*.01,20+(i%2)*15);box(g,[.8,4,.8],[0,2,0],steel);const panel=box(g,[10,.3,6],[0,4,0],mat('#263d77',{metalness:.3}));panel.rotation.z=.3;
    for(let k=-4;k<=4;k+=2){const line=box(g,[.07,.05,6],[k,4.2,0],'#8fa6cf');line.position.y+=Math.sin(.3)*k;}
  }
  const dish=facility(.77,31);mesh(new THREE.CylinderGeometry(2,3.4,10,12),cream,dish,0,5,0);const bowl=mesh(new THREE.SphereGeometry(8,20,10,0,Math.PI*2,0,Math.PI*.42),cream,dish,0,12,0);bowl.rotation.z=.45;
  box(dish,[.4,9,.4],[2,15,0],orange);sign(dish,['DISH-ISH','99% buffering.'],18,[0,22,0],'#91cbf6');
  const rover=facility(.42,22);box(rover,[5,3,7],[0,2.4,0],yellow);box(rover,[3,1,3],[0,4.5,-1],cream);
  for(const x of [-3,3])for(const z of [-2.5,0,2.5]){const wheel=mesh(new THREE.CylinderGeometry(1.5,1.5,1,10),dark,rover,x,1.5,z);wheel.rotation.z=Math.PI/2;}
  box(rover,[.3,5,.3],[0,6,0],steel);sign(rover,['ROVERDRAFT','Version 0.0.1'],14,[0,11,0]);
  const crateMaterial=mat('#c19566');
  for(const at of [.02,.38,.65,.87]){const g=facility(at,23);for(let i=0;i<5;i++){box(g,[3,3,3],[(i%3)*4,1.5+Math.floor(i/3)*3,0],crateMaterial);box(g,[3.1,.3,3.1],[(i%3)*4,1.5+Math.floor(i/3)*3,0],dark);}}
}
export function createMoonView(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#060b17');const camera=new THREE.PerspectiveCamera(48,1,.3,1600);
  scene.add(new THREE.HemisphereLight('#adccff','#40352b',2.0));const sun=new THREE.DirectionalLight('#fff0d6',3.1);sun.position.set(-120,160,-50);scene.add(sun);
  const random=seededRandom('moon-scenery-v1');
  const stars=[];for(let i=0;i<850;i++){const a=random()*Math.PI*2,y=.1+random()*.9,r=700;stars.push(Math.cos(a)*Math.sqrt(1-y*y)*r,y*r,Math.sin(a)*Math.sqrt(1-y*y)*r);}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({size:1.1,color:'#bfdcff',sizeAttenuation:true})));
  const terrain=new THREE.PlaneGeometry(1200,1100,180,165);terrain.rotateX(-Math.PI/2);const pos=terrain.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),y=terrainY(x,z);pos.setY(i,y);const shade=.48+random()*.07+y*.012;colors.push(shade*.92,shade*.98,shade*1.09);}
  terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();mesh(terrain,mat('#ffffff',{vertexColors:true,flatShading:true}),scene);
  const rockGeo=new THREE.DodecahedronGeometry(1,0),rocks=new THREE.InstancedMesh(rockGeo,mat('#626978',{flatShading:true}),280),dummy=new THREE.Object3D();
  for(let i=0;i<280;i++){let x,z,near;do{x=(random()-.5)*570;z=(random()-.5)*460;near=TRACK_SAMPLES.some((p,k)=>k%5===0&&Math.hypot(p.x-x,p.z-z)<14);}while(near);
    dummy.position.set(x,terrainY(x,z)+.3,z);dummy.scale.set(.6+random()*2.8,.4+random()*1.7,.6+random()*2.6);dummy.rotation.set(random()*2,random()*6,random());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}
  scene.add(rocks);
  for(let i=0;i<18;i++){const angle=i/18*Math.PI*2,r=270+random()*80,h=12+random()*24,x=Math.cos(angle)*r,z=Math.sin(angle)*r;const mountain=mesh(new THREE.DodecahedronGeometry(1,0),mat('#697082',{flatShading:true}),scene,x,terrainY(x,z)-2,z);mountain.scale.set(30+random()*35,h,22+random()*25);mountain.rotation.y=random()*6;}
  const planetCanvas=document.createElement('canvas');planetCanvas.width=512;planetCanvas.height=256;const ctx=planetCanvas.getContext('2d');ctx.fillStyle='#2478bc';ctx.fillRect(0,0,512,256);
  for(let i=0;i<70;i++){ctx.fillStyle=i%3?'#5e9b83':'#b3c9aa';ctx.beginPath();ctx.ellipse(random()*512,random()*256,8+random()*35,5+random()*20,random()*6,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#e9f9ffbb';for(let i=0;i<60;i++){ctx.beginPath();ctx.ellipse(random()*512,random()*256,8+random()*30,1+random()*3,-.3,0,Math.PI*2);ctx.fill();}
  const planetTexture=new THREE.CanvasTexture(planetCanvas);planetTexture.colorSpace=THREE.SRGBColorSpace;
  mesh(new THREE.SphereGeometry(30,40,28),mat('#ffffff',{map:planetTexture,roughness:1,emissive:'#0a2342',emissiveIntensity:.3}),scene,0,88,-270);
  mesh(new THREE.SphereGeometry(31.4,40,28),new THREE.MeshBasicMaterial({color:'#3c96ff',transparent:true,opacity:.16,side:THREE.BackSide}),scene,0,88,-270);
  mesh(stripGeometry(-7,7),mat('#ffffff',{vertexColors:true,roughness:.93}),scene);
  for(let s=0;s<TRACK_LENGTH;s+=24){const p=trackFrame(s);if(p.y>5){const floor=terrainY(p.x,p.z),h=p.y-floor;mesh(new THREE.CylinderGeometry(1.4,1.8,h,8),mat('#74848f'),scene,p.x,floor+h/2,p.z);}}
  for(const lane of [-7,7]){
    mesh(railGeometry(lane),mat('#a9b6c3',{side:THREE.DoubleSide,metalness:.25}),scene);
    const ribbon=stripGeometry(lane-.15,lane+.15);for(let i=0;i<ribbon.attributes.position.count;i++)ribbon.attributes.position.setY(i,ribbon.attributes.position.getY(i)+.8);
    mesh(ribbon,new THREE.MeshBasicMaterial({color:lane<0?'#ecae65':'#76c9de'}),scene);
  }
  for(let s=0;s<TRACK_LENGTH;s+=18){const p=trackFrame(s);const line=box(scene,[.16,.02,3.4],[p.x,p.y+.1,p.z],'#e4ddb7');line.rotation.y=p.yaw;}
  // Cyan runway bars explain the launch point before the first car reaches it.
  for(let n=0;n<5;n++){const p=trackFrame(JUMP_AT-14+n*3);const bar=box(scene,[10,.035,.35],[p.x,p.y+.12,p.z],new THREE.MeshBasicMaterial({color:'#7ce6f7'}));bar.rotation.y=p.yaw;}
  for(let s=0;s<TRACK_LENGTH;s+=32){const p=trackFrame(s,-7.4);const bollard=box(scene,[.35,1.3,.35],[p.x,p.y+.65,p.z],'#7a91a6');box(scene,[.4,.25,.4],[p.x,p.y+1.3,p.z],new THREE.MeshBasicMaterial({color:'#ffe7a9'}));}
  for(const [at,text,color] of [[.075,'SPACE-ISH','#ffb45f'],[.255,'LOW-G SKYWAY','#68e5ee'],[.50,'CRATER CUT','#c2a0ff'],[.70,'N.A.P.S.','#b7ed72']]){
    const p=trackFrame(at*TRACK_LENGTH,11);sign(scene,[text,'MOON GRAND PRIX'],16,[p.x,p.y+8,p.z],color);
  }
  equipment(scene);
  // Finish gantry and grid use the same start plane as the simulation.
  const finish=new THREE.Group(),f=trackFrame(0);finish.position.set(f.x,f.y,f.z);finish.rotation.y=f.yaw;scene.add(finish);
  for(const x of [-8,8])box(finish,[.65,8,.65],[x,4,0],'#b9c9d1');box(finish,[17,1.8,.8],[0,8,0],'#163042');sign(finish,['MOON GRAND PRIX','LOW GRAVITY. HIGH HOPES.'],16,[0,10,0],'#78dff2');
  for(let x=0;x<14;x++)for(let z=0;z<2;z++)box(finish,[1,.035,1],[x-6.5,.11,z-.5],(x+z)%2?'#182432':'#f4e6cd');
  for(let s=-5;s>=-26;s-=7)for(const lane of [-2.6,2.6]){const p=trackFrame(s,lane);const mark=box(scene,[3,.02,4.8],[p.x,p.y+.11,p.z],'#677986');mark.rotation.y=p.yaw;}
  const jetRoot=new THREE.Group();scene.add(jetRoot);const jetPos=trackFrame(JET_AT,-4);jetRoot.position.set(jetPos.x,jetPos.y+1.1,jetPos.z);jetRoot.quaternion.setFromUnitVectors(Y,new THREE.Vector3(jetPos.nx,.06,jetPos.nz).normalize());
  const plume=mesh(new THREE.ConeGeometry(2.0,10,12,1,true),new THREE.MeshBasicMaterial({color:'#ffad54',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}),jetRoot);plume.rotation.z=Math.PI;
  const warningPos=trackFrame(JET_AT,-3.8),warning=box(scene,[5.8,.025,14],[warningPos.x,warningPos.y+.14,warningPos.z],new THREE.MeshBasicMaterial({color:'#ff914d',transparent:true,opacity:.22}));warning.rotation.y=warningPos.yaw;
  const cargoFrame=trackFrame(CARGO_AT),cargo=new THREE.Group();scene.add(cargo);const crate=box(cargo,[2.8,2.6,2.8],[0,0,0],'#e4b271');box(cargo,[2.9,.35,2.9],[0,0,0],'#223346');
  const hook=box(scene,[.12,10,.12],[cargoFrame.x,cargoFrame.y+7,cargoFrame.z],'#a9c1ce');
  const crane=new THREE.Group();crane.position.set(cargoFrame.x,cargoFrame.y,cargoFrame.z);crane.rotation.y=cargoFrame.yaw;scene.add(crane);
  box(crane,[1.2,12,1.2],[-11,6,0],'#a5b77e');box(crane,[25,1.2,1.2],[0,12,0],'#a5b77e');sign(crane,['SPECIAL DELIVERY','Cargo has right of way.'],16,[-14,17,0],'#b7ed72');
  const carMeshes=[],shadows=[],labels=[],dust=[];
  const signs=[];scene.traverse(o=>{if(o.userData.signWidth)signs.push(o);});
  const shadowMat=new THREE.MeshBasicMaterial({color:'#061021',transparent:true,opacity:.4,depthWrite:false});
  for(let i=0;i<8;i++){const group=new THREE.Group();scene.add(group);carMeshes.push(group);const shadow=mesh(new THREE.CircleGeometry(1,20),shadowMat.clone(),scene);shadow.rotation.x=-Math.PI/2;shadows.push(shadow);labels.push(null);}
  const dustGeo=new THREE.SphereGeometry(.18,5,4),dustMat=mat('#b3bac7',{transparent:true,opacity:.32,depthWrite:false});
  for(let i=0;i<96;i++){const p=mesh(dustGeo,dustMat,scene);p.visible=false;dust.push({mesh:p,life:0,vx:0,vz:0});}
  const confetti=new THREE.Group();scene.add(confetti);for(let i=0;i<70;i++){const p=mesh(new THREE.BoxGeometry(.25,.1,.45),new THREE.MeshBasicMaterial({color:TEAMS[i%4].color}),confetti);p.userData={angle:random()*Math.PI*2,speed:4+random()*8,phase:random()};}
  confetti.visible=false;let raceSeed=null,dustIndex=0,emitT=0,smoothedTarget=new THREE.Vector3(),ready=false;
  function resetCars(race){
    raceSeed=race.seed;ready=false;
    for(const c of race.cars){const g=carMeshes[c.id];while(g.children.length){const child=g.children[0];g.remove(child);child.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});}
      const car=makeVehicle(c.kind);car.scale.setScalar(c.scale);car.name='vehicle';
      car.traverse(o=>{if(!o.isMesh||!o.material?.color)return;const color=o.material.color;if(Math.max(color.r,color.g,color.b)>.09&&o.name!=='boost-exhaust')color.lerp(new THREE.Color(c.color),.7);});g.add(car);
      const plate=box(g,[c.hx*1.4,.05,1.5],[0,1.7*c.scale,.1],new THREE.MeshBasicMaterial({color:c.color}));plate.name='team-plate';
      const ring=mesh(new THREE.RingGeometry(2.1,2.27,28),new THREE.MeshBasicMaterial({color:c.color,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}),g,0,.07,0);ring.rotation.x=-Math.PI/2;ring.name='team-ring';
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture([`${c.number}  ${c.name.toUpperCase()}`,TEAMS.find(t=>t.id===c.team).short],{accent:c.color,height:192,width:512}),depthTest:false,depthWrite:false}));label.position.set(0,5.1,0);label.scale.set(7.2,2.7,1);g.add(label);labels[c.id]=label;
    }
    for(const p of dust){p.life=0;p.mesh.visible=false;}
  }
  function resize(){const width=innerWidth,height=innerHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  resize();
  function update(race,{dt=1/60,cameraMode='team',focus=0,reducedMotion=false,celebration=0}={}){
    if(raceSeed!==race.seed)resetCars(race);if(camera.aspect!==innerWidth/innerHeight)resize();
    const hazards=moonHazards(race.time,race.offset);jetRoot.visible=hazards.jetActive;plume.scale.setScalar(1+Math.sin(race.time*26)*.09);
    warning.material.opacity=hazards.jetActive?.55:hazards.jetWarning?.22+Math.sin(race.time*8)*.12:.07;
    const cp=trackFrame(CARGO_AT,hazards.cargoLane);cargo.position.set(cp.x,cp.y+1.5,cp.z);cargo.rotation.y=race.time*.1;hook.position.set(cp.x,cp.y+7.6,cp.z);
    const leader=raceOrder(race)[0],tracked=race.cars[cameraMode==='leader'?leader.id:focus]||leader;
    emitT+=dt;
    for(const c of race.cars){
      const g=carMeshes[c.id];g.position.set(c.x,c.y,c.z);g.rotation.y=c.yaw;const body=g.getObjectByName('vehicle');body.rotation.x=c.airborne?c.vy*.075:Math.atan(trackFrame(c.s).slope);body.rotation.z=-c.lateral*.03;
      body.traverse(o=>{if(o.name==='boost-exhaust'){o.visible=c.boosting;o.scale.z=1.6+Math.sin(race.time*32)*.25;}});
      const ground=trackFrame(c.s,c.lane);shadows[c.id].position.set(c.x,ground.y+.1,c.z);shadows[c.id].scale.set(1.8,2.6,1);shadows[c.id].material.opacity=.4/(1+Math.max(0,c.y-ground.y)*.35);
      labels[c.id].visible=!['track','showcase'].includes(cameraMode)&&(c.id===tracked.id||(c.team===tracked.team&&Math.hypot(c.x-tracked.x,c.z-tracked.z)>12));
      g.getObjectByName('team-ring').visible=c.id===focus;
      if(emitT>.085&&c.speed>7&&!c.airborne&&!reducedMotion){const p=dust[dustIndex++%dust.length];p.life=.7;p.mesh.position.set(c.x,c.y+.15,c.z);p.vx=-ground.tx*c.speed*.06;p.vz=-ground.tz*c.speed*.06;p.mesh.visible=true;p.mesh.scale.setScalar(c.boosting?1.5:1);}
    }
    if(emitT>.085)emitT=0;
    for(const p of dust)if(p.life>0){p.life-=dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.z+=p.vz*dt;p.mesh.position.y+=dt*.4;p.mesh.scale.multiplyScalar(1+dt*1.2);p.mesh.visible=p.life>0;}
    let target,offset;
    if(cameraMode==='showcase'){target=new THREE.Vector3(0,10,-8);offset=new THREE.Vector3(145,105,220);}
    else if(cameraMode==='track'){target=new THREE.Vector3(0,0,0);const portrait=camera.aspect<.85;offset=new THREE.Vector3(portrait?85:155,portrait?380:228,portrait?255:215);}
    else {const ahead=trackFrame(tracked.s+(tracked.finishTime!==null?0:8),tracked.lane*.3);target=new THREE.Vector3(ahead.x,Math.max(ahead.y,tracked.y)*.75,ahead.z);const wide=camera.aspect<.8?1.18:1;offset=new THREE.Vector3(36*wide,48*wide,47*wide);}
    if(!ready){smoothedTarget.copy(target);camera.position.copy(target).add(offset);ready=true;}
    // Fixed world heading avoids turn-by-turn spins and sudden broadcast cuts.
    const follow=1-Math.exp(-Math.min(dt,.05)*(reducedMotion?2.6:3.3));smoothedTarget.lerp(target,follow);camera.position.lerp(smoothedTarget.clone().add(offset),1-Math.exp(-Math.min(dt,.05)*2.7));camera.lookAt(smoothedTarget);
    // Reserve the left of portrait screens for the standings without hiding the followed car.
    if(camera.aspect<.8&&!['track','showcase'].includes(cameraMode))camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.2,0,innerWidth,innerHeight);
    else camera.clearViewOffset();
    confetti.visible=celebration>0&&!reducedMotion;
    if(confetti.visible){const win=leader;confetti.position.set(win.x,win.y+2,win.z);for(const p of confetti.children){const {angle,speed,phase}=p.userData,t=(celebration+phase*.8)%2.4;p.position.set(Math.cos(angle)*speed*t,9*t-4*t*t,Math.sin(angle)*speed*t);p.rotation.set(t*4,angle+t*3,t*5);}}
    const screen=new THREE.Vector3(tracked.x,tracked.y+1,tracked.z).project(camera);
    // Keep jokes readable without letting a nearby billboard cover the race.
    const world=new THREE.Vector3();
    for(const label of signs){
      label.getWorldPosition(world);const distance=camera.position.distanceTo(world),cap=innerWidth<540?130:210;
      const w=Math.min(label.userData.signWidth,cap*2*distance*Math.tan(camera.fov*Math.PI/360)/innerHeight);label.scale.set(w,w/3,1);
      const projected=world.project(camera),overCar=!['track','showcase'].includes(cameraMode)&&Math.abs(projected.x-screen.x)*innerWidth/2<cap/2+16&&Math.abs(projected.y-screen.y)*innerHeight/2<cap/6+30;
      label.material.opacity+=( (overCar?.18:1)-label.material.opacity)*(1-Math.exp(-dt*8));
    }
    renderer.render(scene,camera);
    return {focus:tracked.id,position:camera.position.toArray(),target:smoothedTarget.toArray(),screen:[(screen.x+1)/2,(1-screen.y)/2],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  }
  return {scene,camera,renderer,update,resize};
}
