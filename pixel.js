/**
 * PIXEL mode — Pixel Forge castle pitch + 8-dir vehicle atlases + ball VFX.
 * Same sim bodies (x/z/yaw); no physics here.
 */
import { FW, FL } from "./catalog.js";

const CELL = 32;
const GUT = 1; // between cells only (no outer frame)
const ROW_OF = { cybertruck: 0, model3: 1, cybercab: 2, semi: 3 };

// ball_vfx_atlas.png row layout (1px magenta between rows)
const BALL = {
  ball16: { y: 0, size: 16, frames: 4 },
  ball24: { y: 17, size: 24, frames: 4 },
  shadow: { y: 42, size: 32, frames: 1 },
  boost: { y: 75, size: 32, frames: 8 },
  dust: { y: 108, size: 32, frames: 6 },
  goalburst: { y: 141, size: 32, frames: 8 },
  banner: { y: 174, size: 64, frames: 2 }
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load " + src));
    img.src = src;
  });
}

function yawToCol(yaw) {
  // forward: (-sin yaw, -cos yaw). atan2(fwdX,fwdZ):
  // yaw=0 → -z (screen up) → S; yaw=π → +z (screen down) → N
  const fwdX = -Math.sin(yaw);
  const fwdZ = -Math.cos(yaw);
  let ang = Math.atan2(fwdX, fwdZ);
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
  const VW = 216;
  const VH = 384;
  canvas.width = VW;
  canvas.height = VH;

  let active = false;
  let night = false;
  let ready = false;
  let pitchImg = null;
  let carsImg = null;
  let boostImg = null;
  let vfxImg = null;
  let tAnim = 0;

  Promise.all([
    loadImage("./assets/pixel/pitch.png"),
    loadImage("./assets/pixel/vehicles_8dir.png"),
    loadImage("./assets/pixel/vehicles_boost.png"),
    loadImage("./assets/pixel/ball_vfx.png")
  ]).then(([pitch, cars, boost, vfx]) => {
    pitchImg = pitch;
    carsImg = cars;
    boostImg = boost;
    vfxImg = vfx;
    ready = true;
  }).catch((err) => console.warn("[pixel]", err));

  function setActive(on) {
    active = !!on;
    canvas.style.display = on ? "block" : "none";
    document.body.classList.toggle("pixel-mode", on);
  }
  function setNight(on) { night = !!on; }
  function isActive() { return active; }

  function worldTo(x, z) {
    const padX = 18;
    const padTop = 28;
    const padBot = 28;
    const fieldW = VW - padX * 2;
    const fieldH = VH - padTop - padBot;
    return {
      sx: padX + (x / FW + 0.5) * fieldW,
      sy: padTop + (z / FL + 0.5) * fieldH,
      scale: fieldW / FW
    };
  }

  function drawPitch() {
    if (pitchImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pitchImg, 0, 0, VW, VH);
      if (night) {
        ctx.fillStyle = "rgba(8,16,48,0.28)";
        ctx.fillRect(0, 0, VW, VH);
      }
      return;
    }
    ctx.fillStyle = night ? "#0c1430" : "#3a6aaa";
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = night ? "#1e6b28" : "#2f9a3a";
    ctx.fillRect(20, 18, VW - 40, VH - 36);
  }

  function blitCar(kind, yaw, boosting, sx, sy, scale) {
    const row = ROW_OF[kind] ?? 1;
    const col = yawToCol(yaw);
    const sheet = boosting && boostImg ? boostImg : carsImg;
    if (!sheet) return false;
    const sx0 = col * (CELL + GUT);
    const sy0 = row * (CELL + GUT);
    const draw = Math.max(16, Math.min(40, scale * 3.4));
    ctx.drawImage(sheet, sx0, sy0, CELL, CELL, sx - draw / 2, sy - draw / 2, draw, draw);
    return true;
  }

  function drawCar(c) {
    if (!c) return;
    const { sx, sy, scale } = worldTo(c.x, c.z);
    if (!blitCar(c.kind, c.yaw, !!c.boosting, sx, sy, scale)) {
      ctx.fillStyle = "#3a6fff";
      ctx.fillRect(sx - 4, sy - 3, 8, 6);
    }
  }

  function blitVfx(rowKey, frame, dx, dy, dw, dh) {
    if (!vfxImg) return false;
    const row = BALL[rowKey];
    if (!row) return false;
    const f = ((frame % row.frames) + row.frames) % row.frames;
    const sx0 = f * (row.size + GUT);
    ctx.drawImage(vfxImg, sx0, row.y, row.size, row.size, dx, dy, dw, dh);
    return true;
  }

  function drawBall(ball) {
    if (!ball) return;
    const { sx, sy, scale } = worldTo(ball.x, ball.z);
    const r = Math.max(4, 0.6 * scale);
    const spin = Math.abs(ball.vx || 0) + Math.abs(ball.vz || 0);
    const frame = Math.floor((tAnim * 10 + spin * 0.15) % 4);

    blitVfx("shadow", 0, sx - r, sy + r * 0.35, r * 2, r);
    if (!blitVfx("ball24", frame, sx - r, sy - r, r * 2, r * 2)) {
      ctx.fillStyle = "#f4f0e6";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(label) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(4, 3, 110, 14);
    ctx.fillStyle = "#f0c020";
    ctx.font = "bold 8px monospace";
    ctx.fillText("GROKET · PIXEL", 8, 13);
    ctx.fillStyle = "#f7f1d0";
    ctx.font = "7px monospace";
    ctx.fillText(label || (night ? "TORCH NIGHT" : "CASTLE DAY"), VW - 72, 13);
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
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(VW / 2 - 42, VH / 2 - 8, 84, 16);
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.fillText("LOADING SPRITES…", VW / 2 - 38, VH / 2 + 3);
    }
  }

  return { canvas, setActive, setNight, isActive, draw };
}

export { createPixelView };


