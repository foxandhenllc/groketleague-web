import {createMoonRace,stepMoonRace,raceOrder,raceTeamScores,TEAMS,RACE_LAPS} from './moon-sim.js';
import {TRACK_LENGTH,sectorAt,moonHazards,JET_AT,CARGO_AT,trackGap} from './moon-track.js';
import {createMoonView} from './moon-scene.js';
import {createPhysicsClock} from './physics-clock.js';
import {SFX,ensureAudio,playBed,stopBed,isMusicMuted,isSfxMuted,setSfxMuted,setMusicMuted} from './audio.js';

const $=id=>document.getElementById(id),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let team='comet';try{const saved=localStorage.getItem('gl_moon_team');if(TEAMS.some(t=>t.id===saved))team=saved;}catch{}
let manual=false,boostHeld=false,mode='setup',paused=false,heat=1,cameraMode='team',race=createMoonRace('lunar-grid-preview',team),view=null;
const boostKeys=new Set();let pointer=null;
let cup=Object.fromEntries(TEAMS.map(t=>[t.id,0])),resultsApplied=false,eventSeen=0,eventUntil=0,eventText='',lastCount=-1,celebration=0,last=performance.now(),uiTime=0,renderState={},bootError='';
const focusId=()=>TEAMS.findIndex(t=>t.id===team)*2;
const fixed=createPhysicsClock(dt=>{if(!paused&&mode==='racing')stepMoonRace(race,dt,{manual,boost:boostHeld,car:focusId()});});
const timeText=n=>{if(n===null)return 'DNF';const mins=Math.floor(n/60);return mins+':'+(n%60).toFixed(1).padStart(4,'0');};
function chooseTeam(id){
  team=id;const t=TEAMS.find(t=>t.id===id);document.documentElement.style.setProperty('--team',t.color);
  for(const button of document.querySelectorAll('[data-team]'))button.setAttribute('aria-pressed',String(button.dataset.team===id));
  $('teamDescription').textContent=t.motto+' Following '+t.drivers[0]+'; both teammates score.';
  try{localStorage.setItem('gl_moon_team',id);}catch{}
}
for(const t of TEAMS){const button=document.createElement('button');button.className='teamCard';button.dataset.team=t.id;button.style.setProperty('--badge',t.color);button.setAttribute('aria-pressed','false');button.innerHTML=`<span class="teamMark">${t.mark}</span><span><strong>${t.name}</strong><small>${t.drivers.join(' + ')}</small></span>`;button.onclick=()=>{chooseTeam(t.id);SFX.tick();};$('teams').appendChild(button);}
chooseTeam(team);
function setControl(value){manual=value;$('watchMode').setAttribute('aria-pressed',String(!manual));$('boostMode').setAttribute('aria-pressed',String(manual));boostHeld=false;}
$('watchMode').onclick=()=>setControl(false);$('boostMode').onclick=()=>setControl(true);
function clearBoost(){boostHeld=false;boostKeys.clear();pointer=null;$('raceBoost').classList.remove('hot');}
function startHeat(newCup=false){
  if(!view)return;
  if(newCup){heat=1;cup=Object.fromEntries(TEAMS.map(t=>[t.id,0]));}
  const requested=new URL(location.href).searchParams.get('seed');
  race=createMoonRace((requested?requested.slice(0,80):crypto.randomUUID())+':'+heat,team);
  mode='racing';paused=false;resultsApplied=false;eventSeen=0;lastCount=-1;eventText='';eventUntil=0;celebration=0;uiTime=0;cameraMode='team';clearBoost();fixed.reset();last=performance.now();
  $('raceSetup').hidden=true;$('raceResults').hidden=true;$('racePause').hidden=true;$('raceHud').hidden=false;
  $('raceBoost').disabled=!manual;$('raceBoost').textContent=manual?'HOLD BOOST':'WATCHING';$('boostHint').textContent=manual?'SPACE / SHIFT / TOUCH':'AUTONOMOUS BOOST';
  syncCameraButtons();ensureAudio();playBed('night');SFX.tick();$('raceMenu').focus({preventScroll:true});
}
function returnToTeams(){mode='setup';paused=false;clearBoost();fixed.reset();$('raceHud').hidden=true;$('raceResults').hidden=true;$('racePause').hidden=true;$('raceSetup').hidden=false;stopBed();$('startRace').focus();}
$('startRace').onclick=()=>startHeat(true);
$('changeTeam').onclick=returnToTeams;$('resultsTeams').onclick=returnToTeams;
$('nextHeat').onclick=()=>{if(heat>=3)startHeat(true);else{heat++;startHeat();}};
function syncRaceAudio(){
  for(const [id,on,label] of [['raceMusic',!isMusicMuted(),'Music'],['raceSfx',!isSfxMuted(),'Sound effects']]){
    $(id).textContent=label+': '+(on?'On':'Off');$(id).setAttribute('aria-pressed',String(on));
  }
}
function pauseRace(value){if(mode!=='racing')return;paused=value;clearBoost();fixed.reset();$('racePause').hidden=!value;if(value){syncRaceAudio();$('resumeRace').focus();SFX.pause();}else $('raceMenu').focus({preventScroll:true});}
$('raceMenu').onclick=()=>pauseRace(true);$('resumeRace').onclick=()=>pauseRace(false);
$('raceMusic').onclick=()=>{ensureAudio();setMusicMuted(!isMusicMuted());syncRaceAudio();};
$('raceSfx').onclick=()=>{ensureAudio();setSfxMuted(!isSfxMuted());syncRaceAudio();SFX.tick();};
syncRaceAudio();
function syncCameraButtons(){for(const b of document.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',String(b.dataset.camera===cameraMode));}
for(const b of document.querySelectorAll('[data-camera]'))b.onclick=()=>{cameraMode=b.dataset.camera;syncCameraButtons();};
$('raceBoost').addEventListener('pointerdown',e=>{if(mode!=='racing'||paused||!manual)return;pointer=e.pointerId;e.preventDefault();$('raceBoost').setPointerCapture?.(pointer);boostHeld=true;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('raceBoost').addEventListener(event,()=>{pointer=null;boostHeld=boostKeys.size>0;});
window.addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target?.isContentEditable||e.target?.closest?.('input,textarea,select'))return;
  if((e.code==='Escape'||e.code==='KeyP')&&mode==='racing'){e.preventDefault();pauseRace(!paused);return;}
  if(mode==='racing'&&!paused&&manual&&['Space','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();boostKeys.add(e.code);boostHeld=true;}
});
window.addEventListener('keyup',e=>{if(['Space','ShiftLeft','ShiftRight'].includes(e.code)){boostKeys.delete(e.code);boostHeld=boostKeys.size>0||pointer!==null;}});
window.addEventListener('blur',clearBoost);document.addEventListener('visibilitychange',()=>{clearBoost();if(document.hidden&&mode==='racing'&&!paused)pauseRace(true);});
for(const dialog of [$('racePause'),$('raceResults')])dialog.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;const focusable=[...dialog.querySelectorAll('button,a,summary')].filter(el=>!el.disabled),first=focusable[0],end=focusable.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}
});
function showResults(){
  if(resultsApplied)return;resultsApplied=true;mode='results';clearBoost();const scores=raceTeamScores(race);for(const t of TEAMS)cup[t.id]+=scores[t.id];
  const teams=[...TEAMS].sort((a,b)=>cup[b.id]-cup[a.id]),order=raceOrder(race),winner=order[0],winningTeam=TEAMS.find(t=>t.id===winner.team);
  const tied=teams.filter(t=>cup[t.id]===cup[teams[0].id]);
  $('finishKicker').textContent=heat===3?'LUNAR CUP COMPLETE':'HEAT '+heat+' / 3 · CHEQUERED FLAG';
  $('finishTitle').textContent=heat===3?(tied.length>1?'Shared Moon Cup!':teams[0].name+' take the cup!'):winner.name+' takes the flag!';
  $('finishCopy').textContent=heat===3?'Three heats. Two racers per team. '+(tied.length>1?tied.map(t=>t.name).join(' and ')+' finish level on points.':teams[0].name+' finish with '+cup[teams[0].id]+' points.'):winningTeam.name+' win the heat in '+timeText(winner.finishTime)+'. Both teammates add to the cup total.';
  $('cupTable').innerHTML=teams.map(t=>`<div class="cupRow" style="--badge:${t.color}"><b>${teams.findIndex(o=>cup[o.id]===cup[t.id])+1}</b><div>${t.name}${t.id===team?' · YOUR TEAM':''}<small>+${scores[t.id]} this heat</small></div><b>${cup[t.id]} pts</b></div>`).join('');
  $('finishOrder').innerHTML=order.map(c=>`<li>${c.name} · ${TEAMS.find(t=>t.id===c.team).short}<span>${timeText(c.finishTime)}</span></li>`).join('');
  $('nextHeat').textContent=heat===3?'Race another cup':'Next heat';$('raceResults').hidden=false;$('nextHeat').focus();SFX.goal();celebration=.01;
}
function updateHud(){
  const order=raceOrder(race),you=race.cars[focusId()],leader=order[0];
  $('heatLabel').textContent='HEAT '+heat+' / 3';$('raceClock').textContent=timeText(race.time);
  $('lapLabel').textContent=race.phase==='countdown'?'LIGHTS OUT SOON':leader.finishTime!==null?'FINISHERS ARRIVING':'LAP '+Math.min(RACE_LAPS,Math.floor(Math.max(0,leader.s)/TRACK_LENGTH)+1)+' / '+RACE_LAPS;
  $('positions').innerHTML=order.map((c,i)=>`<li class="${c.team===team?'mine':''}"><b>${i+1}</b><i style="background:${c.color}"></i><span class="racerName">${c.name}<small>${TEAMS.find(t=>t.id===c.team).short}${c.id===focusId()?' · YOU':''}</small></span><span class="gap">${c.finishTime!==null?'FIN':i===0?'LEAD':'+'+Math.max(0,(leader.s-c.s)/Math.max(12,c.speed)).toFixed(1)}</span></li>`).join('');
  const places=order.map((c,i)=>c.team===team?i+1:null).filter(Boolean);$('teamStatus').textContent=TEAMS.find(t=>t.id===team).short+' · P'+places.join(' + P')+' · '+cup[team]+' cup pts';
  const focus=race.cars[cameraMode==='leader'?leader.id:focusId()],sector=sectorAt(focus.s),hazard=moonHazards(race.time,race.offset);
  $('sectorName').textContent=sector.name;$('sectorName').style.color=sector.color;
  const nearJet=Math.abs(trackGap(focus.s,JET_AT))<45,nearCargo=Math.abs(trackGap(focus.s,CARGO_AT))<32;
  $('sectorHint').textContent=nearJet&&(hazard.jetWarning||hazard.jetActive)?(hazard.jetWarning?'ENGINE TEST IN '+Math.max(1,Math.ceil(2.3-hazard.jetPhase))+'s · orange lane pushes outward.':'ENGINE TEST · exhaust pushes across the orange lane.'):nearCargo?'MOVING CARGO · watch the crate and pass on the open side.':sector.hint;
  $('raceBoostFill').style.width=(you.boost*100).toFixed(1)+'%';$('raceBoost').classList.toggle('hot',you.boosting);
  const count=race.phase==='countdown'?Math.ceil(race.countdown):race.time<.8?'GO':'';$('countdown').textContent=count;
  if(count!==lastCount){if(count==='GO')SFX.whistle();else if(count!=='')SFX.tick();lastCount=count;}
  for(const e of race.events.filter(e=>e.id>eventSeen)){
    eventSeen=e.id;if(e.type==='air'&&e.car!==focusId())continue;if(e.type==='finish'&&e.car!==leader.id)continue;
    if(e.type==='finish'){celebration=.01;SFX.goal();eventText=leader.name.toUpperCase()+' TAKES THE FLAG · '+TEAMS.find(t=>t.id===leader.team).name.toUpperCase();eventUntil=e.time+5;continue;}
    if(leader.finishTime!==null&&race.time-leader.finishTime<5)continue;
    eventText=e.text;eventUntil=e.time+2.6;if(e.type==='lead'&&e.car===focusId())SFX.tick();
  }
  $('raceEvent').hidden=!eventText||race.time>eventUntil||race.phase==='countdown';$('raceEvent').textContent=eventText;
}
function tick(now){
  requestAnimationFrame(tick);const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  if(!view)return;
  try{
    if(mode==='racing'&&!paused)fixed.advance(dt);
    if(mode==='racing'&&race.phase==='results')showResults();
    if(celebration>0&&!paused)celebration+=dt;
    renderState=view.update(race,{dt:paused?0:dt,cameraMode:mode==='setup'?'showcase':cameraMode,focus:focusId(),reducedMotion:reducedMotion.matches,celebration:celebration<7?celebration:0});
    uiTime+=dt;if(uiTime>.09&&mode!=='setup'){updateHud();uiTime=0;}
  }catch(error){bootError=error.message;console.error('[moon]',error);view=null;returnToTeams();$('startRace').disabled=true;$('raceError').hidden=false;$('raceError').textContent='Race stopped. Reload to try again. '+error.message;}
}
window.render_game_to_text=()=>JSON.stringify({game:'moon-grand-prix',mode,paused,heat,team,manual,cameraMode,time:race.time,phase:race.phase,countdown:race.countdown,seed:race.seed,
  trackLength:TRACK_LENGTH,laps:RACE_LAPS,cup:{...cup},order:raceOrder(race).map(c=>c.id),cars:race.cars.map(c=>({id:c.id,team:c.team,name:c.name,kind:c.kind,s:c.s,lane:c.lane,x:c.x,y:c.y,z:c.z,speed:c.speed,boost:c.boost,boosting:c.boosting,airborne:c.airborne,finishTime:c.finishTime,checkpoint:c.checkpoint})),metrics:race.metrics,camera:renderState,error:bootError});
try{view=createMoonView($('moonCanvas'));$('startRace').disabled=false;$('startRace').textContent='Start the Moon Cup';requestAnimationFrame(tick);}catch(error){bootError=error.message;console.error(error);$('raceError').hidden=false;$('raceError').textContent='The 3D race could not start. Reload to try again. '+error.message;}
window.addEventListener('resize',()=>view?.resize());
