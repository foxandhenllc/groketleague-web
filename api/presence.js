// Lightweight presence for garage online/playing counts.
// In-memory across warm serverless instances (best-effort without KV).
// POST { id, state: "garage"|"queue"|"match" }  GET -> { online, playing }

const TTL_MS = 45000;

function store() {
  if (!globalThis.__glPresence) globalThis.__glPresence = new Map();
  return globalThis.__glPresence;
}

function prune(now) {
  const g = store();
  for (const [k, v] of g) {
    if (now - v.t > TTL_MS) g.delete(k);
  }
}

function tally() {
  const now = Date.now();
  prune(now);
  let online = 0;
  let playing = 0;
  for (const v of store().values()) {
    online += 1;
    if (v.state === "queue" || v.state === "match") playing += 1;
  }
  return { online, playing, t: now };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body || "{}"); } catch { body = {}; }
    }
    body = body || {};
    const id = String(body.id || "").slice(0, 80);
    const state = ["garage", "queue", "match"].includes(body.state) ? body.state : "garage";
    if (id) store().set(id, { state, t: Date.now() });
    return res.status(200).json(tally());
  }

  if (req.method === "GET") return res.status(200).json(tally());
  return res.status(405).json({ error: "method_not_allowed" });
}
