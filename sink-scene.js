import * as THREE from 'three';
import { SINK, sinkHeight } from './sink.js';
/** View-only oversized kitchen; gameplay geometry lives in sink.js/sim.js. */
export function makeSinkScene(scene) {
  const root=new THREE.Group();scene.add(root);root.visible=false;
  const metal=new THREE.MeshStandardMaterial({color:'#9fbdc9',metalness:.65,roughness:.3});
  const chrome=new THREE.MeshStandardMaterial({color:'#d7f1ff',metalness:.8,roughness:.2});
  const mat=color=>new THREE.MeshLambertMaterial({color});
  const add=(g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.receiveShadow=true;root.add(o);return o;};
  const box=(w,h,d,x,y,z,m)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const counter=mat('#d5b696');
  box(22,3,112,-33,1,0,counter);box(22,3,112,33,1,0,counter);
  box(44,3,22,0,1,-45,counter);box(44,3,22,0,1,45,counter);
  const floor=new THREE.PlaneGeometry(44,68,44,68);floor.rotateX(-Math.PI/2);
  const pos=floor.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,sinkHeight(pos.getX(i),pos.getZ(i)));
  floor.computeVertexNormals();add(floor,metal,0,-.02,0);
  for(const side of [-1,1]) {
    box(1,1.8,68,side*22,2.3,0,chrome);box(44,1.8,1,0,2.3,side*34,chrome);
    const color=side>0?'#ffc268':'#62dbe8';
    const disk=add(new THREE.CircleGeometry(SINK.drainRadius,48),mat('#07141b'),0,.025,side*SINK.drainZ);disk.rotation.x=-Math.PI/2;
    for(const [inner,outer,m] of [[4,4.5,chrome],[4.6,4.85,mat(color)],[1.1,1.3,chrome],[2.4,2.55,chrome]]) {
      const ring=add(new THREE.RingGeometry(inner,outer,48),m,0,.05,side*SINK.drainZ);ring.rotation.x=-Math.PI/2;
    }
    for(let i=0;i<8;i++){const angle=i*Math.PI/4,slot=box(.12,.04,7.8,0,.065,side*SINK.drainZ,metal);slot.rotation.y=angle;}
  }
  // A chrome swan-neck faucet feeds the basin from the left countertop.
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-27,3,0),new THREE.Vector3(-27,16,0),new THREE.Vector3(-20,21,0),new THREE.Vector3(-9,16,0),new THREE.Vector3(-9,11,0)]);
  add(new THREE.TubeGeometry(curve,32,.8,10,false),chrome,0,0,0);
  box(5,1,5,-27,3,0,chrome);
  const water=add(new THREE.CylinderGeometry(.4,.9,10,12),new THREE.MeshBasicMaterial({color:'#7fe8ff',transparent:true,opacity:.35}),-9,5.5,0);
  // Oversized dish, sponge and soap bottle establish the toy-car scale.
  for(const z of [-21,22]){
    const plate=add(new THREE.CylinderGeometry(8,7.5,.8,32),mat('#f4e8d9'),32,3,z);
    const inset=add(new THREE.TorusGeometry(6,.25,8,40),mat('#8aaec3'),32,3.5,z);inset.rotation.x=Math.PI/2;
  }
  box(8,2,5,-31,4,-21,mat('#eed14b'));box(8,.4,5,-31,5.2,-21,mat('#35785d'));
  box(5,9,4,-32,7,23,mat('#54b9a9'));box(2,2,2,-32,12.5,23,mat('#e9f2de'));
  const hazard=new THREE.Group();root.add(hazard);
  const ring=new THREE.Mesh(new THREE.RingGeometry(SINK.radius-.16,SINK.radius,48),new THREE.MeshBasicMaterial({color:'#ff7447',side:THREE.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.15;hazard.add(ring);
  const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5,0),mat('#e06b36'));hazard.add(rock);
  const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.15,.7,24,5),new THREE.MeshBasicMaterial({color:'#b7f7ff'}));hazard.add(bolt);
  const shards=Array.from({length:12},()=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.25,0),mat('#ffc77a'));hazard.add(m);return m;});
  return {root,update(state){
    water.visible=!!state?.surge;water.material.opacity=.2+(state?.surge||0)*.4;
    const h=state?.hazard;hazard.visible=!!h;if(!h)return;
    hazard.position.set(h.x,0,h.z);
    const hit=h.age>=SINK.warning;
    ring.material.color.set(h.kind==='meteor'?'#ff7447':'#9bedff');
    ring.scale.setScalar(hit?1+(h.age-SINK.warning)*2:1);ring.material.opacity=hit?Math.max(0,1-(h.age-SINK.warning)/.9):.65;
    rock.visible=h.kind==='meteor'&&!hit;rock.position.y=Math.max(0,(SINK.warning-h.age)*20);rock.rotation.x=h.age*3;
    shards.forEach((s,i)=>{s.visible=hit&&h.kind==='meteor';const t=h.age-SINK.warning,a=i*Math.PI/6;s.position.set(Math.cos(a)*t*9,Math.max(0,4*t-5*t*t),Math.sin(a)*t*9);});
    bolt.visible=h.kind==='lightning'&&hit&&h.age<SINK.warning+.3;bolt.position.y=12;
  }};
}
