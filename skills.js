import { simulationConfig } from './simulation-config.js';

export function movePhase(car, config = simulationConfig) {
  const m = car.move, spec = config.skills.moves[car.kind];
  if (!m || !spec || m.age >= spec.windup+spec.duration+spec.recovery) return 'ready';
  return m.age < spec.windup ? 'windup' : m.age < spec.windup+spec.duration ? 'active' : 'recovery';
}
/** A rising press spends the cooldown; holding never repeats a move. */
export function updateMove(car, ball, dt, held, config = simulationConfig) {
  const spec = config.skills.moves[car.kind];
  const m = car.move ||= {age:99,cooldown:0,held:false,side:1};
  m.age += dt; m.cooldown = Math.max(0,m.cooldown-dt);
  if (held && !m.held && m.cooldown===0) {
    m.age=0; m.cooldown=spec.cooldown;
    // Dodge toward the ball's lateral side, or toward open midfield if centered.
    const side=(ball.x-car.x)*Math.cos(car.yaw)-(ball.z-car.z)*Math.sin(car.yaw);
    m.side=Math.abs(side)>.4 ? Math.sign(side) : (car.x>0?-1:1)*Math.sign(Math.cos(car.yaw)||1);
  }
  m.held=held;
}
export function timingCue(car, ball, radius) {
  const dx=ball.x-car.x,dz=ball.z-car.z,dist=Math.hypot(dx,dz);
  const forward=dist>0?(-Math.sin(car.yaw)*dx-Math.cos(car.yaw)*dz)/dist:0;
  const closing=dist>0?((car.vx-ball.vx)*dx+(car.vz-ball.vz)*dz)/dist:0;
  const eta=(dist-car.hz-radius)/Math.max(1,closing);
  return forward>.92 && closing>2 && eta>0 && eta<.3 && car.boostState!=='release' && car.boost>.18;
}

export const moveDescriptions = {
  cybertruck:'Charge: surge forward with limited steering. 7s cooldown.',
  model3:'Dash: a short forward burst, followed by reduced speed. 5s cooldown.',
  cybercab:'Sidestep: dodge toward the ball or open midfield. 5s cooldown.',
  semi:'Brace: stop and resist collisions for one second. 7s cooldown.'
};
