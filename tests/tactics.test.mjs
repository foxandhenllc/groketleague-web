import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../sim.js';
import {planDrive} from '../autopilot.js';
import {kickoffLayout} from '../match-variety.js';

test('a goal-side defender holds the incoming shot lane instead of sidestepping it',()=>{
 for(const mode of ['pixel','3d']){
  const sim=createSimulation(mode),me=sim.bodyFrom('model3',0,-8,Math.PI),foe=sim.bodyFrom('semi',0,8,0);
  const ball={x:0,z:0,y:sim.getBallRadius(),vx:0,vy:0,vz:-20};
  assert.equal(planDrive(me,foe,ball,1/120,1,sim.getField(),false).state,'defend');
  assert.ok(Math.abs(me._ai.target.x)<.01,'stay in the path of the shot');
  assert.ok(me._ai.target.z<0,'meet it before the defended goal');
 }
});
test('all faceoffs require a redirected shot rather than a straight spawn-to-goal launch',()=>{
 for(const seed of ['capture-review-1-1-20260925','launch-check','mirrored'])for(let round=0;round<5;round++){
  const k=kickoffLayout(seed,round);
  assert.ok(Math.abs(Math.hypot(k.P.x-k.ball.x,k.P.z)-Math.hypot(k.B.x-k.ball.x,k.B.z))<1e-9);
  for(const [car,goal] of [[k.P,-34],[k.B,34]]){
   const cross=k.ball.x+(k.ball.x-car.x)/(k.ball.z-car.z)*(goal-k.ball.z);
   assert.ok(Math.abs(cross)>5.5,'unsteered faceoff launch misses the goal mouth');
  }
 }
});
