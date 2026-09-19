// PeerJS signaling only; gameplay travels directly between the two browsers.
const PREFIX = "glr-";
const QUEUE = "glq-";
const SLOTS = 12;
const ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
let PeerCtor;
let peer = null, conn = null, role = null, roomCode = "", ready = false;
let handlers = {}, generation = 0;
const peers = new Set();
const cancelled = () => new Error("cancelled");
function check(g) { if (g !== generation) throw cancelled(); }
function code4() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), n => ABC[n % ABC.length]).join("");
}
async function makePeer(id, g) {
  if (!PeerCtor) {
    const m = await import("https://cdn.jsdelivr.net/npm/peerjs@1.5.4/+esm");
    PeerCtor = m.Peer || m.default;
  }
  check(g);
  return new Promise((resolve, reject) => {
    const p = new PeerCtor(id, { debug: 0 });
    peers.add(p);
    let opened = false;
    const fail = err => { clearTimeout(timer); peers.delete(p); p.destroy(); reject(err); };
    const timer = setTimeout(() => fail(new Error("Signaling timed out. Try again.")), 10000);
    p.on("open", () => {
      clearTimeout(timer);
      if (g !== generation) return fail(cancelled());
      opened = true;
      resolve(p);
    });
    p.on("error", err => {
      if (!opened) fail(err);
      else if (p === peer && !ready && err.type !== "peer-unavailable") handlers.onError?.(err);
    });
    p.on("disconnected", () => {
      if (g === generation && p === peer && !ready) handlers.onError?.(new Error("Signaling disconnected. Try again."));
    });
  });
}
function send(msg) {
  if (conn?.open) {
    try { conn.send(msg); } catch { handlers.onDrop?.(); }
  }
}
function wire(c, g) {
  conn = c;
  c.on("data", msg => {
    if (g !== generation || conn !== c || !msg || typeof msg !== "object") return;
    const event = { hello: "onHello", start: "onStart", in: "onInput", st: "onState", chat: "onChat", busy: "onBusy" }[msg.t];
    if (event) handlers[event]?.(msg);
  });
  const drop = () => {
    if (g !== generation || conn !== c) return;
    ready = false;
    handlers.onDrop?.();
  };
  c.on("close", drop);
  c.on("error", drop);
}
function listenHost(p, g, queue = false) {
  p.on("connection", c => {
    if (g !== generation) return c.close();
    // Reserve the room before open, so simultaneous guests cannot replace each other.
    if (conn) {
      c.on("open", () => { c.send({ t: "busy" }); setTimeout(() => c.close(), 250); });
      return;
    }
    wire(c, g);
    const timer = setTimeout(() => { if (!c.open && conn === c) { conn = null; c.close(); } }, 10000);
    c.on("open", () => {
      clearTimeout(timer);
      if (g !== generation) return c.close();
      ready = true;
      if (queue) c.send({ t: "wait" });
      handlers.onPeer?.();
    });
  });
}
function destroy() {
  generation++;
  ready = false; role = null; roomCode = "";
  const old = conn; conn = null;
  old?.close();
  for (const p of peers) p.destroy();
  peers.clear(); peer = null;
}
async function createRoom() {
  destroy();
  const g = generation;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = code4();
    try {
      const p = await makePeer(PREFIX + code, g);
      check(g); peer = p; role = "host"; roomCode = code;
      listenHost(p, g);
      return code;
    } catch (err) {
      check(g);
      if (err.type !== "unavailable-id") throw err;
    }
  }
  throw new Error("Could not reserve a room. Try again.");
}
function dial(p, id, g, queue) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const c = p.connect(id, { reliable: true });
    const finish = (err) => {
      if (settled) return;
      settled = true; clearTimeout(timer); p.off("error", onError);
      if (err || g !== generation) { c.close(); reject(err || cancelled()); return; }
      peer = p; role = "guest"; roomCode = queue ? "QUICK MATCH" : id.slice(PREFIX.length);
      wire(c, g); ready = true;
      handlers.onPeer?.();
      resolve(roomCode);
    };
    const onError = err => { if (err.type === "peer-unavailable") finish(new Error("Room not found. Check the code and try again.")); };
    const timer = setTimeout(() => finish(new Error("Connection timed out. Try another room or network.")), 6500);
    p.on("error", onError);
    c.on("error", err => finish(err));
    c.on("close", () => finish(new Error("Room closed.")));
    c.on("open", () => { if (!queue) finish(); });
    if (queue) c.on("data", msg => {
      if (msg?.t === "wait") finish();
      else if (msg?.t === "busy") finish(new Error("Room is full."));
    });
  });
}
async function joinRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized.length !== 4 || [...normalized].some(c => !ABC.includes(c))) throw new Error("Enter a valid 4-character room code.");
  destroy();
  const g = generation;
  const p = await makePeer(undefined, g);
  check(g);
  return dial(p, PREFIX + normalized, g, false);
}
async function quickMatch() {
  destroy();
  const g = generation;
  const seeker = await makePeer(undefined, g);
  for (let i = 0; i < SLOTS; i++) {
    check(g);
    try { await dial(seeker, QUEUE + i, g, true); return { joined: true, slot: i }; }
    catch { check(g); }
  }
  for (let i = 0; i < SLOTS; i++) {
    check(g);
    try {
      const p = await makePeer(QUEUE + i, g);
      check(g); seeker.destroy(); peers.delete(seeker);
      peer = p; role = "host"; roomCode = "QUICK MATCH";
      listenHost(p, g, true);
      return { hosted: true, slot: i };
    } catch (err) {
      check(g);
      if (err.type !== "unavailable-id") throw err;
      // A simultaneous seeker may just have claimed this slot. Join it before
      // claiming another, preventing two players from waiting in separate rooms.
      try { await dial(seeker, QUEUE + i, g, true); return { joined: true, slot: i }; }
      catch { check(g); }
    }
  }
  throw new Error("Quick match is full. Try again or create a room.");
}
function isHost() { return role === "host"; }
function isGuest() { return role === "guest"; }
function isOnline() { return ready && !!conn?.open; }
function getCode() { return roomCode; }
function setHandlers(h) { handlers = h || {}; }
export { createRoom, destroy, getCode, isGuest, isHost, isOnline, joinRoom, quickMatch, send, setHandlers };
