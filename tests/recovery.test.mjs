import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../sim.js';
import { simulationConfig } from '../simulation-config.js';
import { reachableTarget } from '../drive-geometry.js';
import { cornerContact } from '../arena-geometry.js';
import { constrainChase } from '../chase-camera.js';
import { planDrive } from '../autopilot.js';

for(const mode of ['pixel','3d'])for(const spec of simulationConfig.cars){
 test(`${mode}/${spec.id}: setup footprints fit every corner at every yaw`,()=>{
  const sim=createSimulation(mode),car=sim.bodyFrom(spec.id,0,0,0),field=sim.getField();
  for(const sx of [-1,1])for(const sz of [-1,1])for(let i=0;i<24;i++){
   const yaw=i*Math.PI/12,p=reachableTarget(sx*22,sz*34,car,field,yaw),c=Math.cos(yaw),s=Math.sin(yaw);
   for(const a of [-1,1])for(const b of [-1,1]){
    const x=p.x+c*car.hx*a+s*car.hz*b,z=p.z-s*car.hx*a+c*car.hz*b;
    assert.ok(Math.abs(x)<=22+1e-6 && Math.abs(z)<=34+1e-6);
    const hit=cornerContact(x,z,22,34,0,field.corner);assert.ok(!hit || hit.depth<1e-6);
   }
  }
 });
 test(`${mode}/${spec.id}: move a stationary corner ball without boost`,()=>{
  for(const sx of [-1,1])for(const sz of [-1,1]){
   const sim=createSimulation(mode),ball={x:sx*19.25,z:sz*31.25,y:sim.getBallRadius(),vx:0,vz:0,vy:0};
   const car=sim.bodyFrom(spec.id,sx*12,sz*22,Math.atan2(-sx*7.25,-sz*9.25));
   let moved=0;
   for(let i=0;i<1800 && moved<5;i++){
    sim.botAI(car,null,ball,1/120,-sz,false);sim.solveContacts([car],ball,1/120);sim.stepBall(ball,1/120);
    moved=Math.hypot(ball.x-sx*19.25,ball.z-sz*31.25);
   }
   assert.ok(moved>=5,`corner ${sx}/${sz}: moved ${moved.toFixed(2)}`);
   assert.deepEqual(sim.diagnostics.export().counters,{});
  }
 });
}
test('defender recognizes a lined-up shot before the ball begins moving',()=>{
 const sim=createSimulation('pixel'),me=sim.bodyFrom('model3',7,-10,Math.PI),foe=sim.bodyFrom('semi',0,6,0);
 const ball={x:0,z:0,y:.9,vx:0,vz:0,vy:0};
 const plan=planDrive(me,foe,ball,1/120,1,sim.getField(),false);
 assert.equal(plan.state,'defend');assert.ok(me._ai.target.z<0);assert.ok(Math.abs(me._ai.target.x)<Math.abs(me.x));
});
test('castle chase camera remains inside scenery even after an extreme chase offset',()=>{
 for(const x of [-45,-26,0,26,45])for(const z of [-55,-42,0,42,55]){
  const p=constrainChase({x,y:8.2,z},22,34);assert.ok(Math.abs(p.x)<=20&&Math.abs(p.z)<=32);
  if(Math.abs(x)>17||Math.abs(z)>29)assert.ok(p.y>=12);
 }
});
