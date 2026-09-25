import fs from 'node:fs';
import {createSimulation} from '../sim.js';
import {simulationConfig} from '../simulation-config.js';
const dt=1/120,rows=[];
for(const spec of simulationConfig.cars){
 const s=createSimulation('pixel'),c=s.bodyFrom(spec.id,0,0,0),samples=[];
 for(let i=0;i<1200;i++){c.x=c.z=0;s.drive(c,1,0,false,dt);samples.push(-c.vz);}
 const cruise=samples.at(-1),t90=(samples.findIndex(v=>v>=cruise*.9)+1)*dt;
 Object.assign(c,{x:0,z:0,vx:0,vz:-15,yaw:0});let distance=0,time=0;
 for(let i=0;i<1200&&-c.vz>.5;i++){s.drive(c,-1,0,false,dt);distance+=Math.hypot(c.vx,c.vz)*dt;time+=dt;c.x=c.z=0;}
 Object.assign(c,{x:0,z:0,vx:0,vz:-10,yaw:0});s.drive(c,0,1,false,dt);
 rows.push({car:spec.id,cruise,t90,stopFrom15:{distance,time},instantTurnRadiusAt10:10/(c.yaw/dt)});
}
const out=process.env.QA_OUT||'output/first-playable-slice/controller';fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'/measurements.json',JSON.stringify(rows,null,2));console.log(rows);
