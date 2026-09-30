/** Application observation contract for future model coaches; this is not a provider API schema. */
export function coachObservation({ cup, seat, coach, car, foe, ball, timeLeft, scoreA, scoreB, roundEpoch, field }) {
  const physical = body => Object.fromEntries(['kind','x','z','yaw','vx','vz','boost','boostMax','boosting','tactic'].map(k => [k, body[k]]));
  return {
    version: 1, cupId: cup.id, heat: cup.heat, roundEpoch, seat, phase: cup.phase,
    rulesVersion: cup.rulesVersion, timeLeft, score: { A: scoreA, B: scoreB }, standings: { ...cup.standings },
    directives: { own: seat === 'A' ? cup.pick : cup.rival, opponent: cup.phase === 'draft' ? null : seat === 'A' ? cup.rival : cup.pick },
    history: cup.heats.map(h => ({ ...h })), interventions: { ...coach, offer: coach.offer ? { ...coach.offer, legal: [...coach.offer.legal] } : null },
    self: { ...physical(car), moveCooldown: car.move?.cooldown || 0 }, opponent: physical(foe),
    ball: Object.fromEntries(['x','y','z','vx','vy','vz'].map(k => [k, ball[k]])),
    field: { width: field.FW, length: field.FL, goalWidth: field.GOAL_W }
  };
}
