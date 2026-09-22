// Rendering and networking may run at any rate; gameplay always advances at 120 Hz.
export const PHYSICS_DT = 1 / 120;

export function createPhysicsClock(step) {
  let accumulated = 0;
  return {
    advance(elapsed) {
      if (!Number.isFinite(elapsed) || elapsed <= 0) return;
      // Bound catch-up after a suspended tab without changing ordinary slow frames.
      accumulated += Math.min(elapsed, 0.25);
      while (accumulated + 1e-10 >= PHYSICS_DT) {
        accumulated = Math.max(0, accumulated - PHYSICS_DT);
        step(PHYSICS_DT);
      }
    },
    reset() { accumulated = 0; }
  };
}
