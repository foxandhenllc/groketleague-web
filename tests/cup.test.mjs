import test from 'node:test';
import assert from 'node:assert/strict';
import { createCup, createCupPacing, CUP_RULES, counterWinner, cupStandings, DIRECTIVES } from '../cup.js';
import { createInterventions, legalActions } from '../opportunities.js';
import { createCoach } from '../coach-controller.js';
import { createProgression, SAVE_KEY } from '../progression.js';
import { coachObservation } from '../agent-observation.js';
import { createSimulation } from '../sim.js';

const dt = 1 / 120;
const memoryStorage = () => { const values = new Map(); return { getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v), values }; };
const fixture = () => {
  const sim = createSimulation('pixel');
  return { sim, car:sim.bodyFrom('model3',0,8,0), foe:sim.bodyFrom('semi',0,-8,Math.PI), ball:{x:0,z:0,y:sim.getBallRadius(),vx:0,vz:0,vy:0} };
};
const offer = (ledger, f) => { for (let i=0;i<74;i++) ledger.beforeStep(dt,f.car,f.foe,f.ball,-1,f.sim.getField()); return ledger.view.offer; };
const results = [{a:1,b:0},{a:0,b:0},{a:2,b:1}];

test('all nine directive pairs implement the announced counter triangle',()=>{
  for(const a of DIRECTIVES)for(const b of DIRECTIVES) {
    assert.equal(counterWinner(a.id,b.id),a.id===b.id?null:a.counters===b.id?'A':'B');
  }
  assert.throws(()=>counterWinner('unknown','auto'));
});
test('CPU commits before human input, stays hidden during draft and reveals its bonus',()=>{
  let calls=0;
  const cup=createCup({id:'sealed',random:()=>{calls++;return .9;}});
  assert.equal(calls,1); assert.equal(cup.view.rival,null); assert.equal(cup.view.allowances,null);
  assert.equal(cup.choose('attack'),true); assert.equal(calls,1); assert.equal(cup.view.rival,'auto');
  assert.deepEqual(cup.view.allowances,{A:3,B:2}); assert.equal(cup.choose('defend'),false);
  cup.advance(2); assert.equal(cup.phase,'heat');
});
test('draft timeout picks Read the Room; three heats score points and refuse duplicate results',()=>{
  const cup=createCup({id:'three',random:()=>.1});
  for(let i=0;i<3;i++){
    cup.advance(CUP_RULES.draftSeconds); assert.equal(cup.view.pick,'auto');
    cup.advance(CUP_RULES.revealSeconds); assert.equal(cup.phase,'heat');
    assert.equal(cup.finishHeat(results[i].a,results[i].b),true);
    assert.equal(cup.finishHeat(99,0),false);
    assert.equal(cup.view.heats.length,i+1);
    assert.equal(cup.nextHeat(),i<2);
  }
  assert.equal(cup.phase,'complete'); assert.deepEqual(cup.view.standings,{a:7,b:1,winner:'A'});
});
test('equal cup points share the cup and invalid scores cannot corrupt standings',()=>{
  assert.deepEqual(cupStandings([{a:1,b:0},{a:0,b:1},{a:0,b:0}]),{a:4,b:4,winner:'shared'});
  assert.throws(()=>cupStandings([{a:-1,b:0}])); assert.throws(()=>cupStandings([{a:NaN,b:0}]));
});
test('cup defenders contest a stale ball while classic defense keeps its existing guard behavior',()=>{
  for(const cupRules of [false,true]){
    const f=fixture();f.car=f.sim.bodyFrom('semi',0,24,0);
    for(let i=0;i<120*5;i++)f.sim.botAI(f.car,f.foe,f.ball,dt,-1,false,{tactic:'defend',...(cupRules?{contestStaleSeconds:CUP_RULES.contestStaleSeconds}:{})});
    assert.equal(f.car._ai.mode,cupRules?'clear':'guard');
  }
});
test('dead ball recalibration is neutral, progress cancels it and reset keeps its cumulative count',()=>{
  const pacing=createCupPacing(),ball={x:0,z:0};
  assert.equal(pacing.step(ball,0),false);assert.equal(pacing.step(ball,7),false);
  ball.x=3;assert.equal(pacing.step(ball,2),false);assert.equal(pacing.step(ball,8),true);
  assert.equal(pacing.resets,1);pacing.reset();assert.equal(pacing.resets,1);assert.equal(pacing.step(ball,8),false);
});
test('reservation rejects stale IDs, duplicates and unoffered actions; only activation spends',()=>{
  const f=fixture(), ledger=createInterventions({seat:'A',scope:'cup:1',charges:2,tactic:'auto'}), opening=offer(ledger,f);
  assert.ok(opening); assert.equal(ledger.choose('old:1','boost'),false);
  assert.equal(ledger.choose(opening.id,'teleport'),false);
  assert.equal(ledger.choose(opening.id,'boost'),true); assert.equal(ledger.choose(opening.id,'special'),false);
  assert.equal(ledger.view.charges,2); ledger.afterStep({boosting:false}); assert.equal(ledger.view.charges,2);
  ledger.afterStep({boosting:true}); assert.equal(ledger.view.charges,1); assert.equal(ledger.view.status,'activated');
  ledger.afterStep({boosting:true}); assert.equal(ledger.view.charges,1);
  assert.equal(ledger.choose(opening.id,'boost'),false);
});
test('expiry and reset release reservations, and pass never spends a charge',()=>{
  for(const reason of ['expire','goal','pass']){
    const f=fixture(), ledger=createInterventions({seat:'A',scope:'c:1',charges:2,tactic:'auto'}), opening=offer(ledger,f);
    ledger.choose(opening.id,reason==='pass'?'pass':'boost');
    if(reason==='expire')ledger.beforeStep(3,f.car,f.foe,f.ball,-1,f.sim.getField());
    if(reason==='goal')ledger.cancel();
    assert.equal(ledger.view.charges,2); assert.equal(ledger.view.reserved,false);
    ledger.afterStep({boosting:true}); assert.equal(ledger.view.charges,2);
    assert.equal(ledger.choose(opening.id,'boost'),false);
  }
});
test('signature legality respects cooldown and shock; failed activation keeps reservation',()=>{
  const f=fixture(); f.car.move={cooldown:3,age:99};
  assert.equal(legalActions(f.car).includes('special'),false);
  f.car.move.cooldown=0; f.car.shock=1; assert.equal(legalActions(f.car).includes('special'),false);
  f.car.shock=0; const ledger=createInterventions({seat:'A',scope:'c:1',charges:2,tactic:'attack'}), opening=offer(ledger,f);
  assert.equal(ledger.choose(opening.id,'special'),true);
  ledger.afterStep({move:{age:1,cooldown:0}}); assert.equal(ledger.view.charges,2);
  ledger.afterStep({move:{age:0,cooldown:5}}); assert.equal(ledger.view.charges,1);
});
test('armed boosts retain the existing safety gate and fresh Perfect Touch press',()=>{
  const f=fixture(); f.car.yaw=Math.PI;
  f.sim.botAI(f.car,f.foe,f.ball,dt,-1,true,{tactic:'attack',boostArmed:true});
  assert.equal(f.car.boosting,false); assert.equal(f.car._boost.held,false);
  f.car.yaw=0;
  for(let i=0;i<120 && !f.car.boosting;i++) f.sim.botAI(f.car,f.foe,f.ball,dt,-1,true,{tactic:'attack',boostArmed:true});
  assert.equal(f.car.boosting,true); assert.equal(f.car._boost.pressAge,0);
});
test('both CPU and human action paths stay within the same allowance on all four cars',()=>{
  for(const kind of ['cybertruck','model3','cybercab','semi'])for(const type of ['human','cpu']){
    const f=fixture(); f.car=f.sim.bodyFrom(kind,0,8,0);
    const coach=createCoach({type,seat:'A',scope:`all:${kind}:${type}`,charges:2,tactic:'attack',random:()=>0});
    for(let i=0;i<120*18;i++){
      const controls=coach.beforeStep(dt,f.car,f.foe,f.ball,-1,f.sim.getField());
      if(type==='human'&&coach.view.offer&&!coach.view.reserved)coach.choose(coach.view.offer.id,'boost');
      f.sim.botAI(f.car,f.foe,f.ball,dt,-1,controls.boost,controls); coach.afterStep(f.car);
      f.sim.solveContacts([f.car,f.foe],f.ball,dt); f.sim.stepBall(f.ball,dt);
      assert.ok(coach.view.charges>=0); assert.ok(coach.view.activated<=2);
    }
    assert.ok(coach.view.activated>0,`${kind}/${type} must execute a real intervention`);
  }
});
test('completed cup grants exactly-once claims and a first cosmetic that survives reload',()=>{
  const storage=memoryStorage(), progress=createProgression(storage);
  const earned=progress.completeCup({id:'first',heats:results});
  assert.deepEqual(earned,{duplicate:false,claims:75,unlocked:['beta','void']});
  assert.equal(progress.equip('beta'),true); assert.equal(progress.equip('recall'),false);
  assert.deepEqual(progress.completeCup({id:'first',heats:results}),{duplicate:true,claims:0,unlocked:[]});
  const reload=createProgression(storage); assert.equal(reload.view.claims,75); assert.equal(reload.view.equipped,'beta');
  assert.equal(reload.completeCup({id:'first',heats:results}).duplicate,true);
  assert.throws(()=>reload.completeCup({id:'unfinished',heats:results.slice(0,2)}));
});
test('shared and lost cups earn completion claims without removing previous unlocks',()=>{
  const progress=createProgression(memoryStorage()); progress.completeCup({id:'win',heats:results,saves:1});
  const loss=progress.completeCup({id:'loss',heats:[{a:0,b:1},{a:0,b:2},{a:0,b:0}]});
  assert.equal(loss.claims,50); assert.ok(progress.view.unlocked.includes('void')); assert.ok(progress.view.unlocked.includes('assist'));
  const shared=progress.completeCup({id:'shared',heats:[{a:1,b:0},{a:0,b:1},{a:0,b:0}]});
  assert.equal(shared.claims,75); assert.equal(progress.view.draws,1); assert.equal(progress.view.wins,1); assert.equal(progress.view.bestStreak,1);
});
test('corrupt and unavailable storage are recoverable with accurate persistence status',()=>{
  const storage=memoryStorage(); storage.setItem(SAVE_KEY,'not-json'); const fresh=createProgression(storage);
  assert.equal(fresh.view.cups,0); assert.match(fresh.view.notice,/Unreadable/);
  fresh.completeCup({id:'recovered',heats:results}); assert.equal(createProgression(storage).view.cups,1);
  const unavailable=createProgression({getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}});
  unavailable.completeCup({id:'temporary',heats:results}); assert.equal(unavailable.view.persistent,false); assert.equal(unavailable.view.cups,1);
  const quota=createProgression({getItem(){return null;},setItem(){throw new Error('quota');}});
  quota.completeCup({id:'quota',heats:results}); assert.equal(quota.view.persistent,false); assert.match(quota.view.notice,/Could not save/);
});
test('model observation exposes public context without hidden planner, seed or unrevealed CPU choice',()=>{
  const f=fixture(), cup=createCup({id:'public',random:()=>.9});
  f.car._ai={target:{x:123,z:123}}; f.foe._ai={secret:'hidden'};
  const observation=coachObservation({cup:cup.view,seat:'A',coach:{charges:2,offer:null},car:f.car,foe:f.foe,ball:f.ball,timeLeft:60,scoreA:0,scoreB:0,roundEpoch:1,field:f.sim.getField()});
  assert.equal(observation.directives.opponent,null); const text=JSON.stringify(observation);
  for(const key of ['_ai','target','seed','secret','personality'])assert.equal(text.includes(key),false);
});
