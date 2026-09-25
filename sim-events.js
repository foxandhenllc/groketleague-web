const types = new Set(['ballHit', 'carHit', 'boardHit']);
export function validImpact(e) {
  return e && Number.isSafeInteger(e.id) && e.id > 0 && Number.isSafeInteger(e.tick) && e.tick >= 0 && types.has(e.type)
    && typeof e.pair === 'string' && e.pair.length <= 48
    && ['x','y','z','nx','ny','nz','closing','impulse'].every(k => Number.isFinite(e[k]) && Math.abs(e[k]) <= 1000)
    && Math.abs(Math.hypot(e.nx,e.ny,e.nz) - 1) < .001 && e.closing >= 0 && e.impulse >= 0;
}
/** Bounded resend window; dropped old FX never block state delivery. */
export function createEventStream(limit = 64) {
  let next = 1, epoch = 0, pending = [], received = new Set();
  return {
    reset(value) { epoch = value; next = 1; pending = []; received.clear(); },
    emit(records) { const events = records.map(e => ({ ...e, id: next++ })); pending.push(...events); pending = pending.slice(-limit); return events; },
    packet() { return { epoch, events: pending }; },
    acknowledge(ids) { if (Array.isArray(ids) && ids.length <= limit) { const accepted = new Set(ids.filter(Number.isSafeInteger)); pending = pending.filter(e => !accepted.has(e.id)); } },
    receive(value, records) {
      if (value !== epoch || !Array.isArray(records) || records.length > limit) return { events: [], ack: [] };
      const events = [], ack = [];
      for (const e of records) if (validImpact(e)) {
        ack.push(e.id);
        // Sliding ID floor keeps storage bounded and rejects late ancient duplicates.
        const high = Math.max(0, ...received);
        if (!received.has(e.id) && e.id > high - limit) { events.push(e); received.add(e.id); }
      }
      const high = Math.max(0, ...received);
      for (const id of received) if (id <= high - limit) received.delete(id);
      return { events, ack };
    }
  };
}
