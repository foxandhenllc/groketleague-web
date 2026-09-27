import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSinkGoal,advanceSinkGoal} from '../sink-goal.js';
import {sinkCameraFrame,sinkCameraPose,createSinkDirector} from '../sink-camera.js';
import {SINK} from '../sink.js';

test('goal timeline preserves the swept entry, survives transport, and ends after the full celebration',()=>{
  const ball={x:2,z:-20,y:1,vx:-2,vy:0,vz:-17,soap:{worldY:1,pitch:.1,yaw:.6,roll:.2,
    goalEntry:{x:1.8,z:-19.8,worldY:1.2,vx:-2,vy:0,vz:-17}}};
  for(const winning of [false,true]) {
    const goal=JSON.parse(JSON.stringify(makeSinkGoal(ball,'A','match:round',winning)));
    assert.equal(goal.z,-SINK.drainZ);assert.equal(goal.winning,winning);
    assert.equal(goal.entry.x,1.8);assert.equal(goal.entry.worldY,1.2);
    assert.deepEqual(goal.entry.soap,{pitch:.1,yaw:.6,roll:.2});
    for(let i=0;i<317;i++)assert.equal(advanceSinkGoal(goal,1/120),false);
    assert.equal(advanceSinkGoal(goal,1/120),true);
    advanceSinkGoal(goal,5);assert.equal(goal.age,goal.duration);
  }
});

test('both drains receive a continuous camera push that returns to live composition before reset',()=>{
  for(const [w,h] of [[1440,900],[390,844],[844,390],[568,320]])for(const z of [-23,23]) {
    const frame=sinkCameraFrame(w,h),soap={x:1,y:.35,z,vx:0,vz:0},goal={age:0,duration:2.65,z};
    const baseline=sinkCameraPose(frame,soap,null),start=sinkCameraPose(frame,soap,goal);
    assert.deepEqual(start,baseline);
    let last=start;
    for(let tick=1;tick<=318;tick++) {
      goal.age=tick/120;const pose=sinkCameraPose(frame,soap,goal);
      assert.ok([...pose.position,...pose.target].every(Number.isFinite));
      assert.ok(Math.hypot(...pose.position.map((v,i)=>v-last.position[i]))<2.6,'no frame cuts');last=pose;
    }
    assert.deepEqual(last,baseline);
    const midpoint=sinkCameraPose(frame,soap,{...goal,age:1.1});
    assert.ok(Math.abs(midpoint.target[2])>Math.abs(baseline.target[2]));
  }
});

test('director freezes during pause, smooths a new kickoff and honors reduced motion',()=>{
  const frame=sinkCameraFrame(1440,900),director=createSinkDirector();
  const base=structuredClone(director.update(frame,{x:-18,z:-20,y:4},null,1/60));
  const paused=structuredClone(director.update(frame,{x:18,z:20,y:8},null,0));
  assert.deepEqual(paused,base);
  const moved=director.update(frame,{x:18,z:20,y:8},null,1/60);
  assert.ok(Math.hypot(...moved.position.map((v,i)=>v-base.position[i]))<.3);
  assert.deepEqual(director.update(frame,{x:18,z:20,y:8},{age:1,duration:2.65,z:23},1/60,true),{position:frame.position,target:[0,0,0]});
});
