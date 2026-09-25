import { byId, ballRadius } from './catalog.js';
export function vehicleBounds(id) {
  const { hx, hz } = byId(id).spec;
  return Object.freeze({ hx, hz, forward: '-Z', tolerance: .03 });
}
export function rollDelta(vx, vz, dt, radius) {
  return { x: vz * dt / radius, z: -vx * dt / radius };
}
export const ballArtRadius = ballRadius;
