import fs from 'node:fs';
import { bodyFrom, botAI, carBall, carCar, stepBall, getBallRadius, setPixelTight, solveContacts, resetContacts } from '../sim.js';
export function replay(mode, fixture) {
  setPixelTight(mode === 'pixel'); resetContacts();
  const jam = fixture === 'jam';
  const P=bodyFrom('model3',0,jam?3:14,0), B=bodyFrom('semi',jam?0:-18,jam?-4:-28,Math.PI);
  const ball={x:0,z:0,y:getBallRadius(),vx:0,vz:0,vy:0};
  const frames=[];
  for(let tick=0;tick<240;tick++) {
    botAI(P,B,ball,1/120,-1,false); botAI(B,P,ball,1/120,1,false);
    const hits=solveContacts([P,B],ball,1/120); const goal=stepBall(ball,1/120);
    frames.push(JSON.parse(JSON.stringify({tick,input:[false,false],P,B,ball,hits,goal})));
    if(goal)break;
  }
  return {mode,fixture,dt:1/120,frames};
}
if(process.argv[1]?.endsWith('replay.mjs')) {
  const out=process.env.QA_OUT || 'output/first-playable-slice/replays'; fs.mkdirSync(out,{recursive:true});
  for(const mode of ['pixel','3d'])for(const fixture of ['jam','open-shot']) {
    const a=replay(mode,fixture), b=replay(mode,fixture);
    if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Nonrepeatable replay');
    fs.writeFileSync(`${out}/${mode}-${fixture}.json`,JSON.stringify({revision:process.env.REVISION||'working-tree',...a}));
  }
  console.log('Four same-runtime replays repeat identically');
}
