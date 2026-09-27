/** Shared kitchen-sink geometry, surface rules and deterministic host-owned events. */
import { simulationConfig } from './simulation-config.js';
export const SINK = simulationConfig.sink;
const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t=clamp01(n); return t*t*(3-2*t); };

/** Renderers and force integration sample the same differentiable basin shoulders. */
export function sinkHeight(x,z,config=SINK) {
  return config.slopeCurveX*Math.max(0,Math.abs(x)-config.slopeStartX)**2
    + config.slopeCurveZ*Math.max(0,Math.abs(z)-config.slopeStartZ)**2;
}

/** Deterministic faucet telegraph. There is no current before the warning completes. */
export function faucetPhase(time,config=SINK) {
  const t=((time%config.faucetCycle)+config.faucetCycle)%config.faucetCycle;
  if(t<config.faucetWarningAt)return {phase:'idle',strength:0,remaining:config.faucetWarningAt-t};
  if(t<config.faucetFlowAt)return {phase:'warning',strength:0,remaining:config.faucetFlowAt-t};
  if(t<config.faucetEbbAt)return {phase:'flow',strength:smooth((t-config.faucetFlowAt)/config.faucetRise),remaining:config.faucetEbbAt-t};
  return {phase:'ebb',strength:1-smooth((t-config.faucetEbbAt)/(config.faucetCycle-config.faucetEbbAt)),remaining:config.faucetCycle-t};
}

/** Pure surface sample. Current/drain vectors are ball acceleration in world units/s^2.
 * Wetness persists between surges, so visible water always means slippery handling.
 * Ball y remains height above this surface, matching both renderers' floor convention.
 */
export function sinkSurface(x,z,state,config=SINK) {
  const dx=Math.max(0,Math.abs(x)-config.slopeStartX),dz=Math.max(0,Math.abs(z)-config.slopeStartZ);
  const wet=smooth((x-config.wetStartX)/(config.wetCoreStartX-config.wetStartX))
    * (1-smooth((x-config.wetCoreEndX)/(config.wetEndX-config.wetCoreEndX)))
    * (1-smooth((Math.abs(z)-config.wetCoreHalfZ)/(config.wetHalfZ-config.wetCoreHalfZ)));
  const strength=state?.surge ?? (state ? faucetPhase(state.time||0,config).strength : 0);
  let drainPullX=0,drainPullZ=0;
  for(const sign of [-1,1]) {
    const xTo=-x,zTo=sign*config.drainZ-z,d=Math.hypot(xTo,zTo);
    if(d>1e-6 && d<config.drainPullRadius) {
      const pull=config.drainPullAcceleration*smooth(1-d/config.drainPullRadius)*Math.min(d/2,1);
      drainPullX+=xTo/d*pull;drainPullZ+=zTo/d*pull;
    }
  }
  return {height:sinkHeight(x,z,config),slopeX:Math.sign(x)*2*config.slopeCurveX*dx,
    slopeZ:Math.sign(z)*2*config.slopeCurveZ*dz,wet,
    currentX:wet*strength*config.currentAcceleration,currentZ:0,drainPullX,drainPullZ};
}

export function makeArenaState(seed='') {
  let hash=2166136261;for(const c of String(seed))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  return {time:0,next:SINK.firstHazard,index:0,seed:hash,hazard:null,surge:0,faucet:faucetPhase(0)};
}
/** Goals clear old targets, but the kitchen's clock and event sequence span the match.
 * Return a new state; an existing later warning is never postponed unnecessarily.
 */
export function resetSinkRound(state,config=SINK) {
  return {...state,hazard:null,next:Math.max(state.next,state.time+config.kickoffHazardGrace)};
}
function limitSpeed(body,max) {
  const speed=Math.hypot(body.vx,body.vz);if(speed>max){body.vx*=max/speed;body.vz*=max/speed;}
}
function kick(body,x,z,power,max) {
  const dx=body.x-x,dz=body.z-z,d=Math.hypot(dx,dz),strength=power*Math.max(0,1-d/SINK.radius);
  if(strength<=0)return;
  body.vx+=(d>.01?dx/d:1)*strength;body.vz+=(d>.01?dz/d:0)*strength;
  limitSpeed(body,max);
}
export function stepSink(state,cars,ball,dt) {
  state.time+=dt;
  state.faucet=faucetPhase(state.time);state.surge=state.faucet.strength;
  for(const b of [...cars,ball]) {
    // High airborne balls clear surface effects; impacts still work in the air.
    const isBall=b===ball;
    if(isBall && (b.soap?.airborne || (b.y||0)>SINK.surfaceBallMaxHeight))continue;
    const s=sinkSurface(b.x,b.z,state),slopeScale=SINK.slopeGravity/(1+s.slopeX*s.slopeX+s.slopeZ*s.slopeZ)
      *(isBall?(b.soap?0:1):SINK.carSlopeScale),currentScale=isBall?1:SINK.currentCarScale;
    b.vx+=(-s.slopeX*slopeScale+s.currentX*currentScale+(isBall?s.drainPullX:0))*dt;
    b.vz+=(-s.slopeZ*slopeScale+s.currentZ*currentScale+(isBall?s.drainPullZ:0))*dt;
    limitSpeed(b,isBall?SINK.ballMaxSpeed:SINK.carMaxSpeed);
  }
  if(state.time>=state.next) {
    const n=state.index++,phase=(state.seed%997+n*137)*.1;
    state.hazard={id:n+1,kind:n%2?'lightning':'meteor',x:Math.max(-14,Math.min(14,ball.x+Math.sin(phase)*5)),z:Math.max(-18,Math.min(18,ball.z+Math.cos(phase)*5)),age:0,fired:false};
    state.next+=SINK.interval;
  }
  const h=state.hazard;
  if(!h)return null;
  h.age+=dt;
  if(!h.fired && h.age>=SINK.warning) {
    h.fired=true;
    for(const car of cars) {
      if(h.kind==='lightning' && Math.hypot(car.x-h.x,car.z-h.z)<SINK.radius)car.shock=SINK.lightningShock;
      kick(car,h.x,h.z,h.kind==='meteor'?SINK.meteorCarImpulse:SINK.lightningCarImpulse,SINK.carMaxSpeed);
    }
    kick(ball,h.x,h.z,h.kind==='meteor'?SINK.meteorBallImpulse:SINK.lightningBallImpulse,SINK.ballMaxSpeed);
    if(h.kind==='meteor' && Math.hypot(ball.x-h.x,ball.z-h.z)<SINK.radius)ball.vy=Math.max(ball.vy,SINK.meteorLift);
    return h.kind;
  }
  if(h.age>SINK.warning+SINK.afterImpact)state.hazard=null;
  return null;
}
export function drainGoal(ball,radius) {
  if(ball.y>radius+1.5)return null;
  for(const sign of [-1,1])if(Math.hypot(ball.x,ball.z-sign*SINK.drainZ)+radius<SINK.drainRadius)return sign<0?'A':'B';
  return null;
}
