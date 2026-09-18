const PREFIX = "glr-";
const QUEUE = "glq-";
const SLOTS = 12;
const ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

let PeerCtor = null;
let peer = null;
let conn = null;
let role = null;
let roomCode = "";
let handlers = {};
let queueSlot = -1;
let ready = false;

function code4() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ABC[Math.floor(Math.random() * ABC.length)];
  return s;
}

function loadPeer() {
  if (PeerCtor) return Promise.resolve(PeerCtor);
  return import("https://cdn.jsdelivr.net/npm/peerjs@1.5.4/+esm").then((m) => {
    PeerCtor = m.Peer || m.default;
    return PeerCtor;
  });
}

function send(msg) {
  if (conn && conn.open) {
    try { conn.send(msg); } catch (_) {}
  }
}

function wire(c) {
  conn = c;
  c.on("data", (msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "hello") handlers.onHello && handlers.onHello(msg);
    else if (msg.t === "start") handlers.onStart && handlers.onStart(msg);
    else if (msg.t === "in") handlers.onInput && handlers.onInput(msg);
    else if (msg.t === "st") handlers.onState && handlers.onState(msg);
    else if (msg.t === "chat") handlers.onChat && handlers.onChat(msg);
    else if (msg.t === "busy") handlers.onBusy && handlers.onBusy(msg);
  });
  c.on("close", () => { handlers.onDrop && handlers.onDrop(); });
  c.on("error", () => { handlers.onDrop && handlers.onDrop(); });
}

function makePeer(id) {
  return loadPeer().then((P) => new Promise((resolve, reject) => {
    const p = new P(id, { debug: 0 });
    const to = setTimeout(() => { try { p.destroy(); } catch (_) {} reject(new Error("timeout")); }, 8000);
    p.on("open", () => { clearTimeout(to); resolve(p); });
    p.on("error", (err) => { clearTimeout(to); reject(err); });
  }));
}

function listenHost(p) {
  p.on("connection", (c) => {
    if (conn && conn.open) {
      c.on("open", () => { try { c.send({ t: "busy" }); c.close(); } catch (_) {} });
      return;
    }
    wire(c);
    c.on("open", () => {
      ready = true;
      handlers.onPeer && handlers.onPeer();
    });
  });
}

function destroy() {
  ready = false;
  role = null;
  roomCode = "";
  queueSlot = -1;
  try { if (conn) conn.close(); } catch (_) {}
  conn = null;
  try { if (peer) peer.destroy(); } catch (_) {}
  peer = null;
}

function createRoom() {
  destroy();
  role = "host";
  roomCode = code4();
  return makePeer(PREFIX + roomCode).then((p) => {
    peer = p;
    listenHost(p);
    return roomCode;
  }).catch(() => createRoom());
}

function joinRoom(code) {
  destroy();
  role = "guest";
  roomCode = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (roomCode.length !== 4) return Promise.reject(new Error("bad code"));
  return makePeer().then((p) => {
    peer = p;
    return new Promise((resolve, reject) => {
      const c = p.connect(PREFIX + roomCode, { reliable: true });
      const to = setTimeout(() => reject(new Error("no room")), 7000);
      c.on("open", () => {
        clearTimeout(to);
        wire(c);
        ready = true;
        resolve(roomCode);
      });
      c.on("error", () => { clearTimeout(to); reject(new Error("no room")); });
    });
  });
}

function trySlot(i) {
  return new Promise((resolve) => {
    makePeer().then((p) => {
      const c = p.connect(QUEUE + i, { reliable: true });
      const to = setTimeout(() => { try { p.destroy(); } catch (_) {} resolve(null); }, 900);
      c.on("open", () => {
        clearTimeout(to);
        c.once("data", (msg) => {
          if (msg && msg.t === "wait") {
            peer = p;
            role = "guest";
            roomCode = "Q" + i;
            wire(c);
            ready = true;
            resolve({ joined: true, slot: i });
          } else {
            try { c.close(); p.destroy(); } catch (_) {}
            resolve(null);
          }
        });
      });
      c.on("error", () => { clearTimeout(to); try { p.destroy(); } catch (_) {} resolve(null); });
    }).catch(() => resolve(null));
  });
}

function claimSlot(i) {
  return makePeer(QUEUE + i).then((p) => {
    peer = p;
    role = "host";
    queueSlot = i;
    roomCode = "Q" + i;
    p.on("connection", (c) => {
      if (conn && conn.open) {
        c.on("open", () => { try { c.send({ t: "busy" }); c.close(); } catch (_) {} });
        return;
      }
      wire(c);
      c.on("open", () => {
        try { c.send({ t: "wait" }); } catch (_) {}
        ready = true;
        handlers.onPeer && handlers.onPeer();
      });
    });
    return { hosted: true, slot: i };
  });
}

async function quickMatch() {
  destroy();
  for (let i = 0; i < SLOTS; i++) {
    const hit = await trySlot(i);
    if (hit) return hit;
  }
  for (let i = 0; i < SLOTS; i++) {
    try {
      return await claimSlot(i);
    } catch (_) {}
  }
  throw new Error("queue full");
}

function isHost() { return role === "host"; }
function isGuest() { return role === "guest"; }
function isOnline() { return ready && !!conn; }
function getCode() { return roomCode; }
function setHandlers(h) { handlers = h || {}; }

export { createRoom, destroy, getCode, isGuest, isHost, isOnline, joinRoom, quickMatch, send, setHandlers };
