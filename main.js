import * as THREE from "three";
import { CATALOG, byId } from "./catalog.js";
import { ensureAudio, SFX } from "./audio.js";
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
const PIX = 2.4;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
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
}
applyMap();
function cycleMap() { mapMode = mapMode === "day" ? "night" : "day"; applyMap(); }
mapBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); cycleMap(); });
bindInput(cycleMap);
bindTouch(document.getElementById("pad"), document.getElementById("knob"), document.getElementById("boostBtn"));
let selectedId = "cybertruck";
let hoverId = "cybertruck";
let botId = "model3";
let fsd = false;
const CHAT = [
  "L + ratio + no FSD",
  "skill issue. have you tried not being poor",
  "this is why FSD is taking so long",
  "imagine steering. couldn't be me",
  "the ball is a psyop",
  "nice demo. next quarter.",
  "you just got wss'd",
  "cope. seethe. Model 3.",
  "posted from the goal line",
  "thanks for the engagement",
  "unemployed behavior",
  "my other car is also juicing",
  "what color is your fridge",
  "I am become Semi, destroyer of nets",
  "touch grass. preferably the pitch",
  "the algorithm fed you to me",
  "this app is the app now",
  "you are not the main character",
  "supervised? brother I am the supervisor",
  "that touch was a software-defined brick"
];
let chatCool = 0;
let P = bodyFrom("cybertruck", 0, 14, 0);
let B = bodyFrom("model3", 0, -14, Math.PI);
let ball = { x: 0, y: 0.55, z: 0, vx: 0, vy: 0, vz: 0, flat: 0 };
let scoreA = 0, scoreB = 0, timeLeft = 90, playing = false, locked = false;
let mode = "garage";
let faceoffT = 0;
let last = performance.now();
let boostSfxCool = 0;
window.__controlsTest = { getYaw: () => P.yaw, getSpeed: () => Math.hypot(P.vx, P.vz), setKeys: (codes) => setQaKeys(codes) };
function toast(msg, ms = 900) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  window.setTimeout(() => toastEl.classList.remove("show"), ms);
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
    el.addEventListener("click", () => { selectedId = v.id; setInspect(v.id); rebuildGarage(); });
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
function swapMesh(old, id) {
  const n = makeVehicle(id);
  scene.add(n); scene.remove(old);
  return n;
}
function showResults(title, sub) {
  mode = "results"; playing = false;
  document.body.classList.remove("playing");
  document.body.classList.remove("fsd");
  overlay.style.display = "flex";
  overlay.classList.add("results");
  document.getElementById("resTitle").innerHTML = title;
  document.getElementById("resSub").textContent = sub;
}
function syncMesh(mesh, c) {
  mesh.position.set(c.x, 0, c.z);
  mesh.rotation.y = c.yaw + Math.PI;
}
async function onGoal(who) {
  if (locked) return;
  locked = true;
  SFX.goal(); SFX.crowd(who === "A"); shake = 0.55;
  if (who === "A") { scoreA++; toast(byId(selectedId).name + " GOAL"); }
  else { scoreB++; toast(byId(botId).name + " GOAL"); }
  scoreAEl.textContent = String(scoreA);
  scoreBEl.textContent = String(scoreB);
  if (scoreA >= 3 || scoreB >= 3) {
    setTimeout(() => {
      showResults(scoreA > scoreB ? byId(selectedId).name + "<br>WINS" : byId(botId).name + "<br>WINS", scoreA + " \u2014 " + scoreB);
      locked = false;
    }, 1100);
    return;
  }
  await new Promise((r) => setTimeout(r, 1000));
  resetKick(who === "A" ? 1 : -1);
  SFX.whistle(); locked = false;
}
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (playing && !locked) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0; SFX.whistle();
      const title = scoreA === scoreB ? "DRAW" : scoreA > scoreB ? byId(selectedId).name + "<br>WINS" : byId(botId).name + "<br>WINS";
      showResults(title, scoreA + " \u2014 " + scoreB);
    }
    const m = Math.floor(timeLeft / 60);
    const s = Math.floor(timeLeft % 60).toString().padStart(2, "0");
    clockEl.textContent = m + ":" + s;
    const ctl = readControls();
    if (fsd && Math.abs(ctl.throttle) < 0.2 && Math.abs(ctl.steer) < 0.2) {
      botAI(P, B, ball, dt);
      if (ctl.boost) drive(P, 0, 0, true, dt);
    } else {
      drive(P, ctl.throttle, ctl.steer, ctl.boost, dt);
    }
    if (P.boosting) { boostSfxCool -= dt; if (boostSfxCool <= 0) { SFX.boost(); boostSfxCool = 0.16; } }
    botAI(B, P, ball, dt);
    chatCool -= dt;
    if (fsd && chatCool <= 0 && Math.random() < dt * 0.28) {
      toast(CHAT[Math.floor(Math.random() * CHAT.length)], 1100);
      chatCool = 2.6;
    }
    if (carCar(P, B)) { SFX.hit(); shake = Math.max(shake, 0.2); }
    const h1 = carBall(P, ball); const h2 = carBall(B, ball);
    if (h1 === "pancake" || h2 === "pancake") { SFX.thunk(); shake = Math.max(shake, 0.35); }
    else if (h1 || h2) { SFX.hit(); shake = Math.max(shake, 0.16); }
    const g = stepBall(ball, dt); if (g) void onGoal(g);
  }
  boostFill.style.transform = "scaleX(" + P.boost / P.boostMax + ")";
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
    faceoffT -= dt;
    const sub = document.getElementById("faceSub");
    if (sub) sub.textContent = (fsd ? "FSD" : "MANUAL") + " \u00b7 " + Math.max(1, Math.ceil(faceoffT)) + " \u00b7 TAP TO SKIP";
    if (faceoffT <= 0) kickoffNow();
  } else {
    preview.visible = false; playerMesh.visible = true; botMesh.visible = true; ballMesh.visible = true;
    syncMesh(playerMesh, P); syncMesh(botMesh, B);
    const squash = ball.flat > 0 ? 0.45 : 1;
    ballMesh.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    ballMesh.position.set(ball.x, ball.y * squash + (squash < 1 ? 0.15 : 0), ball.z);
    ballMesh.rotation.x += ball.vz * 0.02; ballMesh.rotation.z -= ball.vx * 0.02;
    const { x: fx, z: fz } = forwardXZ(P.yaw);
    desired.set(P.x - fx * 11.5, 7.4, P.z - fz * 11.5);
    if (shake > 0) {
      desired.x += (Math.random() - 0.5) * shake * 1.4;
      desired.y += (Math.random() - 0.5) * shake * 0.8;
      shake = Math.max(0, shake - dt * 1.8);
    }
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    playLook.set(P.x * 0.55 + ball.x * 0.45, 0.6, P.z * 0.55 + ball.z * 0.45);
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
function kickoffNow() {
  if (mode !== "faceoff") return;
  mode = "play";
  playing = true;
  locked = false;
  document.body.classList.add("playing");
  document.body.classList.toggle("fsd", fsd);
  overlay.style.display = "none";
  overlay.classList.remove("faceoff");
  overlay.classList.remove("results");
  hud.classList.remove("hidden");
  boostHud.classList.remove("hidden");
  SFX.whistle();
  toast(fsd ? "FSD SUPERVISED" : "KICK OFF", 800);
}
function startGame(useFsd) {
  ensureAudio();
  fsd = !!useFsd;
  botId = pickBot();
  playerMesh = swapMesh(playerMesh, selectedId);
  botMesh = swapMesh(botMesh, botId);
  labA.textContent = byId(selectedId).name + (fsd ? " \u00b7 FSD" : " \u00b7 YOU");
  labB.textContent = byId(botId).name + " \u00b7 NPC";
  scoreA = 0; scoreB = 0; scoreAEl.textContent = "0"; scoreBEl.textContent = "0";
  timeLeft = 90; resetKick(0);
  playing = false; locked = false; mode = "faceoff"; faceoffT = 2.8;
  document.body.classList.remove("playing");
  document.body.classList.remove("fsd");
  overlay.style.display = "flex";
  overlay.classList.remove("results");
  overlay.classList.add("faceoff");
  const title = document.getElementById("faceTitle");
  if (title) title.textContent = byId(selectedId).name + " vs " + byId(botId).name;
  const sub = document.getElementById("faceSub");
  if (sub) sub.textContent = (fsd ? "FSD" : "MANUAL") + " \u00b7 TAP TO SKIP";
  hud.classList.add("hidden");
  boostHud.classList.add("hidden");
  SFX.tick();
}
overlay.addEventListener("pointerdown", (e) => {
  if (mode !== "faceoff") return;
  if (e.target.closest("button")) return;
  kickoffNow();
});
window.addEventListener("keydown", (e) => {
  if (mode === "faceoff" && (e.code === "Space" || e.code === "Enter")) kickoffNow();
});
document.getElementById("go").addEventListener("click", () => startGame(false));
const goFsd = document.getElementById("goFsd");
if (goFsd) goFsd.addEventListener("click", () => startGame(true));
function sayChat(i) {
  toast(CHAT[i % CHAT.length], 1200);
  SFX.tick();
}
const chatEl = document.getElementById("chat");
if (chatEl) chatEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chat]");
  if (!btn) return;
  sayChat(Number(btn.dataset.chat));
});
window.addEventListener("keydown", (e) => {
  if (!playing) return;
  if (e.code === "Digit1") sayChat(0);
  if (e.code === "Digit2") sayChat(1);
  if (e.code === "Digit3") sayChat(2);
  if (e.code === "Digit4") sayChat(3);
});
document.getElementById("again").addEventListener("click", () => {
  overlay.classList.remove("results");
  overlay.classList.remove("faceoff");
  mode = "garage";
  document.body.classList.remove("playing");
  document.body.classList.remove("fsd");
  hud.classList.add("hidden"); boostHud.classList.add("hidden");
  setInspect(selectedId);
});
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitRenderer();
});
