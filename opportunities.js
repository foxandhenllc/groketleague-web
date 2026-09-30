import { simulationConfig } from './simulation-config.js';
import { movePhase } from './skills.js';

export const OPPORTUNITY_RULES = Object.freeze({ seconds: 2.5, spacing: 4, boostSeconds: .25 });

/** Offers use visible geometry, never a planner target or the opponent's private intent. */
export function opportunityKind(car, foe, ball, attackSign, field) {
  const distance = Math.hypot(ball.x - car.x, ball.z - car.z);
  const opponentDistance = Math.hypot(ball.x - foe.x, ball.z - foe.z);
  if (distance > 21) return null;
  if (ball.z * attackSign < -field.FL * .18 && ball.vz * attackSign < -2) return 'save';
  if (distance < 17 && opponentDistance < 17 && Math.abs(distance - opponentDistance) < 6) return 'contest';
  if (distance < 19 && ball.z * attackSign > -field.FL * .3) return 'attack';
  return null;
}
export function legalActions(car, config = simulationConfig) {
  const actions = [];
  if (car.boost >= config.drive.startThreshold && !car._boost?.depleted && !(car.shock > 0) && movePhase(car, config) !== 'recovery' && !(car.kind === 'semi' && movePhase(car, config) === 'active')) actions.push('boost');
  if (!(car.move?.cooldown > 0) && movePhase(car, config) === 'ready' && !(car.shock > 0)) actions.push('special');
  actions.push('pass');
  return actions;
}
function readyToMove(car, foe, ball, kind, config) {
  if (!legalActions(car, config).includes('special')) return false;
  const dx = ball.x - car.x, dz = ball.z - car.z, distance = Math.hypot(dx, dz);
  if (car.kind === 'semi') return kind === 'save' && distance < car.l / 2 + 8;
  const forward = distance > 0 ? (-Math.sin(car.yaw) * dx - Math.cos(car.yaw) * dz) / distance : 0;
  return distance < car.l / 2 + 9 && distance > car.l / 2 + .4 && forward > .7;
}

/** A single outstanding reservation; a charge is spent only after the simulator confirms activation. */
export function createInterventions({ seat, scope, charges, tactic, config = simulationConfig }) {
  if (!['A','B'].includes(seat) || typeof scope !== 'string' || !scope || !Number.isInteger(charges) || charges < 0 || charges > 3 || !['attack','defend','auto'].includes(tactic)) throw new TypeError('Invalid intervention allowance');
  let available = charges, age = 0, nextOffer = .6, serial = 0, offer = null, reserved = null, burst = 0;
  let receipt = { status: 'watching', text: 'FSD has the wheel. Watch for an opening.' };
  let activated = 0;
  const cancel = (text = 'Cancelled - charge kept') => {
    if (reserved) receipt = { status: 'cancelled', text };
    else if (offer) receipt = { status: 'passed', text: 'Opening closed. Charge kept.' };
    offer = null; reserved = null; burst = 0; nextOffer = age + OPPORTUNITY_RULES.spacing;
  };
  return {
    get view() {
      return { seat, charges: available, reserved: !!reserved, activated, ...receipt,
        offer: offer ? { id: offer.id, kind: offer.kind, remaining: Math.max(0, offer.until - age), legal: [...offer.legal] } : null };
    },
    choose(id, action) {
      if (!offer || offer.id !== id || age >= offer.until || reserved || !offer.legal.includes(action)) return false;
      if (action === 'pass') { cancel(); receipt = { status: 'passed', text: 'Passed. Charge kept.' }; return true; }
      if (available <= 0) return false;
      reserved = { action, kind: offer.kind, until: offer.until };
      receipt = { status: 'armed', text: `${action === 'boost' ? 'Boost' : 'Signature move'} armed. Waiting for FSD.` };
      return true;
    },
    beforeStep(dt, car, foe, ball, attackSign, field) {
      age += dt; burst = Math.max(0, burst - dt);
      if (offer && age >= offer.until) cancel();
      if (!offer && !reserved && !burst && age >= nextOffer && available > 0) {
        const kind = opportunityKind(car, foe, ball, attackSign, field);
        if (kind) {
          const legal = legalActions(car, config);
          if (legal.length > 1) {
            offer = { id: `${scope}:${seat}:${++serial}`, kind, until: age + OPPORTUNITY_RULES.seconds, legal };
            receipt = { status: 'offered', text: 'An opening. Arm one intervention or pass.' };
          }
        }
      }
      const boost = burst > 0 || reserved?.action === 'boost' && legalActions(car, config).includes('boost');
      const special = reserved?.action === 'special' && readyToMove(car, foe, ball, reserved.kind, config);
      // The simulator starts an armed boost's fresh press only after its normal safety gate passes.
      return { tactic, boost: !!boost, boostArmed: true, special: !!special };
    },
    afterStep(car) {
      if (!reserved) return;
      const fired = reserved.action === 'boost' ? car.boosting === true : car.move?.age === 0 && car.move.cooldown > 0;
      if (!fired) return;
      available--; activated++;
      const action = reserved.action;
      if (action === 'boost') burst = OPPORTUNITY_RULES.boostSeconds;
      offer = null; reserved = null; nextOffer = age + OPPORTUNITY_RULES.spacing;
      receipt = { status: 'activated', text: `${action === 'boost' ? 'Boost' : 'Signature move'} activated. 1 charge spent.` };
    },
    cancel
  };
}
