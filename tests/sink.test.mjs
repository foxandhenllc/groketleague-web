import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../sim.js';
import {SINK,makeArenaState,resetSinkRound,stepSink,drainGoal,sinkHeight,sinkSurface,faucetPhase} from '../sink.js';
import {simulationConfig} from '../simulation-config.js';
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

test('faucet warns without pushing, ramps into a localized flow, then ebbs',()=>{
 assert.equal(faucetPhase(6).phase,'idle');
 assert.deepEqual(faucetPhase(7),{phase:'warning',strength:0,remaining:2});
 assert.equal(faucetPhase(8.99).strength,0);
 assert.equal(faucetPhase(9).strength,0);
 assert.equal(faucetPhase(9.25).strength,.5);
 assert.equal(faucetPhase(10).strength,1);
 assert.equal(faucetPhase(12.5).phase,'ebb');
 assert.equal(faucetPhase(13.25).strength,.5);
 assert.deepEqual(faucetPhase(14),faucetPhase(0));
 const state=makeArenaState();state.time=10;state.next=100;
 const wet={x:0,z:0,vx:0,vz:0},dry={x:0,z:7,vx:0,vz:0},upstream={x:-14,z:0,vx:0,vz:0};
 const ball={x:0,z:0,y:.9,vx:0,vz:0,vy:0};
 stepSink(state,[wet,dry,upstream],ball,.1);
 assert.ok(wet.vx>0 && ball.vx>wet.vx);
 assert.equal(dry.vx,0);assert.equal(upstream.vx,0);
 assert.equal(sinkSurface(0,0,state).currentZ,0);
 assert.equal(sinkSurface(0,0,{time:8}).currentX,0);
 assert.equal(sinkSurface(0,0,{time:10}).currentX,SINK.currentAcceleration);
 assert.ok(sinkSurface(0,3.5,state).currentX>0 && sinkSurface(0,3.5,state).currentX<SINK.currentAcceleration);
 assert.equal(sinkSurface(0,5,state).wet,0);
});

test('rendered shoulders and downhill forces share a smooth surface gradient',()=>{
 for(const [x,z] of [[0,0],[15,0],[-20,0],[20,30],[0,-31]]) {
  const s=sinkSurface(x,z),e=1e-5;
  assert.ok(Math.abs(s.slopeX-(sinkHeight(x+e,z)-sinkHeight(x-e,z))/(2*e))<1e-5);
  assert.ok(Math.abs(s.slopeZ-(sinkHeight(x,z+e)-sinkHeight(x,z-e))/(2*e))<1e-5);
 }
 const state=makeArenaState(),car={x:20,z:30,vx:0,vz:0},ball={...car,y:.9,vy:0};
 stepSink(state,[car],ball,.1);
 const gradient=sinkSurface(car.x,car.z);
 assert.ok(car.vx*gradient.slopeX+car.vz*gradient.slopeZ<0);
 assert.ok(ball.vx*gradient.slopeX+ball.vz*gradient.slopeZ<0);
 assert.ok(Math.hypot(ball.vx,ball.vz)>Math.hypot(car.vx,car.vz));
});

for(const mode of ['pixel','3d']) {
 test(`${mode}: visible wet floor preserves sideways slip and longer ball rolls`,()=>{
  const s=createSimulation(mode);s.setSink(true);
  const wet=s.bodyFrom('model3',0,0,0),dry=s.bodyFrom('model3',0,10,0);
  wet.vx=dry.vx=4;
  for(let i=0;i<24;i++){s.drive(wet,0,0,false,1/120);s.drive(dry,0,0,false,1/120);}
  assert.ok(wet.vx>dry.vx*1.3,'wet lateral grip should be visibly weaker');
  const wetBall={x:0,z:0,y:s.getBallRadius(),vx:4,vz:0,vy:0},dryBall={...wetBall,z:10};
  for(let i=0;i<120;i++){s.stepBall(wetBall,1/120);s.stepBall(dryBall,1/120);}
  assert.ok(wetBall.vx>dryBall.vx*(mode==='3d'?1.08:1.4),'wet rolling drag should be lower');
  assert.ok(wetBall.x>dryBall.x);
  assert.equal(sinkSurface(0,0,{time:0}).wet,sinkSurface(0,0,{time:11}).wet,'wet appearance and handling persist while faucet is off');
 });
 test(`${mode}: sink tuning cannot change classic driving or ball motion`,()=>{
  const changed=structuredClone(simulationConfig);changed.sink.wetGripScale=.01;changed.sink.wetBallDragScale=.01;changed.sink.slopeCurveX=4;
  const ordinary=createSimulation(mode),variant=createSimulation(mode,changed);
  const a=ordinary.bodyFrom('model3',0,0,0),b=variant.bodyFrom('model3',0,0,0);
  a.vx=b.vx=4;
  const x={x:0,z:0,y:ordinary.getBallRadius(),vx:4,vz:0,vy:0},y={...x};
  for(let i=0;i<60;i++){
   ordinary.drive(a,1,.2,false,1/120);variant.drive(b,1,.2,false,1/120);
   ordinary.stepBall(x,1/120);variant.stepBall(y,1/120);
  }
  assert.deepEqual(a,b);assert.deepEqual(x,y);
  variant.setSink(true);variant.setSink(false);
  ordinary.drive(a,0,0,false,1/120);variant.drive(b,0,0,false,1/120);
  assert.deepEqual(a,b,'leaving Kitchen Sink restores ordinary traction immediately');
 });
}

test('drain rim attraction bends low ball paths, never cars or distant play',()=>{
 const state=makeArenaState(),car={x:5,z:SINK.drainZ,vx:0,vz:0},ball={...car,y:.9,vy:0};
 assert.equal(drainGoal(ball,.9),null,'attraction starts outside the scoring circle');
 stepSink(state,[car],ball,.1);
 assert.ok(ball.vx<0 && ball.vx>-.4);assert.equal(car.vx,0);assert.equal(car.vz,0);
 assert.equal(sinkSurface(8,SINK.drainZ).drainPullX,0);
 assert.equal(sinkSurface(0,0).drainPullZ,0);
 assert.ok(sinkSurface(2,SINK.drainZ-3).drainPullZ>0);
 assert.ok(sinkSurface(2,-SINK.drainZ+3).drainPullZ<0);
});

test('airborne balls clear floor currents and drain suction',()=>{
 const state=makeArenaState();state.time=10;state.next=100;
 for(const [x,z] of [[0,0],[5,SINK.drainZ],[20,0]]) {
  const ball={x,z,y:4,vx:0,vz:0,vy:0};stepSink(state,[],ball,1/120);
  assert.equal(ball.vx,0);assert.equal(ball.vz,0);
 }
});

test('3d shoulder contacts compare ball height against the car local floor',()=>{
 const sink=createSimulation('3d'),classic=createSimulation('3d');sink.setSink(true);
 const a=sink.bodyFrom('model3',19.8,10,0),b=classic.bodyFrom('model3',19.8,10,0);
 const high={x:21.25,z:10,y:sink.getBallRadius()+.4,vx:-5,vz:0,vy:0},flat={...high,y:classic.getBallRadius()+.4};
 const events=sink.solveContacts([a],high,1/120),ordinary=classic.solveContacts([b],flat,1/120);
 assert.equal(events.some(e=>e.type==='ballHit'),false,'ball on the raised shoulder clears the downhill car');
 assert.equal(a.vx,0);
 assert.ok(ordinary.some(e=>e.type==='ballHit'),'the same floor-relative ball height touches on a flat arena');
});

test('sustained surface forces remain within the sink speed envelope',()=>{
 const state=makeArenaState();state.next=1000;
 const car={x:0,z:0,vx:0,vz:0},ball={...car,y:.9,vy:0};
 for(let i=0;i<120*120;i++)stepSink(state,[car],ball,1/120);
 assert.ok(Math.hypot(car.vx,car.vz)<=SINK.carMaxSpeed);
 assert.ok(Math.hypot(ball.vx,ball.vz)<=SINK.ballMaxSpeed);
});

test('goal reset clears the old warning but preserves match clock, faucet and alternating hazard sequence',()=>{
 const state=makeArenaState('round-reset'),ball={x:0,z:0,y:.9,vx:0,vz:0,vy:0};
 state.time=5;stepSink(state,[],ball,0);
 assert.equal(state.hazard.kind,'meteor');assert.equal(state.hazard.fired,false);
 state.time=8;state.faucet=faucetPhase(8);state.surge=state.faucet.strength;
 const before=structuredClone(state),next=resetSinkRound(state);
 assert.deepEqual(state,before,'pure reset must not mutate the outgoing round');
 assert.notEqual(next,state);assert.equal(next.hazard,null);
 for(const key of ['time','seed','index','surge','faucet'])assert.deepEqual(next[key],state[key]);
 assert.equal(next.faucet.phase,'warning','faucet warning carries through the kickoff');
 next.time=9.5;stepSink(next,[],ball,0);
 assert.equal(next.hazard,null);assert.equal(next.faucet.phase,'flow');assert.equal(next.surge,1);
 next.time=next.next;stepSink(next,[],ball,0);
 assert.equal(next.hazard.kind,'lightning');assert.equal(next.hazard.id,2);
 assert.equal(next.hazard.age,0,'next event gets its complete warning interval');
});

test('goal reset grants exactly the needed hazard grace without postponing later warnings',()=>{
 for(const time of [1,4,8,12.9,35])for(const until of [-2,0,.5,2.5,5,8]) {
  const state={...makeArenaState('grace'),time,next:time+until};
  const next=resetSinkRound(state);
  assert.ok(next.next>=time+SINK.kickoffHazardGrace);
  assert.equal(next.next,Math.max(state.next,time+SINK.kickoffHazardGrace));
  assert.ok(next.next-state.next<=Math.max(0,SINK.kickoffHazardGrace-until));
  assert.deepEqual(resetSinkRound(next),next,'duplicate reset at the same time cannot extend grace');
 }
 const state={...makeArenaState('safe-kickoff'),time:12.8,next:13,index:1};
 const next=resetSinkRound(state),ball={x:0,z:0,y:.9,vx:0,vz:0,vy:0};
 next.time=next.next-.01;stepSink(next,[],ball,0);assert.equal(next.hazard,null);
 next.time=next.next;stepSink(next,[],ball,0);assert.equal(next.hazard.kind,'lightning');
});

test('frequent goals no longer restart the faucet clock or force every event to be a meteor',()=>{
 let state=makeArenaState('fast-goals');
 const ball={x:0,z:0,y:.9,vx:0,vz:0,vy:0},kinds=new Set();let flows=0,lastId=0;
 for(let tick=1;tick<=36*120;tick++) {
  stepSink(state,[],ball,1/120);
  if(state.faucet.phase==='flow')flows++;
  if(state.hazard?.id!==lastId&&state.hazard){kinds.add(state.hazard.kind);lastId=state.hazard.id;}
  if(tick%(4*120)===0)state=resetSinkRound(state);
 }
 assert.ok(Math.abs(state.time-36)<1e-8);
 assert.ok(flows>0);assert.deepEqual([...kinds].sort(),['lightning','meteor']);
 assert.ok(state.index>=3);
});
