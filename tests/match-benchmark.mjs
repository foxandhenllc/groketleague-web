// Fast preflight for the eight screenshot setups; uses the same seed/boost policy.
import fs from 'node:fs';
import { createSimulation } from '../sim.js';
import { kickoffLayout, driverPersonality } from '../match-variety.js';
const ids=['cybertruck','model3','cybercab','semi'],results=[];
for(const [m,mode] of ['pixel','3d'].entries())for(const [i,id] of ids.entries()){
 const foe=ids[(i+(m?2:1))%4],seed=`capture-review-${m}-${i}-20260925`,sim=createSimulation(mode),trace=[];
 let P,B,ball,round=0,hold=0,score=[0,0],slow=0,near=0,frames=0,slowRun=0,maxSlow=0;
 const reset=()=>{const k=kickoffLayout(seed,round);sim.resetContacts();P=sim.bodyFrom(id,k.P.x,k.P.z,k.P.yaw);B=sim.bodyFrom(foe,k.B.x,k.B.z,k.B.yaw);
  P.personality=driverPersonality(id,seed,round,'P');B.personality=driverPersonality(foe,seed,round,'B');
  ball={...k.ball,y:sim.getBallRadius(),vx:0,vz:0,vy:mode==='pixel'?0:6};round++;hold=0;slowRun=0;};
 reset();
 for(let tick=0;tick<10800 && Math.max(...score)<3;tick++){
  hold=Math.max(0,hold-1/120);
  const distance=Math.hypot(ball.x-P.x,ball.z-P.z),reach=P.l/2+sim.getBallRadius();
  const a=Math.atan2(-(ball.x-P.x),-(ball.z-P.z))-P.yaw;
  if(hold===0&&P.boost>.25&&ball.z<P.z&&Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<.25&&distance>reach+.5&&distance<reach+8&&ball.y-sim.getBallRadius()<1.25)hold=.3;
  sim.botAI(P,B,ball,1/120,-1,hold>0);sim.botAI(B,P,ball,1/120,1);
  sim.solveContacts([P,B],ball,1/120);const goal=sim.stepBall(ball,1/120);frames++;
  if(tick%120===0)trace.push(JSON.parse(JSON.stringify({tick,P,B,ball})));
  if(Math.hypot(ball.vx,ball.vz)<1){slow++;slowRun++;maxSlow=Math.max(maxSlow,slowRun);}else slowRun=0;
  if(Math.abs(ball.x)>18||Math.abs(ball.z)>30)near++;
  if(goal){score[goal==='A'?0:1]++;reset();}
 }
 results.push({mode,id,foe,score,seconds:frames/120,slowPercent:100*slow/frames,nearPercent:100*near/frames,maxSlow:maxSlow/120,counters:sim.diagnostics.export().counters});
 if(process.env.BENCH_OUT)fs.writeFileSync(process.env.BENCH_OUT+`.${mode}-${id}.trace.json`,JSON.stringify(trace));
}
console.log(JSON.stringify(results,null,2));
if(process.env.BENCH_OUT)fs.writeFileSync(process.env.BENCH_OUT,JSON.stringify(results,null,2));
