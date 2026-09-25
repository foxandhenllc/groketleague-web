import { simulationConfig } from './simulation-config.js';

/** Stable streams: never consume randomness at render or physics frequency. */
export function seededRandom(seed) {
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

/** A shuffled rotation prevents repeated faceoffs. Both cars are equidistant,
 * face the stationary ball, and have identical longitudinal goal distances. */
export function kickoffLayout(seed, round, config = simulationConfig) {
  const random = seededRandom(`${seed}:kickoffs`);
  const layouts = [...config.planner.kickoffs];
  for (let i = layouts.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [layouts[i], layouts[j]] = [layouts[j], layouts[i]];
  }
  const layout = layouts[round % layouts.length];
  const mirror = random() < .5 ? -1 : 1;
  const x = layout.x * mirror, offset = layout.offset * mirror;
  const facing = (cx, z) => ({x:cx, z, yaw:Math.atan2(cx-x, z)});
  return {name:layout.name, ball:{x,z:0}, P:facing(x+offset,layout.distance), B:facing(x-offset,-layout.distance)};
}

/** Vehicle identity stays stable; each round chooses a coherent shooting lane. */
export function driverPersonality(kind, seed, round, slot, config = simulationConfig) {
  const random = seededRandom(`${seed}:${kind}:${slot}`);
  const base = config.planner.personalities[kind];
  const lane = seededRandom(`${seed}:${slot}:lane:${round}`)() * 2 - 1;
  return {...base, setup:base.setup + (random()-.5)*.8,
    side:random()<.5 ? -1 : 1, patience:1.5+random()*2, aim:lane*config.planner.aimWidth};
}
