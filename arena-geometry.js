import { simulationConfig } from "./simulation-config.js";
/** Rounded 2D boards prevent dead ninety-degree corners. Shared with the renderer. */
export const CORNER_RADIUS = simulationConfig.modes.pixel.corner;
export const GOAL_DEPTH = simulationConfig.modes.pixel.depth;

export function cornerContact(x, z, halfW, halfL, padding = 0) {
  const cx = halfW - CORNER_RADIUS, cz = halfL - CORNER_RADIUS;
  const dx = Math.abs(x) - cx, dz = Math.abs(z) - cz;
  if (dx <= 0 || dz <= 0) return null;
  const distance = Math.hypot(dx, dz), limit = CORNER_RADIUS - padding;
  if (distance <= limit) return null;
  return { nx: dx / distance * Math.sign(x), nz: dz / distance * Math.sign(z), depth: distance - limit };
}
