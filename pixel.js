/**
 * PIXEL mode - Pixel Forge castle pitch + 8-dir vehicle atlases + ball VFX.
 * Rich night-castle pitch (384x216). Playable area = grass clamp.
 */
import { FL, pixelFieldSize, byId, CHARACTERS } from "./catalog.js";

const CELL = 32;
const GUT = 1;
const ROW_OF = { cybertruck: 0, model3: 1, cybercab: 2, semi: 3 };

const _pf = pixelFieldSize();
// Grass clamp from shared characters contract
const CLAMP = { x0: _pf.clamp.x0, y0: _pf.clamp.y0, x1: _pf.clamp.x1, y1: _pf.clamp.y1 };
// Uniform field matching sim setPixelTight (no anisotropic stretch)
const FIELD_W = _pf.fieldW;
const PX_PER = (CLAMP.x1 - CLAMP.x0) / FIELD_W;
const BALL_R_WORLD = (CHARACTERS.ball?.radius_bu || 0.131) * (CHARACTERS.reference?.catalog_model3_l || 4.2);
const FIELD_L = _pf.fieldL;

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

/** Strip atlas magenta (#FFx00FF-ish) to transparent. */
function chromaSheet(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 240 && g < 40 && b > 240) d[i + 3] = 0; // pure atlas magenta only
  }
  x.putImageData(id, 0, 0);
  return c;
}


  function scrubMagenta(img) {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 220 && d[i + 1] < 60 && d[i + 2] > 220) {
        d[i] = 12; d[i + 1] = 20; d[i + 2] = 48; d[i + 3] = 255;
      }
    }
    x.putImageData(id, 0, 0);
    return c;
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
  let vfxImg = null;
  let tAnim = 0;

  Promise.all([
    loadImage("./assets/pixel/pitch.png"),
    loadImage("./assets/pixel/vehicles_8dir.png"),
    loadImage("./assets/pixel/vehicles_boost.png"),
    loadImage("./assets/pixel/ball_vfx.png")
  ]).then(([pitch, cars, boost, vfx]) => {
    pitchImg = scrubMagenta(pitch);
    carsImg = chromaSheet(cars);
    boostImg = chromaSheet(boost);
    vfxImg = chromaSheet(vfx);
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
    // Uniform scale: FIELD_W/FIELD_L matches clamp aspect (from characters.js)
    return {
      sx: CLAMP.x0 + (x / FIELD_W + 0.5) * gw,
      sy: CLAMP.y0 + (z / FIELD_L + 0.5) * gh,
      scale: gw / FIELD_W
    };
  }

  function drawPitch() {
    if (pitchImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pitchImg, 0, 0, VW, VH);
      if (night) {
        ctx.fillStyle = "rgba(8,16,48,0.18)";
        ctx.fillRect(0, 0, VW, VH);
      }
      return;
    }
    ctx.fillStyle = "#0c1430";
    ctx.fillRect(0, 0, VW, VH);
  }

  function blitCar(c, sx, sy) {
    const row = ROW_OF[c.kind] ?? 1;
    const col = yawToCol(c.yaw);
    const sheet = c.boosting && boostImg ? boostImg : carsImg;
    if (!sheet) return false;
    const sx0 = col * (CELL + GUT);
    const sy0 = row * (CELL + GUT);
    const src = CELL;
    // Match on-screen size to physics footprint (was ~2x too big = mushy hits)
    const spec = byId(c.kind)?.spec;
    const physL = (spec?.l || c.l || 4.2) * PX_PER;
    const physW = (spec?.w || c.w || 1.8) * PX_PER;
    const bh = Math.max(12, Math.min(28, Math.round(physL * 1.18)));
    const bw = Math.max(9, Math.min(22, Math.round(physW * 1.25)));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, sx0, sy0, src, src, Math.round(sx - bw / 2), Math.round(sy - bh / 2), bw, bh);
    return true;
  }

  function blitVfx(rowKey, frame, dx, dy, dw, dh) {
    if (!vfxImg) return false;
    const meta = BALL[rowKey];
    if (!meta) return false;
    const f = ((frame % meta.frames) + meta.frames) % meta.frames;
    const size = meta.size;
    const sx0 = f * (size + GUT) + (GUT ? 0 : 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(vfxImg, sx0, meta.y, size, size, Math.round(dx), Math.round(dy), dw, dh);
    return true;
  }

  function drawCar(c) {
    if (!c) return;
    const { sx, sy } = worldTo(c.x, c.z);
    // boost sheet already has flames; VFX boost row was yellow pillar bleed
    if (!blitCar(c, sx, sy)) {
      // cream fallback, never magenta
      ctx.fillStyle = "#e8dcc8";
      ctx.fillRect(Math.round(sx - 6), Math.round(sy - 6), 12, 12);
    }
  }

  function drawBall(ball) {
    if (!ball) return;
    const { sx, sy } = worldTo(ball.x, ball.z);
    const diam = Math.max(9, Math.min(14, Math.round(BALL_R_WORLD * 2 * PX_PER * 1.35)));
    const r = diam / 2;
    blitVfx("shadow", 0, sx - r, sy + r * 0.35, diam, Math.max(4, r));
    const spin = Math.floor(tAnim / 3);
    if (!blitVfx("ball16", spin, sx - r, sy - r, diam, diam)) {
      ctx.fillStyle = "#f4efe4";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(label) {
    ctx.fillStyle = "rgba(12,20,48,0.55)";
    ctx.fillRect(4, 4, VW - 8, 14);
    ctx.fillStyle = "#f4efe4";
    ctx.font = "8px monospace";
    ctx.textAlign = "left";
    ctx.fillText("PIXEL - " + (label || "CASTLE"), 8, 14);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a8c4e8";
    ctx.fillText("BOOST HOLD", VW - 8, 14);
  }

  function draw(state) {
    if (!active) return;
    tAnim++;
    ctx.imageSmoothingEnabled = false;
    drawPitch();
    drawCar(state.bot);
    drawCar(state.player);
    drawBall(state.ball);
    drawHud(state.mapLabel);
  }

  return { setActive, setNight, isActive, draw, canvas };
}

export { createPixelView };

