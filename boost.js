import { simulationConfig } from './simulation-config.js';

/** Held intent is distinct from safety authorization. Returns the active part of this tick. */
export function updateBoost(car, held, safe, dt, config = simulationConfig, reason = 'TURNING') {
  const d = config.drive;
  car._boost ||= { released: d.rearmSeconds, sinceActive: d.rechargeDelay, depleted: false };
  const state = car._boost;
  state.sinceActive += dt;
  car.boosting = false; car.boostReason = '';
  if (!held) {
    state.released += dt;
    if (state.released + 1e-9 >= d.rearmSeconds) state.depleted = false;
    if (state.released + 1e-9 >= d.rearmSeconds && state.sinceActive + 1e-9 >= d.rechargeDelay)
      car.boost = Math.min(car.boostMax, car.boost + dt * d.boost_regen);
    car.boostState = car.boost >= d.startThreshold && !state.depleted ? 'ready' : 'recharging';
    state.active = false;
    return 0;
  }
  state.released = 0;
  if (state.depleted || (!state.active && car.boost < d.startThreshold)) {
    state.depleted = true; state.active = false; car.boostState = 'release'; return 0;
  }
  if (!safe) {
    state.active = false; car.boostState = 'waiting'; car.boostReason = reason; return 0;
  }
  const drain = car.mass > d.heavy_mass_threshold ? d.boost_drain_heavy : d.boost_drain_light;
  const activeSeconds = Math.min(dt, car.boost / drain);
  car.boost = Math.max(0, car.boost - drain * activeSeconds);
  if (car.boost < 1e-10) car.boost = 0;
  car.boosting = activeSeconds > 0; car.boostState = 'active';
  state.active = true; state.sinceActive = 0;
  if (car.boost === 0) { state.depleted = true; state.active = false; }
  return activeSeconds;
}

export function boostLabel(car) {
  return ({ ready: 'BOOST', waiting: `WAITING: ${car.boostReason || 'TURNING'}`, active: 'BOOSTING', release: 'RELEASE TO RECHARGE', recharging: 'RECHARGING' })[car.boostState] || 'BOOST';
}
