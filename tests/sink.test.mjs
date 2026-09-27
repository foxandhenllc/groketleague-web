import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../sim.js';
import {SINK,makeArenaState,stepSink,drainGoal,sinkHeight} from '../sink.js';
for(const mode of ['pixel','3d']){
 test(`${mode}: sink scores only a whole low ball inside the opposing drain`,()=>{
  const s=createSimulation(mode);s.setSink(true);const r=s.getBallRadius();
  const ball={x:0,z:-SINK.drainZ,y:r,vx:0,vz:0,vy:0};
  assert.equal(s.stepBall({...ball},1/120),'A');assert.equal(s.stepBall({...ball,z:SINK.drainZ},1/120),'B');
  assert.equal(drainGoal({...ball,x:SINK.drainRadius-r+.01},r),null);
  assert.equal(drainGoal({...ball,y:r+3},r),null);
  const edge={...ball,z:-34.5,vz:-10};assert.equal(s.stepBall(edge,1/120),null);assert.ok(edge.vz>0);
  s.setSink(false);assert.equal(s.stepBall({...ball},1/120),null);
 });
 test(`${mode}: a sink defender and striker target the actual drain`,()=>{
  const s=createSimulation(mode);s.setSink(true);
  const p=s.bodyFrom('model3',0,10,0),b=s.bodyFrom('semi',8,-10,Math.PI),ball={x:0,z:0,y:s.getBallRadius(),vx:0,vz:0,vy:0};
  let scored=false;
  for(let i=0;i<120*15;i++){s.botAI(p,b,ball,1/120,-1,false,{tactic:'attack'});s.solveContacts([p],ball,1/120);if(s.stepBall(ball,1/120)==='A'){scored=true;break;}}
  assert.ok(scored,'open shot reaches drain');
 });
}
test('hazards are seeded, telegraphed, bounded and hit each body once',()=>{
 const run=()=>{
  const s=createSimulation('3d'),p=s.bodyFrom('model3',0,0,0),b=s.bodyFrom('semi',0,0,0),ball={x:0,z:0,y:.55,vx:0,vz:0,vy:0},state=makeArenaState('fixture');
  for(let i=0;i<601;i++)stepSink(state,[p,b],ball,1/120);
  assert.ok(state.hazard);assert.equal(state.hazard.fired,false);assert.equal(ball.vx,0);
  Object.assign(p,{x:state.hazard.x+.1,z:state.hazard.z});Object.assign(ball,{x:p.x,z:p.z});
  while(!state.hazard.fired)stepSink(state,[p,b],ball,1/120);
  assert.ok(Math.hypot(p.vx,p.vz)>5);assert.ok(Math.hypot(ball.vx,ball.vz)<=42);
  const v=ball.vx;stepSink(state,[p,b],ball,1/120);assert.equal(ball.vx,v);
  return {state,p,ball};
 };
 assert.deepEqual(run(),run());
});
test('basin shoulders push inward and faucet surge has a physical effect',()=>{
 const state=makeArenaState(),a={x:21,z:0,vx:0,vz:0},ball={x:0,z:0,y:.9,vx:0,vz:0};
 stepSink(state,[a],ball,.1);assert.ok(a.vx<0);assert.ok(sinkHeight(21,0)>0);
 state.time=11;state.next=100;stepSink(state,[a],ball,.1);assert.ok(ball.vx>0);
});
test('lightning interrupts boost briefly and then releases the car',()=>{
 const s=createSimulation(),car=s.bodyFrom('model3',1,0,0),ball={x:10,z:0,y:.55,vx:0,vz:0,vy:0};
 const state=makeArenaState();state.hazard={id:1,kind:'lightning',x:0,z:0,age:1.49,fired:false};
 assert.equal(stepSink(state,[car],ball,.02),'lightning');assert.ok(car.shock>0);
 s.drive(car,1,0,true,1/120);assert.equal(car.boosting,false);assert.equal(car.boostReason,'ZAPPED');
 for(let i=0;i<80;i++)s.drive(car,1,0,false,1/120);
 assert.equal(car.shock,0);
});
