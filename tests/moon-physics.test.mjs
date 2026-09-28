import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoonRace,stepMoonRace,raceOrder,raceTeamScores,TEAMS,RACE_POINTS} from '../moon-sim.js';
import {trackFrame,TRACK_LENGTH,TRACK_WIDTH,JUMP_AT,JET_AT,CARGO_AT,moonHazards} from '../moon-track.js';

const dt=1/120;
function run(race,seconds,input={}){for(let n=0;n<Math.round(seconds/dt);n++)stepMoonRace(race,dt,input);return race;}
function isolate(race,car){race.phase='race';for(const other of race.cars)if(other!==car){other.s=300+other.id*8;other.lane=0;}return car;}

test('same seed and inputs replay identically; team selection cannot bias the grid',()=>{
  const a=run(createMoonRace('replay','comet'),55),b=run(createMoonRace('replay','gators'),55);
  assert.deepEqual(a.cars,b.cars);assert.deepEqual(a.metrics,b.metrics);
  assert.notDeepEqual(createMoonRace('other').cars.map(c=>c.s),createMoonRace('replay').cars.map(c=>c.s));
  assert.equal(new Set(a.cars.map(c=>c.id)).size,8);
  for(const t of TEAMS)assert.equal(a.cars.filter(c=>c.team===t.id).length,2);
});

test('closed course joins continuously and offset lanes share the visible width',()=>{
  const a=trackFrame(-.001),b=trackFrame(TRACK_LENGTH-.001),c=trackFrame(.001);
  assert.deepEqual(a,b);assert.ok(Math.hypot(a.x-c.x,a.z-c.z)<.003);
  for(let s=0;s<TRACK_LENGTH;s+=3){const l=trackFrame(s,-TRACK_WIDTH/2),r=trackFrame(s,TRACK_WIDTH/2);assert.ok(Math.abs(Math.hypot(l.x-r.x,l.z-r.z)-TRACK_WIDTH)<1e-8);assert.ok(Math.abs(l.curvature)*TRACK_WIDTH/2<.65,'inside road edge must not fold through itself');}
});

test('countdown gates movement, invalid steps are ignored, completed races are immutable',()=>{
  const r=createMoonRace('gates'),s=r.cars.map(c=>c.s);run(r,2.9);assert.deepEqual(r.cars.map(c=>c.s),s);
  const before=JSON.stringify(r);for(const d of [0,-1,NaN,Infinity])stepMoonRace(r,d);assert.equal(JSON.stringify(r),before);
  r.phase='results';const done=JSON.stringify(r);run(r,20);assert.equal(JSON.stringify(r),done);
});

test('manual boost spends reserve and produces extra forward progress without changing other control ownership',()=>{
  const off=createMoonRace('control'),on=createMoonRace('control');
  for(const r of [off,on]){const c=isolate(r,r.cars[0]);c.s=0;c.lane=0;c.speed=18;}
  run(off,3,{manual:true,car:0,boost:false});run(on,3,{manual:true,car:0,boost:true});
  assert.ok(on.cars[0].boost<off.cars[0].boost-.5);assert.ok(on.cars[0].s>off.cars[0].s+3);
  assert.ok(off.cars.slice(1).some(c=>c.boost<1),'other racers keep autonomous boost');
});

test('skyway launches with momentum then lands; a missed slow ramp cannot launch later on flat road',()=>{
  const r=createMoonRace('flight'),c=isolate(r,r.cars[0]);c.s=JUMP_AT-.1;c.lane=0;c.speed=20;c.y=trackFrame(c.s).y;
  stepMoonRace(r,dt);assert.equal(c.airborne,true);const launch=c.y;
  run(r,.6,{manual:true,car:0,boost:false});assert.ok(c.y>launch+.7);
  run(r,4,{manual:true,car:0,boost:false});assert.equal(c.airborne,false);assert.equal(r.metrics.jumps,1);
  const slow=createMoonRace('slow'),d=isolate(slow,slow.cars[0]);d.s=JUMP_AT-.001;d.speed=8;d.y=trackFrame(d.s).y;stepMoonRace(slow,dt);
  run(slow,4,{manual:true,car:0,boost:false});assert.equal(d.airborne,false);assert.equal(slow.metrics.jumps,0);
});

test('warned exhaust lane and moving cargo apply visible-location impulses',()=>{
  const r=createMoonRace('exhaust'),c=isolate(r,r.cars[0]);r.offset=3;r.time=0;c.s=JET_AT;c.lane=-3;c.speed=20;c.y=trackFrame(c.s).y;
  assert.equal(moonHazards(r.time,r.offset).jetActive,true);stepMoonRace(r,dt);assert.equal(r.metrics.jetHits,1);assert.ok(c.speed<15);assert.ok(c.lateral>3);
  const safe=createMoonRace('safe'),d=isolate(safe,safe.cars[0]);safe.offset=3;d.s=JET_AT;d.lane=3;d.speed=20;stepMoonRace(safe,dt);assert.equal(safe.metrics.jetHits,0);
  const cargo=createMoonRace('cargo'),e=isolate(cargo,cargo.cars[0]);cargo.offset=0;e.s=CARGO_AT;e.lane=0;e.speed=20;stepMoonRace(cargo,dt);assert.equal(cargo.metrics.cargoHits,1);assert.ok(e.speed<13);
});

test('two laps and all ordered gates are required; finish times determine classification',()=>{
  const r=createMoonRace('finish'),c=isolate(r,r.cars[0]);c.s=TRACK_LENGTH-.01;c.checkpoint=15;c.speed=20;stepMoonRace(r,dt);assert.equal(c.finishTime,null);assert.equal(c.checkpoint,16);
  c.s=TRACK_LENGTH*2-.01;c.checkpoint=31;c.speed=20;stepMoonRace(r,dt);assert.ok(c.finishTime!==null);assert.equal(c.checkpoint,32);
  const d=r.cars[1];d.finishTime=c.finishTime+.1;d.s=c.s+100;assert.equal(raceOrder(r)[0].id,c.id);
  const points=raceTeamScores(r);assert.equal(Object.values(points).reduce((a,b)=>a+b,0),RACE_POINTS[0]+RACE_POINTS[1]);
});

test('32 seeded heats finish without invalid states or stuck recovery, and every team can win',()=>{
  const wins=new Set();let air=0,hazards=0;
  for(let n=0;n<32;n++){
    const r=createMoonRace('moon-audit-'+n);
    for(let step=0;step<140*120&&r.phase!=='results';step++){
      stepMoonRace(r,dt);
      if(step%120===0)for(const c of r.cars){for(const key of ['x','y','z','speed','s','lane','boost'])assert.ok(Number.isFinite(c[key]),`${n}: ${key}`);assert.ok(c.boost>=0&&c.boost<=1);assert.ok(Math.abs(c.lane)<TRACK_WIDTH/2+.2);}
    }
    assert.equal(r.phase,'results');assert.ok(r.cars.every(c=>c.finishTime!==null&&c.checkpoint===32));assert.equal(r.metrics.recoveries,0);
    assert.equal(Object.values(raceTeamScores(r)).reduce((a,b)=>a+b,0),58);
    wins.add(raceOrder(r)[0].team);air+=r.metrics.jumps;hazards+=r.metrics.jetHits+r.metrics.cargoHits;
  }
  assert.equal(wins.size,4);assert.ok(air>450);assert.ok(hazards>0);
});
