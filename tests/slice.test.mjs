import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../sim.js';
import { simulationConfig as config, validateConfig } from '../simulation-config.js';
import { configHash, canonicalJSON, compatible, compatibleSetup, compatibilityFields } from '../net-protocol.js';
import { createDiagnostics } from '../diagnostics.js';
import { createEventStream } from '../sim-events.js';
import { updateBoost } from '../boost.js';
import { ballManifold } from '../contacts.js';
import { rollDelta } from '../art-contract.js';
const dt=1/120;
const ballAt=(sim,fields={})=>({x:0,z:0,y:sim.getBallRadius(),vx:0,vz:0,vy:0,...fields});
const energy=(cars,b)=>cars.reduce((s,c)=>s+c.mass*(c.vx*c.vx+c.vz*c.vz)/2,config.ball.mass*(b.vx*b.vx+b.vz*b.vz)/2);
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('canonical physics hash is stable and sensitive; mismatches block',async()=>{
 const hash=await configHash(); assert.equal(await configHash({...config,cars:config.cars}),hash);
 const other=structuredClone(config);other.ball.mass+=.01;assert.notEqual(await configHash(other),hash);
 assert.equal(canonicalJSON({b:2,a:1}),canonicalJSON({a:1,b:2}));
 assert.equal(compatible(compatibilityFields(hash),hash),true);
 for(const msg of [{},{...compatibilityFields(hash),protocol:1},{...compatibilityFields(hash),configHash:'bad'}]) assert.equal(compatible(msg,hash),false);
 for(const gfx of ['bad',null,undefined,'3d']) assert.equal(compatibleSetup({...compatibilityFields(hash),gfx},hash,'pixel'),false);
 assert.equal(compatibleSetup({...compatibilityFields(hash),gfx:'pixel'},hash,'pixel'),true);
 assert.throws(()=>canonicalJSON({bad:NaN}));assert.throws(()=>canonicalJSON({bad:undefined}));assert.ok(Object.isFrozen(config.cars[0]));
 const invalid=structuredClone(config);invalid.cars[0].mass=0;assert.throws(()=>validateConfig(invalid));
});
test('simulation instances preserve independent modes and diagnostics',()=>{
 const a=createSimulation('pixel'),b=createSimulation('3d');
 const x=ballAt(a,{vx:5}),y=ballAt(b,{vx:5});
 for(let i=0;i<100;i++){a.stepBall(x,dt);b.stepBall(y,dt);}
 assert.equal(a.getBallRadius(),.9);assert.equal(b.getBallRadius(),.5502);near(x.x,y.x);
 b.setPixelTight(true);assert.equal(a.getBallRadius(),.9);
});
test('diagnostics are bounded, opt-in and count repairs independently',()=>{
 const d=createDiagnostics(3);d.record(1);assert.equal(d.export().frames.length,0);
 d.enabled=true;for(let i=0;i<10;i++)d.record(i);assert.deepEqual(d.export().frames,[7,8,9]);
 d.count('cap');assert.equal(d.export().counters.cap,1);d.reset();assert.deepEqual(d.export().frames,[]);
});
for(const mode of ['pixel','3d'])for(const car of config.cars){
 test(`${mode}/${car.id}: ten-second hold never restarts and release recharges`,()=>{
  const sim=createSimulation(mode),c=sim.bodyFrom(car.id,0,0,0);let starts=0,was=false;
  for(let i=0;i<1200;i++){c.x=c.z=0;sim.drive(c,1,0,true,dt);if(c.boosting&&!was)starts++;was=c.boosting;}
  assert.equal(starts,1);assert.equal(c.boost,0);assert.equal(c.boostState,'release');
  for(let i=0;i<10;i++)updateBoost(c,false,true,dt);updateBoost(c,true,true,dt);assert.equal(c.boosting,false);
  for(let i=0;i<150;i++)updateBoost(c,false,true,dt);assert.ok(c.boost>=.18);updateBoost(c,true,true,dt);assert.equal(c.boosting,true);
  updateBoost(c,false,true,dt);assert.equal(c.boosting,false);
 });
 test(`${mode}/${car.id}: isolated rotated impacts conserve momentum and passive energy`,()=>{
  const sim=createSimulation(mode);
  for(const degrees of [0,15,45,90,135,180])for(const boost of [false,true]){
   sim.resetContacts();const yaw=degrees*Math.PI/180,c=sim.bodyFrom(car.id,0,0,yaw),f=sim.forwardXZ(yaw);
   c.vx=f.x*18;c.vz=f.z*18;c.boosting=boost;
   const b=ballAt(sim,{x:f.x*(c.l/2+sim.getBallRadius()-.01),z:f.z*(c.l/2+sim.getBallRadius()-.01)});
   const initial=energy([c],b),px=c.mass*c.vx,pz=c.mass*c.vz;
   const events=sim.solveContacts([c],b,dt);assert.equal(events.length,1);
   near(c.mass*c.vx+config.ball.mass*b.vx,px);near(c.mass*c.vz+config.ball.mass*b.vz,pz);
   assert.ok(energy([c],b)<=initial+1e-6);near(Math.hypot(events[0].nx,events[0].nz),1);
  }
 });
}
test('waiting intent never recharges, drains, or fires after release',()=>{
 const s=createSimulation(),c=s.bodyFrom('model3',0,0,0);
 for(let i=0;i<100;i++)updateBoost(c,true,false,dt);assert.equal(c.boost,.75);assert.equal(c.boostState,'waiting');
 updateBoost(c,false,true,dt);assert.equal(c.boosting,false);assert.equal(c.boost,.75);
});
test('squeeze and board pin remain passive and finite without caps',()=>{
 for(const mode of ['pixel','3d'])for(const reverse of [false,true]){
  const s=createSimulation(mode),a=s.bodyFrom('model3',0,3,0),b=s.bodyFrom('model3',0,-3,Math.PI),ball=ballAt(s);
  a.vz=-8;b.vz=8;const initial=energy([a,b],ball);
  for(let i=0;i<240;i++){
   a.z+=a.vz*dt;b.z+=b.vz*dt;ball.z+=ball.vz*dt;
   s.solveContacts(reverse?[b,a]:[a,b],ball,dt);
   assert.ok(energy([a,b],ball)<=initial+1e-6);
  }
  for(const c of [a,b,ball])assert.ok([c.x,c.z,c.vx,c.vz].every(Number.isFinite));
  assert.equal(s.diagnostics.export().counters.ballSafetyCap,undefined);
 }
});
test('deep correction converges without impact events',()=>{
 const s=createSimulation('pixel'),c=s.bodyFrom('semi',0,0,0),b=ballAt(s);
 for(let i=0;i<20;i++)assert.equal(s.solveContacts([c],b,dt).length,0);
 assert.ok((ballManifold(c,b,.9)?.depth||0)<=.01);
});
test('release preserves collision overspeed rather than clamping to propulsion cap',()=>{
 const s=createSimulation('pixel'),c=s.bodyFrom('semi',0,0,0);c.vz=-30;
 s.drive(c,0,0,false,dt);assert.ok(-c.vz>c.max);assert.ok(-c.vz<30);
});
test('visual roll depends on travel, not render frequency',()=>{
 for(const hz of [30,60,120,144,240]){let x=0,z=0;for(let i=0;i<hz;i++){const d=rollDelta(3,5,1/hz,.5502);x+=d.x;z+=d.z;}near(x,5/.5502);near(z,-3/.5502);}
});
test('event resend, reorder, bounded storage and epoch reset are safe',()=>{
 const host=createEventStream(4),guest=createEventStream(4);host.reset(1);guest.reset(1);
 const record={type:'ballHit',pair:'P:ball',tick:1,x:0,y:0,z:0,nx:0,ny:0,nz:-1,closing:5,impulse:2};
 host.emit([record,record]);let packet=host.packet();const first=guest.receive(1,[...packet.events].reverse());assert.equal(first.events.length,2);
 assert.equal(guest.receive(1,packet.events).events.length,0);host.acknowledge(first.ack);assert.equal(host.packet().events.length,0);
 host.emit(Array.from({length:20},()=>record));assert.equal(host.packet().events.length,4);
 assert.equal(guest.receive(0,packet.events).events.length,0);guest.reset(2);assert.equal(guest.receive(1,packet.events).events.length,0);
});

test('fast powered returns dissipate restitution instead of activating a velocity cap',()=>{
 const s=createSimulation('pixel'),c=s.bodyFrom('cybertruck',0,0,0);c.vz=-24;c.boosting=true;
 const b=ballAt(s,{z:-3.3,vz:40});const before=energy([c],b),momentum=c.mass*c.vz+config.ball.mass*b.vz;
 s.solveContacts([c],b,dt);assert.ok(Math.hypot(b.vx,b.vz)<=48+1e-6);
 near(c.mass*c.vz+config.ball.mass*b.vz,momentum);assert.ok(energy([c],b)<=before+1e-6);
 s.stepBall(b,dt);assert.equal(s.diagnostics.export().counters.ballSafetyCap,undefined);
});

test('board-car-ball pin dissipates energy and settles within tolerance',()=>{
 for(const mode of ['pixel','3d']) {
  const s=createSimulation(mode),c=s.bodyFrom('model3',19.8,0,0),b=ballAt(s,{x:21.3});c.vx=10;
  const initial=energy([c],b);
  for(let i=0;i<240;i++){
   c.x+=c.vx*dt;b.x+=b.vx*dt;s.solveContacts([c],b,dt);
   assert.ok(energy([c],b)<=initial+1e-6);
  }
  assert.ok((ballManifold(c,b,s.getBallRadius())?.depth||0)<=.01);
  assert.ok(b.x<=22+(mode==='pixel'?0:.9)-s.getBallRadius()+.01);
 }
});
test('effect cooldown survives separation but does not suppress physical response',()=>{
 const s=createSimulation('3d'),c=s.bodyFrom('model3',0,0,0),b=ballAt(s,{z:-2.64,vz:10});
 assert.equal(s.solveContacts([c],b,dt).length,1);
 Object.assign(b,{z:-10,vz:0,vy:0});s.solveContacts([c],b,dt);
 Object.assign(c,{x:0,z:0,vx:0,vz:0});Object.assign(b,{z:-2.64,vz:10});
 assert.equal(s.solveContacts([c],b,dt).length,0);assert.ok(b.vz<0);assert.ok(b.vy>0,'physical lift is independent of sound cooldown');
});
