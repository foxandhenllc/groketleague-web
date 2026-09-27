/** Shared kitchen-sink rules and deterministic, host-owned arena events. */
import { simulationConfig } from './simulation-config.js';
export const SINK = simulationConfig.sink;
export function sinkHeight(x,z) { return Math.max(0,Math.abs(x)-17)*.38 + Math.max(0,Math.abs(z)-29)*.25; }
export function makeArenaState(seed='') {
  let hash=2166136261;for(const c of String(seed))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  return {time:0,next:5,index:0,seed:hash,hazard:null,surge:0};
}
function kick(body,x,z,power,max) {
  const dx=body.x-x,dz=body.z-z,d=Math.hypot(dx,dz),strength=power*Math.max(0,1-d/SINK.radius);
  if(strength<=0)return;
  body.vx+=(d>.01?dx/d:1)*strength;body.vz+=(d>.01?dz/d:0)*strength;
  const speed=Math.hypot(body.vx,body.vz);if(speed>max){body.vx*=max/speed;body.vz*=max/speed;}
}
export function stepSink(state,cars,ball,dt) {
  state.time+=dt;
  const phase=state.time%14;state.surge=phase>9 ? Math.sin((phase-9)/5*Math.PI) : 0;
  for(const b of [...cars,ball]) {
    // The raised basin shoulders continuously roll bodies toward the flat center.
    b.vx-=Math.sign(b.x)*Math.max(0,Math.abs(b.x)-17)*2.3*dt;
    b.vz-=Math.sign(b.z)*Math.max(0,Math.abs(b.z)-29)*1.8*dt;
    b.vx+=state.surge*(b===ball?8:3)*dt;
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
      if(h.kind==='lightning' && Math.hypot(car.x-h.x,car.z-h.z)<SINK.radius)car.shock=.6;
      kick(car,h.x,h.z,h.kind==='meteor'?18:10,38);
    }
    kick(ball,h.x,h.z,h.kind==='meteor'?27:18,42);
    if(h.kind==='meteor' && Math.hypot(ball.x-h.x,ball.z-h.z)<SINK.radius)ball.vy=Math.max(ball.vy,5);
    return h.kind;
  }
  if(h.age>SINK.warning+.9)state.hazard=null;
  return null;
}
export function drainGoal(ball,radius) {
  if(ball.y>radius+1.5)return null;
  for(const sign of [-1,1])if(Math.hypot(ball.x,ball.z-sign*SINK.drainZ)+radius<SINK.drainRadius)return sign<0?'A':'B';
  return null;
}
