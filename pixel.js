/**
 * PIXEL mode — Pixel Forge castle pitch + 8-dir vehicle atlases + ball VFX.
 * Same sim bodies (x/z/yaw). Playable area maps to grass inset (not walls/sky).
 */
import { FW, FL } from "./catalog.js";

const CELL = 32;
const GUT = 1;
const ROW_OF = { cybertruck: 0, model3: 1, cybercab: 2, semi: 3 };

// pitch_216x384.png — Pixel Forge physics_clamp (inclusive xyxy)
const CLAMP = { x0: 24, y0: 44, x1: 191, y1: 339 };

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
    const gw = CLAMP.x1 - CLAMP.x0;
    const gh = CLAMP.y1 - CLAMP.y0;
    return {
      sx: CLAMP.x0 + (x / FW + 0.5) * gw,
      sy: CLAMP.y0 + (z / FL + 0.5) * gh,
      scale: gw / FW
    };
  }

  function drawPitch() {
    if (pitchImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pitchImg, 0, 0, VW, VH);
      if (night) {
        ctx.fillStyle = "rgba(8,16,48,0.22)";
        ctx.fillRect(0, 0, VW, VH);
      }
      return;
    }
    ctx.fillStyle = "#0c1430";
    ctx.fillRect(0, 0, VW, VH);
  }

  function blitCar(c, sx, sy, scale) {
    const row = ROW_OF[c.kind] ?? 1;
    const col = yawToCol(c.yaw);
    const sheet = c.boosting && boostImg ? boostImg : carsImg;
    if (!sheet) return false;
    const sx0 = col * (CELL + GUT);
    const sy0 = row * (CELL + GUT);
    // Hug the art (~75% of the 32px cell); skip 1px in case magenta gutter bleeds
    const worldLen = Number.isFinite(c.l) ? c.l : 4;
    const draw = Math.max(10, Math.min(26, worldLen * scale * 0.72));
    ctx.drawImage(sheet, sx0 + 1, sy0 + 1, CELL - 2, CELL - 2, sx - draw / 2, sy - draw / 2, draw, draw);
    return true;
  }

  function drawCar(c) {
    if (!c) return;
    const { sx, sy, scale } = worldTo(c.x, c.z);
    if (!blitCar(c, sx, sy, scale)) {
      ctx.fillStyle = "#3a6fff";
      ctx.fillRect(sx - 3, sy - 2, 6, 4);
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
    const r = Math.max(3, 0.45 * scale);
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
    ctx.fillStyle = "rgba(10,16,32,0.72)";
    ctx.fillRect(4, 3, 102, 13);
    ctx.fillStyle = "#f7f1d0";
    ctx.font = "bold 8px monospace";
    ctx.fillText("GROKET  PIXEL", 8, 12);
    ctx.fillStyle = "#c8d4ff";
    ctx.font = "7px monospace";
    ctx.fillText(label || (night ? "TORCH NIGHT" : "CASTLE DAY"), VW - 70, 12);
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
      ctx.fillText("LOADING SPRITES...", VW / 2 - 38, VH / 2 + 3);
    }
  }

  return { canvas, setActive, setNight, isActive, draw };
}

export { createPixelView };
