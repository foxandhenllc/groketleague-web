import { configHash, compatibilityFields, compatible, compatibleSetup, VERSION_MESSAGE } from './net-protocol.js';
import { createEventStream } from './sim-events.js';
import { makeArenaState, stepSink, resetSinkRound, sinkHeight, sinkSurface, SINK } from './sink.js';
import { makeSinkScene } from './sink-scene.js';
import { sinkCameraFrame, createSinkDirector } from './sink-camera.js';
import { makeSinkGoal, advanceSinkGoal } from './sink-goal.js';
import { makeSoap, updateSoap } from './soap-scene.js';
import { initSoap } from './soap-physics.js';
import { sinkFeedback } from './sink-feedback.js';
import { movePhase, timingCue, moveDescriptions } from './skills.js';
import { createCup, createCupPacing, CUP_RULES } from './cup.js';
import { createCoach } from './coach-controller.js';
import { createProgression } from './progression.js';
import { createCupUI } from './cup-ui.js';
import { paintRoofDecal } from './cosmetic-art.js';
import { coachObservation } from './agent-observation.js';
import { simulationConfig } from './simulation-config.js';
import { boostLabel } from './boost.js';
import { kickoffLayout, driverPersonality } from './match-variety.js';
import { createPlayCamera } from './chase-camera.js';
let matchSeed = '';
const rulesHash = await configHash();
diagnostics.enabled = location.hash === "#diagnostics";
window.exportSimulationTrace = () => diagnostics.export({rulesHash, mode:gfxMode, tick:simTick});
const rules = compatibilityFields(rulesHash);
const impactStream = createEventStream();
let roundEpoch = 0, simTick = 0;
const impactMarks = [];
let impactSoundTimes = [];
let lastBoostActive = false;
function consumeImpacts(events) {
  const now = performance.now();
  for (const e of events.sort((a,b)=>b.impulse-a.impulse)) {
    impactMarks.push({ ...e, until: now + (e.timed || e.save ? 300 : 140) });
    if(e.timed || e.save) {
      const who=e.pair.startsWith('P:')?'p1':'cpu';
      toast(e.save ? 'SAVE!' : 'PERFECT TOUCH!', 700, who);
      e.save ? SFX.save() : SFX.perfect();
    }
    while (impactMarks.length > 2) impactMarks.shift();
    impactSoundTimes = impactSoundTimes.filter(t=>now-t<1000);
    if (impactSoundTimes.length < 4 && e.closing >= (e.type === 'carHit' ? 2 : 1)) {
      e.heavyBoost ? SFX.thunk() : SFX.hit(); impactSoundTimes.push(now);
    }
  }
}
import * as THREE from "three";
import * as NET from "./net.js";
import { CATALOG, byId } from "./catalog.js";
import { ensureAudio, SFX, startCrowd, stopCrowd, playBed, isMusicMuted, isSfxMuted, setMusicMuted, setSfxMuted } from "./audio.js";
import { bindInput, bindTouch, readControls, setQaKeys, clearInput, chooseTactic, triggerSpecial } from "./input.js";
import { makeVehicle, makeBall } from "./vehicles.js";
import { makeField, lamps } from "./field.js";
import { setSink, bodyFrom, stepBall, coastCars, botAI, forwardXZ, setPixelTight, getBallRadius, getField, solveContacts, resetContacts, diagnostics } from "./sim.js";
import { createPhysicsClock } from "./physics-clock.js";
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
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
function fitRenderer(sink = false) {
  const divisor = sink ? Math.max(1,innerWidth/1600,innerHeight/1000) : PIX;
  const w = Math.max(320, Math.floor(innerWidth / divisor));
  const h = Math.max(180, Math.floor(innerHeight / divisor));
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.imageRendering = sink ? "auto" : "pixelated";
}
fitRenderer();
document.body.prepend(renderer.domElement);
renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); console.warn("[groket] webgl lost"); }, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 220);
const camTarget = new THREE.Vector3();
const playCamera = createPlayCamera(camera);
const garageCam = new THREE.Vector3(6.4, 3.1, 9.2);
const garageLook = new THREE.Vector3(0, 1.05, 6);
const faceCam = new THREE.Vector3(0, 12.5, 24);
const faceLook = new THREE.Vector3(0, 0.6, 0);
const ballCue=document.createElement('div');
ballCue.id='ballCue';ballCue.hidden=true;ballCue.setAttribute('aria-hidden','true');
document.body.append(ballCue);
const cuePoint=new THREE.Vector3(),cueEdge=new THREE.Vector3(),cueDirection=new THREE.Vector3();
const cueRay=new THREE.Raycaster();
let cueOccluded=false,cueAge=1;
function updateBallCue(dt){
  if(mode!=='play'||pixelView.isActive()||paused||goalCelebration||!pauseLayer.classList.contains('hidden')){ballCue.hidden=true;return;}
  camera.updateMatrixWorld();
  const floor=mapMode==='sink'?sinkHeight(ball.x,ball.z):0;
  const visual=soapMode()?soapMesh.userData.body.position:{x:ball.x,y:ball.y+floor,z:ball.z};
  cuePoint.set(visual.x,visual.y,visual.z).project(camera);
  cueEdge.set(visual.x+getBallRadius(),visual.y,visual.z).project(camera);
  const x=(cuePoint.x+1)*innerWidth/2,y=(1-cuePoint.y)*innerHeight/2;
  const top=soapMode()?sinkFrame.rect.top+8:mapMode==='sink'?(innerHeight<500?24:122):innerHeight<500?132:150;
  const bottom=soapMode()?sinkFrame.rect.bottom-8:innerHeight-(mapMode==='sink'?(innerHeight<500?24:182):100);
  const left=soapMode()?sinkFrame.rect.left+8:24,right=soapMode()?sinkFrame.rect.right-8:innerWidth-24;
  const behind=cuePoint.z>1||cuePoint.z< -1;
  const edge=behind||x<left||x>right||y<top||y>bottom;
  cueAge+=dt;
  if(!soapMode()&&cueAge>=.1){
    cueAge=0;scene.updateMatrixWorld(true);
    cueDirection.set(visual.x,visual.y,visual.z).sub(camera.position);
    cueRay.set(camera.position,cueDirection.clone().normalize());
    cueRay.far=Math.max(0,cueDirection.length()-getBallRadius()*.8);
    cueOccluded=cueRay.intersectObjects([playerMesh,botMesh,mapMode==='sink'?sinkScene.root:fieldRoot],true).length>0;
  }
  const tiny=Math.abs(cueEdge.x-cuePoint.x)*innerWidth<14;
  ballCue.hidden=soapMode()?!edge:!(edge||cueOccluded||tiny);
  if(ballCue.hidden)return;
  ballCue.classList.toggle('edge',edge);
  ballCue.textContent='';
  ballCue.style.left=Math.max(left,Math.min(right,behind?innerWidth-x:x))+'px';
  ballCue.style.top=Math.max(top,Math.min(bottom,behind?innerHeight-y:y))+'px';
  const angle=Math.atan2(y-innerHeight/2,x-innerWidth/2)+(behind?Math.PI:0);
  ballCue.style.transform=`translate(-50%,-50%) rotate(${edge?angle:0}rad)`;
}
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
const sinkScene=makeSinkScene(scene);
let goalCelebration=null, goalPresentation=null, goalViewId='', goalViewAge=0, goalSoundId='', goalSoundPhase=-1, goalCaptureId='';
const goalCaption=document.getElementById('sinkGoalCaption');
const sinkDirector=createSinkDirector();
let lastSoapLaunch=0,lastSoapLanding=0,lastSoapRelease=0;
let arenaState=makeArenaState(), drainAnimation=0, lastHazardToken='', lastSinkWarning='', lastFaucetCue='';
const sinkCameraPosition=new THREE.Vector3(),sinkCameraTarget=new THREE.Vector3();
let sinkFrame=sinkCameraFrame(innerWidth,innerHeight),sinkViewKey='';
const sinkUp=new THREE.Vector3(),sinkTilt=new THREE.Quaternion(),sinkYaw=new THREE.Quaternion(),worldUp=new THREE.Vector3(0,1,0);
let playerMesh = makeVehicle("cybertruck");
let botMesh = makeVehicle("model3");
const ballMesh = makeBall();
const soapMesh=makeSoap();soapMesh.visible=false;
scene.add(playerMesh, botMesh, ballMesh,soapMesh);
playerMesh.frustumCulled = false;
botMesh.frustumCulled = false;
ballMesh.frustumCulled = false;
const preview = new THREE.Group();
let previewMesh = makeVehicle("cybertruck");
preview.add(previewMesh);
preview.position.set(0, 0, 6);
scene.add(preview);
const maps = {
  sink: { label:'KITCHEN SINK',bg:'#354b59',fogN:70,fogF:160,hemi:['#d8f6ff','#78604c',1.7],sun:1.5,fill:.7,lamp:0,turf:'#ffffff' },
  day: { label: "CASTLE DAY", bg: "#3a6aaa", fogN: 42, fogF: 115, hemi: ["#b8d8ff", "#5a3a18", 1.05], sun: 1.25, fill: 0.48, lamp: 18, turf: "#ffffff" },
  night: { label: "TORCH NIGHT", bg: "#0c1430", fogN: 28, fogF: 95, hemi: ["#4a6aaa", "#1a1020", 0.5], sun: 0.12, fill: 0.22, lamp: 48, turf: "#ffffff" }
};
let mapMode = "sink";
const pixelView = createPixelView();
let gfxMode = "3d";
setPixelTight(gfxMode === "pixel");
function syncGfxUI() {
  document.getElementById("gfx3d")?.classList.toggle("on", gfxMode === "3d");
  document.getElementById("gfxPixel")?.classList.toggle("on", gfxMode === "pixel");
  document.getElementById('gfx3d')?.setAttribute('aria-pressed',String(gfxMode==='3d'));
  document.getElementById('gfxPixel')?.setAttribute('aria-pressed',String(gfxMode==='pixel'));
}
function setGfxMode(g) {
  gfxMode = g === "pixel" ? "pixel" : "3d";
  setPixelTight(gfxMode === "pixel");
  syncGfxUI();
  syncArenaDescription();
  syncHomeMatch();
  mapTag.textContent = mapMode === "sink" ? "KITCHEN SINK" : gfxMode === "pixel" ? (mapMode === "night" ? "AFTER HOURS" : "CIRCUIT 01") : maps[mapMode].label;
  mapBtn.textContent = "MAP: " + (mapMode === "sink" ? "KITCHEN SINK" : gfxMode === "pixel" ? (mapMode === "night" ? "AFTER HOURS" : "CIRCUIT DAY") : maps[mapMode].label);
  syncPixelVisibility();
}
function syncPixelVisibility() {
  const want = gfxMode === "pixel" && (mode === "play" || mode === "faceoff" || mode === "results" || mode.startsWith('cup-'));
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
    impacts: impactMarks.filter(e => e.until > performance.now()),
    sink:mapMode==='sink',arenaState,
    drainProgress:mapMode==='sink'&&locked?Math.min(1,(performance.now()-drainAnimation)/700):0,
    localIsBot: online && NET.isGuest()
  });
}
let mode = "garage";
let online = false, netPending = false, matchId = "", sessionSerial = 0;
let cup = null, cupCoaches = null, cupReward = null, cupSaves = 0, cupPacing = null;
let guestStorage; try { guestStorage = localStorage; } catch {}
const progression = createProgression(guestStorage);
let wantRematch = false, peerWantRematch = false;
let localChoice = "cybertruck", remoteInput = { throttle: 0, steer: 0, boost: false };
let lastPacket = 0, lastInput = 0;
let reconnectTimer = 0, reconnecting = false;
let lastGoalCard = null, bestGoalCard = null, lastGoalBy = null;
const opponentName = () => online ? "P2" : cup ? "CPU RIVAL" : "GROK";
const localBody = () => online && NET.isGuest() ? B : P;
const soapMode = () => mapMode==='sink'&&gfxMode==='3d';
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
  for (const id of ["netQuick", "netCreate", "netJoin", "roomCodeIn", "toMatchup", "backVehicle", "modeLocal", "modeQuick", "modePrivate", "go", "playNow", "cupLaunch", "mapBtn", "gfx3d", "gfxPixel", "specsToggle", "settingsToggle", "collectionToggle", "howOpen"]) {
    const el = document.getElementById(id);
    if (el) el.disabled = !!value;
  }
  for(const button of document.querySelectorAll('[data-arena],[data-light]'))button.disabled=!!value;
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
  clearInput(); impactMarks.length = 0; impactStream.reset(roundEpoch);
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
  showGarageStep("matchup",true);
  setMatchMode("local");
});
document.getElementById("backVehicle")?.addEventListener("click", () => {
  if (netPending || online) return;
  showGarageStep("vehicle",true);
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
      queueMicrotask(()=>{showGarageStep('matchup');setMatchMode('private');input.focus();});
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
    if (NET.isGuest()) NET.send({ t: "hello", car: localChoice, ...rules, clientId });
  },
  onHello(msg) {
    if (!NET.isHost() || matchId || !validCar(msg.car)) return;
    if (!compatible(msg, rulesHash)) { NET.send({t:'versionError'}); netMessage(VERSION_MESSAGE); return; }
    if (msg.clientId && msg.clientId === clientId) {
      netMessage("CAN'T MATCH YOURSELF - WAITING FOR ANOTHER PLAYER");
      try { NET.kickPeer?.() || NET.destroy?.(); } catch (_) {}
      // Stay in queue as host if possible ' soft reject
      leaveNetwork("SELF-MATCH BLOCKED - TRY QUICK MATCH AGAIN");
      return;
    }
    matchId = crypto.randomUUID();
    NET.send({ t: "start", ...rules, phase: "setup", id: matchId, a: localChoice, b: msg.car, map: mapMode, gfx: gfxMode });
  },
  onVersionError() { netMessage(VERSION_MESSAGE); },
  onEventAck(msg) { if (NET.isHost() && msg.id === matchId && msg.epoch === roundEpoch) impactStream.acknowledge(msg.ids); },
  onStart(msg) {
    notePacket();
    if (!compatibleSetup(msg, rulesHash, NET.isHost() ? gfxMode : undefined)) { netMessage(VERSION_MESSAGE); return; }
    if (NET.isGuest() && msg.phase === "setup" && !online && typeof msg.id === "string" && validCar(msg.a) && validCar(msg.b)) {
      matchId = msg.id;
      startGame(false, msg);
      NET.send({ t: "start", ...rules, phase: "ready", id: matchId, a: msg.a, b: msg.b, map: msg.map, gfx: gfxMode });
    } else if (NET.isHost() && msg.phase === "ready" && msg.id === matchId && !online && msg.a === localChoice && validCar(msg.b)) {
      startGame(false, { ...msg, gfx: gfxMode });
      sendSnapshot();
    }
  },
  onInput(msg) {
    if (!online || !NET.isHost() || msg.id !== matchId) return;
    const clamp = n => Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
    remoteInput = { throttle: clamp(msg.throttle), steer: clamp(msg.steer), boost: msg.boost === true, tactic: ['attack','defend'].includes(msg.tactic)?msg.tactic:'auto', special:msg.special===true, fsd: msg.fsd === true };
    if (peerFsd !== remoteInput.fsd) { peerFsd = remoteInput.fsd; syncFsdUI(); }
    lastInput = performance.now(); notePacket();
  },
  onState(msg) {
    if (!online || !NET.isGuest() || msg.id !== matchId) return;
    if (![msg.P, msg.B, msg.ball].every(c => c && [c.x, c.z, c.vx, c.vz].every(Number.isFinite))) return;
    notePacket();
    if (peerFsd !== (msg.fsdA === true)) { peerFsd = msg.fsdA === true; syncFsdUI(); }
    if (!Number.isInteger(msg.epoch) || msg.epoch < roundEpoch) return;
    if (msg.epoch > roundEpoch) { roundEpoch = msg.epoch; lastHazardToken=''; lastSinkWarning=''; lastFaucetCue=''; impactStream.reset(roundEpoch); impactMarks.length = 0; }
    const delivered = impactStream.receive(roundEpoch, msg.events);
    consumeImpacts(delivered.events);
    NET.send({t:'eventAck',id:matchId,epoch:roundEpoch,ids:delivered.ack});
    if(msg.arenaState)arenaState=msg.arenaState;
    goalCelebration=msg.goalCelebration||null;
    Object.assign(P, msg.P); Object.assign(B, msg.B); Object.assign(ball, msg.ball);
    if (msg.scoreA > scoreA || msg.scoreB > scoreB) {
      drainAnimation=performance.now();
      if(!soapMode()) {
        SFX.goal(); if(mapMode==='sink')SFX.drain(); SFX.crowd(msg.scoreB > scoreB);
        toast(msg.scoreA > scoreA ? "P1 GOAL" : "P2 GOAL", 1100, msg.scoreA > scoreA ? "p1" : "cpu");
      }
    }
    scoreA = msg.scoreA; scoreB = msg.scoreB; timeLeft = msg.timeLeft; locked = msg.locked;
    faceoffT = msg.faceoffT;
    scoreAEl.textContent = String(scoreA); scoreBEl.textContent = String(scoreB);
    if (msg.mode === "play" && mode === "faceoff") {kickoffNow(true);locked=msg.locked;}
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
    if (!compatibleSetup(msg, rulesHash, gfxMode) || typeof msg.nextId !== "string") { netMessage(VERSION_MESSAGE); return; }
    if (!online || msg.id !== matchId) return;
    if (!validCar(msg.a) || !validCar(msg.b)) return;
    beginRematch(msg);
  },
  onDrop: () => softDisconnect(),
  onBusy: () => disconnected("ROOM IS FULL - TRY ANOTHER CODE"),
  onError: err => disconnected(err.message || "Connection lost. Try again.")
});
function sendSnapshot() {
  NET.send({ t: "st", id: matchId, ...impactStream.packet(), P, B, ball, arenaState, goalCelebration, scoreA, scoreB, timeLeft, locked, mode, faceoffT, fsdA: fsd, fsdB: peerFsd });
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
function syncArenaDescription() {
  document.getElementById('arenaDescription').textContent=mapMode!=='sink'?'Car soccer on the stadium pitch.':gfxMode==='3d'
    ?'Slide soap into the opposing drain. Ride the banks for airtime; dodge the marked meteor and lightning strikes.'
    :'Sink the ball into the opposing drain. Slippery steel, faucet currents and wild hazards keep it moving.';
}
function syncHomeMatch() {
  const sink=mapMode==='sink',title=sink?'Kitchen Sink':'Stadium',view=gfxMode==='3d'?'3D':'2D';
  const image=document.getElementById('homeArenaImage');
  image.src='/assets/menu/'+(sink?'sink':'classic')+'.webp';
  image.alt=sink?'The Kitchen Sink arena with two drain goals and a running faucet':'The castle stadium and its soccer pitch';
  document.getElementById('homeArenaTitle').textContent=title;
  document.getElementById('homeModeTag').textContent=view+' · VS GROK'+(mapMode==='night'?' · NIGHT':'');
  document.getElementById('homeArenaHint').textContent=sink?(gfxMode==='3d'?'Slippery soap. Big air. Down the drain.':'Drain goals. Wild hazards. Top-down chaos.'):'A classic pitch. A very unconventional team.';
  document.getElementById('homeMatchSummary').textContent=view+' · You vs Grok · First to 3';
  document.getElementById('playNow').innerHTML='Play '+title+' <span aria-hidden="true">&#8594;</span>';
  document.getElementById('go').textContent='Play '+title;
}
function applyMap() {
  const sink=mapMode==='sink';mapBtn.hidden=true;document.body.classList.toggle('sink-mode',sink);setSink(sink);fieldRoot.visible=!sink;sinkScene.root.visible=sink;
  for(const button of document.querySelectorAll('[data-arena]')) {
    const selected=button.dataset.arena===(sink?'sink':'classic');button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));
  }
  for(const button of document.querySelectorAll('[data-light]')) {
    const selected=button.dataset.light===mapMode;button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));
  }
  document.getElementById('stadiumLighting').hidden=sink;
  syncArenaDescription();
  syncHomeMatch();
  fitRenderer(sink);
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
  mapTag.textContent = mapMode === "sink" ? "KITCHEN SINK" : gfxMode === "pixel" ? (mapMode === "night" ? "AFTER HOURS" : "CIRCUIT 01") : m.label;
  mapBtn.textContent = "MAP: " + (mapMode === "sink" ? "KITCHEN SINK" : gfxMode === "pixel" ? (mapMode === "night" ? "AFTER HOURS" : "CIRCUIT DAY") : m.label);
  if (mode === "play" || mode === "faceoff") playBed(mapMode === "night" ? "night" : "day");
}
applyMap();
function cycleMap() { if (online || netPending || cup || mapMode==='sink') return; mapMode = mapMode === "day" ? "night" : "day"; applyMap(); }
for(const button of document.querySelectorAll('[data-arena]'))button.addEventListener('click',()=>{if(online||netPending||mode!=='garage')return;mapMode=button.dataset.arena==='sink'?'sink':'day';applyMap();});
for(const button of document.querySelectorAll('[data-light]'))button.addEventListener('click',()=>{if(online||netPending||mode!=='garage'||mapMode==='sink')return;mapMode=button.dataset.light==='night'?'night':'day';applyMap();});
mapBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); cycleMap(); });
document.getElementById("gfx3d")?.addEventListener("click", () => {if(!netPending&&!online&&mode==='garage')setGfxMode("3d");});
document.getElementById("gfxPixel")?.addEventListener("click", () => {if(!netPending&&!online&&mode==='garage')setGfxMode("pixel");});
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
let P = bodyFrom("cybertruck", 0, 14, 0);
let B = bodyFrom("model3", 0, -14, Math.PI);
let ball = { x: 0, y: 0.55, z: 0, vx: 0, vy: 0, vz: 0, flat: 0 };
let scoreA = 0, scoreB = 0, timeLeft = 90, playing = false, locked = false, paused = false;
let faceoffT = 0;
let last = performance.now();
const physicsClock = createPhysicsClock(simulateMatch);
const cupUI = createCupUI({ onDirective: value => cup?.choose(value), onAction: chooseCupAction, onNext: nextCupHeat, onExit: returnToGarage, onEquip: equipDecal });
cupUI.collection(progression.view);
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
const vehicleDescriptions = {
  cybertruck: ['Heavy hitter', 'Strong boosted touches, with slower acceleration and turning.'],
  model3: ['Fast attacker', 'The fastest vehicle, with quick acceleration and responsive handling.'],
  cybercab: ['Agile runner', 'The lightest vehicle and quickest turner, with a smaller boost reserve.'],
  semi: ['Heavy defender', 'The largest and heaviest vehicle. Covers more space, but moves slowly.']
};
function setInspect(id) {
  const v = byId(id);
  const spec = bodyFrom(id,0,0,0);
  document.getElementById("inspName").textContent = v.name;
  document.getElementById("inspMeme").textContent = vehicleDescriptions[id][1];
  document.getElementById("inspStats").innerHTML = '<dl>' + [
    ['Mass', spec.mass], ['Top speed', spec.max + ' units/s'],
    ['Acceleration', spec.accel + ' units/s squared'], ['Turn rate', spec.turn + ' rad/s'],
    ['Grip', spec.grip], ['Boost reserve', spec.boostMax], ['Size', spec.w + ' x ' + spec.l + ' units'], ['Signature move', moveDescriptions[id]]
  ].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('') + '</dl>';
  document.getElementById("inspName").style.color = "";
  if (hoverId !== id) {
    hoverId = id;
    preview.remove(previewMesh);
    previewMesh = makeVehicle(id);
    preview.add(previewMesh);
    SFX.tick();
  }
  paintRoofDecal(previewMesh, id, progression.view.equipped);
  [...garageEl.children].forEach((el) => el.classList.toggle("on", el.dataset.id === selectedId));
}
function rebuildGarage() {
  garageEl.innerHTML = "";
  for (const v of CATALOG) {
    const el = document.createElement("button");
    el.type = "button";
    el.setAttribute("aria-pressed", String(v.id === selectedId));
    el.className = "card" + (v.id === selectedId ? " on" : "");
    el.dataset.id = v.id;
    el.innerHTML = `<img src="/assets/menu/${v.id}.webp" alt="" width="224" height="128" /><span class="carCopy"><span class="title">${v.name}</span><span class="tag">${vehicleDescriptions[v.id][0]}</span></span>`;
    el.addEventListener("click", () => {
      if (netPending || online) return;
      selectedId = localChoice = v.id;
      setInspect(v.id);
      rebuildGarage();
      garageEl.querySelector(`[data-id="${selectedId}"]`)?.focus({preventScroll:true});
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
  strip.textContent = v ? ("YOUR RIDE · " + v.name) : "";
}
function showGarageStep(step,focus=false) {
  const vehicle = document.getElementById("stepVehicle");
  const matchup = document.getElementById("stepMatchup");
  if (!vehicle || !matchup) return;
  const onMatch = step === "matchup";
  vehicle.hidden = onMatch;
  matchup.hidden = !onMatch;
  if (onMatch) syncLockedVehicle();
  document.getElementById('garageShell').scrollTop=0;
  if(focus)document.getElementById(onMatch?'backVehicle':'playNow')?.focus({preventScroll:true});
}
function setMatchMode(mode) {
  const localPane = document.getElementById("localPane");
  const privatePane = document.getElementById("privatePane");
  for (const id of ["modeLocal", "modeQuick", "modePrivate"]) {
    const btn = document.getElementById(id);
    if (btn) {btn.classList.toggle("on", btn.dataset.mode === mode);btn.setAttribute('aria-pressed',String(btn.dataset.mode===mode));}
  }
  if (localPane) localPane.hidden = mode !== "local";
  if (privatePane) privatePane.hidden = mode !== "private";
}
rebuildGarage();
setInspect("cybertruck");
function resetKick() {
  cancelCupInterventions();
  cupPacing?.reset();
  goalCelebration=null;goalPresentation=null;goalViewId='';goalViewAge=0;
  lastSoapLaunch=0;lastSoapLanding=0;lastSoapRelease=0;
  clearInput(); resetContacts(); impactMarks.length = 0;
  impactStream.reset(++roundEpoch);
  arenaState=mapMode==='sink'&&roundEpoch>1?resetSinkRound(arenaState):makeArenaState(matchSeed+roundEpoch);
  lastHazardToken=''; lastSinkWarning=''; lastFaucetCue='';
  const round = roundEpoch - 1, layout = kickoffLayout(matchSeed, round);
  P = bodyFrom(selectedId, layout.P.x, layout.P.z, layout.P.yaw);
  B = bodyFrom(botId, layout.B.x, layout.B.z, layout.B.yaw);
  if (!online) P.cosmetic = progression.view.equipped;
  P.personality = driverPersonality(selectedId, matchSeed, round, 'P');
  B.personality = driverPersonality(botId, matchSeed, round, 'B');
  ball = { ...layout.ball, y: getBallRadius(), vx: 0, vy: gfxMode === "pixel" ? 0 : 6, vz: 0, flat: 0 };
  if(soapMode())initSoap(ball);
}
function markTeam(mesh, color) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, 20), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  ring.name='skill-ring'; ring.userData.teamColor=color;
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06; ring.userData.decoration = true;
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
  if (![c.x,c.z,c.vx,c.vz,c.yaw,c.boost].every(Number.isFinite)) diagnostics.count("carRepair");
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
  if (![b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite) || b.y > 18) diagnostics.count("ballRepair");
  if (!Number.isFinite(b.x)) b.x = 0;
  if (!Number.isFinite(b.y) || b.y < getBallRadius()) b.y = getBallRadius();
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
  mesh.position.set(c.x, mapMode==='sink'?sinkHeight(c.x,c.z):0, c.z);
  if(mapMode==='sink') {
    const surface=sinkSurface(c.x,c.z,arenaState);
    sinkUp.set(-surface.slopeX,1,-surface.slopeZ).normalize();
    sinkTilt.setFromUnitVectors(worldUp,sinkUp);sinkYaw.setFromAxisAngle(worldUp,c.yaw);
    mesh.quaternion.copy(sinkTilt).multiply(sinkYaw);
  } else mesh.rotation.set(0, c.yaw, 0);
  const ring=mesh.getObjectByName('skill-ring'), phase=movePhase(c);
  if(ring) { ring.material.color.set(phase==='windup'?'#ff784e':phase==='active'?'#ffffff':ring.userData.teamColor); ring.scale.setScalar(phase==='ready'?1:1.6); }
  mesh.children.filter(child => child.name === "boost-exhaust").forEach(child => { child.visible = !!c.boosting; });
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

function makeShareCard(line, currentFrame=false) {
  const card = document.createElement("canvas");
  card.width = 1200; card.height = 630;
  const ctx = card.getContext("2d");
  ctx.fillStyle = "#14305a"; ctx.fillRect(0, 0, 1200, 630);
  try {
    if(currentFrame) {
      // Reuse the frame just rendered instead of blocking drain entry with a second render/readback.
      const source=renderer.domElement,fit=Math.min(1200/source.width,630/source.height);
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(source,(1200-source.width*fit)/2,(630-source.height*fit)/2,source.width*fit,source.height*fit);
    } else if (gfxMode === "pixel") {
      paintPixelFrame();
      const source = pixelView.canvas;
      const fit = Math.min(1200 / source.width, 630 / source.height);
      ctx.drawImage(source, (1200 - source.width * fit) / 2, (630 - source.height * fit) / 2, source.width * fit, source.height * fit);
    } else {
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
    }
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
function captureGoalStill(who, currentFrame=false) {
  try {
    const scorer = who === "A" ? (playerLabel() + " " + byId(selectedId).name) : (opponentName() + " " + byId(botId).name);
    const line = scorer + " GOAL - " + scoreA + "-" + scoreB + " - GROKET LEAGUE";
    const card = makeShareCard(line,currentFrame);
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
  if (reconnecting) { pip.className = "sig-wait"; pip.textContent = "RECONNECTING"; return; }
  if (age < 250) { pip.className = ""; pip.textContent = "LIVE"; }
  else if (age < 1200) { pip.className = "sig-mid"; pip.textContent = "LAG"; }
  else { pip.className = "sig-bad"; pip.textContent = "WEAK"; }
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
  locked = true; drainAnimation=performance.now();
  cancelCupInterventions();
  if(!soapMode())captureGoalStill(who);
  if(!soapMode()){SFX.goal(); if(mapMode==='sink')SFX.drain(); SFX.crowd(who === "A");}
  if (who === "A") { scoreA++; if(!soapMode())toast("P1 GOAL - " + byId(selectedId).name, 1100, "p1"); }
  else { scoreB++; if(!soapMode())toast(opponentName() + " GOAL - " + byId(botId).name, 1100, "cpu"); }
  scoreAEl.textContent = String(scoreA);
  scoreBEl.textContent = String(scoreB);
  if(soapMode()) {
    goalCelebration=makeSinkGoal(ball,who,matchSeed+':'+roundEpoch,scoreA>=3||scoreB>=3);
    toastEl.classList.remove('show');
    clearInput();
    return;
  }
  if (!cup && (scoreA >= 3 || scoreB >= 3)) {
    setTimeout(() => {
      if (serial !== sessionSerial) return;
      finishMatch();
      locked = false;
    }, 1100);
    return;
  }
  await new Promise((r) => setTimeout(r, 700));
  if (serial !== sessionSerial) return;
  resetKick();
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
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      stepGame(dt);
    }, 50);
  } else if (!on && hostSimPump) {
    clearInterval(hostSimPump);
    hostSimPump = 0;
  }
}
function tick(now) {
  requestAnimationFrame(tick);
  // Background online host is driven by ensureHostSimPump (rAF is throttled/paused).
  if (document.hidden && online && NET.isHost()) return;
  const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  stepGame(dt);
}
function simulateMatch(dt) {
  if(playing&&locked&&goalCelebration&&!paused&&!(online&&NET.isGuest())) {
    coastCars([P,B],dt);
    if(advanceSinkGoal(goalCelebration,dt)) {
      if(goalCelebration.winning){finishMatch();locked=false;}
      else {resetKick();locked=false;SFX.whistle();}
    }
    return;
  }
  if (playing && !locked && !paused && !(online && NET.isGuest())) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0; SFX.whistle();
      if (cup) finishCupHeat(); else finishMatch();
      return;
    }
    const m = Math.floor(timeLeft / 60);
    const s = Math.floor(timeLeft % 60).toString().padStart(2, "0");
    clockEl.textContent = m + ":" + s;
    const ctl = online && pauseLayer && !pauseLayer.classList.contains("hidden") ? { throttle: 0, steer: 0, boost: false } : readControls();
    // FSD steers; human chooses boost timing, tactics and signature moves.
    if (cupCoaches && cup?.phase === 'heat') {
      const a = cupCoaches.A.beforeStep(dt, P, B, ball, -1, getField());
      const b = cupCoaches.B.beforeStep(dt, B, P, ball, 1, getField());
      botAI(P, B, ball, dt, -1, a.boost, a); cupCoaches.A.afterStep(P);
      botAI(B, P, ball, dt, 1, b.boost, b); cupCoaches.B.afterStep(B);
    } else {
      botAI(P, B, ball, dt, -1, !!ctl.boost, ctl);
      if (online) {
      const input = performance.now() - lastInput < 500 ? remoteInput : { throttle: 0, steer: 0, boost: false };
      botAI(B, P, ball, dt, 1, !!input.boost, input);
      } else botAI(B, P, ball, dt, 1);
    }
    if (matchChatIdle > 0) {
      matchChatIdle -= dt;
      if (matchChatIdle <= 0 && matchChat) matchChat.classList.add("idle");
    }
    if(mapMode==='sink')stepSink(arenaState,[P,B],ball,dt);
    const events = impactStream.emit(solveContacts([P, B], ball, dt));
    if (cup) cupSaves += events.filter(e => e.save && e.pair.startsWith('P:')).length;
    consumeImpacts(events);
    simTick++;
    if (diagnostics.enabled) diagnostics.record({tick:simTick,input:[!!ctl.boost,!!remoteInput.boost],
      P:{...P,_boost:{...P._boost},_ai:{...P._ai,target:{...P._ai.target}}},B:{...B,_boost:{...B._boost},_ai:{...B._ai,target:{...B._ai.target}}},ball:{...ball},events});
    const g = stepBall(ball, dt);
    if (g) void onGoal(g);
    else if (cupPacing?.step(ball, dt)) { resetKick(); toast('FSD RECALIBRATING', 1100); }
  }
}
const impactLines = Array.from({length:2}, () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3));
  const line = new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#fff4ce',depthTest:false}));
  line.visible=false; line.frustumCulled=false; line.renderOrder=10; scene.add(line); return line;
});
function updateImpactMeshes() {
  const active=impactMarks.filter(e=>e.until>performance.now());
  impactLines.forEach((line,i)=>{
    const e=active[i]; line.visible=!!e && !pixelView.isActive(); if(!e)return;
    const length=.35+Math.min(1,e.closing/25)*.55;
    const y=e.y+(mapMode==='sink'?sinkHeight(e.x,e.z):0);
    line.geometry.attributes.position.array.set([e.x-e.nz*.3,y,e.z+e.nx*.3,e.x+e.nz*.3,y,e.z-e.nx*.3,
      e.x,y,e.z,e.x+e.nx*length,y,e.z+e.nz*length]);
    line.geometry.attributes.position.needsUpdate=true;
  });
}
function updateGoalPresentation(dt) {
  const goal=soapMode()?goalCelebration:null;
  toastEl.hidden=!!goal;
  if(goal) {
    if(goalViewId!==goal.id){goalViewId=goal.id;goalViewAge=goal.age;}
    else if(online&&NET.isGuest())goalViewAge=Math.min(goal.duration,goal.age+.1,Math.max(goal.age,goalViewAge+dt));
    else goalViewAge=goal.age;
    goalPresentation={...goal,age:goalViewAge};
    if(!paused&&mode==='play') {
      const phase=goalViewAge<.75?0:goalViewAge<1.25?1:2;
      if(goalSoundId!==goal.id||goalSoundPhase!==phase) {
        goalSoundId=goal.id;goalSoundPhase=phase;
        if(phase===0)SFX.soapCatch();
        else if(phase===1)SFX.drain();
        else {SFX.goal();SFX.bubbles();SFX.crowd(goal.team===(online&&NET.isGuest()?'B':'A'));}
      }
    }
  } else {goalPresentation=null;goalViewId='';goalViewAge=0;}
  goalCaption.hidden=!goal||mode!=='play'||paused;
  if(!goalCaption.hidden&&goalCaption.dataset.goal!==goal.id) {
    goalCaption.dataset.goal=goal.id;goalCaption.dataset.team=goal.team;
    goalCaption.querySelector('strong').textContent=goal.team==='A'?'AMBER SCORES!':'CYAN SCORES!';
    goalCaption.querySelector('span').textContent=goal.winning?'SQUEAKY CLEAN VICTORY!':['DOWN THE DRAIN!','SOAP, THERE IT IS!','A CLEAN FINISH!'][roundEpoch%3];
  }
  if(soapMode()&&!paused&&!goal&&mode==='play'&&ball.soap) {
    if(ball.soap.launches>lastSoapLaunch)SFX.soapAir();
    if(ball.soap.landings>lastSoapLanding)SFX.soapLand();
    if(ball.soap.releaseT>lastSoapRelease+.25)SFX.soapSlip();
    lastSoapLaunch=ball.soap.launches;lastSoapLanding=ball.soap.landings;lastSoapRelease=ball.soap.releaseT;
  }
}
function stepGame(dt) {
  try {
  if (cup && (cup.phase === 'draft' || cup.phase === 'reveal')) {
    cup.advance(dt);
    if (cup.phase === 'heat') beginCupHeat();
  }
  if (playing && (!locked||goalCelebration) && !paused && !(online && NET.isGuest())) physicsClock.advance(dt);
  else physicsClock.reset();
  cupUI.update(cup?.view, cupCoaches ? { A: cupCoaches.A.view, B: cupCoaches.B.view } : null, progression.view, cupReward, { playing, paused, car: selectedId });
  const me = localBody();
  if (me.boosting && !lastBoostActive) SFX.boost();
  lastBoostActive = !!me.boosting;
  clockEl.textContent = Math.floor(timeLeft / 60) + ":" + Math.floor(timeLeft % 60).toString().padStart(2, "0");
  if (boostFill && me.boostMax) boostFill.style.transform = "scaleX(" + Math.max(0, Math.min(1, me.boost / me.boostMax)) + ")";
  if (boostLab) boostLab.textContent = boostLabel(me);
  const boostButton = document.getElementById('boostBtn');
  const controls = readControls(), phase = movePhase(me), move = simulationConfig.skills.moves[me.kind];
  for(const b of document.querySelectorAll('[data-tactic]')) b.setAttribute('aria-pressed',String(controls.tactic===b.dataset.tactic));
  const specialButton=document.getElementById('specialBtn');
  const cooling=(me.move?.cooldown||0)>0;
  specialButton.textContent=move.name + (cooling ? ' '+Math.ceil(me.move.cooldown)+'s' : ' [E]');
  specialButton.title=moveDescriptions[me.kind]+' Press E or tap.';
  specialButton.disabled=cooling || locked || paused;
  specialButton.dataset.phase=phase;
  const cue=playing && !locked && !paused && timingCue(me,ball,getBallRadius());
  boostButton?.classList.toggle('timing',cue);
  if(cue && !me.boosting && boostLab) boostLab.textContent='BURST NOW';
  const pressed = mode === 'play' && !paused && pauseLayer.classList.contains('hidden') && readControls().boost;
  boostButton?.classList.toggle('hot', !!pressed);
  boostButton?.setAttribute('aria-pressed', String(!!pressed));
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
    ballMesh.position.set(ball.x, ball.y+(mapMode==='sink'?sinkHeight(ball.x,ball.z):0), ball.z);
    if(mapMode==='sink'&&locked){const drop=Math.min(1,(performance.now()-drainAnimation)/700);ballMesh.position.y-=drop*3;ballMesh.scale.setScalar(Math.max(.01,1-drop));}
    faceCam.z=online && NET.isGuest() ? -24 : 24;
    if(mapMode!=='sink') {
      camera.position.lerp(faceCam, 1 - Math.pow(0.002, dt));
      camTarget.lerp(faceLook, 1 - Math.pow(0.002, dt));
    }
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
    ballMesh.position.set(ball.x, ball.y+(mapMode==='sink'?sinkHeight(ball.x,ball.z):0), ball.z);
    if(mapMode==='sink'&&locked){const drop=Math.min(1,(performance.now()-drainAnimation)/700);ballMesh.position.y-=drop*3;ballMesh.scale.setScalar(Math.max(.01,1-drop));}
    ballMesh.rotation.x += ball.vz * dt / getBallRadius(); ballMesh.rotation.z -= ball.vx * dt / getBallRadius();
    repairCar(me);
    repairBall(ball);
    if (!paused && mapMode!=='sink') playCamera.update(camTarget, me, ball, getField(), dt, online && NET.isGuest() ? -1 : 1);
  }
  if (mode === 'garage' || mode === 'faceoff') {
    playCamera.reset();
    camera.lookAt(camTarget);
  }
  if (![camera.position.x,camera.position.y,camera.position.z,camTarget.x,camTarget.y,camTarget.z].every(Number.isFinite)) {
    camera.position.set(0,22,24);camTarget.set(0,1,0);playCamera.reset();camera.lookAt(camTarget);
  }
  // Keep the pitch legible when portrait framing raises the camera.
  if(scene.fog){const m=maps[mapMode],lift=Math.max(0,camera.position.y-18);scene.fog.near=m.fogN+lift;scene.fog.far=m.fogF+lift;}
  updateGoalPresentation(dt);
  soapMesh.visible=soapMode()&&mode!=='garage';
  if(soapMesh.visible) {
    ballMesh.visible=false;
    updateSoap(soapMesh,ball,{time:arenaState.time,dt,reducedMotion:reducedMotion.matches,goal:goalPresentation,interpolate:online&&NET.isGuest()});
  }
  if(mapMode==='sink' && mode!=='garage') {
    const viewKey=innerWidth+':'+innerHeight;
    if(sinkViewKey!==viewKey) {
      sinkFrame=sinkCameraFrame(innerWidth,innerHeight,camera.fov);sinkViewKey=viewKey;
      camera.setViewOffset(innerWidth,innerHeight,sinkFrame.offsetX,sinkFrame.offsetY,innerWidth,innerHeight);
    }
    if(soapMode()) {
      const p=soapMesh.userData.body.position;
      const framing=sinkDirector.update(sinkFrame,{x:p.x,y:p.y,z:p.z,vx:ball.vx,vz:ball.vz},goalPresentation,paused?0:dt,reducedMotion.matches);
      camera.position.fromArray(framing.position);camTarget.fromArray(framing.target);
    } else {
      sinkCameraPosition.fromArray(sinkFrame.position);
      camera.position.lerp(sinkCameraPosition,reducedMotion.matches?1:1-Math.exp(-dt*5));
      camTarget.lerp(sinkCameraTarget,reducedMotion.matches?1:1-Math.exp(-dt*5));
    }
    camera.lookAt(camTarget);
  } else {sinkDirector.reset();if(sinkViewKey){camera.clearViewOffset();sinkViewKey='';}}
  if(mapMode==='sink'&&!pixelView.isActive())sinkScene.update(arenaState,{cars:[P,B],ball,reducedMotion:reducedMotion.matches,goal:goalPresentation});
  const hazardEl=document.getElementById('hazardNotice'), h=arenaState.hazard;
  hazardEl.hidden=mapMode!=='sink'||mode!=='play'||locked;
  if(!hazardEl.hidden) {
    const feedback=sinkFeedback(arenaState,me,ball);
    if(hazardEl.textContent!==feedback.text)hazardEl.textContent=feedback.text;
    hazardEl.dataset.kind=feedback.kind;
    if(!paused) {
      const hazardToken=roundEpoch+':'+h?.id;
      if(h&&!h.fired&&lastSinkWarning!==hazardToken){lastSinkWarning=hazardToken;SFX.hazardWarning();}
      if(h?.fired&&lastHazardToken!==hazardToken){lastHazardToken=hazardToken;h.kind==='meteor'?SFX.meteor():SFX.zap();}
      const phase=arenaState.faucet?.phase,token=roundEpoch+':'+Math.floor(arenaState.time/SINK.faucetCycle)+':'+phase;
      if(lastFaucetCue!==token){lastFaucetCue=token;if(phase==='warning')SFX.tapWarning();else if(phase==='flow')SFX.water();}
    }
  }
  updateBallCue(dt);
  updateImpactMeshes();
  if (!pixelView.isActive()) renderer.render(scene, camera);
  if(soapMode()&&mode==='play'&&!paused&&goalPresentation?.age>=.35&&goalCaptureId!==goalPresentation.id) {
    goalCaptureId=goalPresentation.id;captureGoalStill(goalPresentation.team,true);
  }
  paintPixelFrame();
  } catch (err) {
    console.error("[groket tick]", err);
    ballCue.hidden=true;
    if (diagnostics.enabled) { paused = true; playing = false; locked = true; netMessage('Simulation stopped - export diagnostic trace'); return; }
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
  toast(mapMode==='sink'?'LET THAT SINK IN':gfxMode === "pixel" ? (online && NET.isGuest() ? "YOU ARE CYAN" : "YOU ARE AMBER") : (online ? (NET.isGuest() ? "P2 - BLUE GOAL" : "P1 - YELLOW GOAL") : "KICK OFF"), 1100, online && NET.isGuest() ? "cpu" : "p1");
}
function cancelCupInterventions(text) {
  cupCoaches?.A.cancel(text); cupCoaches?.B.cancel(text);
}
function endCup() {
  cancelCupInterventions(); cup?.cancel();
  cup = null; cupCoaches = null; cupReward = null; cupSaves = 0; cupPacing = null;
  document.body.classList.remove('cup-mode');
  cupUI.update(null, null, progression.view, null, { playing: false, paused: false, car: selectedId });
}
function startCup() {
  if (online || netPending) return;
  setGfxMode('pixel'); mapMode = 'day'; applyMap();
  startGame(true);
  cup = createCup({ id: crypto.randomUUID() }); cupSaves = 0; cupPacing = createCupPacing();
  mode = 'cup-draft'; playing = false; paused = true; timeLeft = CUP_RULES.heatSeconds;
  faceLayer.classList.add('hidden'); document.body.classList.add('cup-mode');
  syncTeamLabels(); syncPixelVisibility();
  document.getElementById('fsdHint').textContent = 'FSD drives. Arm Boost or a signature move only during an offered opening.';
  cupUI.update(cup.view, null, progression.view, null, { playing, paused, car: selectedId });
}
function beginCupHeat() {
  if (cup?.phase !== 'heat') return;
  resetKick(); physicsClock.reset();
  scoreA = 0; scoreB = 0; scoreAEl.textContent = '0'; scoreBEl.textContent = '0';
  timeLeft = CUP_RULES.heatSeconds;
  const view = cup.view, scope = `${view.id}:${view.heat}`;
  cupCoaches = {
    A: createCoach({ type: 'human', seat: 'A', scope, tactic: view.pick, charges: view.allowances.A }),
    B: createCoach({ type: 'cpu', seat: 'B', scope, tactic: view.rival, charges: view.allowances.B })
  };
  mode = 'faceoff'; faceoffT = 0; kickoffNow(true);
}
function chooseCupAction(action) {
  if (!playing || paused || locked || cup?.phase !== 'heat') return false;
  const offer = cupCoaches.A.view.offer;
  return !!offer && cupCoaches.A.choose(offer.id, action);
}
function finishCupHeat() {
  if (!cup?.finishHeat(scoreA, scoreB)) return;
  cancelCupInterventions('Heat ended - charge kept'); clearInput(); sessionSerial++;
  playing = false; paused = true; locked = false; physicsClock.reset();
  mode = cup.phase === 'complete' ? 'cup-results' : 'cup-summary';
  document.body.classList.remove('playing', 'fsd'); hud.classList.add('hidden');
  stopCrowd(); playBed('garage');
  if (cup.phase === 'complete') {
    const view = cup.view;
    cupReward = progression.completeCup({ id: view.id, heats: view.heats, saves: cupSaves });
    cupUI.collection(progression.view);
  }
}
function nextCupHeat() {
  if (cup?.phase === 'complete') { startCup(); return; }
  if (!cup?.nextHeat()) return;
  cancelCupInterventions(); cupCoaches = null; clearInput(); sessionSerial++;
  playing = false; paused = true; locked = false; mode = 'cup-draft';
  hud.classList.add('hidden');
}
function equipDecal(id) {
  if (!progression.equip(id)) return;
  paintRoofDecal(previewMesh, hoverId, id);
  if (!online) { P.cosmetic = id; paintRoofDecal(playerMesh, selectedId, id); }
  cupUI.collection(progression.view);
}
window.addEventListener('keydown', e => {
  if (e.repeat || e.isComposing || e.ctrlKey || e.altKey || e.metaKey || cup?.phase !== 'heat' || paused || !playing) return;
  if (e.target.closest('input, textarea, [contenteditable], #pauseLayer, #cupLayer')) return;
  const action = e.code === 'KeyE' ? 'special' : ['Space','ShiftLeft','ShiftRight'].includes(e.code) ? 'boost' : null;
  if (!action || e.code === 'Space' && e.target.closest('button')) return;
  e.preventDefault(); chooseCupAction(action);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && cup?.phase === 'heat' && !paused && playing) togglePause(true); });
function startGame(useFsd, config = null) {
  endCup();
  document.getElementById('fsdHint').textContent = 'FSD always drives. You only hold BOOST / Ludicrous Mode.';
  closeQcMenu();
  chooseTactic('auto');
  lastGoalCard = null; bestGoalCard = null; lastGoalBy = null;
  clearReconnect();
  if (config) {
    // Both peers must render the host's field and ball dimensions.
    if (config.gfx === "pixel" || config.gfx === "3d") setGfxMode(config.gfx);
    online = true; setNetPending(false);
    selectedId = config.a; botId = config.b;
    mapMode = ["night","sink"].includes(config.map) ? config.map : "day"; applyMap();
    remoteInput = { throttle: 0, steer: 0, boost: false };
    lastInput = performance.now(); notePacket();
    netMessage("ONLINE 1v1 CONNECTED");
  } else { localChoice = selectedId; leaveNetwork(); }
  sessionSerial++;
  document.querySelector(".scorebox.cpu .who").textContent = opponentName() + (online && NET.isGuest() ? " - YOU" : "");
  document.querySelector(".scorebox.p1 .who").textContent = "P1" + (online && NET.isHost() ? " - YOU" : "");
  syncTeamLabels();
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
  fsd = true; // boost-only: FSD always on
  peerFsd = true;
  physicsClock.reset();
  if (!config) botId = pickBot();
  playerMesh = swapMesh(playerMesh, selectedId, "#f0c020");
  botMesh = swapMesh(botMesh, botId, "#3a6fff");
  if (!online) paintRoofDecal(playerMesh, selectedId, progression.view.equipped);
  syncFsdUI();
  scoreA = 0; scoreB = 0; scoreAEl.textContent = "0"; scoreBEl.textContent = "0";
  roundEpoch = 0; simTick = 0; diagnostics.reset();
  matchSeed = online ? matchId : crypto.randomUUID();
  timeLeft = 90; resetKick();
  playing = false; locked = false; paused = false; mode = "faceoff"; faceoffT = 1.6;
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
document.getElementById('playNow').addEventListener('click',()=>{if(mode==='garage'&&!netPending&&!online)startGame(true);});
document.getElementById('cupLaunch').addEventListener('click', startCup);
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
  if(qcMenu.contains(document.activeElement))qcToggle.focus({preventScroll:true});
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
function backQcMenu() {
  if(qcView==='root')closeQcMenu();
  else {qcView='root';renderQcMenu();}
  SFX.tick();
}
function selectQcNumber(number) {
  if(qcMenu.classList.contains('hidden')) {
    if(number<1||number>CHAT_CATS.length)return;
    openQcMenu();
  }
  // Activate the same numbered choice as a click, using the current folder.
  qcMenu.querySelector(`[data-qc-key="${number}"]`)?.click();
}
function renderQcMenu() {
  if (!qcMenu) return;
  qcMenu.innerHTML = "";
  if (qcView === "root") {
    CHAT_CATS.forEach((cat,i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qc cat";
      b.textContent = (i+1)+' - '+cat.label;
      b.dataset.qcKey = String(i+1);
      b.dataset.cat = cat.id;
      qcMenu.appendChild(b);
    });
  } else {
    const catId = qcView.slice(4);
    const cat = CHAT_CATS.find((c) => c.id === catId);
    const back = document.createElement("button");
    back.type = "button";
    back.className = "qc back";
    back.textContent = "0 - BACK";
    back.title = "Back to categories (0 or Backspace)";
    back.dataset.qcKey = '0';
    back.dataset.back = "1";
    qcMenu.appendChild(back);
    if (cat) {
      const base = CHAT_CATS.slice(0, CHAT_CATS.indexOf(cat)).reduce((n, c) => n + c.lines.length, 0);
      cat.lines.forEach((line, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "qc line";
        b.textContent = (i + 1) + " - " + line;
        b.dataset.qcKey = String(i+1);
        b.dataset.chat = String(base + i);
        qcMenu.appendChild(b);
      });
    }
  }
}
if (qcToggle) {
  qcToggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (!playing || paused || !pauseLayer.classList.contains('hidden')) return;
    if (qcMenu && !qcMenu.classList.contains("hidden")) closeQcMenu();
    else openQcMenu();
    SFX.tick();
  });
}
if (qcMenu) {
  qcMenu.addEventListener("click", (e) => {
    if(!playing||paused||!pauseLayer.classList.contains('hidden'))return;
    const btn = e.target.closest("button.qc");
    if (!btn) return;
    if (btn.dataset.back) {
      backQcMenu();
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
  if(e.defaultPrevented||e.repeat||e.isComposing||e.ctrlKey||e.altKey||e.metaKey)return;
  if(e.target?.isContentEditable||e.target?.closest?.('input, textarea, select, [role="textbox"]'))return;
  if (e.code === "Escape" || e.code === "KeyP") {
    if (mode === "play") {
      e.preventDefault();
      if (qcMenu && !qcMenu.classList.contains("hidden")) closeQcMenu();
      else togglePause();
    }
    return;
  }
  if (!playing || paused || !pauseLayer.classList.contains('hidden')) return;
  const number=/^(?:Digit|Numpad)([0-9])$/.exec(e.code)?.[1];
  if(e.code==='Backspace'||number==='0') {
    if(!qcMenu.classList.contains('hidden')){e.preventDefault();backQcMenu();}
    return;
  }
  if(number){e.preventDefault();selectQcNumber(Number(number));}
});
function syncFsdUI() {
  syncTeamLabels();
  labA.textContent = byId(selectedId).name;
  labB.textContent = byId(botId).name;
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
  clearInput();
  if (mode !== "play") return;
  cancelCupInterventions('Paused - charge kept');
  closeQcMenu();
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
  if (config.nextId) matchId = config.nextId;
  wantRematch = false; peerWantRematch = false;
  syncRematchUI();
  startGame(fsd, { a: config.a, b: config.b, map: ["night","sink"].includes(config.map) ? config.map : "day", gfx: config.gfx });
}
function maybeStartRematch() {
  if (!online || !NET.isHost() || !wantRematch || !peerWantRematch || mode !== "results") return;
  const payload = { t: "rx", id: matchId, nextId: crypto.randomUUID(), ...rules, a: selectedId, b: botId, map: mapMode, gfx: gfxMode };
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
  endCup();
  applyIdentityUI();
  if (online || netPending) leaveNetwork();
  sessionSerial++;
  wantRematch = false; peerWantRematch = false;
  paused = false; playing = false; mode = "garage";
  goalCelebration=null;goalPresentation=null;
  stopCrowd(); playBed("garage");
  pauseLayer.classList.add("hidden"); faceLayer.classList.add("hidden");
  syncMenuUI();
  overlay.style.display = "flex"; overlay.classList.remove("results", "faceoff");
  document.body.classList.remove("playing", "fsd");
  hud.classList.add("hidden"); boostHud.classList.add("hidden");
  syncPixelVisibility();
  rebuildGarage(); setInspect(selectedId);
  showGarageStep('vehicle',true);setMatchMode('local');syncHomeMatch();
  syncRematchUI();
  syncAudioUI();

}
function maybeShowHow() {
  const layer = document.getElementById("howLayer");
  if (!layer) return;
  layer.classList.remove("hidden");
  document.getElementById('howGotIt').focus();
}
function dismissHow() {
  const layer = document.getElementById("howLayer");
  if (layer) layer.classList.add("hidden");
  try { localStorage.setItem("gl_seen_how", "1"); } catch {}
  if(mode==='garage')document.getElementById('howOpen').focus();
}
document.getElementById("howGotIt")?.addEventListener("click", dismissHow);
document.getElementById("howLayer")?.addEventListener("click", (e) => { if (e.target.id === "howLayer") dismissHow(); });
document.getElementById('howLayer').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();dismissHow();}
  if(e.key==='Tab'){e.preventDefault();document.getElementById('howGotIt').focus();}
});
document.getElementById('howOpen').addEventListener('click',maybeShowHow);
for(const [buttonId,panelId] of [['specsToggle','inspect'],['settingsToggle','garageSettings'],['collectionToggle','collection']]) {
  const button=document.getElementById(buttonId),panel=document.getElementById(panelId);
  button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));});
}

for (const b of document.querySelectorAll('[data-tactic]')) b.addEventListener('click',()=>chooseTactic(b.dataset.tactic));
document.getElementById('specialBtn').addEventListener('click',triggerSpecial);
document.getElementById("newGameBtn").addEventListener("click", returnToGarage);
document.getElementById("again").addEventListener("click", requestRematch);
document.getElementById("leaveBtn").addEventListener("click", returnToGarage);
window.render_game_to_text = () => JSON.stringify({
  mode, gfxMode, mapMode, arenaState, goalCelebration, goalPresentation, online, role: online ? (NET.isHost() ? "host" : "guest") : null,
  fsd, peerFsd, paused, menuOpen: !pauseLayer.classList.contains("hidden"), locked, matchId, cameraFollows: soapMode()?'soap-director':mapMode==='sink'?'arena':online && NET.isGuest() ? "B" : "P",
  coordinates: "x across pitch; y up; P starts at +z, B at -z",
  P, B, ball, scoreA, scoreB, timeLeft, rulesHash, roundEpoch, matchSeed,
  faceoffName: kickoffLayout(matchSeed, Math.max(0,roundEpoch-1)).name,
  diagnostics: diagnostics.export({tick:simTick}).counters, netStatus: netStatus.textContent,
  cup: cup?.view || null, cupRecalibrations: cupPacing?.resets || 0, coaches: cupCoaches ? { A: cupCoaches.A.view, B: cupCoaches.B.view } : null, progression: progression.view
});
window.coach_observation_to_text = () => cup?.phase === 'heat' ? JSON.stringify(coachObservation({
  cup: cup.view, seat: 'A', coach: cupCoaches.A.view, car: P, foe: B, ball, timeLeft, scoreA, scoreB, roundEpoch, field: getField()
})) : null;


function playerLabel(opts = {}) {
  const u = getXUser();
  if (u && u.username) {
    if (opts.withAt === false) return u.username;
    if (opts.preferName && u.name) return u.name;
    return "@" + u.username;
  }
  return opts.guest || "P1";
}
function syncTeamLabels() {
  const guest = online && NET.isGuest();
  const label = playerLabel({ guest: gfxMode === "pixel" ? "YOU" : guest ? "P2" : "P1" });
  document.getElementById("hudP1Who").textContent = guest ? "P1" : label;
  document.querySelector(".scorebox.cpu .who").textContent = guest ? label : opponentName();
  document.getElementById("faceP1Tag").textContent = (guest ? "P1" : label) + (gfxMode === "pixel" ? " - AMBER GOAL" : " - YELLOW GOAL");
  document.querySelector(".cputag").textContent = (guest ? label : opponentName()) + (gfxMode === "pixel" ? " - CYAN GOAL" : " - BLUE GOAL");
  document.body.classList.toggle("cyan-player", guest);
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
  syncTeamLabels();
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
  fitRenderer(mapMode==='sink');
  sinkViewKey='';
});


