// Reproducible section-10 policy experiment. Synthetic diagnostics, not a human playtest.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CATALOG } from '../catalog.js';
import { createSimulation } from '../sim.js';
import { simulationConfig } from '../simulation-config.js';
import { configHash } from '../net-protocol.js';
const sourceFiles=['sim.js','contacts.js','boost.js','autopilot.js','simulation-config.js','characters.js'];
const sources=Object.fromEntries(sourceFiles.map(name=>[name,createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex')]));
const config=structuredClone(simulationConfig), variant=process.env.TUNING || 'control';
if(variant==='heavy') {
  Object.assign(config.cars.find(c=>c.id==='cybertruck'),{accel:26,turn:1.65,grip:7});
  Object.assign(config.cars.find(c=>c.id==='semi'),{accel:18,turn:1.25,grip:6});
  config.drive.drag_heavy=1.45;config.drive.drag_light=1.25;
}
if(variant==='economy')Object.assign(config.drive,{boost_punch_heavy:32,boost_punch_light:24,boost_cap_heavy:1.30,boost_cap_light:1.22,boost_drain_heavy:.75,boost_drain_light:.9,boost_regen:.25});
if(variant==='restitution') config.ball.pancake_mult=.86/config.ball.contact_restitution;
const {bodyFrom,botAI,drive,stepBall,getBallRadius,setPixelTight,solveContacts,resetContacts,diagnostics}=createSimulation('3d',config);
const hash=await configHash(config);

const dt = 1/120;
const policies = ['none','hold','random','timed'];
const scenarios = [[0,0,0],[3,0,-4],[-3,0,4],[0,4,0]]; // x,z,vx; mirror whole world for side B
const rng = seed => () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const angle = a => Math.atan2(Math.sin(a),Math.cos(a));
const trials=[];
trialsLoop: for(const mode of ['pixel','3d']) for(const a of CATALOG) for(const b of CATALOG)
for(let s=0;s<scenarios.length;s++) for(let side=0;side<2;side++) for(const policy of policies){
  setPixelTight(mode==='pixel');
  const rand=rng(501+s), sign=side ? -1 : 1;
  let P,B,ball,goals=[0,0],contacts=0,active=0,starts=0,shortBursts=0,run=0,held=false;
  let timer=0,holdFor=0,frames=0,maxInactive=0,inactive=0,lastImpact=0;
  function reset(toward=0,first=false){
    resetContacts();
    P=bodyFrom(side ? b.id:a.id,0,14,0); B=bodyFrom(side ? a.id:b.id,0,-14,Math.PI);
    const [x,z,vx]=first?scenarios[s]:[0,toward*4,0];
    ball={x:x*(first?sign:1),z:z*(first?sign:1),vx:vx*(first?sign:1),vz:toward*3,y:getBallRadius(),vy:mode==='3d'?6:0};
    if(run>0 && run<.05)shortBursts++;run=0;
  }
  reset(0,true);
  const capsBefore=diagnostics.export().counters.ballSafetyCap||0;
  for(let i=0;i<90*120 && Math.max(...goals)<3;i++){
    const me=side?B:P, foe=side?P:B;
    if(i%12===0){
      if(policy==='none')held=false;
      if(policy==='hold')held=true;
      if(policy==='random'){if(timer<=0){held=!held;timer=held?.3:.3+rand()*.8;}timer-=.1;}
      if(policy==='timed'){
        holdFor=Math.max(0,holdFor-.1);
        const d=Math.hypot(ball.x-me.x,ball.z-me.z),reach=me.l/2+getBallRadius();
        const heading=Math.abs(angle(Math.atan2(-(ball.x-me.x),-(ball.z-me.z))-me.yaw));
        const low=ball.y-getBallRadius()<1.25, attack=side?1:-1;
        const goalward=(ball.z-me.z)*attack>0;
        if(holdFor===0 && me.boost>.25 && low && goalward && heading<.25 && d>reach+.5 && d<reach+8)holdFor=.3;
        held=holdFor>0;
      }
    }
    botAI(P,B,ball,dt,-1,side?undefined:held);
    botAI(B,P,ball,dt,1,side?held:undefined);
    const impacts=solveContacts([P,B],ball,dt);const h1=impacts.some(e=>e.pair==='P:ball'),h2=impacts.some(e=>e.pair==='B:ball');
    if(h1||h2){contacts+=Number(!!h1)+Number(!!h2);lastImpact=i*dt;}
    inactive=i*dt-lastImpact;maxInactive=Math.max(maxInactive,inactive);
    if(me.boosting){active+=dt;if(run===0)starts++;run+=dt;}
    else if(run>0){if(run<.05)shortBursts++;run=0;}
    const g=stepBall(ball,dt);frames++;
    if(process.env.STOP_ON_CAP && diagnostics.lastFailure) { console.log(JSON.stringify({P,B,ball:diagnostics.lastFailure,mode,policy,scenario:s,tick:i}));process.exit(2); }
    if(![P.x,P.z,P.yaw,B.x,B.z,B.yaw,ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz].every(Number.isFinite))throw Error('nonfinite');
    if(g){goals[g==='A'?0:1]++;reset(g==='A'?1:-1);lastImpact=i*dt;}
  }
  const gf=goals[side],ga=goals[1-side];
  trials.push({mode,a:a.id,b:b.id,scenario:s,side,policy,gf,ga,result:gf>ga?'win':gf<ga?'loss':'draw',duration:frames*dt,contacts,active,starts,shortBursts,maxInactive,caps:(diagnostics.export().counters.ballSafetyCap||0)-capsBefore});
}
const summary=[];
for(const mode of ['pixel','3d'])for(const policy of policies){
 const rows=trials.filter(t=>t.mode===mode&&t.policy===policy);
 const sum=k=>rows.reduce((a,b)=>a+b[k],0),avg=k=>+(sum(k)/rows.length).toFixed(3);
 summary.push({mode,policy,n:rows.length,wins:rows.filter(t=>t.result==='win').length,draws:rows.filter(t=>t.result==='draw').length,losses:rows.filter(t=>t.result==='loss').length,meanGoalDiff:+((sum('gf')-sum('ga'))/rows.length).toFixed(3),meanSeconds:avg('duration'),boostSeconds:avg('active'),starts:sum('starts'),shortBursts:sum('shortBursts'),meanImpacts:avg('contacts')});
}
setPixelTight(true);
const burstProbe=[];
for(const c of CATALOG){
 const me=bodyFrom(c.id,0,0,0);let run=0,lengths=[];
 for(let i=0;i<1200;i++){
   // Reset position only to exclude walls. Direct drive isolates reserve behavior.
   me.x=0;me.z=0;drive(me,1,0,true,dt);
   if(me.boosting)run++;
   else if(run){lengths.push(run);run=0;}
 }
 if(run)lengths.push(run);
 burstProbe.push({car:c.id,firstBurstSeconds:lengths[0]*dt,bursts:lengths.length,singleTickBursts:lengths.filter(n=>n===1).length,finalReserve:me.boost});
}
const metadata={sources,revision:process.env.REVISION || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()+'+working-tree',node:process.version,variant,configHash:hash,dt,scenarios,seed:501,opponent:'current automatic boost using the shared FSM',notes:'Synthetic boost intent policies, no reaction delay, no network; first-to-3 or 90 simulated active seconds; immediate resets; no faceoff/celebration time; first kickoff mirrored; baseline post-goal ball bias preserved. Not human playtests.'};
fs.mkdirSync(process.env.QA_OUT || 'output/first-playable-slice/policy', { recursive:true });
fs.writeFileSync((process.env.QA_OUT || 'output/first-playable-slice/policy') + '/probes.json',JSON.stringify({metadata,diagnostics:diagnostics.export().counters,summary,byCar:trials.reduce((out,t)=>{const key=[t.mode,t.a,t.side,t.policy].join('/');const v=out[key]||={n:0,gf:0,ga:0,wins:0,draws:0,losses:0,caps:0};v.n++;v.gf+=t.gf;v.ga+=t.ga;v[t.result==='win'?'wins':t.result==='loss'?'losses':'draws']++;v.caps+=t.caps;return out;},{}),burstProbe,trials},null,2));
console.log(JSON.stringify({metadata,summary,burstProbe},null,2));
