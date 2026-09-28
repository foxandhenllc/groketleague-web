import {TRACK_LENGTH,TRACK_WIDTH,trackFrame,trackGap,localProgress,moonHazards,JUMP_AT,JET_AT,CARGO_AT} from './moon-track.js';
import {vehicleBounds} from './art-contract.js';
export const TEAMS=[
  {id:'comet',name:'Comet Club',short:'COMET',color:'#ffb45f',mark:'CC',motto:'Late brakes. Big wishes.',drivers:['Nova','Blip'],cars:['model3','cybertruck']},
  {id:'mops',name:'Moon Mops',short:'MOPS',color:'#68e5ee',mark:'MM',motto:'Cleaning up the podium.',drivers:['Dusty','Bucket'],cars:['cybercab','semi']},
  {id:'budget',name:'Budget Boosters',short:'BUDGET',color:'#c2a0ff',mark:'BB',motto:'Mostly within budget.',drivers:['Coupon','Overtime'],cars:['model3','cybercab']},
  {id:'gators',name:'Crater Gators',short:'GATORS',color:'#b7ed72',mark:'CG',motto:'Mind the bite radius.',drivers:['Chomp','Pebble'],cars:['semi','cybertruck']}
];
export const RACE_LAPS=2,RACE_LIMIT=135,RACE_POINTS=[15,12,10,8,6,4,2,1];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function seededRandom(seed){
  let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}
  return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
function pose(car){const p=trackFrame(car.s,car.lane);car.x=p.x;car.z=p.z;if(!car.airborne)car.y=p.y;car.yaw=p.yaw+Math.atan2(-car.lateral,Math.max(4,car.speed));return p;}
export function createMoonRace(seed='moon',team='comet'){
  const random=seededRandom(seed),grid=[0,1,2,3,4,5,6,7];
  for(let i=7;i>0;i--){const j=Math.floor(random()*(i+1));[grid[i],grid[j]]=[grid[j],grid[i]];}
  const cars=TEAMS.flatMap((t,ti)=>t.drivers.map((name,i)=>{
    const id=ti*2+i,slot=grid.indexOf(id),s=-5-Math.floor(slot/2)*7;
    const bounds=vehicleBounds(t.cars[i]),scale=2.05/bounds.hz;
    const c={id,team:t.id,name,kind:t.cars[i],number:id+1,color:t.color,s,lane:slot%2?2.6:-2.6,speed:0,lateral:0,y:0,vy:0,airborne:false,
      scale,hx:bounds.hx*scale,hz:2.05,boost:1,boosting:false,boostRest:0,style:Math.floor(random()*4),nerve:.8+random()*.4,pace:.97+random()*.06,phase:random()*Math.PI*2,
      laneWish:0,think:random()*.2,bump:0,recover:0,finishTime:null,checkpoint:-1,lastRamp:-1,lastJet:-99,lastCargo:-99,stuck:0,airTime:0};pose(c);return c;
  }));
  return {seed,team,cars,time:0,phase:'countdown',countdown:3,offset:random()*14,order:[],events:[],eventId:0,
    leader:null,leadCandidate:null,leadSince:0,rankAt:0,metrics:{passes:0,leadChanges:0,contacts:0,wallHits:0,jetHits:0,cargoHits:0,jumps:0,recoveries:0},lastRanks:null};
}
export function raceOrder(race){return [...race.cars].sort((a,b)=>{
  if(a.finishTime!==null||b.finishTime!==null){if(a.finishTime===null)return 1;if(b.finishTime===null)return -1;return a.finishTime-b.finishTime||a.id-b.id;}
  return b.s-a.s||a.id-b.id;
});}
function event(race,type,car,text){race.events.push({id:++race.eventId,type,car:car?.id,text,time:race.time});if(race.events.length>12)race.events.shift();}
function chooseLane(c,race,frame){
  const u=localProgress(c.s)/TRACK_LENGTH,inside=clamp(frame.curvature*220,-3.8,3.8);
  let wanted=(c.style===0?inside:c.style===1?-inside*.25:c.style===2?inside*.5:0)+Math.sin(c.s*.013+c.phase)*1.5;
  const ahead=race.cars.filter(o=>o!==c&&o.finishTime===null&&trackGap(o.s,c.s)>0&&trackGap(o.s,c.s)<18);
  const blocker=ahead.find(o=>Math.abs(o.lane-c.lane)<2.8);
  if(blocker){
    const lanes=[-4.5,-1.5,1.5,4.5];
    lanes.sort((a,b)=>{
      const score=l=>ahead.reduce((v,o)=>v+(Math.abs(o.lane-l)<2.7?(20-trackGap(o.s,c.s)):0),0)+Math.abs(l-c.lane)*.22;
      return score(a)-score(b);
    });wanted=lanes[0];
  }
  const hazards=moonHazards(race.time,race.offset),jetAhead=trackGap(JET_AT,c.s),cargoAhead=trackGap(CARGO_AT,c.s);
  if(jetAhead>0&&jetAhead<30&&(hazards.jetWarning||hazards.jetActive))wanted=c.style===2?-1.3:2.8;
  if(cargoAhead>0&&cargoAhead<22)wanted=hazards.cargoLane>0?-4:4;
  if(u>.48&&u<.62&&c.style===1)wanted*=.5;
  c.laneWish=clamp(wanted,-5.1,5.1);
}
export function stepMoonRace(race,dt,input={}){
  if(race.phase==='results'||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,1/30);
  if(race.phase==='countdown'){race.countdown=Math.max(0,race.countdown-dt);if(race.countdown===0){race.phase='race';event(race,'start',null,'GREEN LIGHT. MOON RULES.');}return;}
  race.time+=dt;const hazards=moonHazards(race.time,race.offset);
  for(const c of race.cars){
    if(c.finishTime!==null){c.speed=Math.max(0,c.speed-dt*5);c.s+=c.speed*dt;pose(c);continue;}
    const frame=trackFrame(c.s,c.lane),u=localProgress(c.s)/TRACK_LENGTH,previous=c.s;
    c.think-=dt;c.bump=Math.max(0,c.bump-dt);c.recover=Math.max(0,c.recover-dt);c.boostRest=Math.max(0,c.boostRest-dt);
    if(c.think<=0){chooseLane(c,race,trackFrame(c.s+13));c.think=.24;}
    const dust=u>.48&&u<.62,grip=dust?.58:1;
    const steering=(c.laneWish-c.lane)*(c.airborne?.65:5.3)*grip*c.nerve-c.lateral*(c.airborne?.7:3.7)*grip;
    c.lateral=clamp(c.lateral+steering*dt,-7,7);c.lane+=c.lateral*dt;
    const turn=Math.abs(trackFrame(c.s+14).curvature);
    const top=({model3:19.3,cybercab:19,cybertruck:18.9,semi:18.7})[c.kind];
    let target=clamp(top-turn*(c.style===0?175:225),11,top)*c.pace;
    const draft=race.cars.find(o=>o!==c&&o.finishTime===null&&trackGap(o.s,c.s)>4&&trackGap(o.s,c.s)<15&&Math.abs(o.lane-c.lane)<2.6);
    if(draft){target+=.7;c.boost=Math.min(1,c.boost+dt*.035);}
    if(dust)target*=c.style===0?1.02:.96;
    const controlled=input.manual&&c.id===input.car;
    const wants=controlled?!!input.boost:(turn<.015&&c.boost>.3&&c.boostRest===0&&(draft||Math.sin(race.time*.7+c.phase)>.25));
    c.boosting=wants&&c.boost>.025&&c.boostRest===0;
    if(c.boosting){target+=7;c.boost=Math.max(0,c.boost-dt*.36);if(c.boost<=.025)c.boostRest=1.3;}
    else c.boost=Math.min(1,c.boost+dt*.13);
    c.speed=Math.max(0,c.speed+clamp((target-c.speed)*1.15,-11,7.3)*dt-frame.slope*5.8*dt);
    c.s+=c.speed*dt/clamp(1-frame.curvature*c.lane,.76,1.3);
    const edge=TRACK_WIDTH/2-c.hx-.25;
    if(Math.abs(c.lane)>edge){c.lane=Math.sign(c.lane)*edge;c.lateral*=-.42;c.speed*=.96;if(c.bump===0){race.metrics.wallHits++;c.bump=.3;}}
    const ground=trackFrame(c.s,c.lane).y;
    const ramp=Math.floor((c.s-JUMP_AT)/TRACK_LENGTH);
    if(c.s>=JUMP_AT&&ramp>c.lastRamp){c.lastRamp=ramp;if(c.speed>12&&!c.airborne){c.airborne=true;c.vy=4.4+(c.boosting?.8:0);c.y=ground+.03;race.metrics.jumps++;event(race,'air',c,c.name.toUpperCase()+' TAKES THE SKYWAY');}}
    if(c.airborne){c.vy-=4.6*dt;c.y+=c.vy*dt;c.airTime+=dt;if(c.y<=ground&&c.vy<0){c.y=ground;c.vy=0;c.airborne=false;c.speed*=.985;}}
    if(hazards.jetActive&&Math.abs(trackGap(c.s,JET_AT))<7&&c.lane<-.7&&race.time-c.lastJet>2.5){c.lastJet=race.time;c.speed*=.68;c.lateral+=4.8;race.metrics.jetHits++;event(race,'jet',c,'PROTOTYPE EXHAUST! '+c.name.toUpperCase()+' PUSHED WIDE');}
    if(Math.abs(trackGap(c.s,CARGO_AT))<3.5&&Math.abs(c.lane-hazards.cargoLane)<2.5&&race.time-c.lastCargo>2){c.lastCargo=race.time;c.speed*=.6;c.lateral+=(c.lane>hazards.cargoLane?1:-1)*4.5;race.metrics.cargoHits++;event(race,'cargo',c,'SPECIAL DELIVERY. '+c.name.toUpperCase()+' MEETS THE CARGO');}
    // Progress advances through ordered checkpoint gates. Collisions cannot skip a lap.
    while(c.s>=(c.checkpoint+1)*TRACK_LENGTH/16&&c.checkpoint<32)c.checkpoint++;
    if(c.s>=RACE_LAPS*TRACK_LENGTH&&c.checkpoint>=32){
      c.finishTime=race.time-dt+dt*clamp((RACE_LAPS*TRACK_LENGTH-previous)/Math.max(.001,c.s-previous),0,1);
      c.s=RACE_LAPS*TRACK_LENGTH;event(race,'finish',c,c.name.toUpperCase()+' CROSSES THE LINE');
    }
    c.stuck=c.speed<2?c.stuck+dt:0;
    if(c.stuck>3){c.laneWish=0;c.speed=5;c.stuck=0;c.recover=1;race.metrics.recoveries++;}
    pose(c);
  }
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
    const a=race.cars[i],b=race.cars[j];if(a.finishTime!==null||b.finishTime!==null||Math.abs(a.y-b.y)>2.4)continue;
    const ds=trackGap(a.s,b.s),dl=a.lane-b.lane,along=a.hz+b.hz+.08-Math.abs(ds),across=a.hx+b.hx+.08-Math.abs(dl);
    if(along<=0||across<=0)continue;
    if(across<along){const sign=Math.sign(dl)||1;a.lane+=sign*across*.51;b.lane-=sign*across*.51;const impulse=(a.lateral-b.lateral)*sign;if(impulse<0){a.lateral-=impulse*sign*.55;b.lateral+=impulse*sign*.55;}}
    else {const front=ds>0?a:b,rear=ds>0?b:a;front.s+=along*.5;rear.s-=along*.5;if(rear.speed>front.speed){const hit=rear.speed-front.speed;front.speed+=hit*.38;rear.speed-=hit*.62;rear.lateral+=(rear.lane>front.lane?1:-1)*.5;}}
    if(a.bump===0&&b.bump===0){race.metrics.contacts++;a.bump=b.bump=.22;}
    pose(a);pose(b);
  }
  const order=raceOrder(race);race.order=order.map(c=>c.id);
  // Confirm the lead before calling it: side-by-side contact can swap raw rank every tick.
  if(race.leadCandidate!==order[0].id){race.leadCandidate=order[0].id;race.leadSince=race.time;}
  if(race.leader===null)race.leader=order[0].id;
  if(race.leader!==order[0].id&&race.time-race.leadSince>.65){
    if(race.time>4){race.metrics.leadChanges++;event(race,'lead',order[0],order[0].name.toUpperCase()+' TAKES THE LEAD');}
    race.leader=order[0].id;
  }
  if(race.time-race.rankAt>.75){
    if(race.lastRanks&&race.time>4)for(let i=0;i<order.length;i++)if(race.lastRanks.indexOf(order[i].id)>i)race.metrics.passes++;
    race.rankAt=race.time;race.lastRanks=race.order.slice();
  }
  if(order.every(c=>c.finishTime!==null)||race.time>=RACE_LIMIT){race.phase='results';event(race,'results',order[0],'CHEQUERED FLAG');}
}
export function raceTeamScores(race){const scores=Object.fromEntries(TEAMS.map(t=>[t.id,0]));raceOrder(race).forEach((c,i)=>{if(c.finishTime!==null)scores[c.team]+=RACE_POINTS[i];});return scores;}
