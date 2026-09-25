// Optional historical comparison; generates ignored fixtures from the pinned commit.
// Run with Node's default module flag, just like the simulation tests.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('../',import.meta.url),out=new URL('output/match-variety/baseline/',root);
fs.mkdirSync(out,{recursive:true});
const files=execFileSync('git',['ls-tree','--name-only','08fa7b3'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
for(const name of files.filter(n=>n.endsWith('.js')))fs.writeFileSync(new URL(name,out),execFileSync('git',['show',`08fa7b3:${name}`],{cwd:root}));
const { createSimulation } = await import(new URL('sim.js',out));
const { simulationConfig } = await import(new URL('simulation-config.js',out));
let goals=0;
for(const mode of ['pixel','3d'])for(const a of simulationConfig.cars)for(const b of simulationConfig.cars){
  const sim=createSimulation(mode),P=sim.bodyFrom(a.id,0,14,0),B=sim.bodyFrom(b.id,0,-14,Math.PI);
  const ball={x:0,z:0,y:sim.getBallRadius(),vx:0,vz:0,vy:mode==='pixel'?0:6};
  for(let tick=0;tick<10800;tick++){
    sim.botAI(P,B,ball,1/120,-1,undefined);sim.botAI(B,P,ball,1/120,1,undefined);
    sim.solveContacts([P,B],ball,1/120);
    if(sim.stepBall(ball,1/120)){goals++;break;}
  }
}
console.log(JSON.stringify({revision:'08fa7b3',scored:goals,contests:32,seconds:90}));
