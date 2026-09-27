import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../sim.js';
import {simulationConfig as config} from '../simulation-config.js';
import {updateMove,movePhase} from '../skills.js';
import {updateBoost} from '../boost.js';
import {planDrive} from '../autopilot.js';

for(const mode of ['pixel','3d']) {
  test(`${mode}: timed front contact is stronger; late or side contacts remain ordinary`,()=>{
    const hit=(age,side=false)=>{
      const s=createSimulation(mode),c=s.bodyFrom('model3',0,0,0);
      c.boosting=true;c._boost={pressAge:age,timedUsed:false};c.vz=-12;
      const r=s.getBallRadius(),b={x:side?c.hx+r-.01:0,z:side?0:-c.hz-r+.01,y:r,vx:0,vz:0,vy:0};
      if(side){c.vx=12;c.vz=0;}
      const events=s.solveContacts([c],b,1/120);
      return {speed:Math.hypot(b.vx,b.vz),events,c};
    };
    const timed=hit(.12),late=hit(.5),side=hit(.12,true);
    assert.ok(timed.speed>late.speed*1.1);
    assert.equal(timed.events[0].timed,true);assert.equal(timed.c._boost.timedUsed,true);
    assert.equal(late.events[0].timed,false);assert.equal(side.events[0].timed,false);
  });
  for(const kind of config.cars.map(c=>c.id)) test(`${mode}: ${kind} has a visible windup, physical effect, cooldown and release requirement`,()=>{
    const s=createSimulation(mode),a=s.bodyFrom(kind,0,0,0),b=s.bodyFrom(kind,0,0,0),ball={x:2,z:-10};
    a.vz=b.vz=-8;
    updateMove(a,ball,1/120,true);assert.equal(movePhase(a),'windup');
    for(let i=0;i<90;i++) {
      updateMove(a,ball,1/120,true);s.drive(a,1,0,false,1/120,{desiredSpeed:12});s.drive(b,1,0,false,1/120,{desiredSpeed:12});
    }
    if(kind==='semi')assert.ok(Math.abs(a.vz)<Math.abs(b.vz)*.5);
    else if(kind==='cybercab')assert.ok(a.x>b.x+.3);
    else assert.ok(a.z<b.z-.3);
    assert.ok(a.move.cooldown>0);
    const age=a.move.age;updateMove(a,ball,.01,false);updateMove(a,ball,.01,true);assert.ok(a.move.age>age);
    updateMove(a,ball,8,true);assert.equal(movePhase(a),'ready');
    updateMove(a,ball,.01,false);updateMove(a,ball,.01,true);assert.equal(movePhase(a),'windup');
  });
}
test('tactics choose different reachable routes, while Attack still protects an imminent own goal',()=>{
 const s=createSimulation('pixel'),me=s.bodyFrom('model3',8,10,0),foe=s.bodyFrom('semi',-6,-8,Math.PI),ball={x:0,z:0,vx:0,vz:0};
 me.tactic='attack';planDrive(me,foe,ball,1/120,-1,s.getField(),false);const attack={...me._ai.target};
 me.tactic='defend';planDrive(me,foe,ball,1/120,-1,s.getField(),false);assert.equal(me._ai.mode,'guard');assert.ok(me._ai.target.z>attack.z+10);
 me.tactic='attack';ball.z=26;ball.vz=10;planDrive(me,foe,ball,1/120,-1,s.getField(),false);assert.equal(me._ai.mode,'defend');
});
test('sustained boost costs more and unsafe waiting cannot store a perfect touch',()=>{
 const s=createSimulation(),c=s.bodyFrom('semi',0,0,0);
 for(let i=0;i<90;i++)updateBoost(c,true,false,1/120);
 assert.ok(c._boost.pressAge>config.skills.timingWindow);
 updateBoost(c,false,true,.2);updateBoost(c,true,true,.01);assert.equal(c._boost.pressAge,0);
 const start=c.boost;updateBoost(c,true,true,.01);const early=start-c.boost;
 c._boost.heldTime=1;const before=c.boost;updateBoost(c,true,true,.01);assert.ok(before-c.boost>early*1.3);
});
test('brace reduces displacement from a vehicle collision without changing permanent stats',()=>{
 const run=brace=>{const s=createSimulation('pixel'),a=s.bodyFrom('semi',0,0,0),b=s.bodyFrom('model3',0,5,0);b.vz=-15;if(brace)a.move={age:.3};s.solveContacts([a,b],{x:15,z:15,y:.9,vx:0,vz:0,vy:0},1/120);assert.equal(a.mass,4.6);return Math.abs(a.vz);};
 assert.ok(run(true)<run(false)*.6);
});
test('holding boost cannot bypass signature recovery or create a fresh boost press',()=>{
 const s=createSimulation(),c=s.bodyFrom('model3',0,0,0);c.move={age:.5};
 c._boost={released:0,held:true,heldTime:.5,pressAge:.5,sinceActive:0};
 s.drive(c,1,0,true,1/120,{desiredSpeed:c.max});
 assert.equal(c.boosting,false);assert.equal(c.boostReason,'RECOVERING');assert.ok(c._boost.pressAge>.5);
});
