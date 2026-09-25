import test from 'node:test';
import assert from 'node:assert/strict';
import { kickoffLayout, driverPersonality } from '../match-variety.js';
import { simulationConfig as config } from '../simulation-config.js';
import { createSimulation } from '../sim.js';
import { createDiagnostics } from '../diagnostics.js';
import { planDrive } from '../autopilot.js';

test('faceoffs rotate without repeats, face the ball and give equal travel distances', () => {
  const openings = new Set();
  for(let seed=0;seed<100;seed++) {
    const names=[];
    for(let round=0;round<5;round++) {
      const k=kickoffLayout(seed,round); names.push(k.name); openings.add(JSON.stringify(k));
      assert.deepEqual(k,kickoffLayout(seed,round));
      assert.ok(Math.abs(Math.hypot(k.P.x-k.ball.x,k.P.z)-Math.hypot(k.B.x-k.ball.x,k.B.z))<1e-10);
      assert.equal(k.P.z,-k.B.z);
      for(const car of [k.P,k.B]) {
        const dx=k.ball.x-car.x,dz=-car.z,length=Math.hypot(dx,dz);
        assert.ok(Math.abs(-Math.sin(car.yaw)-dx/length)<1e-10);
        assert.ok(Math.abs(-Math.cos(car.yaw)-dz/length)<1e-10);
        for(const spec of config.cars) {
          assert.ok(Math.abs(car.x)+Math.hypot(spec.w,spec.l)/2<22);
          assert.ok(Math.abs(car.z)+Math.hypot(spec.w,spec.l)/2<34);
          assert.ok(length>spec.l/2+config.ball.radiusPixel+2);
        }
      }
    }
    assert.equal(new Set(names).size,5);
    assert.notEqual(kickoffLayout(seed,4).name,kickoffLayout(seed,5).name);
  }
  assert.ok(openings.size>=9);
});

test('driver identity persists while shooting lanes change between rounds', () => {
  for(const {id} of config.cars) {
    const a=driverPersonality(id,'match',0,'P'),b=driverPersonality(id,'match',1,'P');
    assert.equal(a.name,b.name); assert.equal(a.side,b.side); assert.equal(a.setup,b.setup);
    assert.notEqual(a.aim,b.aim);
    assert.deepEqual(a,driverPersonality(id,'match',0,'P'));
    const sim=createSimulation('pixel'), me=sim.bodyFrom(id,9,0,0),foe=sim.bodyFrom('model3',0,5,Math.PI);
    me.personality=a;
    const ball={x:0,z:18,vx:0,vz:12,y:.9,vy:0};
    assert.equal(planDrive(me,foe,ball,1/120,-1,sim.getField(),false).state,'defend');
  }
});

test('seeded faceoffs generate distinct finite contests across every matchup and both arenas', () => {
  let goals=0;
  for(const mode of ['pixel','3d']) for(const a of config.cars) for(const b of config.cars) {
    const signatures=new Set();
    for(let round=0;round<5;round++) {
      const diag=createDiagnostics(),sim=createSimulation(mode,config,diag),seed=`${a.id}:${b.id}`;
      const k=kickoffLayout(seed,round);
      const P=sim.bodyFrom(a.id,k.P.x,k.P.z,k.P.yaw),B=sim.bodyFrom(b.id,k.B.x,k.B.z,k.B.yaw);
      P.personality=driverPersonality(a.id,seed,round,'P'); B.personality=driverPersonality(b.id,seed,round,'B');
      const ball={...k.ball,y:sim.getBallRadius(),vx:0,vz:0,vy:mode==='pixel'?0:6};
      let signature='';
      for(let tick=0;tick<10800;tick++) {
        sim.botAI(P,B,ball,1/120,-1,undefined);sim.botAI(B,P,ball,1/120,1,undefined);
        sim.solveContacts([P,B],ball,1/120);
        const goal=sim.stepBall(ball,1/120);
        if(tick%120===0)signature+=`${ball.x.toFixed(1)},${ball.z.toFixed(1)};`;
        for(const body of [P,B,ball])for(const key of ['x','z','vx','vz'])assert.ok(Number.isFinite(body[key]));
        if(goal){goals++;break;}
      }
      signatures.add(signature);
      assert.equal(diag.export().counters.ballSafetyCap||0,0);
    }
    assert.equal(signatures.size,5,`${mode}/${a.id}/${b.id}: distinct rally trajectories`);
  }
  assert.ok(goals>=80,`at least half of CPU contests score within a match: ${goals}/160`);
  console.log(`Variety sample: ${goals}/160 faceoffs scored within 90 seconds`);
});
