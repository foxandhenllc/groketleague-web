/**
 * SNES / LTTP-style top-down pitch — matches the OG thumbnail look.
 * Pure renderer over the same sim bodies (x/z/yaw). No physics of its own.
 */
import { FW, FL, GOAL_W } from "./catalog.js";

const CAR_COLORS = {
  cybertruck: { body: "#c5ccd4", accent: "#8a939c", glow: "#e8fbff" },
  model3: { body: "#3a6fff", accent: "#1a2740", glow: "#ffffff" },
  cybercab: { body: "#e6ecf2", accent: "#c5d0dc", glow: "#ffffff" },
  semi: { body: "#e23b3b", accent: "#2a3038", glow: "#ffd0d0" }
};

function carStyle(id) {
  return CAR_COLORS[id] || CAR_COLORS.model3;
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
  const stars = Array.from({ length: 48 }, () => ({
    x: Math.random() * VW,
    y: Math.random() * (VH * 0.42),
    s: Math.random() < 0.3 ? 2 : 1
  }));

  function setActive(on) {
    active = !!on;
    canvas.style.display = on ? "block" : "none";
    document.body.classList.toggle("pixel-mode", on);
  }
  function setNight(on) {
    night = !!on;
  }
  function isActive() {
    return active;
  }

  function worldTo(x, z) {
    const padX = 36;
    const padTop = 28;
    const padBot = 18;
    const fieldW = VW - padX * 2;
    const fieldH = VH - padTop - padBot;
    const sx = padX + (x / FW + 0.5) * fieldW;
    const sy = padTop + (z / FL + 0.5) * fieldH;
    return { sx, sy, scale: fieldW / FW };
  }

  function drawChecker(x, y, w, h, a, b, cell) {
    for (let py = 0; py < h; py += cell) {
      for (let px = 0; px < w; px += cell) {
        const odd = ((px / cell) + (py / cell)) & 1;
        ctx.fillStyle = odd ? a : b;
        ctx.fillRect(x + px, y + py, cell, cell);
      }
    }
  }

  function crenelate(x, y, len, alongX, stone, dark) {
    const step = 6;
    const n = Math.floor(len / step);
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) continue;
      ctx.fillStyle = i % 4 === 1 ? dark : stone;
      if (alongX) ctx.fillRect(x + i * step, y - 4, 4, 4);
      else ctx.fillRect(x - 4, y + i * step, 4, 4);
    }
  }

  function drawTower(sx, sy, banner) {
    ctx.fillStyle = "#6b5344";
    ctx.fillRect(sx - 8, sy - 10, 16, 20);
    ctx.fillStyle = "#5a4538";
    ctx.fillRect(sx - 9, sy - 12, 18, 3);
    for (const [dx, dy] of [[-6, -14], [2, -14], [-6, -8], [2, -8]]) {
      ctx.fillStyle = "#7a5e4c";
      ctx.fillRect(sx + dx, sy + dy, 5, 5);
    }
    ctx.fillStyle = "#2a1c14";
    ctx.fillRect(sx - 3, sy + 2, 6, 8);
    if (banner) {
      ctx.fillStyle = banner;
      ctx.fillRect(sx + 8, sy - 6, 7, 10);
      ctx.fillStyle = "#f0c020";
      ctx.fillRect(sx + 10, sy - 3, 3, 4);
    }
  }

  function drawPitch() {
    ctx.fillStyle = night ? "#0c1430" : "#3a6aaa";
    ctx.fillRect(0, 0, VW, VH);
    if (night) {
      for (const st of stars) {
        ctx.fillStyle = st.s > 1 ? "#ffffff" : "#c8d4ff";
        ctx.fillRect(st.x | 0, st.y | 0, st.s, st.s);
      }
      ctx.fillStyle = "#f5e6a0";
      ctx.beginPath();
      ctx.arc(VW - 42, 28, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8d078";
      ctx.fillRect(VW - 48, 22, 4, 4);
      ctx.fillRect(VW - 36, 30, 3, 3);
    }

    const origin = worldTo(-FW / 2, -FL / 2);
    const corner = worldTo(FW / 2, FL / 2);
    const left = origin.sx;
    const top = origin.sy;
    const fw = corner.sx - origin.sx;
    const fh = corner.sy - origin.sy;

    ctx.fillStyle = night ? "#2f241c" : "#4a3828";
    ctx.fillRect(left - 10, top - 10, fw + 20, fh + 20);

    drawChecker(left, top, fw, fh, night ? "#1e6b28" : "#2f9a3a", night ? "#278634" : "#3aad45", 4);

    ctx.fillStyle = "#f7f1d0";
    ctx.fillRect(left, top, fw, 1);
    ctx.fillRect(left, top + fh - 1, fw, 1);
    ctx.fillRect(left, top, 1, fh);
    ctx.fillRect(left + fw - 1, top, 1, fh);
    ctx.fillRect(left, top + fh / 2 - 0.5, fw, 1);
    ctx.strokeStyle = "#f7f1d0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(left + fw / 2, top + fh / 2, Math.min(fw, fh) * 0.09, 0, Math.PI * 2);
    ctx.stroke();

    const gw = (GOAL_W / FW) * fw;
    ctx.strokeRect(left + fw / 2 - gw / 2, top, gw, fh * 0.12);
    ctx.strokeRect(left + fw / 2 - gw / 2, top + fh - fh * 0.12, gw, fh * 0.12);

    const stone = "#6b5344";
    const dark = "#4e3b30";
    const wall = 5;
    ctx.fillStyle = stone;
    ctx.fillRect(left - wall, top - wall, fw + wall * 2, wall);
    ctx.fillRect(left - wall, top + fh, fw + wall * 2, wall);
    ctx.fillRect(left - wall, top - wall, wall, fh + wall * 2);
    ctx.fillRect(left + fw, top - wall, wall, fh + wall * 2);
    crenelate(left - wall, top - wall, fw + wall * 2, true, stone, dark);
    crenelate(left - wall, top + fh + wall, fw + wall * 2, true, stone, dark);
    crenelate(left - wall, top - wall, fh + wall * 2, false, stone, dark);
    crenelate(left + fw + wall, top - wall, fh + wall * 2, false, stone, dark);

    drawTower(left - 2, top - 2, "#3a6fff");
    drawTower(left + fw + 2, top - 2, "#3a6fff");
    drawTower(left - 2, top + fh + 2, "#e24a3a");
    drawTower(left + fw + 2, top + fh + 2, "#e24a3a");

    ctx.fillStyle = "#2a1c14";
    ctx.fillRect(left + fw / 2 - gw / 2 - 2, top - wall - 2, gw + 4, wall + 3);
    ctx.fillRect(left + fw / 2 - gw / 2 - 2, top + fh - 1, gw + 4, wall + 3);
    ctx.fillStyle = "#3a6fff";
    ctx.fillRect(left + fw / 2 - gw / 2, top - 2, gw, 2);
    ctx.fillStyle = "#f0c020";
    ctx.fillRect(left + fw / 2 - gw / 2, top + fh, gw, 2);

    const torchPts = [
      worldTo(-FW / 2 - 1.2, -FL / 2 - 0.8),
      worldTo(FW / 2 + 1.2, -FL / 2 - 0.8),
      worldTo(-FW / 2 - 1.2, FL / 2 + 0.8),
      worldTo(FW / 2 + 1.2, FL / 2 + 0.8)
    ];
    for (const t of torchPts) {
      ctx.fillStyle = "#3a2a1a";
      ctx.fillRect(t.sx - 1, t.sy - 6, 2, 8);
      ctx.fillStyle = night ? "#ffb040" : "#ffd090";
      ctx.fillRect(t.sx - 2, t.sy - 9, 4, 4);
      if (night) {
        ctx.fillStyle = "rgba(255,160,40,0.18)";
        ctx.beginPath();
        ctx.arc(t.sx, t.sy - 7, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCar(c, teamTint) {
    if (!c) return;
    const { sx, sy, scale } = worldTo(c.x, c.z);
    const style = carStyle(c.kind);
    const L = Math.max(6, (c.l || 4) * scale * 0.55);
    const W = Math.max(4, (c.w || 1.8) * scale * 0.55);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(c.yaw);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-L / 2 + 1, -W / 2 + 1, L, W);
    ctx.fillStyle = style.body;
    ctx.fillRect(-L / 2, -W / 2, L, W);
    ctx.fillStyle = style.accent;
    ctx.fillRect(-L / 2 + 1, -W / 2 + 1, L * 0.35, W - 2);
    ctx.fillStyle = "#15202c";
    ctx.fillRect(L * 0.05, -W / 2 + 1, L * 0.28, W - 2);
    if (teamTint) {
      ctx.fillStyle = teamTint;
      ctx.fillRect(-L / 2, W / 2 - 2, L, 2);
    }
    if (c.boosting) {
      ctx.fillStyle = "#ffb040";
      ctx.fillRect(-L / 2 - 4, -2, 4, 4);
      ctx.fillStyle = "#ff6020";
      ctx.fillRect(-L / 2 - 6, -1, 2, 2);
    }
    ctx.fillStyle = style.glow;
    ctx.fillRect(L / 2 - 1, -W / 2 + 1, 2, 2);
    ctx.fillRect(L / 2 - 1, W / 2 - 3, 2, 2);
    ctx.restore();
  }

  function drawBall(ball) {
    if (!ball) return;
    const { sx, sy, scale } = worldTo(ball.x, ball.z);
    const r = Math.max(3, 0.55 * scale);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(sx + 1, sy + 2, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f7f1d0";
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(sx - 1, sy - r + 1, 2, 2);
    ctx.fillRect(sx - r + 1, sy - 1, 2, 2);
  }

  function drawHudChrome(label) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(6, 4, 118, 16);
    ctx.fillStyle = "#f0c020";
    ctx.font = "bold 8px monospace";
    ctx.fillText("GROKET · PIXEL", 10, 14);
    ctx.fillStyle = "#f7f1d0";
    ctx.font = "7px monospace";
    ctx.fillText(label || (night ? "TORCH NIGHT" : "CASTLE DAY"), VW - 78, 14);
  }

  function draw(state) {
    if (!active) return;
    ctx.imageSmoothingEnabled = false;
    drawPitch();
    drawCar(state.bot, "#e24a3a");
    drawCar(state.player, "#3a6fff");
    drawBall(state.ball);
    drawHudChrome(state.mapLabel);
  }

  return { canvas, setActive, setNight, isActive, draw };
}

export { createPixelView };
