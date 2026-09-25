/** Bounded, opt-in simulation recorder. No JSON serialization in the tick path. */
export function createDiagnostics(capacity = 600, enabled = false) {
  const ring = new Array(capacity);
  let cursor = 0, count = 0;
  const counters = Object.create(null);
  return {
    enabled,
    count(name) { counters[name] = (counters[name] || 0) + 1; },
    record(frame) {
      if (!this.enabled) return;
      ring[cursor] = frame;
      cursor = (cursor + 1) % capacity;
      count = Math.min(count + 1, capacity);
    },
    export(metadata = {}) {
      return { ...metadata, lastFailure: this.lastFailure, counters: { ...counters }, frames: Array.from({ length: count }, (_, i) => ring[(cursor - count + i + capacity) % capacity]) };
    },
    reset() { delete this.lastFailure; ring.fill(undefined); cursor = count = 0; for (const key of Object.keys(counters)) delete counters[key]; }
  };
}
