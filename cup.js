/** Local cups own their clock, sealed draft and results separately from classic matches. */
export const CUP_RULES = Object.freeze({ version: 1, heats: 3, heatSeconds: 60, draftSeconds: 5, revealSeconds: 2, charges: 2, counterBonus: 1, contestStaleSeconds: 4, recalibrateSeconds: 8 });
export const DIRECTIVES = Object.freeze([
  Object.freeze({ id: 'attack', name: 'Send It', counters: 'auto', hint: 'Pressure the ball. Counters Read the Room.' }),
  Object.freeze({ id: 'defend', name: 'Safety First', counters: 'attack', hint: 'Protect your goal. Counters Send It.' }),
  Object.freeze({ id: 'auto', name: 'Read the Room', counters: 'defend', hint: 'Let FSD adapt. Counters Safety First.' })
]);
export const directive = id => DIRECTIVES.find(d => d.id === id);
export function counterWinner(a, b) {
  if (!directive(a) || !directive(b)) throw new TypeError('Unknown directive');
  return a === b ? null : directive(a).counters === b ? 'A' : 'B';
}
export function cupStandings(heats) {
  let a = 0, b = 0;
  for (const heat of heats) {
    if (!Number.isInteger(heat.a) || !Number.isInteger(heat.b) || heat.a < 0 || heat.b < 0) throw new TypeError('Invalid heat score');
    a += heat.a > heat.b ? 3 : heat.a === heat.b ? 1 : 0;
    b += heat.b > heat.a ? 3 : heat.a === heat.b ? 1 : 0;
  }
  return { a, b, winner: a === b ? 'shared' : a > b ? 'A' : 'B' };
}

/** A visible neutral faceoff breaks long dead balls; it never replenishes interventions or changes score. */
export function createCupPacing() {
  let anchor = null, stalled = 0, resets = 0;
  return {
    reset() { anchor = null; stalled = 0; },
    get resets() { return resets; },
    step(ball, dt) {
      if (!anchor || Math.hypot(ball.x - anchor.x, ball.z - anchor.z) > 2) { anchor = {x:ball.x,z:ball.z}; stalled = 0; }
      else stalled += dt;
      if (stalled < CUP_RULES.recalibrateSeconds) return false;
      anchor = null; stalled = 0; resets++; return true;
    }
  };
}

export function createCup({ id, random = Math.random } = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('Cup ID required');
  let phase = 'draft', heat = 1, remaining = CUP_RULES.draftSeconds, pick = null, rival = null;
  const heats = [];
  const sealRival = () => {
    const sample = random();
    rival = DIRECTIVES[Math.min(2, Math.max(0, Math.floor((Number.isFinite(sample) ? sample : 0) * 3)))].id;
  };
  sealRival(); // The CPU commits before the human selects; it cannot react to that pick.
  const choose = value => {
    if (phase !== 'draft' || !directive(value)) return false;
    pick = value; phase = 'reveal'; remaining = CUP_RULES.revealSeconds;
    return true;
  };
  return {
    get phase() { return phase; },
    get view() {
      const revealed = phase !== 'draft' && phase !== 'cancelled';
      const counter = revealed ? counterWinner(pick, rival) : null;
      return { id, rulesVersion: CUP_RULES.version, phase, heat, remaining, pick,
        rival: revealed ? rival : null, counter,
        allowances: revealed ? { A: CUP_RULES.charges + (counter === 'A' ? CUP_RULES.counterBonus : 0), B: CUP_RULES.charges + (counter === 'B' ? CUP_RULES.counterBonus : 0) } : null,
        heats: heats.map(h => ({ ...h })), standings: cupStandings(heats) };
    },
    choose,
    advance(dt) {
      if (!(dt >= 0 && Number.isFinite(dt))) return;
      if (phase !== 'draft' && phase !== 'reveal') return;
      remaining = Math.max(0, remaining - dt);
      if (remaining === 0) {
        if (phase === 'draft') choose('auto');
        else phase = 'heat';
      }
    },
    finishHeat(a, b) {
      if (phase !== 'heat') return false;
      cupStandings([{ a, b }]);
      heats.push({ a, b, pick, rival, counter: counterWinner(pick, rival) });
      phase = heat === CUP_RULES.heats ? 'complete' : 'summary';
      return true;
    },
    nextHeat() {
      if (phase !== 'summary') return false;
      heat++; phase = 'draft'; remaining = CUP_RULES.draftSeconds; pick = null; sealRival();
      return true;
    },
    cancel() { phase = 'cancelled'; }
  };
}
