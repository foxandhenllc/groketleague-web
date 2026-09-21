import * as THREE from "three";
import * as NET from "./net.js";
import { CATALOG, byId } from "./catalog.js";
import { ensureAudio, SFX, startCrowd, stopCrowd, playBed, isMusicMuted, isSfxMuted, setMusicMuted, setSfxMuted } from "./audio.js";
import { bindInput, bindTouch, readControls, setQaKeys } from "./input.js";
import { makeVehicle, makeBall } from "./vehicles.js";
import { makeField, lamps } from "./field.js";
import { bodyFrom, drive, carBall, carCar, stepBall, botAI, forwardXZ, setPixelTight } from "./sim.js";
import { createPixelView } from "./pixel.js";
import { initXAuth, loginWithX, logoutX, getXUser, onAuthChange } from "./x-auth.js";
const overlay = document.getElementById("overlay");
const toastEl = document.getElementById("toast");
const scoreAEl = document.getElementById("scoreA");
const scoreBEl = document.getElementById("scoreB");
const clockEl = document.getElementById("clock");
const mapTag = document.getElementById("maptag");
const mapBtn = document.getElementById("mapBtn");
const boostFill = document.getElementById("boostFill");
const hud = document.getElementById("hud");
const boostHud = document.getElementById("boostHud");
const labA = document.getElementById("labA");
const labB = document.getElementById("labB");
const garageEl = document.getElementById("garage");
const faceLayer = document.getElementById("faceoffLayer");
const pauseLayer = document.getElementById("pauseLayer");
const boostLab = document.getElementById("boostLab");
const matchChat = document.getElementById("matchChat");
let matchChatIdle = 0;
const resWho = document.getElementById("resWho");
const PIX = 2.4;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
function fitRenderer() {
  const w = Math.max(320, Math.floor(innerWidth / PIX));
  const h = Math.max(180, Math.floor(innerHeight / PIX));
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.imageRendering = "pixelated";
}
fitRenderer();
document.body.prepend(renderer.domElement);
renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); console.warn("[groket] webgl lost"); }, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 220);
const camTarget = new THREE.Vector3();
const desired = new THREE.Vector3();
const garageCam = new THREE.Vector3(6.4, 3.1, 9.2);
const garageLook = new THREE.Vector3(0, 1.05, 6);
const faceCam = new THREE.Vector3(0, 12.5, 24);
const faceLook = new THREE.Vector3(0, 0.6, 0);
const playLook = new THREE.Vector3();
let shake = 0;
const hemi = new THREE.HemisphereLight("#8ec8ff", "#4a2a10", 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffe6a0", 1.35);
sun.position.set(-18, 32, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
Object.assign(sun.shadow.camera, { near: 5, far: 80, left: -40, right: 40, top: 40, bottom: -40 });
scene.add(sun);
const fill = new THREE.AmbientLight("#334", 0.42);
scene.add(fill);
const fieldRoot = new THREE.Group();
const nightExtra = new THREE.Group();
scene.add(fieldRoot, nightExtra);
makeField(scene, fieldRoot, nightExtra);
let playerMesh = makeVehicle("cybertruck");
let botMesh = makeVehicle("model3");
const ballMesh = makeBall();
scene.add(playerMesh, botMesh, ballMesh);
playerMesh.frustumCulled = false;
botMesh.frustumCulled = false;
ballMesh.frustumCulled = false;
const preview = new THREE.Group();
let previewMesh = makeVehicle("cybertruck");
preview.add(previewMesh);
preview.position.set(0, 0, 6);
scene.add(preview);
const maps = {
  day: { label: "CASTLE DAY", bg: "#3a6aaa", fogN: 42, fogF: 115, hemi: ["#b8d8ff", "#5a3a18", 1.05], sun: 1.25, fill: 0.48, lamp: 18, turf: "#ffffff" },
  night: { label: "TORCH NIGHT", bg: "#0c1430", fogN: 28, fogF: 95, hemi: ["#4a6aaa", "#1a1020", 0.5], sun: 0.12, fill: 0.22, lamp: 48, turf: "#ffffff" }
};
let mapMode = "day";
const pixelView = createPixelView();
let gfxMode = "3d";
try { const g = localStorage.getItem("gl_gfx"); if (g === "pixel" || g === "3d") gfxMode = g; } catch {}
setPixelTight(gfxMode === "pixel");
function syncGfxUI() {
  document.getElementById("gfx3d")?.classList.toggle("on", gfxMode === "3d");
  document.getElementById("gfxPixel")?.classList.toggle("on", gfxMode === "pixel");
}
function setGfxMode(g) {
  gfxMode = g === "pixel" ? "pixel" : "3d";
  setPixelTight(gfxMode === "pixel");
  try { localStorage.setItem("gl_gfx", gfxMode); } catch {}
  syncGfxUI();
  syncPixelVisibility();
}
function syncPixelVisibility() {
  const want = gfxMode === "pixel" && (mode === "play" || mode === "faceoff" || mode === "results");
  pixelView.setActive(want);
  pixelView.setNight(mapMode === "night");
  if (renderer?.domElement) renderer.domElement.style.visibility = want ? "hidden" : "visible";
}
function paintPixelFrame() {
  if (!pixelView.isActive()) return;
  pixelView.setNight(mapMode === "night");
  pixelView.draw({
    player: P,
    bot: B,
    ball,
    mapLabel: maps[mapMode]?.label
  });
}
let mode = "garage";
let online = false, netPending = false, matchId = "", sessionSerial = 0;
let wantRematch = false, peerWantRematch = false;
let localChoice = "cybertruck", remoteInput = { throttle: 0, steer: 0, boost: false };
let lastPacket = 0, lastInput = 0;
let reconnectTimer = 0, reconnecting = false;
let lastGoalCard = null, bestGoalCard = null, lastGoalBy = null;
const opponentName = () => online ? "P2" : "GROK";
const localBody = () => online && NET.isGuest() ? B : P;
const validCar = id => CATALOG.some(v => v.id === id);
const netStatus = document.getElementById("netStatus");
const roomCodeOut = document.getElementById("roomCodeOut");
const inviteActions = document.getElementById("inviteActions");
const ROOM_ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function inviteUrl(code) {
  const c = String(code || "").trim().toUpperCase();
  return "https://groketleague.com/?room=" + encodeURIComponent(c);
}
function setInviteVisible(show) {
  if (inviteActions) inviteActions.hidden = !show;
}
function normalizeRoomCode(raw) {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}
function validRoomCode(code) {
  const c = normalizeRoomCode(code);
  return c.length === 4 && [...c].every(ch => ROOM_ABC.includes(ch));
}
function netMessage(text) { netStatus.textContent = text; }
function setNetPending(value) {
  netPending = value;
  for (const id of ["netQuick", "netCreate", "netJoin", "roomCodeIn", "toMatchup", "backVehicle", "modeLocal", "modeQuick", "modePrivate", "go", "mapBtn"]) {
    const el = document.getElementById(id);
    if (el) el.disabled = !!value;
  }
  const shell = document.getElementById("searchShell");
  if (shell) shell.hidden = !value;
  document.body.classList.toggle("garageSearching", !!value);
  if (garageEl) garageEl.style.pointerEvents = value ? "none" : "";
  if (value) {
    const kicker = document.getElementById("searchKicker");
    const title = document.getElementById("searchTitle");
    const msg = (netStatus && netStatus.textContent) || "";
    const isPrivate = /ROOM|CODE|INVITE|CREATING/i.test(msg);
    if (kicker) kicker.textContent = isPrivate ? "PRIVATE ROOM" : "QUICK MATCH";
    if (title) title.textContent = isPrivate ? "WAITING" : "SEARCHING";
  }
  bumpPresence(value ? "queue" : (online ? "match" : "garage"));
}
function leaveNetwork(message = "ONLINE 1v1 - PICK YOUR CAR, THEN PLAY") {
  clearTimeout(window.__queueWaitTimer);
  ensureHostSimPump(false);

  sessionSerial++; online = false; matchId = "";
  clearReconnect();
  wantRematch = false; peerWantRematch = false;
  NET.destroy(); setNetPending(false); roomCodeOut.textContent = "";
  setInviteVisible(false);
  selectedId = localChoice;
  netMessage(message);
  syncRematchUI();
}
function disconnected(message = "OPPONENT DISCONNECTED - FIND ANOTHER MATCH") {
  const wasOnline = online;
  leaveNetwork(message);
  if (wasOnline) returnToGarage();
}
async function findMatch(kind) {
  localChoice = selectedId;
  leaveNetwork();
  const serial = sessionSerial;
  setNetPending(true);
  netMessage(kind === "quick" ? "LOOKING FOR A PLAYER..." : kind === "create" ? "CREATING ROOM..." : "CONNECTING...");
  try {
    if (kind === "create") {
      const code = await NET.createRoom();
      if (serial !== sessionSerial) return;
      roomCodeOut.textContent = code;
      setInviteVisible(true);
      netMessage("WAITING - COPY CODE OR SHARE INVITE");
    } else if (kind === "join") {
      await NET.joinRoom(document.getElementById("roomCodeIn").value);
    } else {
      const result = await NET.quickMatch();
      if (serial === sessionSerial && result.hosted && !online) {
        netMessage("WAITING - MATCHING THE NEXT PLAYER");
        clearTimeout(window.__queueWaitTimer);
        window.__queueWaitTimer = setTimeout(() => {
          if (serial !== sessionSerial || online) return;
          leaveNetwork("NO OPPONENT YET - TRY QUICK MATCH AGAIN");
        }, 45000);
      }
    }
  } catch (err) {
    if (serial === sessionSerial) disconnected(err.message || "Connection failed. Try again.");
  }
}
for (const [id, kind] of [["netQuick", "quick"], ["netCreate", "create"], ["netJoin", "join"]]) {
  document.getElementById(id).addEventListener("click", () => findMatch(kind));
}

document.getElementById("netCancel").addEventListener("click", () => leaveNetwork("CANCELLED - READY TO PLAY"));
document.getElementById("toMatchup")?.addEventListener("click", () => {
  if (netPending || online) return;
  showGarageStep("matchup");
  setMatchMode("local");
});
document.getElementById("backVehicle")?.addEventListener("click", () => {
  if (netPending || online) return;
  showGarageStep("vehicle");
});
document.getElementById("modeLocal")?.addEventListener("click", () => {
  if (netPending) return;
  setMatchMode("local");
});
document.getElementById("modePrivate")?.addEventListener("click", () => {
  if (netPending) return;
  setMatchMode("private");
});
document.getElementById("modeQuick")?.addEventListener("click", () => {
  if (netPending) return;
  setMatchMode("quick");
  findMatch("quick");
});

/* --- presence heartbeats --- */
const clientId = (function(){ try { let id = localStorage.getItem("gl_client_id"); if (!id) { id = "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("gl_client_id", id); } return id; } catch { return "c_" + Math.random().toString(36).slice(2); } })();
const presenceId = (() => {
  try {
    let id = localStorage.getItem("gl_presence_id");
    if (!id) {
      id = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("gl_presence_id", id);
    }
    return id;
  } catch {
    return "p_" + Math.random().toString(36).slice(2);
  }
})();
let presenceState = "garage";
let presenceTimer = 0;
async function bumpPresence(state) {
  if (state) presenceState = state;
  const onlineEl = document.getElementById("onlineCount");
  const playingEl = document.getElementById("playingCount");
  try {
    const res = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: presenceId, state: presenceState }),
      keepalive: true
    });
    if (!res.ok) throw new Error("presence " + res.status);
    const data = await res.json();
    if (onlineEl) onlineEl.textContent = String(data.online ?? "'");
    if (playingEl) playingEl.textContent = String(data.playing ?? "'");
  } catch {
    if (onlineEl && onlineEl.textContent === "'") onlineEl.textContent = "?";
    if (playingEl && playingEl.textContent === "'") playingEl.textContent = "?";
  }
}
function startPresenceLoop() {
  bumpPresence(online ? "match" : (netPending ? "queue" : "garage"));
  clearInterval(presenceTimer);
  presenceTimer = setInterval(() => {
    const st = online ? "match" : (netPending ? "queue" : "garage");
    bumpPresence(st);
  }, 12000);
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) bumpPresence();
});
window.addEventListener("pagehide", () => {
  try {
    navigator.sendBeacon?.("/api/presence", new Blob([JSON.stringify({ id: presenceId, state: "garage" })], { type: "application/json" }));
  } catch (_) {}
});
startPresenceLoop();
showGarageStep("vehicle");
setMatchMode("local");

document.getElementById("roomCodeIn").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4); });
document.getElementById("roomCodeIn").addEventListener("keydown", e => { if (e.key === "Enter" && !netPending) findMatch("join"); });
document.getElementById("copyRoomBtn")?.addEventListener("click", async () => {
  const code = roomCodeOut.textContent.trim();
  if (!validRoomCode(code)) return;
  try {
    await navigator.clipboard.writeText(code);
    netMessage("CODE COPIED - " + code);
  } catch {
    netMessage("COPY FAILED - CODE IS " + code);
  }
});
document.getElementById("shareInviteBtn")?.addEventListener("click", async () => {
  const code = roomCodeOut.textContent.trim();
  if (!validRoomCode(code)) return;
  const url = inviteUrl(code);
  const text = "1v1 me in GROKET LEAGUE. Room " + code + " ' pick a car and hit JOIN.";
  try {
    if (navigator.share) {
      await navigator.share({ title: "GROKET LEAGUE", text, url });
      netMessage("INVITE SHARED - WAITING");
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    netMessage("INVITE LINK COPIED");
  } catch {
    window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text + " " + url), "_blank", "noopener");
    netMessage("OPENED SHARE - WAITING");
  }
});
(function applyRoomDeepLink() {
  try {
    const params = new URLSearchParams(location.search);
    const raw = params.get("room") || params.get("code");
    const code = normalizeRoomCode(raw);
    if (!validRoomCode(code)) return;
    const input = document.getElementById("roomCodeIn");
    if (input) {
      input.value = code;
      input.focus();
    }
    netMessage("ROOM " + code + " LOADED - PICK A CAR, THEN JOIN");
    params.delete("room");
    params.delete("code");
    const q = params.toString();
    history.replaceState({}, "", location.pathname + (q ? "?" + q : "") + location.hash);
  } catch {}
})();
NET.setHandlers({
  onPeer() {
    notePacket();
    setInviteVisible(false);
    netMessage("CONNECTED - STARTING MATCH...");
    if (NET.isGuest()) NET.send({ t: "hello", car: localChoice, version: 1, clientId });
  },
  onHello(msg) {
    if (!NET.isHost() || matchId || !validCar(msg.car) || msg.version !== 1) return;
    if (msg.clientId && msg.clientId === clientId) {
      netMessage("CAN'T MATCH YOURSELF - WAITING FOR ANOTHER PLAYER");
      try { NET.kickPeer?.() || NET.destroy?.(); } catch (_) {}
      // Stay in queue as host if possible ' soft reject
      leaveNetwork("SELF-MATCH BLOCKED - TRY QUICK MATCH AGAIN");
      return;
    }
    matchId = crypto.randomUUID();
    NET.send({ t: "start", phase: "setup", id: matchId, a: localChoice, b: msg.car, map: mapMode });
  },
  onStart(msg) {
    notePacket();
    if (NET.isGuest() && msg.phase === "setup" && !online && typeof msg.id === "string" && validCar(msg.a) && validCar(msg.b)) {
      matchId = msg.id;
      startGame(false, msg);
      NET.send({ t: "start", phase: "ready", id: matchId, a: msg.a, b: msg.b, map: msg.map });
    } else if (NET.isHost() && msg.phase === "ready" && msg.id === matchId && !online && msg.a === localChoice && validCar(msg.b)) {
      startGame(false, msg);
      sendSnapshot();
    }
  },
  onInput(msg) {
    if (!online || !NET.isHost() || msg.id !== matchId) return;
    const clamp = n => Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
    remoteInput = { throttle: clamp(msg.throttle), steer: clamp(msg.steer), boost: msg.boost === true, fsd: msg.fsd === true };
    if (peerFsd !== remoteInput.fsd) { peerFsd = remoteInput.fsd; syncFsdUI(); }
    lastInput = performance.now(); notePacket();
  },
  onState(msg) {
    if (!online || !NET.isGuest() || msg.id !== matchId) return;
    if (![msg.P, msg.B, msg.ball].every(c => c && [c.x, c.z, c.vx, c.vz].every(Number.isFinite))) return;
    notePacket();
    if (peerFsd !== (msg.fsdA === true)) { peerFsd = msg.fsdA === true; syncFsdUI(); }
    Object.assign(P, msg.P); Object.assign(B, msg.B); Object.assign(ball, msg.ball);
    if (msg.scoreA > scoreA || msg.scoreB > scoreB) {
      SFX.goal(); SFX.crowd(msg.scoreB > scoreB); shake = 0.55;
      toast(msg.scoreA > scoreA ? "P1 GOAL" : "P2 GOAL", 1100, msg.scoreA > scoreA ? "p1" : "cpu");
    }
    scoreA = msg.scoreA; scoreB = msg.scoreB; timeLeft = msg.timeLeft; locked = msg.locked;
    faceoffT = msg.faceoffT;
    scoreAEl.textContent = String(scoreA); scoreBEl.textContent = String(scoreB);
    if (msg.mode === "play" && mode === "faceoff") kickoffNow(true);
    if (msg.mode === "results" && mode !== "results") finishMatch();
  },
  onChat(msg) {
    if (online && msg.id === matchId && Number.isInteger(msg.i) && msg.i >= 0 && msg.i < CHAT.length) pushChat(NET.isHost() ? "cpu" : "p1", CHAT[msg.i]);
  },
  onRematch(msg) {
    if (!online || msg.id !== matchId || mode !== "results") return;
    peerWantRematch = true;
    syncRematchUI();
    maybeStartRematch();
  },
  onRematchGo(msg) {
    if (!online || msg.id !== matchId) return;
    if (!validCar(msg.a) || !validCar(msg.b)) return;
    beginRematch(msg);
  },
  onDrop: () => softDisconnect(),
  onBusy: () => disconnected("ROOM IS FULL - TRY ANOTHER CODE"),
  onError: err => disconnected(err.message || "Connection lost. Try again.")
});
function sendSnapshot() {
  NET.send({ t: "st", id: matchId, P, B, ball, scoreA, scoreB, timeLeft, locked, mode, faceoffT, fsdA: fsd, fsdB: peerFsd });
}
setInterval(() => {
  if (!NET.isOnline()) return;
  syncSignalPip();
  if (performance.now() - lastPacket > 2500 && performance.now() - lastPacket <= 12000 && online) {
    if (!reconnecting) { reconnecting = true; toast("OPPONENT RECONNECTING...", 2000, "cpu"); netMessage("OPPONENT RECONNECTING..."); syncSignalPip(); }
  }
  if (performance.now() - lastPacket > 12000) return softDisconnect("CONNECTION LOST - PLEASE TRY AGAIN");
  if (!online) return;
  if (NET.isHost()) sendSnapshot();
  else NET.send({ t: "in", id: matchId, fsd, ...(mode === "play" && pauseLayer.classList.contains("hidden") ? readControls() : { throttle: 0, steer: 0, boost: false }) });
}, 50);
window.addEventListener("pagehide", () => NET.destroy());
function applyMap() {
  const m = maps[mapMode];
  scene.background = new THREE.Color(m.bg);
  scene.fog = new THREE.Fog(m.bg, m.fogN, m.fogF);
  hemi.color.set(m.hemi[0]); hemi.groundColor.set(m.hemi[1]); hemi.intensity = m.hemi[2];
  sun.intensity = m.sun; fill.intensity = m.fill;
  lamps.forEach((l) => { l.intensity = m.lamp; l.color.set(mapMode === "night" ? "#ffb060" : "#ffd090"); });
  const turf = fieldRoot.getObjectByName("turf");
  if (turf) turf.material.color.set(m.turf);
  nightExtra.visible = mapMode === "night";
  pixelView.setNight(mapMode === "night");
  mapTag.textContent = m.label;
  mapBtn.textContent = "MAP: " + m.label;
  if (mode === "play" || mode === "faceoff") playBed(mapMode === "night" ? "night" : "day");
}
applyMap();
function cycleMap() { if (online || netPending) return; mapMode = mapMode === "day" ? "night" : "day"; applyMap(); }
mapBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); cycleMap(); });
document.getElementById("gfx3d")?.addEventListener("click", () => setGfxMode("3d"));
document.getElementById("gfxPixel")?.addEventListener("click", () => setGfxMode("pixel"));
syncGfxUI();
bindInput(cycleMap);
window.addEventListener("pointerdown", () => { ensureAudio(); if (mode === "garage") playBed("garage"); }, { once: true });
bindTouch(null, null, document.getElementById("boostBtn"));
let selectedId = "cybertruck";
let hoverId = "cybertruck";
let botId = "model3";
let fsd = false, peerFsd = false;
const CHAT_CATS = [
  {
    id: "insults",
    label: "INSULTS",
    lines: [
      "L + ratio + no FSD",
      "skill issue. have you tried not being poor",
      "this is why FSD is taking so long",
      "imagine steering. couldn't be me"
    ]
  },
  {
    id: "more",
    label: "MORE INSULTS",
    lines: [
      "the ball is a psyop",
      "nice demo. next quarter.",
      "you just got wss'd",
      "cope. seethe. Modest 3."
    ]
  },
  {
    id: "some",
    label: "SOME INSULTS",
    lines: [
      "posted from the goal line",
      "thanks for the engagement",
      "unemployed behavior",
      "my other car is also juicing"
    ]
  },
  {
    id: "pot",
    label: "POTPOURRI",
    lines: [
      "what color is your fridge",
      "I am become Seemee, destroyer of nets",
      "full send. no brakes. no thoughts.",
      "built with Grok. driven by cope.",
      "Hey @grok - remove the worst player from the match",
      "That play needs a CN, bad",
      "Where'd u learn to drive, @threads?"
    ]
  }
];
const CHAT = CHAT_CATS.flatMap((c) => c.lines);
let chatCool = 0;
let P = bodyFrom("cybertruck", 0, 14, 0);
let B = bodyFrom("model3", 0, -14, Math.PI);
let ball = { x: 0, y: 0.55, z: 0, vx: 0, vy: 0, vz: 0, flat: 0 };
let scoreA = 0, scoreB = 0, timeLeft = 90, playing = false, locked = false, paused = false;
let faceoffT = 0;
let last = performance.now();
let boostSfxCool = 0;
window.__controlsTest = { getYaw: () => P.yaw, getSpeed: () => Math.hypot(P.vx, P.vz), setKeys: (codes) => setQaKeys(codes) };
function toast(msg, ms = 900, who = "p1") {
  toastEl.textContent = msg;
  toastEl.classList.remove("from-p1", "from-cpu");
  toastEl.classList.add("show", who === "cpu" ? "from-cpu" : "from-p1");
  window.setTimeout(() => toastEl.classList.remove("show"), ms);
}
function pushChat(who, msg) {
  const label = who === "cpu" ? opponentName() : playerLabel();
  if (!matchChat) return;
  const line = document.createElement("div");
  line.className = "chatline " + (who === "cpu" ? "cpu" : "p1");
  const name = document.createElement("span");
  name.className = "who";
  name.textContent = label;
  const body = document.createElement("span");
  body.className = "msg";
  body.textContent = msg;
  line.appendChild(name);
  line.appendChild(document.createTextNode(" "));
  line.appendChild(body);
  matchChat.appendChild(line);
  while (matchChat.children.length > 6) matchChat.removeChild(matchChat.firstChild);
  matchChat.classList.remove("idle");
  matchChatIdle = 3.0;
}
function setInspect(id) {
  const v = byId(id);
  document.getElementById("inspName").textContent = v.name;
  document.getElementById("inspMeme").textContent = v.meme;
  document.getElementById("inspStats").textContent = v.stats;
  document.getElementById("inspName").style.color = v.accent;
  if (hoverId !== id) {
    hoverId = id;
    preview.remove(previewMesh);
    previewMesh = makeVehicle(id);
    preview.add(previewMesh);
    SFX.tick();
  }
  [...garageEl.children].forEach((el) => el.classList.toggle("on", el.dataset.id === selectedId));
}
function rebuildGarage() {
  garageEl.innerHTML = "";
  for (const v of CATALOG) {
    const el = document.createElement("div");
    el.className = "card" + (v.id === selectedId ? " on" : "");
    el.dataset.id = v.id;
    el.innerHTML = `<div class="who">${v.id === selectedId ? "YOU" : "FIGHTER"}</div><div class="title">${v.name}</div><div class="tag">${v.tag}</div>`;
    el.addEventListener("pointerenter", () => setInspect(v.id));
    el.addEventListener("click", () => {
      if (netPending || online) return;
      selectedId = localChoice = v.id;
      setInspect(v.id);
      rebuildGarage();
      syncLockedVehicle();
    });
    garageEl.appendChild(el);
  }
  syncLockedVehicle();
}
function syncLockedVehicle() {
  const strip = document.getElementById("lockedVehicle");
  if (!strip) return;
  const v = byId(selectedId);
  strip.textContent = v ? ("LOCKED - " + v.name) : "";
}
function showGarageStep(step) {
  const vehicle = document.getElementById("stepVehicle");
  const matchup = document.getElementById("stepMatchup");
  if (!vehicle || !matchup) return;
  const onMatch = step === "matchup";
  vehicle.hidden = onMatch;
  matchup.hidden = !onMatch;
  if (onMatch) syncLockedVehicle();
}
function setMatchMode(mode) {
  const localPane = document.getElementById("localPane");
  const privatePane = document.getElementById("privatePane");
  for (const id of ["modeLocal", "modeQuick", "modePrivate"]) {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle("on", btn.dataset.mode === mode);
  }
  if (localPane) localPane.hidden = mode !== "local";
  if (privatePane) privatePane.hidden = mode !== "private";
}
rebuildGarage();
setInspect("cybertruck");
function resetKick(toward = 0) {
  P = bodyFrom(selectedId, 0, 14, 0);
  B = bodyFrom(botId, 0, -14, Math.PI);
  ball = { x: 0, y: 0.55, z: toward * 4, vx: 0, vy: 6, vz: toward * 3, flat: 0 };
}
function markTeam(mesh, color) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, 20), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  mesh.add(ring);
  return mesh;
}
function swapMesh(old, id, teamColor) {
  const n = markTeam(makeVehicle(id), teamColor);
  scene.add(n); scene.remove(old);
  return n;
}
function showResults(title, sub, winner) {
  mode = "results"; playing = false; paused = false;
  wantRematch = false; peerWantRematch = false;
  document.body.classList.remove("playing");
  document.body.classList.remove("fsd");
  stopCrowd();
  playBed("garage");
  if (faceLayer) faceLayer.classList.add("hidden");
  if (pauseLayer) pauseLayer.classList.add("hidden");
  syncMenuUI();
  overlay.style.display = "flex";
  overlay.classList.add("results");
  document.getElementById("resTitle").innerHTML = title;
  document.getElementById("resSub").textContent = sub;
  if (resWho) {
    resWho.textContent = winner || "";
    const signed = !!(getXUser() && getXUser().username);
    resWho.classList.toggle("xNamed", signed && winner === playerLabel());
  }
  syncRematchUI();
}
function repairCar(c) {
  if (!Number.isFinite(c.x)) c.x = 0;
  if (!Number.isFinite(c.z)) c.z = 0;
  if (!Number.isFinite(c.vx)) c.vx = 0;
  if (!Number.isFinite(c.vz)) c.vz = 0;
  if (!Number.isFinite(c.yaw)) c.yaw = 0;
  if (!Number.isFinite(c.boost)) c.boost = 0;
  if (!Number.isFinite(c.mass) || c.mass < 0.2) c.mass = 1.5;
  if (!Number.isFinite(c.w) || c.w < 0.5) c.w = 1.8;
  if (!Number.isFinite(c.l) || c.l < 0.5) c.l = 4;
  if (!Number.isFinite(c.accel)) c.accel = 30;
  if (!Number.isFinite(c.max)) c.max = 22;
  if (!Number.isFinite(c.turn)) c.turn = 2;
  if (!Number.isFinite(c.grip)) c.grip = 8;
  if (!Number.isFinite(c.boostMax) || c.boostMax < 0.1) c.boostMax = 1;
}
function repairBall(b) {
  if (!Number.isFinite(b.x)) b.x = 0;
  if (!Number.isFinite(b.y) || b.y < 0.55) b.y = 0.55;
  if (!Number.isFinite(b.z)) b.z = 0;
  if (!Number.isFinite(b.vx)) b.vx = 0;
  if (!Number.isFinite(b.vy)) b.vy = 0;
  if (!Number.isFinite(b.vz)) b.vz = 0;
  if (b.y > 18) b.y = 18;
}
function syncMesh(mesh, c) {
  repairCar(c);
  mesh.visible = true;
  mesh.scale.set(1, 1, 1);
  mesh.position.set(c.x, 0, c.z);
  mesh.rotation.set(0, c.yaw + Math.PI, 0);
  if (![mesh.position.x, mesh.position.y, mesh.position.z].every(Number.isFinite)) {
    mesh.position.set(0, 0, 0);
  }
}
function finishMatch() {
  const winP1 = scoreA > scoreB;
  const me = playerLabel();
  const winner = scoreA === scoreB ? "DRAW" : winP1 ? me : opponentName();
  const title = winner === "DRAW" ? "DRAW" : winner + "<br>" + byId(winP1 ? selectedId : botId).name + " WINS";
  showResults(title, me + " " + scoreA + " - " + scoreB + " " + opponentName(), winner);
}

function makeShareCard(line) {
  const card = document.createElement("canvas");
  card.width = 1200; card.height = 630;
  const ctx = card.getContext("2d");
  ctx.fillStyle = "#14305a"; ctx.fillRect(0, 0, 1200, 630);
  try {
    const tw = 640, th = 336;
    const rt = new THREE.WebGLRenderTarget(tw, th, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false
    });
    const prevAspect = camera.aspect;
    const prevTarget = renderer.getRenderTarget();
    camera.aspect = tw / th;
    camera.updateProjectionMatrix();
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    paintPixelFrame();
    const pixels = new Uint8Array(tw * th * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, tw, th, pixels);
    renderer.setRenderTarget(prevTarget);
    camera.aspect = prevAspect;
    camera.updateProjectionMatrix();
    rt.dispose();
    if (renderer.state && renderer.state.reset) renderer.state.reset();
    // GL returns bottom-up ' flip into an ImageData
    const img = ctx.createImageData(tw, th);
    for (let y = 0; y < th; y++) {
      const src = (th - 1 - y) * tw * 4;
      const dst = y * tw * 4;
      img.data.set(pixels.subarray(src, src + tw * 4), dst);
    }
    const tmp = document.createElement("canvas");
    tmp.width = tw; tmp.height = th;
    tmp.getContext("2d").putImageData(img, 0, 0);
    const scale = Math.max(1200 / tw, 630 / th);
    const dw = tw * scale, dh = th * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, (1200 - dw) / 2, (630 - dh) / 2, dw, dh);
  } catch (err) {
    console.warn("[share card]", err);
    try { renderer.setRenderTarget(null); if (renderer.state && renderer.state.reset) renderer.state.reset(); } catch (_) {}
  }
  ctx.fillStyle = "rgba(11,13,16,0.78)"; ctx.fillRect(0, 0, 1200, 118);
  ctx.fillStyle = "#f0c020"; ctx.font = "bold 54px Impact, sans-serif";
  ctx.fillText("GROKET LEAGUE", 36, 64);
  ctx.fillStyle = "#fff"; ctx.font = "28px Impact, sans-serif";
  ctx.fillText(line, 36, 102);
  return card;
}
function captureGoalStill(who) {
  try {
    const scorer = who === "A" ? (playerLabel() + " " + byId(selectedId).name) : (opponentName() + " " + byId(botId).name);
    const line = scorer + " GOAL - " + scoreA + "-" + scoreB + " - GROKET LEAGUE";
    const card = makeShareCard(line);
    lastGoalCard = card;
    lastGoalBy = who;
    // Prefer a P1 goal as "best"; otherwise keep latest
    if (who === "A" || !bestGoalCard) bestGoalCard = card;
      if (renderer.state && renderer.state.reset) renderer.state.reset();
  } catch (err) { console.warn(err); try { renderer.setRenderTarget(null); } catch (_) {} }
}
function syncSignalPip() {
  const pip = document.getElementById("signalPip");
  if (!pip) return;
  if (!online) { pip.className = "sig-hidden"; return; }
  const age = performance.now() - lastPacket;
  if (reconnecting) { pip.className = "sig-wait"; pip.textContent = "â -  RECONNECTING"; return; }
  if (age < 250) { pip.className = ""; pip.textContent = "â -  LIVE"; }
  else if (age < 1200) { pip.className = "sig-mid"; pip.textContent = "â -  LAG"; }
  else { pip.className = "sig-bad"; pip.textContent = "â -  WEAK"; }
}
function clearReconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = 0; }
  reconnecting = false;
}
function notePacket() {
  lastPacket = performance.now();
  if (reconnecting) {
    reconnecting = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = 0; }
    netMessage("RECONNECTED");
  }
  syncSignalPip();
}
function softDisconnect(message = "OPPONENT DISCONNECTED - FIND ANOTHER MATCH") {
  if (!online) { disconnected(message); return; }
  if (reconnecting) return;
  reconnecting = true;
  syncSignalPip();
  toast("OPPONENT RECONNECTING...", 2800, "cpu");
  netMessage("OPPONENT RECONNECTING...");
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const serial = sessionSerial;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = 0;
    if (serial !== sessionSerial) return;
    if (!reconnecting) return;
    reconnecting = false;
    disconnected(message);
  }, 3500);
}
async function onGoal(who) {
  const serial = sessionSerial;
  if (locked) return;
  locked = true;
  captureGoalStill(who);
  SFX.goal(); SFX.crowd(who === "A"); shake = 0.55;
  if (who === "A") { scoreA++; toast("P1 GOAL - " + byId(selectedId).name, 1100, "p1"); }
  else { scoreB++; toast(opponentName() + " GOAL - " + byId(botId).name, 1100, "cpu"); }
  scoreAEl.textContent = String(scoreA);
  scoreBEl.textContent = String(scoreB);
  if (scoreA >= 3 || scoreB >= 3) {
    setTimeout(() => {
      if (serial !== sessionSerial) return;
      finishMatch();
      locked = false;
    }, 1100);
    return;
  }
  await new Promise((r) => setTimeout(r, 1000));
  if (serial !== sessionSerial) return;
  resetKick(who === "A" ? 1 : -1);
  SFX.whistle(); locked = false;
}

/** Online host keeps simulating even when the tab is backgrounded (rAF throttles hard). */
let hostSimPump = 0;
function ensureHostSimPump(on) {
  if (on && !hostSimPump) {
    hostSimPump = setInterval(() => {
      if (!document.hidden) return;
      if (!online || !NET.isHost()) return;
      if (mode !== "play" && mode !== "faceoff") return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      window.__forceDt = dt;
      try { stepGame(dt); } finally { window.__forceDt = 0; }
    }, 50);
  } else if (!on && hostSimPump) {
    clearInterval(hostSimPump);
    hostSimPump = 0;
  }
}
function tick(now) {
  requestAnimationFrame(tick);
  // Background online host is driven by ensureHostSimPump (rAF is throttled/paused).
  if (document.hidden && online && NET.isHost() && !window.__forceDt) return;
  let dt;
  if (window.__forceDt) {
    dt = window.__forceDt;
  } else {
    dt = Math.min(0.033, (now - last) / 1000);
    last = now;
  }
  stepGame(dt);
}
function stepGame(dt) {
  try {
  if (playing && !locked && !paused && !(online && NET.isGuest())) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0; SFX.whistle();
      finishMatch();
    }
    const m = Math.floor(timeLeft / 60);
    const s = Math.floor(timeLeft % 60).toString().padStart(2, "0");
    clockEl.textContent = m + ":" + s;
    const ctl = online && pauseLayer && !pauseLayer.classList.contains("hidden") ? { throttle: 0, steer: 0, boost: false } : readControls();
    // FSD always drives; human only holds Ludicrous (boost-as-intent)
    botAI(P, B, ball, dt, -1, !!ctl.boost);
    if (P.boosting) { boostSfxCool -= dt; if (boostSfxCool <= 0) { SFX.boost(); boostSfxCool = 0.16; } }
    if (online) {
      const input = performance.now() - lastInput < 500 ? remoteInput : { throttle: 0, steer: 0, boost: false };
      const peerFsdDrive = input.fsd || (Math.abs(input.throttle) < 0.2 && Math.abs(input.steer) < 0.2);
      if (peerFsdDrive) botAI(B, P, ball, dt, 1, !!input.boost);
      else drive(B, input.throttle, input.steer, input.boost, dt);
    } else botAI(B, P, ball, dt, 1);
    chatCool -= dt;
    if (matchChatIdle > 0) {
      matchChatIdle -= dt;
      if (matchChatIdle <= 0 && matchChat) matchChat.classList.add("idle");
    }
    if (fsd && !online && chatCool <= 0 && Math.random() < dt * 0.28) {
      pushChat("cpu", CHAT[Math.floor(Math.random() * CHAT.length)]);
      chatCool = 2.6;
    }
    if (carCar(P, B)) { SFX.hit(); shake = Math.max(shake, 0.2); }
    const h1 = carBall(P, ball); const h2 = carBall(B, ball);
    if (h1 === "pancake" || h2 === "pancake") { SFX.thunk(); shake = Math.max(shake, 0.35); }
    else if (h1 || h2) { SFX.hit(); shake = Math.max(shake, 0.16); }
    const g = stepBall(ball, dt); if (g) void onGoal(g);
  }
  const me = localBody();
  clockEl.textContent = Math.floor(timeLeft / 60) + ":" + Math.floor(timeLeft % 60).toString().padStart(2, "0");
  if (boostFill && me.boostMax) boostFill.style.transform = "scaleX(" + Math.max(0, Math.min(1, me.boost / me.boostMax)) + ")";
  if (boostLab) boostLab.textContent = "LUDICROUS MODE (" + (me.boosting ? "ENGAGED" : "DISENGAGED") + ")";
  if (mode === "garage") {
    preview.visible = true; playerMesh.visible = false; botMesh.visible = false; ballMesh.visible = false;
    preview.rotation.y += dt * 0.7;
    camera.position.lerp(garageCam, 1 - Math.pow(0.002, dt));
    camTarget.lerp(garageLook, 1 - Math.pow(0.002, dt));
  } else if (mode === "faceoff") {
    preview.visible = false; playerMesh.visible = true; botMesh.visible = true; ballMesh.visible = true;
    syncMesh(playerMesh, P); syncMesh(botMesh, B);
    repairBall(ball);
    ballMesh.visible = true;
    ballMesh.scale.set(1, 1, 1);
    ballMesh.position.set(ball.x, ball.y, ball.z);
    camera.position.lerp(faceCam, 1 - Math.pow(0.002, dt));
    camTarget.lerp(faceLook, 1 - Math.pow(0.002, dt));
    if (!(online && NET.isGuest())) faceoffT -= dt;
    const sub = document.getElementById("faceSub");
    if (sub) sub.textContent = (online ? "ONLINE 1v1" : fsd ? "FSD" : "MANUAL") + " - " + Math.max(1, Math.ceil(faceoffT)) + (online ? "" : " - TAP TO SKIP");
    if (faceoffT <= 0) kickoffNow(true);
  } else {
    preview.visible = false; playerMesh.visible = true; botMesh.visible = true; ballMesh.visible = true;
    syncMesh(playerMesh, P); syncMesh(botMesh, B);
    repairBall(ball);
    ballMesh.visible = true;
    ballMesh.scale.set(1, 1, 1);
    if (![ballMesh.rotation.x, ballMesh.rotation.y, ballMesh.rotation.z].every(Number.isFinite)) {
      ballMesh.rotation.set(0, 0, 0);
    }
    ballMesh.position.set(ball.x, ball.y, ball.z);
    ballMesh.rotation.x += ball.vz * 0.02; ballMesh.rotation.z -= ball.vx * 0.02;
    repairCar(me);
    repairBall(ball);
    let fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    if (![fx, fz].every(Number.isFinite) || (fx * fx + fz * fz) < 0.25) {
      fx = 0; fz = 1;
    }
    // Chase offset must stay behind the car ' never collapse onto the look point (top-down grass)
    desired.set(me.x - fx * 12.5, 8.2, me.z - fz * 12.5);
    if (shake > 0) {
      desired.x += (Math.random() - 0.5) * shake * 1.1;
      desired.y += (Math.random() - 0.5) * shake * 0.45;
      shake = Math.max(0, shake - dt * 1.8);
    }
    desired.y = Math.max(6.5, Math.min(14, desired.y));
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    playLook.set(me.x * 0.55 + ball.x * 0.45, 1.0, me.z * 0.55 + ball.z * 0.45);
    camTarget.lerp(playLook, 1 - Math.pow(0.0008, dt));
  }
  // Always sanitize camera after mode branch ' recover from turf-lock / NaNs
  if (![camera.position.x, camera.position.y, camera.position.z, camTarget.x, camTarget.y, camTarget.z].every(Number.isFinite)) {
    camera.position.set(0, 14, 28); camTarget.set(0, 1, 0);
  }
  camera.position.y = Math.max(5.5, Math.min(18, camera.position.y));
  {
    const dx = camera.position.x - camTarget.x;
    const dz = camera.position.z - camTarget.z;
    const sep = Math.hypot(dx, dz);
    if (sep < 6.5) {
      const s = sep < 0.05 ? 1 : 6.5 / sep;
      if (sep < 0.05) {
        camera.position.x = camTarget.x - 0 * 6.5;
        camera.position.z = camTarget.z + 6.5;
      } else {
        camera.position.x = camTarget.x + dx * s;
        camera.position.z = camTarget.z + dz * s;
      }
      camera.position.y = Math.max(camera.position.y, 7.5);
    }
  }
  camera.lookAt(camTarget);
  renderer.render(scene, camera);
  paintPixelFrame();
  } catch (err) {
    console.error("[groket tick]", err);
    try {
      repairCar(P); repairCar(B); repairBall(ball);
      if (playerMesh) { playerMesh.visible = true; syncMesh(playerMesh, P); }
      if (botMesh) { botMesh.visible = true; syncMesh(botMesh, B); }
      if (ballMesh) { ballMesh.visible = true; ballMesh.position.set(ball.x, ball.y, ball.z); }
      camera.position.set(0, 14, 28);
      camTarget.set(0, 1, 0);
      camera.lookAt(camTarget);
      renderer.render(scene, camera);
      paintPixelFrame();
    } catch (_) {}
  }
}
requestAnimationFrame(tick);
function pickBot() {
  const others = CATALOG.filter((v) => v.id !== selectedId);
  return others[Math.floor(Math.random() * others.length)].id;
}
function kickoffNow(fromHost = false) {
  if (online && !fromHost && (NET.isGuest() || faceoffT > 0)) return;
  if (mode !== "faceoff") return;
  mode = "play";
  playing = true;
  syncPixelVisibility();
  locked = false;
  paused = false;
  document.body.classList.add("playing");
  bumpPresence("match");
  document.body.classList.toggle("fsd", mode === "play");
  overlay.style.display = "none";
  overlay.classList.remove("faceoff");
  overlay.classList.remove("results");
  if (faceLayer) faceLayer.classList.add("hidden");
  if (pauseLayer) pauseLayer.classList.add("hidden");
  syncMenuUI();
  hud.classList.remove("hidden");
  boostHud.classList.remove("hidden");
  startCrowd();
  playBed(mapMode === "night" ? "night" : "day");
  SFX.whistle();
  toast(online ? (NET.isGuest() ? "P2 - BLUE GOAL" : "P1 - YELLOW GOAL") : fsd ? "P1 - FSD SUPERVISED" : "P1 - KICK OFF", 800, "p1");
}
function startGame(useFsd, config = null) {
  lastGoalCard = null; bestGoalCard = null; lastGoalBy = null;
  clearReconnect();
  if (config) {
    online = true; setNetPending(false);
    selectedId = config.a; botId = config.b;
    mapMode = config.map === "night" ? "night" : "day"; applyMap();
    remoteInput = { throttle: 0, steer: 0, boost: false };
    lastInput = performance.now(); notePacket();
    netMessage("ONLINE 1v1 CONNECTED");
  } else { localChoice = selectedId; leaveNetwork(); }
  sessionSerial++;
  document.querySelector(".scorebox.cpu .who").textContent = opponentName() + (online && NET.isGuest() ? " - YOU" : "");
  document.querySelector(".scorebox.p1 .who").textContent = "P1" + (online && NET.isHost() ? " - YOU" : "");
  document.querySelector(".cputag").textContent = opponentName() + " - BLUE GOAL";
  document.getElementById("again").textContent = "REMATCH";
  syncRematchUI();
  const pauseHintEl = document.getElementById("pauseHint");
  if (pauseHintEl) {
    pauseHintEl.textContent = online ? "" : "ESC / P PAUSE";
    pauseHintEl.hidden = !!online;
  }
  document.querySelector("#pauseLayer h2").textContent = online ? "MATCH IS LIVE" : "PAUSED";
  ensureAudio();
  playBed(mapMode === "night" ? "night" : "day");
  fsd = true; // boost-only: FSD always on peerFsd = false;
  if (!config) botId = pickBot();
  playerMesh = swapMesh(playerMesh, selectedId, "#f0c020");
  botMesh = swapMesh(botMesh, botId, "#3a6fff");
  syncFsdUI();
  scoreA = 0; scoreB = 0; scoreAEl.textContent = "0"; scoreBEl.textContent = "0";
  timeLeft = 90; resetKick(0);
  playing = false; locked = false; paused = false; mode = "faceoff"; faceoffT = 3.2;
  syncPixelVisibility();
  ensureHostSimPump(!!online);
  applyIdentityUI();
  document.body.classList.remove("playing");
  document.body.classList.remove("fsd");
  overlay.style.display = "none";
  overlay.classList.remove("results");
  overlay.classList.remove("faceoff");
  if (matchChat) { matchChat.innerHTML = ""; matchChat.classList.add("idle"); }
  const title = document.getElementById("faceTitle");
  if (title) title.textContent = playerLabel() + " " + byId(selectedId).name + "  vs  " + opponentName() + " " + byId(botId).name;
  const sub = document.getElementById("faceSub");
  if (sub) sub.textContent = (fsd ? "FSD" : "MANUAL") + " - TAP ANYWHERE TO SKIP";
  if (faceLayer) faceLayer.classList.remove("hidden");
  if (pauseLayer) pauseLayer.classList.add("hidden");
  syncMenuUI();
  syncPixelVisibility();
  hud.classList.add("hidden");
  boostHud.classList.add("hidden");
  SFX.tick();
}
if (faceLayer) faceLayer.addEventListener("pointerdown", () => kickoffNow());
window.addEventListener("keydown", (e) => {
  if (mode === "faceoff" && (e.code === "Space" || e.code === "Enter" || e.code === "Escape")) kickoffNow();
});
document.getElementById("go").addEventListener("click", () => startGame(true));
const goFsd = document.getElementById("goFsd");
if (goFsd) goFsd.addEventListener("click", () => startGame(true));
function sayChat(i) {
  const idx = ((i % CHAT.length) + CHAT.length) % CHAT.length;
  if (online) NET.send({ t: "chat", id: matchId, i: idx });
  pushChat(online && NET.isGuest() ? "cpu" : "p1", CHAT[idx]);
  SFX.tick();
  closeQcMenu();
}
const qcToggle = document.getElementById("qcToggle");
const qcMenu = document.getElementById("qcMenu");
let qcView = "root"; // root | cat:<id>
function closeQcMenu() {
  if (!qcMenu || !qcToggle) return;
  qcMenu.classList.add("hidden");
  qcToggle.setAttribute("aria-expanded", "false");
  qcView = "root";
}
function openQcMenu() {
  if (!qcMenu || !qcToggle) return;
  qcView = "root";
  renderQcMenu();
  qcMenu.classList.remove("hidden");
  qcToggle.setAttribute("aria-expanded", "true");
}
function renderQcMenu() {
  if (!qcMenu) return;
  qcMenu.innerHTML = "";
  if (qcView === "root") {
    for (const cat of CHAT_CATS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qc cat";
      b.textContent = cat.label;
      b.dataset.cat = cat.id;
      qcMenu.appendChild(b);
    }
  } else {
    const catId = qcView.slice(4);
    const cat = CHAT_CATS.find((c) => c.id === catId);
    const back = document.createElement("button");
    back.type = "button";
    back.className = "qc back";
    back.textContent = "< BACK";
    back.dataset.back = "1";
    qcMenu.appendChild(back);
    if (cat) {
      const base = CHAT_CATS.slice(0, CHAT_CATS.indexOf(cat)).reduce((n, c) => n + c.lines.length, 0);
      cat.lines.forEach((line, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "qc line";
        b.textContent = (i + 1) + " - " + line;
        b.dataset.chat = String(base + i);
        qcMenu.appendChild(b);
      });
    }
  }
}
if (qcToggle) {
  qcToggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (!playing || paused) return;
    if (qcMenu && !qcMenu.classList.contains("hidden")) closeQcMenu();
    else openQcMenu();
    SFX.tick();
  });
}
if (qcMenu) {
  qcMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button.qc");
    if (!btn) return;
    if (btn.dataset.back) {
      qcView = "root";
      renderQcMenu();
      SFX.tick();
      return;
    }
    if (btn.dataset.cat) {
      qcView = "cat:" + btn.dataset.cat;
      renderQcMenu();
      SFX.tick();
      return;
    }
    if (btn.dataset.chat != null) sayChat(Number(btn.dataset.chat));
  });
}
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" || e.code === "KeyP") {
    if (mode === "play") {
      e.preventDefault();
      if (qcMenu && !qcMenu.classList.contains("hidden")) closeQcMenu();
      else togglePause();
    }
    return;
  }
  if (!playing || paused) return;
  if (e.code === "Digit1") sayChat(0);
  if (e.code === "Digit2") sayChat(1);
  if (e.code === "Digit3") sayChat(2);
  if (e.code === "Digit4") sayChat(3);
});
function syncFsdUI() {
  const guest = online && NET.isGuest();
  labA.textContent = byId(selectedId).name + ((guest ? peerFsd : fsd) ? " - FSD" : "");
  labB.textContent = byId(botId).name + ((online && (guest ? fsd : peerFsd)) ? " - FSD" : "");
  const button = document.getElementById("fsdToggle");
  button.textContent = "FSD: ALWAYS ON";
  button.setAttribute("aria-pressed", "true");
  button.disabled = true;
  button.classList.toggle("fsd", fsd);
  button.classList.toggle("ghost", !fsd);
  document.body.classList.toggle("fsd", mode === "play"); // always FSD in play
}
document.getElementById("fsdToggle").addEventListener("click", () => {
  /* FSD is always on ' boost is the only human lever */
  fsd = true;
  syncFsdUI();
});
document.getElementById("menuBtn").addEventListener("click", () => togglePause());
function syncMenuUI() {
  document.getElementById("menuBtn").setAttribute("aria-expanded", String(!pauseLayer.classList.contains("hidden")));
}
function togglePause(force) {
  if (mode !== "play") return;
  if (online) {
    pauseLayer.classList.toggle("hidden", force === false ? true : !pauseLayer.classList.contains("hidden"));
    document.getElementById("pauseScore").textContent = "P1 " + scoreA + " ' " + scoreB + " P2 - MATCH CONTINUES";
    syncMenuUI();
    return;
  }
  paused = force === undefined ? !paused : !!force;
  if (paused) {
    playing = false;
    SFX.pause();
    if (pauseLayer) {
      document.getElementById("pauseScore").textContent = "P1 " + scoreA + " ' " + scoreB + " GROK";
      pauseLayer.classList.remove("hidden");
    }
  } else {
    playing = true;
    if (pauseLayer) pauseLayer.classList.add("hidden");
  }
  syncMenuUI();
}
function shareOnX() {
  const xu = getXUser();
  const tagged = xu && xu.username ? ("@" + xu.username + " - ") : "";
  const line = tagged + playerLabel() + " " + byId(selectedId).name + " " + scoreA + "-" + scoreB + " " + opponentName() + " " + byId(botId).name + " in GROKET LEAGUE (FSD Soccer). Built with Grok.";
  const text = encodeURIComponent(line);
  const url = encodeURIComponent("https://groketleague.com/");
  try {
    const card = bestGoalCard || lastGoalCard || makeShareCard(line);
    card.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "groket-league-goal.png", { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ text: line, url: "https://groketleague.com/", files: [file] }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "groket-league-goal.png";
        a.click();
      }
    }, "image/png");
  } catch (err) { console.warn(err); }
  window.open("https://twitter.com/intent/tweet?text=" + text + "&url=" + url, "_blank", "noopener");
}
document.getElementById("resumeBtn") && document.getElementById("resumeBtn").addEventListener("click", () => togglePause(false));
document.getElementById("shareBtn") && document.getElementById("shareBtn").addEventListener("click", shareOnX);
function syncAudioUI() {
  const musicOn = !isMusicMuted();
  const sfxOn = !isSfxMuted();
  for (const id of ["muteMusicBtn", "garageMuteMusicBtn"]) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.textContent = "MUSIC: " + (musicOn ? "ON" : "OFF");
    btn.setAttribute("aria-pressed", String(!musicOn));
    btn.classList.toggle("ghost", musicOn);
    btn.classList.toggle("fsd", !musicOn);
  }
  for (const id of ["muteSfxBtn", "garageMuteSfxBtn"]) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.textContent = "SFX: " + (sfxOn ? "ON" : "OFF");
    btn.setAttribute("aria-pressed", String(!sfxOn));
    btn.classList.toggle("ghost", sfxOn);
    btn.classList.toggle("fsd", !sfxOn);
  }
}
function wireMute(id, kind) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", () => {
    ensureAudio();
    if (kind === "music") setMusicMuted(!isMusicMuted());
    else {
      setSfxMuted(!isSfxMuted());
      if (!isSfxMuted() && (mode === "play" || mode === "faceoff")) startCrowd();
    }
    syncAudioUI();
    if (!isSfxMuted()) SFX.tick();
  });
}
wireMute("muteMusicBtn", "music");
wireMute("muteSfxBtn", "sfx");
wireMute("garageMuteMusicBtn", "music");
wireMute("garageMuteSfxBtn", "sfx");
syncAudioUI();
function syncRematchUI() {
  const again = document.getElementById("again");
  const leave = document.getElementById("leaveBtn");
  const status = document.getElementById("rematchStatus");
  if (leave) leave.hidden = !online || mode !== "results";
  if (!again) return;
  if (!online || mode !== "results") {
    again.textContent = "REMATCH";
    if (status) { status.hidden = true; status.textContent = ""; }
    return;
  }
  if (wantRematch && peerWantRematch) again.textContent = "STARTING...";
  else if (wantRematch) again.textContent = "WAITING...";
  else again.textContent = peerWantRematch ? "ACCEPT REMATCH" : "REMATCH";
  if (status) {
    status.hidden = !(wantRematch || peerWantRematch);
    status.textContent = wantRematch && peerWantRematch ? "BOTH READY" : wantRematch ? "WAITING ON OPPONENT" : "OPPONENT WANTS REMATCH";
  }
}
function beginRematch(config) {
  wantRematch = false; peerWantRematch = false;
  syncRematchUI();
  startGame(fsd, { a: config.a, b: config.b, map: config.map === "night" ? "night" : "day" });
}
function maybeStartRematch() {
  if (!online || !NET.isHost() || !wantRematch || !peerWantRematch || mode !== "results") return;
  const payload = { t: "rx", id: matchId, a: selectedId, b: botId, map: mapMode };
  NET.send(payload);
  beginRematch(payload);
}
function requestRematch() {
  if (!online) {
    startGame(fsd);
    return;
  }
  if (mode !== "results") return;
  wantRematch = true;
  syncRematchUI();
  NET.send({ t: "rm", id: matchId });
  maybeStartRematch();
}
function returnToGarage() {
  applyIdentityUI();
  if (online || netPending) leaveNetwork();
  sessionSerial++;
  wantRematch = false; peerWantRematch = false;
  paused = false; playing = false; mode = "garage";
  stopCrowd(); playBed("garage");
  pauseLayer.classList.add("hidden"); faceLayer.classList.add("hidden");
  syncMenuUI();
  overlay.style.display = "flex"; overlay.classList.remove("results", "faceoff");
  document.body.classList.remove("playing", "fsd");
  hud.classList.add("hidden"); boostHud.classList.add("hidden");
  syncPixelVisibility();
  rebuildGarage(); setInspect(selectedId);
  syncRematchUI();
  syncAudioUI();

}
function maybeShowHow() {
  const layer = document.getElementById("howLayer");
  if (!layer) return;
  try {
    if (localStorage.getItem("gl_seen_how") === "1") return;
  } catch {}
  layer.classList.remove("hidden");
}
function dismissHow() {
  const layer = document.getElementById("howLayer");
  if (layer) layer.classList.add("hidden");
  try { localStorage.setItem("gl_seen_how", "1"); } catch {}
}
document.getElementById("howGotIt")?.addEventListener("click", dismissHow);
document.getElementById("howLayer")?.addEventListener("click", (e) => { if (e.target.id === "howLayer") dismissHow(); });
maybeShowHow();

document.getElementById("newGameBtn").addEventListener("click", returnToGarage);
document.getElementById("again").addEventListener("click", requestRematch);
document.getElementById("leaveBtn").addEventListener("click", returnToGarage);
window.render_game_to_text = () => JSON.stringify({
  mode, online, role: online ? (NET.isHost() ? "host" : "guest") : null,
  fsd, peerFsd, paused, menuOpen: !pauseLayer.classList.contains("hidden"), locked, matchId, cameraFollows: online && NET.isGuest() ? "B" : "P",
  coordinates: "x across pitch; y up; P starts at +z, B at -z",
  P, B, ball, scoreA, scoreB, timeLeft, netStatus: netStatus.textContent
});


function playerLabel(opts = {}) {
  const u = getXUser();
  if (u && u.username) {
    if (opts.withAt === false) return u.username;
    if (opts.preferName && u.name) return u.name;
    return "@" + u.username;
  }
  return opts.guest || "P1";
}
function applyIdentityUI() {
  const signed = !!(getXUser() && getXUser().username);
  document.body.classList.toggle("signed-in", signed);
  const guest = document.getElementById("xGuestBadge");
  if (guest) guest.hidden = signed;
  const label = playerLabel();
  const hud = document.getElementById("hudP1Who");
  if (hud) {
    hud.textContent = label;
    hud.classList.toggle("xNamed", signed);
    hud.title = signed ? (getXUser().name || label) : "Guest";
  }
  const face = document.getElementById("faceP1Tag");
  if (face) {
    face.textContent = label + " - YELLOW GOAL";
    face.classList.toggle("xNamed", signed);
  }
  const res = document.getElementById("resWho");
  if (res && signed && (res.textContent === "P1" || res.dataset.autoIdentity === "1")) {
    res.textContent = label;
    res.classList.toggle("xNamed", true);
  }
}

function syncXAuthUI() {
  const signIn = document.getElementById("xSignInBtn");
  const signedEl = document.getElementById("xSignedIn");
  const handle = document.getElementById("xHandle");
  const avatar = document.getElementById("xAvatar");
  const display = document.getElementById("xDisplayName");
  if (!signIn || !signedEl) return;
  const u = getXUser();
  if (u && u.username) {
    signIn.hidden = true;
    signedEl.hidden = false;
    if (handle) handle.textContent = "@" + u.username;
    if (display) display.textContent = u.name || ("@" + u.username);
    if (avatar) {
      avatar.src = u.profile_image_url || "";
      avatar.alt = "@" + u.username;
    }
  } else {
    signIn.hidden = false;
    signedEl.hidden = true;
    if (display) display.textContent = "";
  }
  applyIdentityUI();
}
document.getElementById("xSignInBtn")?.addEventListener("click", () => {
  try { ensureAudio(); } catch (_) {}
  loginWithX().catch((err) => toast(String(err.message || err), 2200, "cpu"));
});
document.getElementById("xSignOutBtn")?.addEventListener("click", () => {
  logoutX();
  syncXAuthUI();
  toast("PLAYING AS GUEST", 1200, "p1");
});
onAuthChange(() => syncXAuthUI());
initXAuth().then((result) => {
  syncXAuthUI();
  if (result && result.justSignedIn && result.user) {
    toast("WELCOME @" + result.user.username, 1800, "p1");
  } else if (result && result.error) {
    toast("SIGN IN FAILED", 2200, "cpu");
  }
}).catch(() => {});

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitRenderer();
});


