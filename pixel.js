/**
 * PIXEL mode — Pixel Forge SNES castle pitch + 8-dir vehicle atlases.
 * Same sim bodies (x/z/yaw); no physics here.
 */
import { FW, FL } from "./catalog.js";

const CELL = 64;
const GUTTER = 1;
const ATLAS_COLS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const ROW_OF = { cybertruck: 0, model3: 1, cybercab: 2, semi: 3 };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load " + src));
    img.src = src;
  });
}

function yawToCol(yaw) {
  // forwardXZ: (-sin yaw, -cos yaw). atan2(fwdX, fwdZ):
  // yaw=0 → faces -z (screen up) → S; yaw=π → +z (screen down) → N
  const fwdX = -Math.sin(yaw);
  const fwdZ = -Math.cos(yaw);
  let ang = Math.atan2(fwdX, fwdZ); // [-π, π], 0 = +z = N
  if (ang < 0) ang += Math.PI * 2;
  return Math.round((ang / (Math.PI * 2)) * 8) % 8;
}

function createPixelView() {
  const canvas = document.createElement("canvas");
  canvas.id = "pixelView";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "0",
    display: "none",
    imageRendering: "pixelated",
    background: "#0c1430",
    pointerEvents: "none"
  });
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const VW = 384;
  const VH = 216;
  canvas.width = VW;
  canvas.height = VH;

  let active = false;
  let night = false;
  let ready = false;
  let pitchImg = null;
  let carsImg = null;
  let boostImg = null;
  let tAnim = 0;

  loadImage("./assets/pixel/pitch.png")
    .then((img) => { pitchImg = img; return loadImage("./assets/pixel/vehicles_8dir.png"); })
    .then((img) => { carsImg = img; return loadImage("./assets/pixel/vehicles_boost.png"); })
    .then((img) => { boostImg = img; ready = true; })
    .catch((err) => console.warn("[pixel]", err));

  function setActive(on) {
    active = !!on;
    canvas.style.display = on ? "block" : "none";
    document.body.classList.toggle("pixel-mode", on);
  }
  function setNight(on) { night = !!on; }
  function isActive() { return active; }

  function worldTo(x, z) {
    // Pitch art is full-bleed; map field to inset playable grass (~10% margin)
    const padX = 28;
    const padTop = 22;
    const padBot = 20;
    const fieldW = VW - padX * 2;
    const fieldH = VH - padTop - padBot;
    return {
      sx: padX + (x / FW + 0.5) * fieldW,
      sy: padTop + (z / FL + 0.5) * fieldH,
      scale: fieldW / FW
    };
  }

  function drawFallbackPitch() {
    ctx.fillStyle = night ? "#0c1430" : "#3a6aaa";
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = night ? "#1e6b28" : "#2f9a3a";
    ctx.fillRect(20, 18, VW - 40, VH - 36);
    ctx.strokeStyle = "#f7f1d0";
    ctx.strokeRect(20, 18, VW - 40, VH - 36);
    ctx.beginPath();
    ctx.moveTo(VW / 2, 18);
    ctx.lineTo(VW / 2, VH - 18);
    ctx.stroke();
  }

  function drawPitch() {
    if (pitchImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pitchImg, 0, 0, VW, VH);
      if (night) {
        ctx.fillStyle = "rgba(8,16,48,0.28)";
        ctx.fillRect(0, 0, VW, VH);
      }
    } else {
      drawFallbackPitch();
    }
  }

  function blitCar(kind, yaw, boosting, sx, sy, scale) {
    const row = ROW_OF[kind] ?? 1;
    const col = yawToCol(yaw);
    const sheet = boosting && boostImg ? boostImg : carsImg;
    if (!sheet) return false;
    const sx0 = GUTTER + col * (CELL + GUTTER);
    const sy0 = GUTTER + row * (CELL + GUTTER);
    const draw = Math.max(14, Math.min(36, scale * 3.2));
    ctx.drawImage(sheet, sx0, sy0, CELL, CELL, sx - draw / 2, sy - draw / 2, draw, draw);
    return true;
  }

  function drawCar(c) {
    if (!c) return;
    const { sx, sy, scale } = worldTo(c.x, c.z);
    const ok = blitCar(c.kind, c.yaw, !!c.boosting, sx, sy, scale);
    if (ok) return;
    // tiny fallback rect if sheets still loading
    ctx.fillStyle = "#3a6fff";
    ctx.fillRect(sx - 4, sy - 3, 8, 6);
  }

  function drawBall(ball) {
    if (!ball) return;
    const { sx, sy, scale } = worldTo(ball.x, ball.z);
    const r = Math.max(3, 0.55 * scale);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx + 1, sy + 2, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f0e6";
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    const spin = (ball.vx || 0) + (ball.vz || 0) + tAnim * 8;
    const a = spin * 0.4;
    ctx.fillRect(sx + Math.cos(a) * r * 0.35 - 1, sy + Math.sin(a) * r * 0.35 - 1, 2, 2);
    ctx.fillRect(sx - Math.cos(a) * r * 0.4 - 1, sy - Math.sin(a) * r * 0.4 - 1, 2, 2);
  }

  function drawHud(label) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(4, 3, 110, 14);
    ctx.fillStyle = "#f0c020";
    ctx.font = "bold 8px monospace";
    ctx.fillText("GROKET · PIXEL", 8, 13);
    ctx.fillStyle = "#f7f1d0";
    ctx.font = "7px monospace";
    const tag = label || (night ? "TORCH NIGHT" : "CASTLE DAY");
    ctx.fillText(tag, VW - 72, 13);
  }

  function draw(state) {
    if (!active) return;
    tAnim = (tAnim + 0.016) % 1000;
    ctx.imageSmoothingEnabled = false;
    drawPitch();
    drawCar(state.bot);
    drawCar(state.player);
    drawBall(state.ball);
    drawHud(state.mapLabel);
    if (!ready) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(VW / 2 - 40, VH / 2 - 8, 80, 16);
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.fillText("LOADING SPRITES…", VW / 2 - 36, VH / 2 + 3);
    }
  }

  return { canvas, setActive, setNight, isActive, draw };
}

export { createPixelView };
