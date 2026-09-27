import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSimulation} from '../sim.js';
import {initSoap,sweptSoapDrain} from '../soap-physics.js';
import {makeArenaState,resetSinkRound,stepSink,sinkHeight} from '../sink.js';
import {simulationConfig} from '../simulation-config.js';
import {kickoffLayout,driverPersonality} from '../match-variety.js';
const dt=1/120;
const soapSim=()=>{const s=createSimulation('3d');s.setSink(true);return s;};
const soapAt=(x,z,vx=0,vz=0)=>{const b={x,z,y:1,vx,vz,vy:0};initSoap(b);return b;};

test('soap kickoff is grounded, radius is mode-specific, and classic/pixel remain ordinary balls',()=>{
 const b={x:18,z:4,y:6,vx:3,vz:2,vy:6};initSoap(b);
 assert.equal(b.y,1);assert.equal(b.vy,0);assert.equal(b.soap.airborne,false);
 assert.equal(b.soap.worldY,sinkHeight(18,4)+1);assert.equal(b.vx,3);
 const s=soapSim();assert.equal(s.getBallRadius(),1);
 s.setSink(false);assert.equal(s.getBallRadius(),simulationConfig.ball.radius3d);
 s.setPixelTight(true);s.setSink(true);assert.equal(s.getBallRadius(),simulationConfig.ball.radiusPixel);
 const pixel={x:0,z:0,y:.9,vx:5,vz:0,vy:0};s.stepBall(pixel,dt);assert.equal(pixel.soap,undefined);
});

test('soap retains visibly more flat-floor sliding momentum than the stadium ball',()=>{
 const sink=soapSim(),classic=createSimulation('3d');
 const bar=soapAt(-8,8,5,1),ball={x:-8,z:8,y:classic.getBallRadius(),vx:5,vz:1,vy:0};
 for(let i=0;i<240;i++){sink.stepBall(bar,dt);classic.stepBall(ball,dt);}
 assert.ok(bar.vx>3.5,'soap should still be sliding after two seconds');
 assert.ok(bar.vx>ball.vx*3,'ordinary ball loses appreciably more momentum');
 assert.equal(bar.soap.airborne,false);
});

test('authoritative soap tilt matches bank normals and remains continuous at launch',()=>{
 const bar=soapAt(19,8,0,0),s=bar.soap;
 assert.ok(Math.abs(s.pitch)<1e-10);assert.ok(Math.abs(s.roll-Math.atan(.48))<1e-10);
 const sim=soapSim(),moving=soapAt(16,6,23,3);let previous={...moving.soap},launched=false;
 for(let i=0;i<240;i++) {
  sim.stepBall(moving,dt);
  if(moving.soap.airborne) {
   const difference=n=>Math.abs(Math.atan2(Math.sin(n),Math.cos(n)));
   assert.ok(difference(moving.soap.pitch-previous.pitch)<.1);
   assert.ok(difference(moving.soap.roll-previous.roll)<.1);
   assert.ok(difference(moving.soap.yaw-previous.yaw)<.1);
   assert.ok(Math.abs(previous.pitch)+Math.abs(previous.roll)>.25,'soap visibly tilts up the bank before leaving it');
   launched=true;break;
  }
  previous={...moving.soap};
 }
 assert.ok(launched);
});

for(const setup of [{x:16,z:6,vx:23,vz:3},{x:-16,z:-6,vx:-23,vz:3},{x:8,z:29,vx:2,vz:23},{x:18,z:28,vx:20,vz:20}]) {
 test(`halfpipe ${setup.x}/${setup.z}: substantial takeoff, contained flight and a sliding landing`,()=>{
  const sim=soapSim(),b=soapAt(setup.x,setup.z,setup.vx,setup.vz);let airTime=0,maxClearance=0,landed=false;
  for(let i=0;i<600;i++){
   sim.stepBall(b,dt);airTime+=b.soap.airborne?dt:0;maxClearance=Math.max(maxClearance,b.y-1);
   assert.ok(Math.abs(b.x)<=21.000001&&Math.abs(b.z)<=33.000001);
   assert.ok(b.soap.worldY>=sinkHeight(b.x,b.z)+1-1e-6,'soap cannot render through the bowl');
   assert.ok([b.x,b.y,b.z,b.vx,b.vy,b.vz,b.soap.pitch,b.soap.yaw,b.soap.roll].every(Number.isFinite));
   if(b.soap.landings>0){landed=true;assert.ok(Math.hypot(b.vx,b.vz)>2,'landing continues the slide');break;}
  }
  assert.ok(airTime>.65,`airtime ${airTime} should be readable, not a one-frame bounce`);
  assert.ok(maxClearance>2,`clearance ${maxClearance} should clearly leave the bank`);
  assert.ok(landed);assert.equal(b.soap.airborne,false);assert.equal(b.y,1);
 });
}

test('fast drain crossing and edge graze capture the true entry point and incoming velocity',()=>{
 const s=soapSim(),bar=soapAt(3.5,-30,0,48);
 const goal=s.stepBall(bar,.25);assert.equal(goal,'A');
 const e=bar.soap.goalEntry;
 assert.ok(e.vz>40);assert.ok(e.speed>40);assert.ok(e.z<-23,'entry recorded on the near rim, not teleported to center');
 assert.ok(Math.abs(Math.hypot(e.x,e.z+23)-simulationConfig.sink.soap.drainCaptureRadius)<1e-8);
 assert.equal(bar.x,e.x);assert.equal(bar.z,e.z);
 const before=structuredClone(bar);assert.equal(s.stepBall(bar,dt),'A');assert.deepEqual(bar,before,'captured soap cannot change before the goal director runs');
 const hit=sweptSoapDrain({x:0,z:-31,worldY:1},{x:0,z:-15,worldY:1});assert.equal(hit.sign,-1);
 assert.equal(sweptSoapDrain({x:0,z:-31,worldY:5},{x:0,z:-15,worldY:5}),null,'high aerials pass above drains');
 assert.equal(sweptSoapDrain({x:4,z:-31,worldY:1},{x:4,z:-15,worldY:1}),null,'clear misses stay misses');
});

test('falling soap lands on the same visible bowl height and settles without sinking',()=>{
 const sim=soapSim(),b={x:18,z:9,y:6,vx:-3,vz:1,vy:-4};initSoap(b,{drop:true});
 for(let i=0;i<240&&b.soap.airborne;i++)sim.stepBall(b,dt);
 assert.equal(b.soap.airborne,false);assert.equal(b.soap.landings,1);
 assert.equal(b.y,1);assert.equal(b.soap.worldY,sinkHeight(b.x,b.z)+1);
 assert.ok(Math.hypot(b.vx,b.vz)>2);
});

test('a driven semi cannot permanently pin soap at the bank; release changes velocity, never position',()=>{
 const sim=soapSim(),car=sim.bodyFrom('semi',18,10,-Math.PI/2),bar=soapAt(20.5,10);
 let releaseAt=null,largestStep=0,wasAirborne=false;
 for(let i=0;i<720;i++){
  sim.drive(car,1,0,false,dt);sim.solveContacts([car],bar,dt);
  const before={x:bar.x,z:bar.z};sim.stepBall(bar,dt);
  largestStep=Math.max(largestStep,Math.hypot(bar.x-before.x,bar.z-before.z));
  if(bar.soap.releases&&releaseAt===null)releaseAt=i*dt;
  if(releaseAt!==null&&bar.soap.airborne)wasAirborne=true;
 }
 assert.ok(releaseAt!==null&&releaseAt<2,'actual board/car pin gets a bounded release');
 assert.ok(wasAirborne);assert.ok(bar.x<15,'soap returns to the playable bowl');
 assert.ok(largestStep<.5,`no escape teleport (${largestStep})`);
 assert.equal(bar.soap.releases,1,'release does not become a repeated free kick');
});

test('post-goal car coasting is passive, bounded and stops spending boost',()=>{
 const sim=soapSim(),a=sim.bodyFrom('model3',19,30,-Math.PI/2),b=sim.bodyFrom('semi',-19,-30,Math.PI/2);
 a.vx=20;a.vz=5;b.vx=-18;b.vz=-4;a.boosting=b.boosting=true;
 const start=Math.hypot(a.vx,a.vz,b.vx,b.vz),boost=[a.boost,b.boost];
 for(let i=0;i<318;i++)sim.coastCars([a,b],dt);
 assert.ok(Math.hypot(a.vx,a.vz,b.vx,b.vz)<start*.01);
 assert.deepEqual([a.boost,b.boost],boost);assert.equal(a.boosting,false);assert.equal(b.boosting,false);
 assert.ok(Math.abs(a.x)<22&&Math.abs(a.z)<34&&Math.abs(b.x)<22&&Math.abs(b.z)<34);
});

test('post-goal head-on cars collide without crossing, gaining energy, or running the planner',()=>{
 const sim=soapSim(),a=sim.bodyFrom('model3',-5,8,-Math.PI/2),b=sim.bodyFrom('model3',5,8,Math.PI/2);
 a.vx=15;b.vx=-15;a._ai={mode:'strike',target:{x:0,z:8}};b._ai={mode:'defend',target:{x:0,z:8}};
 const ai=structuredClone([a._ai,b._ai]);let energy=a.mass*a.vx*a.vx+b.mass*b.vx*b.vx,touched=false;
 for(let i=0;i<318;i++) {
  sim.coastCars([a,b],dt);
  const next=a.mass*(a.vx*a.vx+a.vz*a.vz)+b.mass*(b.vx*b.vx+b.vz*b.vz);
  assert.ok(next<=energy+1e-8,'a passive collision cannot add kinetic energy');energy=next;
  assert.ok(b.x-a.x>=a.hz+b.hz-1e-6,'vehicles cannot overlap or pass through each other');
  assert.ok(Math.abs(a.x)+a.hz<=22+1e-6&&Math.abs(b.x)+b.hz<=22+1e-6);
  if(a.vx<0&&b.vx>0)touched=true;
 }
 assert.ok(touched,'cars should bounce apart when they meet');assert.deepEqual([a._ai,b._ai],ai);
});

test('eight varied 90-second soap matches stay finite, launch, score, and avoid long stationary pins',()=>{
 const ids=['cybertruck','model3','cybercab','semi'],results=[];
 for(let variant=0;variant<2;variant++)for(const [i,id] of ids.entries()){
  const foe=ids[(i+1+variant)%4],seed=`soap-soak-${variant}-${id}`,sim=soapSim();sim.diagnostics.enabled=true;
  let arena=makeArenaState(seed),P,B,ball,round=0,hold=0,score=[0,0],contacts=0,airTime=0,launches=0,landings=0,releases=0,slow=0,maxSlow=0,peak=0;
  const reset=()=>{const k=kickoffLayout(seed,round);sim.resetContacts();P=sim.bodyFrom(id,k.P.x,k.P.z,k.P.yaw);B=sim.bodyFrom(foe,k.B.x,k.B.z,k.B.yaw);
   P.personality=driverPersonality(id,seed,round,'P');B.personality=driverPersonality(foe,seed,round,'B');
   ball=soapAt(k.ball.x,k.ball.z);round++;hold=0;slow=0;};reset();
  for(let tick=0;tick<10800;tick++){
   hold=Math.max(0,hold-dt);const distance=Math.hypot(ball.x-P.x,ball.z-P.z),reach=P.l/2+1,a=Math.atan2(-(ball.x-P.x),-(ball.z-P.z))-P.yaw;
   if(hold===0&&P.boost>.25&&ball.z<P.z&&Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<.25&&distance>reach+.5&&distance<reach+8&&ball.y-1<1.25)hold=.3;
   sim.botAI(P,B,ball,dt,-1,hold>0);sim.botAI(B,P,ball,dt,1);stepSink(arena,[P,B],ball,dt);
   contacts+=sim.solveContacts([P,B],ball,dt).filter(e=>e.type==='ballHit').length;
   const goal=sim.stepBall(ball,dt);airTime+=ball.soap.airborne?dt:0;peak=Math.max(peak,ball.y-1);
   assert.ok([P.x,P.z,B.x,B.z,ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz,ball.soap.worldY].every(Number.isFinite));
   slow=Math.hypot(ball.vx,ball.vz)<.7?slow+dt:0;maxSlow=Math.max(maxSlow,slow);
   if(goal){score[goal==='A'?0:1]++;launches+=ball.soap.launches;landings+=ball.soap.landings;releases+=ball.soap.releases;arena=resetSinkRound(arena);reset();}
  }
  launches+=ball.soap.launches;landings+=ball.soap.landings;releases+=ball.soap.releases;
  const counters=sim.diagnostics.export().counters;
  assert.equal(counters.ballSafetyCap,undefined);assert.equal(counters.invalidCarSpeed,undefined);assert.equal(counters.invalidContactState,undefined);
  assert.ok(contacts>10,`${id}/${foe} needs interaction`);assert.ok(score[0]+score[1]>0,`${id}/${foe} needs scoring`);
  assert.ok(maxSlow<8,`${id}/${foe}: stationary ${maxSlow}s`);assert.ok(airTime>.5);
  results.push({variant,id,foe,score,contacts,airTime,launches,landings,releases,peakClearance:peak,maxSlow,counters});
 }
 fs.mkdirSync('output/soap-physics',{recursive:true});fs.writeFileSync('output/soap-physics/matches.json',JSON.stringify(results,null,2));
});
