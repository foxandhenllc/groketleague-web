// Synthetic CPU-vs-CPU pacing sample. These are scripted decisions, never model inference.
import fs from 'node:fs/promises';
import { createSimulation } from '../sim.js';
import { createCup, createCupPacing, DIRECTIVES } from '../cup.js';
import { createCoach } from '../coach-controller.js';
import { kickoffLayout, driverPersonality, seededRandom } from '../match-variety.js';
const ids=['cybertruck','model3','cybercab','semi'],dt=1/120,results=[];
for(const a of ids)for(const b of ids)for(let sample=0;sample<3;sample++){
 const seed=`cup-pacing-v1:${a}:${b}:${sample}`,random=seededRandom(seed),cup=createCup({id:seed,random}),sim=createSimulation('pixel'),pacing=createCupPacing();
 let round=0,P,B,ball;
 const reset=()=>{sim.resetContacts();pacing.reset();const k=kickoffLayout(seed,round);P=sim.bodyFrom(a,k.P.x,k.P.z,k.P.yaw);B=sim.bodyFrom(b,k.B.x,k.B.z,k.B.yaw);P.personality=driverPersonality(a,seed,round,'P');B.personality=driverPersonality(b,seed,round,'B');ball={...k.ball,y:sim.getBallRadius(),vx:0,vz:0,vy:0};round++;};
 const heatMetrics=[];
 for(let heat=0;heat<3;heat++){
  cup.choose(DIRECTIVES[(sample+heat)%3].id);cup.advance(2);reset();const view=cup.view,scope=`${seed}:${heat}`;
  const ca=createCoach({type:'cpu',seat:'A',scope,charges:view.allowances.A,tactic:view.pick,random}),cb=createCoach({type:'cpu',seat:'B',scope,charges:view.allowances.B,tactic:view.rival,random});
  let score=[0,0],slow=0,maxSlow=0,run=0,firstGoal=null,offers=new Set();
  for(let tick=0;tick<60*120;tick++){
   const ac=ca.beforeStep(dt,P,B,ball,-1,sim.getField()),bc=cb.beforeStep(dt,B,P,ball,1,sim.getField());
   if(ca.view.offer)offers.add(ca.view.offer.id);if(cb.view.offer)offers.add(cb.view.offer.id);
   sim.botAI(P,B,ball,dt,-1,ac.boost,ac);ca.afterStep(P);sim.botAI(B,P,ball,dt,1,bc.boost,bc);cb.afterStep(B);
   sim.solveContacts([P,B],ball,dt);const goal=sim.stepBall(ball,dt);
   if(Math.hypot(ball.vx,ball.vz)<1){slow++;run++;maxSlow=Math.max(run,maxSlow);}else run=0;
   if(goal){firstGoal??=tick/120;score[goal==='A'?0:1]++;ca.cancel();cb.cancel();reset();run=0;}
   else if(pacing.step(ball,dt)){ca.cancel();cb.cancel();reset();run=0;}
   if(ca.view.charges<0||cb.view.charges<0||ca.view.activated>view.allowances.A||cb.view.activated>view.allowances.B)throw new Error('Allowance exceeded');
  }
  cup.finishHeat(...score);heatMetrics.push({score,firstGoal,slowPercent:100*slow/7200,maxSlow:maxSlow/120,offers:offers.size,activations:[ca.view.activated,cb.view.activated],allowances:view.allowances});cup.nextHeat();
 }
 results.push({a,b,sample,heats:heatMetrics,standings:cup.view.standings,recalibrations:pacing.resets});
 if(results.length%12===0)console.log('PACING',results.length,'/48');
}
const heats=results.flatMap(r=>r.heats),summary={cups:results.length,heats:heats.length,scorelessHeats:heats.filter(h=>h.score[0]+h.score[1]===0).length,goals:heats.reduce((n,h)=>n+h.score[0]+h.score[1],0),sharedCups:results.filter(r=>r.standings.winner==='shared').length,interventions:heats.reduce((n,h)=>n+h.activations[0]+h.activations[1],0),meanSlowPercent:heats.reduce((n,h)=>n+h.slowPercent,0)/heats.length,longestSlowRun:Math.max(...heats.map(h=>h.maxSlow))};
await fs.mkdir('output/fsd-cup',{recursive:true});await fs.writeFile('output/fsd-cup/pacing.json',JSON.stringify({policy:'scripted CPU for both seats, equal action rules; no inference',summary,results},null,2));console.log(JSON.stringify(summary,null,2));
