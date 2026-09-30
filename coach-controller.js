import { createInterventions } from './opportunities.js';
import { CUP_RULES } from './cup.js';

/** Human and CPU decisions enter the same validated action interface. CPU is explicitly scripted. */
export function createCoach({ type = 'human', random = Math.random, ...options }) {
  const ledger = createInterventions(options);
  let seen = null, responseAge = 0, delay = 0, chosen = false;
  return {
    type,
    get view() { return { type, ...ledger.view }; },
    choose: (id, action) => ledger.choose(id, action),
    beforeStep(dt, ...args) {
      let controls = ledger.beforeStep(dt, ...args);
      const offer = ledger.view.offer;
      if (type === 'cpu' && offer) {
        if (seen !== offer.id) { seen = offer.id; responseAge = 0; delay = .45 + random() * .65; chosen = false; }
        responseAge += dt;
        if (!chosen && responseAge >= delay) {
          const action = offer.kind === 'save' && args[0].kind === 'semi' && offer.legal.includes('special') ? 'special'
            : offer.legal.includes('boost') ? 'boost' : offer.legal[0];
          ledger.choose(offer.id, action); chosen = true;
          // Chosen actions are executed by the next ordinary physics step.
        }
      }
      return { ...controls, contestStaleSeconds: CUP_RULES.contestStaleSeconds };
    },
    afterStep: car => ledger.afterStep(car),
    cancel: text => ledger.cancel(text)
  };
}
