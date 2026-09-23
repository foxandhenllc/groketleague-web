const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

/** Plan a goal-directed route. Human boost is explicit; an undefined intent is the CPU. */
export function planDrive(me, foe, ball, dt, attackSign, field, boostIntent) {
  const halfW = field.FW / 2, halfL = field.FL / 2;
  const radius = field.ballRadius;
  const ai = me._ai ||= {};
  ai.time = (ai.time || 0) + dt;
  const distance = Math.hypot(ball.x - me.x, ball.z - me.z);
  const reach = me.l / 2 + radius;
  const speed = Math.hypot(me.vx, me.vz);
  // Estimate arrival, including rolling drag; don't chase a point behind a moving ball.
  const lead = clamp((distance - reach) / (speed + 14), 0, .5);
  const travel = (1 - Math.exp(-.846 * lead)) / .846;
  const bx = clamp(ball.x + ball.vx * travel, -halfW + radius, halfW - radius);
  const bz = clamp(ball.z + ball.vz * travel, -halfL + radius, halfL - radius);
  const goalZ = attackSign * halfL;
  const ownDistance = halfL + bz * attackSign;
  // Slightly favour the open half of the net when a defender is in the goal mouth.
  const keeper = foe && Math.abs(foe.z - goalZ) < 8;
  const goalX = keeper ? clamp(-foe.x * .45, -field.GOAL_W * .2, field.GOAL_W * .2) : 0;
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
  const px = -uz, pz = ux;
  const rx = me.x - bx, rz = me.z - bz;
  const behind = -(rx * ux + rz * uz);
  const lateral = rx * px + rz * pz;
  const setup = reach + 4.5;
  let tx, tz, state;
  const threat = ball.vz * attackSign < -5 && ownDistance < 23;
  const goalSide = (me.z - bz) * attackSign < -1;
  if (threat && !goalSide && distance > reach + 1) {
    state = 'defend';
    tx = clamp(bx + ball.vx * .3, -field.GOAL_W * .4, field.GOAL_W * .4);
    tz = -attackSign * (halfL - reach - 1.5);
    // Pass beside the ball while retreating, not through it toward our own net.
    if (Math.abs(me.x - bx) < reach + 1 && Math.abs(me.z - bz) < 10) tx = bx + (me.x < bx ? -1 : 1) * (reach + 3);
  } else if (behind > reach * .2 && Math.abs(lateral) < Math.max(1.35, behind * .35, ai.mode === 'strike' ? reach + 1.8 : 0)) {
    state = 'strike'; tx = bx + ux * .5; tz = bz + uz * .5;
  } else {
    state = 'approach'; tx = bx - ux * setup; tz = bz - uz * setup;
    // A car on the wrong side first passes alongside the ball. Keep the chosen
    // side until it is behind; otherwise a moving ball causes left/right dithering.
    if (behind < reach + .6 && Math.abs(lateral) < setup + 1.5) {
      if (!ai.detour) ai.detour = Math.abs(lateral) > .5 ? Math.sign(lateral) : (me.x < 0 ? -1 : 1);
      const wide = setup + 1.8;
      tx += px * ai.detour * wide; tz += pz * ai.detour * wide;
    } else if (behind > setup || Math.abs(lateral) > setup + 2) ai.detour = 0;
  }
  // If neither car advances the ball, abandon the perfect setup and contest it.
  // This progress clock also catches cars circling a stationary ball at speed.
  if (ai.ballX === undefined || Math.hypot(ball.x - ai.ballX, ball.z - ai.ballZ) > 2) {
    ai.ballX = ball.x; ai.ballZ = ball.z; ai.staleTime = 0; ai.clearing = false;
  } else ai.staleTime += dt;
  if (ai.staleTime > 7) ai.clearing = true;
  if (ai.clearing) {
    state = 'clear'; tx = ball.x; tz = ball.z;
    // Never solve a stalemate by driving the ball straight into our own net.
    if (ownDistance < 8 && Math.abs(bx) < field.GOAL_W / 2 + 1 && !goalSide) {
      state = 'defend'; tx = bx + (me.x < bx ? -1 : 1) * (reach + 1);
      tz = bz - attackSign * (reach + .5);
    }
  }
  // Targets remain reachable with the entire vehicle inside the boards.
  const margin = Math.max(me.w * .55, 1.4);
  tx = clamp(tx, -halfW + margin, halfW - margin);
  const depth = Math.abs(tx) + me.w * .55 < field.GOAL_W / 2 ? field.goalDepth || 0 : 0;
  tz = clamp(tz, -halfL - depth + margin, halfL + depth - margin);
  let dx = tx - me.x, dz = tz - me.z;
  const targetDistance = Math.hypot(dx, dz);
  let error = angle(Math.atan2(-dx, -dz) - me.yaw);

  // Measure progress over time, not per-frame deltas (which vary with refresh rate).
  if (ai.sampleX === undefined) { ai.sampleX = me.x; ai.sampleZ = me.z; ai.sampleTime = 0; ai.stuckTime = 0; }
  ai.sampleTime += dt;
  if (ai.sampleTime >= .4) {
    const moved = Math.hypot(me.x - ai.sampleX, me.z - ai.sampleZ);
    const onBoard = Math.abs(me.x) > halfW - reach || Math.abs(me.z) > halfL - reach;
    ai.stuckTime = moved < .3 && targetDistance > 2 && (Math.abs(error) < .8 || onBoard) ? ai.stuckTime + ai.sampleTime : 0;
    ai.sampleTime = 0; ai.sampleX = me.x; ai.sampleZ = me.z;
  }
  ai.recovery = Math.max(0, (ai.recovery || 0) - dt);
  if (ai.stuckTime >= .8 && ai.recovery === 0) {
    ai.recovery = 1.15; ai.stuckTime = 0;
    // Reverse away from the blocking object while rotating toward open space.
    ai.recoverySteer = (Math.sin(me.yaw) * me.z - Math.cos(me.yaw) * me.x) > 0 ? 1 : -1;
  }
  if (ai.recovery > 0) {
    ai.mode = 'recover'; ai.target = { x: tx, z: tz };
    return { throttle: -.8, steer: ai.recoverySteer * .85, boost: false, state: ai.mode };
  }

  const turn = clamp(error * 2.2, -1, 1);
  const heading = Math.abs(error);
  // Brake before a tight turn. This bounds the turning circle for the heavy cars.
  const cruise = Math.min(me.max, me.accel / (me.mass > 3 ? 1.85 : 1.45));
  let desiredSpeed = cruise * clamp(1 - heading / 1.1, .07, 1);
  const turnRadiusSpeed = me.turn * .55 * Math.max(1, targetDistance - reach * .5) / Math.max(.3, Math.sin(heading) * 2);
  if (heading > .25) desiredSpeed = Math.min(desiredSpeed, Math.max(1, turnRadiusSpeed));
  if (state !== 'strike') desiredSpeed = Math.min(desiredSpeed, Math.max(2.2, targetDistance * 1.5));
  const forwardSpeed = -Math.sin(me.yaw) * me.vx - Math.cos(me.yaw) * me.vz;
  const drag = me.mass > 3 ? 1.85 : 1.45;
  const throttle = clamp(((desiredSpeed - forwardSpeed) * 4 + forwardSpeed * drag) / me.accel, -1, 1);
  const lined = heading < .28 && forwardSpeed > -1;
  const automatic = state === 'strike' && distance < 16 && distance > reach + .5;
  const boost = lined && throttle > .5 && me.boost > .08 && (boostIntent === undefined ? automatic : !!boostIntent);
  ai.mode = state; ai.target = { x: tx, z: tz };
  return { throttle, steer: turn, boost, state };
}
