import { simulationConfig } from "./simulation-config.js";
import { reachableTarget } from './drive-geometry.js';
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

/** Plan a goal-directed route. Human boost is explicit; an undefined intent is the CPU. */
export function planDrive(me, foe, ball, dt, attackSign, field, boostIntent) {
  const config = field.config || simulationConfig;
  const halfW = field.FW / 2, halfL = field.FL / 2;
  const radius = field.ballRadius;
  const ai = me._ai ||= {};
  const personality = me.personality || config.planner.personalities[me.kind];
  ai.time = (ai.time || 0) + dt;
  const distance = Math.hypot(ball.x - me.x, ball.z - me.z);
  const reach = me.l / 2 + radius;
  const speed = Math.hypot(me.vx, me.vz);
  // Estimate arrival, including rolling drag; don't chase a point behind a moving ball.
  const lead = clamp((distance - reach) / (speed + 14), 0, .5);
  const travel = (1 - Math.exp(-config.planner.rollingK * lead)) / config.planner.rollingK;
  const bx = clamp(ball.x + ball.vx * travel, -halfW + radius, halfW - radius);
  const bz = clamp(ball.z + ball.vz * travel, -halfL + radius, halfL - radius);
  const goalZ = attackSign * halfL;
  const ownDistance = halfL + bz * attackSign;
  // Slightly favour the open half of the net when a defender is in the goal mouth.
  const keeper = foe && Math.abs(foe.z - goalZ) < 8;
  const goalX = keeper ? clamp(-foe.x * .45, -field.GOAL_W * .2, field.GOAL_W * .2) : (personality?.aim || 0);
  const goalLength = Math.hypot(goalX - bx, goalZ - bz) || 1;
  let ux = (goalX - bx) / goalLength, uz = (goalZ - bz) / goalLength;
  // At our end board, clear toward open field instead of trying to get outside it.
  if (ownDistance < reach + 1) {
    ux = -Math.sign(bx || me.x || 1) * .75; uz = attackSign * .66;
  }
  // A pass up the boards is reachable; aiming directly at goal from here asks
  // the car to approach from outside the arena.
  if (Math.abs(bx) > halfW - reach - 1 && Math.abs(bz) < halfL - reach - 2) {
    ux = -Math.sign(bx) * .12; uz = attackSign * .993;
  }
  // Approach a board ball from the field and bank it along the boundary. Trying
  // to hit it directly inward asks the car to start outside the playable area.
  const sideBoard=Math.abs(bx)>halfW-reach-1;
  const endBoard=Math.abs(bz)>halfL-reach-1 && Math.abs(bx)>field.GOAL_W/2-radius;
  if(sideBoard || endBoard){
    const choices=[];
    if(sideBoard)choices.push({axis:'side',x:Math.sign(bx)*.45,z:attackSign*.893});
    if(endBoard)choices.push({axis:'end',x:-Math.sign(bx)*.893,z:Math.sign(bz)*.45});
    const setupDistance=reach+3;
    for(const choice of choices){
      const x=bx-choice.x*setupDistance,z=bz-choice.z*setupDistance;
      const target=reachableTarget(x,z,me,field);
      choice.cost=Math.hypot(me.x-target.x,me.z-target.z)+3*Math.hypot(target.x-x,target.z-z);
    }
    choices.sort((a,b)=>a.cost-b.cost);
    const chosen=choices.find(c=>c.axis===ai.bankAxis)||choices[0];
    ai.bankAxis=chosen.axis;ux=chosen.x;uz=chosen.z;
  }else ai.bankAxis=null;
  const px = -uz, pz = ux;
  const rx = me.x - bx, rz = me.z - bz;
  const behind = -(rx * ux + rz * uz);
  const lateral = rx * px + rz * pz;
  const setup = reach + ((sideBoard || endBoard) ? 1.5 : (personality?.setup ?? 4.5));
  let tx, tz, state;
  const foeDistance=foe?Math.hypot(foe.x-ball.x,foe.z-ball.z):Infinity;
  const foeHeading=foe?Math.abs(angle(Math.atan2(-(ball.x-foe.x),-(ball.z-foe.z))-foe.yaw)):Math.PI;
  const windingUp=foe && (foeDistance+1.5<distance || foe.boosting) && (foe.z-ball.z)*attackSign>0 && foeDistance<foe.l/2+radius+10 && foeHeading<.4;
  const incoming=ball.vz*attackSign < -5;
  const defendRange=halfL+8+(personality?.defend ?? 23)-23;
  const threat = (incoming && ownDistance<defendRange) || (windingUp && ownDistance<defendRange-3);
  const goalSide = (me.z - bz) * attackSign < -1;
  if (threat && distance > reach + 1 && (!goalSide || windingUp || incoming)) {
    state = 'defend';
    // Meet the shot goal-side. Do not race all the way to the goal line first.
    const interceptZ=goalSide?me.z:bz-attackSign*Math.min(10,Math.max(4,ownDistance*.45));
    const interceptTime=incoming?clamp((interceptZ-ball.z)/ball.vz,0,.9):.3;
    tx = clamp(ball.x+ball.vx*interceptTime, -halfW+reach,halfW-reach);
    tz = interceptZ;
    // Pass beside the ball while retreating, not through it toward our own net.
    if (Math.abs(me.x - bx) < reach + 1 && Math.abs(me.z - bz) < 10) tx = bx + (me.x < bx ? -1 : 1) * (reach + 3);
  } else if (behind > reach * .2 && Math.abs(lateral) < Math.max(1.35, behind * (personality?.commit ?? .35), ai.mode === 'strike' ? reach + 1.8 : 0)) {
    state = 'strike'; tx = bx + ux * .5; tz = bz + uz * .5;
  } else {
    state = 'approach'; tx = bx - ux * setup; tz = bz - uz * setup;
    // A car on the wrong side first passes alongside the ball. Keep the chosen
    // side until it is behind; otherwise a moving ball causes left/right dithering.
    if (!sideBoard && !endBoard && behind < reach + .6 && Math.abs(lateral) < setup + 1.5) {
      if (!ai.detour) ai.detour = Math.abs(lateral) > .5 ? Math.sign(lateral) : (personality?.side || (me.x < 0 ? -1 : 1));
      const wide = setup + (personality?.wide ?? 1.8);
      tx += px * ai.detour * wide; tz += pz * ai.detour * wide;
    } else if (behind > setup || Math.abs(lateral) > setup + 2) ai.detour = 0;
  }
  // If neither car advances the ball, abandon the perfect setup and contest it.
  // This progress clock also catches cars circling a stationary ball at speed.
  if (ai.ballX === undefined || Math.hypot(ball.x - ai.ballX, ball.z - ai.ballZ) > 2) {
    ai.ballX = ball.x; ai.ballZ = ball.z; ai.staleTime = 0; ai.clearing = false;
  } else ai.staleTime += dt;
  if (ai.staleTime > 2.5) ai.clearing = true;
  if (ai.clearing) {
    state = 'clear'; tx = ball.x; tz = ball.z;
    // Never solve a stalemate by driving the ball straight into our own net.
    if (ownDistance < 8 && Math.abs(bx) < field.GOAL_W / 2 + 1 && !goalSide) {
      state = 'defend'; tx = bx + (me.x < bx ? -1 : 1) * (reach + 1);
      tz = bz - attackSign * (reach + .5);
    }
  }
  // Break a slow bumper-to-bumper contest with a short, committed re-approach.
  // Different patience gives one driver space to play; never yield an own-goal threat.
  ai.reposition = Math.max(0, (ai.reposition || 0) - dt);
  const contested = foe && ownDistance > 12 && !threat && distance < reach + 3 &&
    Math.hypot(ball.vx, ball.vz) < 4 && Math.hypot(me.x-foe.x,me.z-foe.z) < (me.l+foe.l)/2+3;
  ai.contestTime = contested ? (ai.contestTime || 0) + dt : 0;
  if (ai.contestTime > (personality?.patience ?? 2.5) && ai.reposition === 0) {
    ai.reposition = 1.5; ai.contestTime = 0;
  }
  if (ai.reposition > 0 && ownDistance > 12 && !threat && !sideBoard && !endBoard) {
    state = 'reposition';
    tx = bx - ux * setup + px * (personality?.side || 1) * (setup + 2);
    tz = bz - uz * setup + pz * (personality?.side || 1) * (setup + 2);
  }
  if(ai.escape && ai.time<ai.escapeUntil && !threat){
    state='escape';tx=ai.escape.x;tz=ai.escape.z;
    if(Math.hypot(me.x-tx,me.z-tz)<2)ai.escape=null;
  }
  // Targets remain reachable with the entire vehicle inside the boards.
  const contactRoute=state==='strike'||state==='clear'||state==='defend';
  const targetYaw=contactRoute?Math.atan2(-(tx-me.x),-(tz-me.z)):(sideBoard||endBoard)?Math.atan2(-ux,-uz):null;
  const reachable=reachableTarget(tx,tz,me,field,targetYaw);
  tx=reachable.x;tz=reachable.z;
  let dx = tx - me.x, dz = tz - me.z;
  const targetDistance = Math.hypot(dx, dz);
  let error = angle(Math.atan2(-dx, -dz) - me.yaw);

  // Measure progress over time, not per-frame deltas (which vary with refresh rate).
  if (ai.sampleX === undefined) { ai.sampleX = me.x; ai.sampleZ = me.z; ai.sampleTime = 0; ai.stuckTime = 0; }
  ai.sampleTime += dt;
  if (ai.sampleTime >= .4) {
    const moved = Math.hypot(me.x - ai.sampleX, me.z - ai.sampleZ);
    const onBoard = Math.abs(me.x) > halfW - reach || Math.abs(me.z) > halfL - reach;
    ai.stuckTime = moved < .3 && (distance>reach+.3 || ai.staleTime>1.5) && (targetDistance>2 || onBoard || ai.staleTime>2.5) && (Math.abs(error) < .8 || onBoard) ? ai.stuckTime + ai.sampleTime : 0;
    ai.sampleTime = 0; ai.sampleX = me.x; ai.sampleZ = me.z;
  }
  ai.recovery = Math.max(0, (ai.recovery || 0) - dt);
  if (ai.stuckTime >= .8 && ai.recovery === 0) {
    ai.recovery = 1.15; ai.stuckTime = 0;
    ai.detour=-(ai.detour || personality?.side || 1);
    ai.bankAxis=null;
    const inwardLength=Math.hypot(me.x,me.z)||1;
    ai.escape=reachableTarget(me.x-me.x/inwardLength*7,me.z-me.z/inwardLength*7,me,field);
    ai.escapeUntil=ai.time+4;
    ai.staleTime=0;ai.clearing=false;
    // Reverse away from the blocking object while rotating toward open space.
    ai.recoverySteer = (Math.sin(me.yaw) * me.z - Math.cos(me.yaw) * me.x) > 0 ? 1 : -1;
  }
  if (ai.recovery > 0) {
    ai.mode = 'recover'; ai.target = { x: tx, z: tz };
    return { throttle: -.8, steer: ai.recoverySteer * .85, boost: boostIntent === true, safe: false, reason: 'BRAKING', state: ai.mode };
  }

  const turn = clamp(error * 2.2, -1, 1);
  const heading = Math.abs(error);
  // Brake before a tight turn. This bounds the turning circle for the heavy cars.
  const cruise = Math.min(me.max, me.accel / (me.mass > 3 ? config.drive.drag_heavy : config.drive.drag_light));
  let desiredSpeed = cruise * clamp(1 - heading / 1.1, .07, 1);
  const turnRadiusSpeed = me.turn * .55 * Math.max(1, targetDistance - reach * .5) / Math.max(.3, Math.sin(heading) * 2);
  if (heading > .25) desiredSpeed = Math.min(desiredSpeed, Math.max(1, turnRadiusSpeed));
  if (state !== 'strike') desiredSpeed = Math.min(desiredSpeed, Math.max(2.2, targetDistance * 1.5));
  const forwardSpeed = -Math.sin(me.yaw) * me.vx - Math.cos(me.yaw) * me.vz;
  const drag = me.mass > 3 ? config.drive.drag_heavy : config.drive.drag_light;
  const throttle = clamp(((desiredSpeed - forwardSpeed) * 4 + forwardSpeed * drag) / me.accel, -1, 1);
  const lined = heading < config.drive.safetyHeading && forwardSpeed > -.5;
  const automatic = state === 'strike' && distance < (personality?.boostRange ?? 16) && distance > reach + .5;
  // CPU must release after depletion; it uses the same economy as a human.
  const boost = boostIntent === undefined ? automatic && me.boostState !== 'release' && me.boostState !== 'recharging' : !!boostIntent;
  const brake = me.brake;
  const stopping = Math.max(0, forwardSpeed) ** 2 / (2 * brake) + .8;
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  const towardX = Math.abs(me.x + fx * stopping) + me.w * .55 > halfW;
  const towardZ = Math.abs(me.z + fz * stopping) + me.l * .5 > halfL + (Math.abs(me.x) + me.w * .55 < field.GOAL_W / 2 ? field.goalDepth : 0);
  const safe = lined && !towardX && !towardZ;
  ai.mode = state; ai.target = { x: tx, z: tz };
  return { throttle, steer: turn, boost, safe, reason: lined ? 'BRAKING' : 'TURNING', desiredSpeed, state };
}
