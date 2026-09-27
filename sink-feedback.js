import { SINK, faucetPhase, sinkSurface } from './sink.js';

/** Short cause/effect descriptions; the arena itself carries the spatial information. */
export function sinkFeedback(state,car,ball) {
  const hazard=state.hazard,faucet=state.faucet||faucetPhase(state.time||0);
  if(hazard) {
    const meteor=hazard.kind==='meteor',hit=hazard.age>=SINK.warning;
    return {kind:meteor?'meteor':'lightning',text:hit
      ?(meteor?'METEOR · outward knockback':'LIGHTNING · cars briefly stunned')
      :`${meteor?'METEOR':'LIGHTNING'} IN ${Math.max(1,Math.ceil(SINK.warning-hazard.age))}s · ${meteor?'blast':'shock'} zone marked`};
  }
  if(faucet.phase==='warning')return {kind:'warning',text:`TAP OPENS IN ${Math.max(1,Math.ceil(faucet.remaining))}s · watch the wet lane`};
  if(faucet.phase==='flow')return {kind:'water',text:'FAUCET FLOW · arrows show the push'};
  if(faucet.phase==='ebb')return {kind:'water',text:'FLOW EASING · wet steel stays slippery'};
  if(car?.shock>0)return {kind:'lightning',text:'SHORT CIRCUIT · drive power returns soon'};
  if(ball?.soap?.airborne&&ball.y>2.5)return {kind:'water',text:'BIG AIR · watch the landing'};
  if(ball?.soap?.releaseT>0)return {kind:'water',text:'SQUIRT! · the soap slips free'};
  const c=car&&sinkSurface(car.x,car.z,state),b=ball&&(ball.y||0)<=SINK.surfaceBallMaxHeight&&sinkSurface(ball.x,ball.z,state);
  if(c?.wet>.25)return {kind:'water',text:'WET TIRES · less grip, wider turns'};
  if(b&&Math.hypot(b.drainPullX,b.drainPullZ)>.18)return {kind:'drain',text:ball.soap?'DRAIN PULL · soap spirals toward the hole':'DRAIN PULL · ball curves toward the hole'};
  if(b&&Math.hypot(b.slopeX,b.slopeZ)>.15)return {kind:'bank',text:ball.soap?'BANK RIDE · speed turns into air':'BALL ON BANK · gravity rolls it downhill'};
  if(c&&Math.hypot(c.slopeX,c.slopeZ)>.15)return {kind:'bank',text:'BANKED STEEL · gravity pulls downhill'};
  return {kind:'quiet',text:'SINK IT · shoot into the opposing drain'};
}
