import * as THREE from "three";
import * as NET from "./net.js";
import { CATALOG, byId } from "./catalog.js";
import { ensureAudio, SFX, startCrowd, stopCrowd, playBed, isMusicMuted, isSfxMuted, setMusicMuted, setSfxMuted } from "./audio.js";
import { bindInput, bindTouch, readControls, setQaKeys } from "./input.js";
import { makeVehicle, makeBall } from "./vehicles.js";
import { makeField, lamps } from "./field.js";
import { bodyFrom, drive, carBall, carCar, stepBall, botAI, forwardXZ } from "./sim.js";
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
const chatLog = document.getElementById("chatLog");
const resWho = document.getElementById("resWho");
const PIX = 2.4;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
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
const preview = new THREE.Group();
let previewMesh = makeVehicle("cybertruck");
preview.add(previewMesh);
preview.position.set(0, 0, 6);
scene.add(preview);
const maps = {
  day: { label: "DAY PITCH", bg: "#14305a", fogN: 38, fogF: 105, hemi: ["#8ec8ff", "#4a2a10", 1.15], sun: 1.35, fill: 0.42, lamp: 22, turf: "#2f9a3a" },
  night: { label: "GIGA NIGHT", bg: "#0a1028", fogN: 26, fogF: 90, hemi: ["#3a5a9a", "#120818", 0.55], sun: 0.18, fill: 0.18, lamp: 55, turf: "#14522a" }
};
let mapMode = "day";
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
  for (const id of ["netQuick", "netCreate", "netJoin", "roomCodeIn"]) document.getElementById(id).disabled = value;
  document.getElementById("netCancel").hidden = !value;
  garageEl.style.pointerEvents = value ? "none" : "";
}
function leaveNetwork(message = "ONLINE 1v1 · PICK YOUR CAR, THEN PLAY") {
  sessionSerial++; online = false; matchId = "";
  clearReconnect();
  wantRematch = false; peerWantRematch = false;
  NET.destroy(); setNetPending(false); roomCodeOut.textContent = "";
  setInviteVisible(false);
  selectedId = localChoice;
  netMessage(message);
  syncRematchUI();
}
function disconnected(message = "OPPONENT DISCONNECTED · FIND ANOTHER MATCH") {
  const wasOnline = online;
  leaveNetwork(message);
  if (wasOnline) returnToGarage();
}
async function findMatch(kind) {
  localChoice = selectedId;
  leaveNetwork();
  const serial = sessionSerial;
  setNetPending(true);
  netMessage(kind === "quick" ? "LOOKING FOR A PLAYER…" : kind === "create" ? "CREATING ROOM…" : "CONNECTING…");
  try {
    if (kind === "create") {
      const code = await NET.createRoom();
      if (serial !== sessionSerial) return;
      roomCodeOut.textContent = code;
      setInviteVisible(true);
      netMessage("WAITING · COPY CODE OR SHARE INVITE");
    } else if (kind === "join") {
      await NET.joinRoom(document.getElementById("roomCodeIn").value);
    } else {
      const result = await NET.quickMatch();
      if (serial === sessionSerial && result.hosted && !online) netMessage("WAITING · MATCHING THE NEXT PLAYER");
    }
  } catch (err) {
    if (serial === sessionSerial) disconnected(err.message || "Connection failed. Try again.");
  }
}
for (const [id, kind] of [["netQuick", "quick"], ["netCreate", "create"], ["netJoin", "join"]]) {
  document.getElementById(id).addEventListener("click", () => findMatch(kind));
}
document.getElementById("netCancel").addEventListener("click", () => leaveNetwork("CANCELLED · READY TO PLAY"));
document.getElementById("roomCodeIn").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4); });
document.getElementById("roomCodeIn").addEventListener("keydown", e => { if (e.key === "Enter" && !netPending) findMatch("join"); });
document.getElementById("copyRoomBtn")?.addEventListener("click", async () => {
  const code = roomCodeOut.textContent.trim();
  if (!validRoomCode(code)) return;
  try {
    await navigator.clipboard.writeText(code);
    netMessage("CODE COPIED · " + code);
  } catch {
    netMessage("COPY FAILED · CODE IS " + code);
  }
});
document.getElementById("shareInviteBtn")?.addEventListener("click", async () => {
  const code = roomCodeOut.textContent.trim();
  if (!validRoomCode(code)) return;
  const url = inviteUrl(code);
  const text = "1v1 me in GROKET LEAGUE. Room " + code + " — pick a car and hit JOIN.";
  try {
    if (navigator.share) {
      await navigator.share({ title: "GROKET LEAGUE", text, url });
      netMessage("INVITE SHARED · WAITING");
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
    netMessage("OPENED SHARE · WAITING");
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
    netMessage("ROOM " + code + " LOADED · PICK A CAR, THEN JOIN");
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
    netMessage("CONNECTED · STARTING MATCH…");
    if (NET.isGuest()) NET.send({ t: "hello", car: localChoice, version: 1 });
  },
  onHello(msg) {
    if (!NET.isHost() || matchId || !validCar(msg.car) || msg.version !== 1) return;
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
  onBusy: () => disconnected("ROOM IS FULL · TRY ANOTHER CODE"),
  onError: err => disconnected(err.message || "Connection lost. Try again.")
});
function sendSnapshot() {
  NET.send({ t: "st", id: matchId, P, B, ball, scoreA, scoreB, timeLeft, locked, mode, faceoffT, fsdA: fsd, fsdB: peerFsd });
}
setInterval(() => {
  if (!NET.isOnline()) return;
  syncSignalPip();
  if (performance.now() - lastPacket > 2500 && performance.now() - lastPacket <= 12000 && online) {
    if (!reconnecting) { reconnecting = true; toast("OPPONENT RECONNECTING…", 2000, "cpu"); netMessage("OPPONENT RECONNECTING…"); syncSignalPip(); }
  }
  if (performance.now() - lastPacket > 12000) return softDisconnect("CONNECTION LOST · PLEASE TRY AGAIN");
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
  lamps.forEach((l) => { l.intensity = m.lamp; l.color.set(mapMode === "night" ? "#cfe7ff" : "#fff2cc"); });
  const turf = fieldRoot.getObjectByName("turf");
  if (turf) turf.material.color.set(m.turf);
  nightExtra.visible = mapMode === "night";
  mapTag.textContent = m.label;
  mapBtn.textContent = "MAP: " + m.label;
  if (mode === "play" || mode === "faceoff") playBed(mapMode === "night" ? "night" : "day");
}
applyMap();
function cycleMap() { if (online || netPending) return; mapMode = mapMode === "day" ? "night" : "day"; applyMap(); }
mapBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); cycleMap(); });
bindInput(cycleMap);
window.addEventListener("pointerdown", () => { ensureAudio(); if (mode === "garage") playBed("garage"); }, { once: true });
bindTouch(document.getElementById("pad"), document.getElementById("knob"), document.getElementById("boostBtn"));
let selectedId = "cybertruck";
let hoverId = "cybertruck";
let botId = "model3";
let fsd = false, peerFsd = false;
const CHAT = ["L + ratio + no FSD","skill issue. have you tried not being poor","this is why FSD is taking so long","imagine steering. couldn't be me","the ball is a psyop","nice demo. next quarter.","you just got wss'd","cope. seethe. Model 3.","posted from the goal line","thanks for the engagement","unemployed behavior","my other car is also juicing","what color is your fridge","I am become Semi, destroyer of nets","touch grass. preferably the pitch","the algorithm fed you to me","this app is the app now","you are not the main character","supervised? brother I am the supervisor","that touch was a software-defined brick"];
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
  if (!chatLog) return;
  const el = document.createElement("div");
  el.className = "chatline " + who;
  el.innerHTML = `<span class="tag">${who === "cpu" ? opponentName() : "P1"}</span>${msg}`;
  chatLog.prepend(el);
  while (chatLog.children.length > 4) chatLog.removeChild(chatLog.lastChild);
  toast((who === "cpu" ? opponentName() + " · " : "P1 · ") + msg, 1200, who);
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
    el.innerHTML = `<div class="who">${v.id === selectedId ? "YOU" : "HOVER"}</div><div class="title">${v.name}</div><div class="tag">${v.tag}</div>`;
    el.addEventListener("pointerenter", () => setInspect(v.id));
    el.addEventListener("click", () => { if (netPending || online) return; selectedId = localChoice = v.id; setInspect(v.id); rebuildGarage(); });
    garageEl.appendChild(el);
  }
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
  if (resWho) resWho.textContent = winner || "";
  syncRematchUI();
}
function syncMesh(mesh, c) {
  mesh.position.set(c.x, 0, c.z);
  mesh.rotation.y = c.yaw + Math.PI;
}
function finishMatch() {
  const winP1 = scoreA > scoreB;
  const winner = scoreA === scoreB ? "DRAW" : winP1 ? "P1" : opponentName();
  const title = winner === "DRAW" ? "DRAW" : winner + "<br>" + byId(winP1 ? selectedId : botId).name + " WINS";
  showResults(title, "P1 " + scoreA + " — " + scoreB + " " + opponentName(), winner);
}

function makeShareCard(line) {
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const card = document.createElement("canvas");
  card.width = 1200; card.height = 630;
  const ctx = card.getContext("2d");
  ctx.fillStyle = "#14305a"; ctx.fillRect(0, 0, 1200, 630);
  const sw = src.width, sh = src.height;
  const scale = Math.max(1200 / Math.max(sw, 1), 630 / Math.max(sh, 1));
  const dw = sw * scale, dh = sh * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, (1200 - dw) / 2, (630 - dh) / 2, dw, dh);
  ctx.fillStyle = "rgba(11,13,16,0.78)"; ctx.fillRect(0, 0, 1200, 118);
  ctx.fillStyle = "#f0c020"; ctx.font = "bold 54px Impact, sans-serif";
  ctx.fillText("GROKET LEAGUE", 36, 64);
  ctx.fillStyle = "#fff"; ctx.font = "28px Impact, sans-serif";
  ctx.fillText(line, 36, 102);
  return card;
}
function captureGoalStill(who) {
  try {
    const scorer = who === "A" ? ("P1 " + byId(selectedId).name) : (opponentName() + " " + byId(botId).name);
    const line = scorer + " GOAL · " + scoreA + "-" + scoreB + " · GROKET LEAGUE";
    const card = makeShareCard(line);
    lastGoalCard = card;
    lastGoalBy = who;
    // Prefer a P1 goal as "best"; otherwise keep latest
    if (who === "A" || !bestGoalCard) bestGoalCard = card;
  } catch (err) { console.warn(err); }
}
function syncSignalPip() {
  const pip = document.getElementById("signalPip");
  if (!pip) return;
  if (!online) { pip.className = "sig-hidden"; return; }
  const age = performance.now() - lastPacket;
  if (reconnecting) { pip.className = "sig-wait"; pip.textContent = "● RECONNECTING"; return; }
  if (age < 250) { pip.className = ""; pip.textContent = "● LIVE"; }
  else if (age < 1200) { pip.className = "sig-mid"; pip.textContent = "● LAG"; }
  else { pip.className = "sig-bad"; pip.textContent = "● WEAK"; }
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
function softDisconnect(message = "OPPONENT DISCONNECTED · FIND ANOTHER MATCH") {
  if (!online) { disconnected(message); return; }
  if (reconnecting) return;
  reconnecting = true;
  syncSignalPip();
  toast("OPPONENT RECONNECTING…", 2800, "cpu");
  netMessage("OPPONENT RECONNECTING…");
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
  if (who === "A") { scoreA++; toast("P1 GOAL · " + byId(selectedId).name, 1100, "p1"); }
  else { scoreB++; toast(opponentName() + " GOAL · " + byId(botId).name, 1100, "cpu"); }
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
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (playing && !locked && !paused && !(online && NET.isGuest())) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0; SFX.whistle();
      finishMatch();
    }
    const m = Math.floor(timeLeft / 60);
    const s = Math.floor(timeLeft % 60).toString().padStart(2, "0");
    clockEl.textContent = m + ":" + s;
    const ctl = online && !pauseLayer.classList.contains("hidden") ? { throttle: 0, steer: 0, boost: false } : readControls();
    if (fsd && Math.abs(ctl.throttle) < 0.2 && Math.abs(ctl.steer) < 0.2) {
      botAI(P, B, ball, dt, -1);
      if (ctl.boost) drive(P, 0, 0, true, dt);
    } else {
      drive(P, ctl.throttle, ctl.steer, ctl.boost, dt);
    }
    if (P.boosting) { boostSfxCool -= dt; if (boostSfxCool <= 0) { SFX.boost(); boostSfxCool = 0.16; } }
    if (online) {
      const input = performance.now() - lastInput < 500 ? remoteInput : { throttle: 0, steer: 0, boost: false };
      if (input.fsd && Math.abs(input.throttle) < 0.2 && Math.abs(input.steer) < 0.2) {
        botAI(B, P, ball, dt, 1);
        if (input.boost) drive(B, 0, 0, true, dt);
      } else drive(B, input.throttle, input.steer, input.boost, dt);
    } else botAI(B, P, ball, dt, 1);
    chatCool -= dt;
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
  boostFill.style.transform = "scaleX(" + me.boost / me.boostMax + ")";
  if (boostLab) boostLab.textContent = "LUDICROUS MODE (" + (me.boosting ? "ENGAGED" : "DISENGAGED") + ")";
  if (mode === "garage") {
    preview.visible = true; playerMesh.visible = false; botMesh.visible = false; ballMesh.visible = false;
    preview.rotation.y += dt * 0.7;
    camera.position.lerp(garageCam, 1 - Math.pow(0.002, dt));
    camTarget.lerp(garageLook, 1 - Math.pow(0.002, dt));
  } else if (mode === "faceoff") {
    preview.visible = false; playerMesh.visible = true; botMesh.visible = true; ballMesh.visible = true;
    syncMesh(playerMesh, P); syncMesh(botMesh, B);
    ballMesh.scale.set(1, 1, 1);
    ballMesh.position.set(ball.x, ball.y, ball.z);
    camera.position.lerp(faceCam, 1 - Math.pow(0.002, dt));
    camTarget.lerp(faceLook, 1 - Math.pow(0.002, dt));
    if (!(online && NET.isGuest())) faceoffT -= dt;
    const sub = document.getElementById("faceSub");
    if (sub) sub.textContent = (online ? "ONLINE 1v1" : fsd ? "FSD" : "MANUAL") + " · " + Math.max(1, Math.ceil(faceoffT)) + (online ? "" : " · TAP TO SKIP");
    if (faceoffT <= 0) kickoffNow();
  } else {
    preview.visible = false; playerMesh.visible = true; botMesh.visible = true; ballMesh.visible = true;
    syncMesh(playerMesh, P); syncMesh(botMesh, B);
    ballMesh.scale.set(1, 1, 1);
    ballMesh.position.set(ball.x, ball.y, ball.z);
    ballMesh.rotation.x += ball.vz * 0.02; ballMesh.rotation.z -= ball.vx * 0.02;
    const { x: fx, z: fz } = forwardXZ(me.yaw);
    desired.set(me.x - fx * 11.5, 7.4, me.z - fz * 11.5);
    if (shake > 0) {
      desired.x += (Math.random() - 0.5) * shake * 1.4;
      desired.y += (Math.random() - 0.5) * shake * 0.8;
      shake = Math.max(0, shake - dt * 1.8);
    }
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    playLook.set(me.x * 0.55 + ball.x * 0.45, 0.6, me.z * 0.55 + ball.z * 0.45);
    camTarget.lerp(playLook, 1 - Math.pow(0.0008, dt));
  }
  camera.lookAt(camTarget);
  renderer.render(scene, camera);
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
  locked = false;
  paused = false;
  document.body.classList.add("playing");
  document.body.classList.toggle("fsd", fsd);
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
  toast(online ? (NET.isGuest() ? "P2 · BLUE GOAL" : "P1 · YELLOW GOAL") : fsd ? "P1 · FSD SUPERVISED" : "P1 · KICK OFF", 800, "p1");
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
  document.querySelector(".scorebox.cpu .who").textContent = opponentName() + (online && NET.isGuest() ? " · YOU" : "");
  document.querySelector(".scorebox.p1 .who").textContent = "P1" + (online && NET.isHost() ? " · YOU" : "");
  document.querySelector(".cputag").textContent = opponentName() + " · BLUE GOAL";
  document.getElementById("again").textContent = "REMATCH";
  syncRematchUI();
  document.getElementById("pauseHint").textContent = online ? "ESC / P MENU · MATCH STAYS LIVE" : "ESC / P PAUSE";
  document.querySelector("#pauseLayer h2").textContent = online ? "MATCH IS LIVE" : "PAUSED";
  ensureAudio();
  playBed(mapMode === "night" ? "night" : "day");
  fsd = !!useFsd; peerFsd = false;
  if (!config) botId = pickBot();
  playerMesh = swapMesh(playerMesh, selectedId, "#f0c020");
  botMesh = swapMesh(botMesh, botId, "#3a6fff");
  syncFsdUI();
  scoreA = 0; scoreB = 0; scoreAEl.textContent = "0"; scoreBEl.textContent = "0";
  timeLeft = 90; resetKick(0);
  playing = false; locked = false; paused = false; mode = "faceoff"; faceoffT = 3.2;
  document.body.classList.remove("playing");
  document.body.classList.remove("fsd");
  overlay.style.display = "none";
  overlay.classList.remove("results");
  overlay.classList.remove("faceoff");
  if (chatLog) chatLog.innerHTML = "";
  const title = document.getElementById("faceTitle");
  if (title) title.textContent = "P1 " + byId(selectedId).name + "  vs  " + opponentName() + " " + byId(botId).name;
  const sub = document.getElementById("faceSub");
  if (sub) sub.textContent = (fsd ? "FSD" : "MANUAL") + " · TAP ANYWHERE TO SKIP";
  if (faceLayer) faceLayer.classList.remove("hidden");
  if (pauseLayer) pauseLayer.classList.add("hidden");
  syncMenuUI();
  hud.classList.add("hidden");
  boostHud.classList.add("hidden");
  SFX.tick();
}
if (faceLayer) faceLayer.addEventListener("pointerdown", () => kickoffNow());
window.addEventListener("keydown", (e) => {
  if (mode === "faceoff" && (e.code === "Space" || e.code === "Enter" || e.code === "Escape")) kickoffNow();
});
document.getElementById("go").addEventListener("click", () => startGame(false));
const goFsd = document.getElementById("goFsd");
if (goFsd) goFsd.addEventListener("click", () => startGame(true));
function sayChat(i) {
  if (online) NET.send({ t: "chat", id: matchId, i });
  pushChat(online && NET.isGuest() ? "cpu" : "p1", CHAT[i % CHAT.length]);
  SFX.tick();
}
const chatEl = document.getElementById("chat");
if (chatEl) chatEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chat]");
  if (!btn) return;
  sayChat(Number(btn.dataset.chat));
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" || e.code === "KeyP") {
    if (mode === "play") { e.preventDefault(); togglePause(); }
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
  labA.textContent = byId(selectedId).name + ((guest ? peerFsd : fsd) ? " · FSD" : "");
  labB.textContent = byId(botId).name + ((online && (guest ? fsd : peerFsd)) ? " · FSD" : "");
  const button = document.getElementById("fsdToggle");
  button.textContent = "FSD: " + (fsd ? "ON" : "OFF");
  button.setAttribute("aria-pressed", String(fsd));
  button.classList.toggle("fsd", fsd);
  button.classList.toggle("ghost", !fsd);
  document.body.classList.toggle("fsd", mode === "play" && fsd);
}
document.getElementById("fsdToggle").addEventListener("click", () => {
  if (mode !== "play") return;
  fsd = !fsd;
  syncFsdUI();
  SFX.tick();
});
document.getElementById("menuBtn").addEventListener("click", () => togglePause());
function syncMenuUI() {
  document.getElementById("menuBtn").setAttribute("aria-expanded", String(!pauseLayer.classList.contains("hidden")));
}
function togglePause(force) {
  if (mode !== "play") return;
  if (online) {
    pauseLayer.classList.toggle("hidden", force === false ? true : !pauseLayer.classList.contains("hidden"));
    document.getElementById("pauseScore").textContent = "P1 " + scoreA + " — " + scoreB + " P2 · MATCH CONTINUES";
    syncMenuUI();
    return;
  }
  paused = force === undefined ? !paused : !!force;
  if (paused) {
    playing = false;
    SFX.pause();
    if (pauseLayer) {
      document.getElementById("pauseScore").textContent = "P1 " + scoreA + " — " + scoreB + " GROK";
      pauseLayer.classList.remove("hidden");
    }
  } else {
    playing = true;
    if (pauseLayer) pauseLayer.classList.add("hidden");
  }
  syncMenuUI();
}
function shareOnX() {
  const line = "P1 " + byId(selectedId).name + " " + scoreA + "-" + scoreB + " " + opponentName() + " " + byId(botId).name + " in GROKET LEAGUE (FSD Soccer). Built with Grok.";
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
  if (wantRematch && peerWantRematch) again.textContent = "STARTING…";
  else if (wantRematch) again.textContent = "WAITING…";
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
  rebuildGarage(); setInspect(selectedId);
  syncRematchUI();
  syncAudioUI();

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

}
document.getElementById("newGameBtn").addEventListener("click", returnToGarage);
document.getElementById("again").addEventListener("click", requestRematch);
document.getElementById("leaveBtn").addEventListener("click", returnToGarage);
window.render_game_to_text = () => JSON.stringify({
  mode, online, role: online ? (NET.isHost() ? "host" : "guest") : null,
  fsd, peerFsd, paused, menuOpen: !pauseLayer.classList.contains("hidden"), locked, matchId, cameraFollows: online && NET.isGuest() ? "B" : "P",
  coordinates: "x across pitch; y up; P starts at +z, B at -z",
  P, B, ball, scoreA, scoreB, timeLeft, netStatus: netStatus.textContent
});
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitRenderer();
});
