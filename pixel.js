/** CIRCUIT: procedural top-down stadium. All shapes use the simulation's world units. */
import { pixelFieldSize, ballRadius, GOAL_W, FW } from './catalog.js';
import { arenaLayout } from './arena-layout.js';
import { CORNER_RADIUS, GOAL_DEPTH } from './arena-geometry.js';

const FIELD = pixelFieldSize();
const W = FIELD.fieldW, L = FIELD.fieldL;
const R = ballRadius(true), MOUTH = GOAL_W * W / FW;
const AMBER = '#ffc268', CYAN = '#62dbe8';
const BODY = { cybertruck: '#b9cad3', model3: '#598def', cybercab: '#f0dfb6', semi: '#e36960' };

function rounded(ctx, x, y, w, h, radius, fill, stroke, line = .1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}
function path(ctx, points, color, width = .1, close = false, fill = false) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (close) ctx.closePath();
  if (fill) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
}
function circle(ctx, x, y, r, fill, stroke, width = .1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function world(ctx, layout) {
  const { scale: s, cx, cy, landscape } = layout;
  ctx.translate(cx, cy);
  if (landscape) ctx.transform(0, s, -s, 0, 0, 0);
  else ctx.scale(s, s);
}

function stadium(ctx, width, height, layout, night) {
  ctx.fillStyle = '#090f18'; ctx.fillRect(0, 0, width, height);
  const wash = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height) * .65);
  wash.addColorStop(0, '#1c303b'); wash.addColorStop(1, '#090f18');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);
  ctx.save(); world(ctx, layout);
  // Recessed grandstand and ordered seating; deliberately quiet around the ball.
  rounded(ctx, -W / 2 - 4.5, -L / 2 - 4.8, W + 9, L + 9.6, 2, '#0a121c', '#253442', .14);
  for (let row = 0; row < 3; row++) {
    for (let z = -L / 2 + 2; z < L / 2 - 1; z += 1.65) {
      for (const side of [-1, 1]) {
        const x = side * (W / 2 + 2.4 + row * .68);
        rounded(ctx, x - .21, z, .42, .9, .12, (Math.round(z) + row) % 5 === 0 ? '#36505d' : '#223440');
      }
    }
    for (let x = -W / 2 + 1; x < W / 2 - 1; x += 1.65) {
      if (Math.abs(x) < MOUTH / 2 + 1.8) continue;
      for (const side of [-1, 1]) rounded(ctx, x, side * (L / 2 + 2.5 + row * .65), .9, .42, .12, '#293b47');
    }
  }
  rounded(ctx, -W / 2 - 1.9, -L / 2 - 1.9, W + 3.8, L + 3.8, .9, '#162731', '#41525c', .1);
  // Goal recesses are exactly as wide as the scoring mouth.
  for (const end of [-1, 1]) {
    const color = end > 0 ? AMBER : CYAN;
    ctx.save(); ctx.scale(1, end);
    rounded(ctx, -MOUTH / 2 - .35, L / 2 - .1, MOUTH + .7, GOAL_DEPTH + .4, .3, '#101d25', '#40545e', .13);
    ctx.strokeStyle = '#324854'; ctx.lineWidth = .06;
    for (let x = -MOUTH / 2 + .65; x < MOUTH / 2; x += .7) path(ctx, [[x, L / 2], [x, L / 2 + GOAL_DEPTH]], '#324854', .06);
    for (let y = .7; y < GOAL_DEPTH; y += .65) path(ctx, [[-MOUTH / 2, L / 2 + y], [MOUTH / 2, L / 2 + y]], '#324854', .06);
    path(ctx, [[-MOUTH / 2, L / 2], [-MOUTH / 2, L / 2 + GOAL_DEPTH], [MOUTH / 2, L / 2 + GOAL_DEPTH], [MOUTH / 2, L / 2]], color, .24);
    ctx.restore();
  }
  ctx.save(); ctx.beginPath(); ctx.roundRect(-W / 2, -L / 2, W, L, CORNER_RADIUS); ctx.clip();
  ctx.fillStyle = night ? '#183d36' : '#245247'; ctx.fillRect(-W / 2, -L / 2, W, L);
  for (let stripe = 0; stripe < 12; stripe++) {
    if (stripe % 2) {
      ctx.fillStyle = night ? '#1c453b' : '#28594c';
      ctx.fillRect(-W / 2, -L / 2 + stripe * L / 12, W, L / 12);
    }
  }
  // Tiny, low-contrast grass strokes add scale without a noisy repeating texture.
  ctx.fillStyle = '#e3ffed08';
  for (let i = 0; i < 520; i++) {
    const x = ((i * 157) % 997) / 997 * (W - 1) - W / 2 + .5;
    const z = ((i * 311) % 991) / 991 * (L - 1) - L / 2 + .5;
    ctx.fillRect(x, z, .06, .2);
  }
  const line = '#c8e5cc9c';
  ctx.restore();
  ctx.lineJoin = 'round';
  // Touchlines and end boards leave an actual opening in each goal.
  for (const side of [-1, 1]) {
    path(ctx, [[side * W / 2, -L / 2 + CORNER_RADIUS], [side * W / 2, L / 2 - CORNER_RADIUS]], line, .16);
    path(ctx, [[-W / 2 + CORNER_RADIUS, side * L / 2], [-MOUTH / 2, side * L / 2]], line, .16);
    path(ctx, [[MOUTH / 2, side * L / 2], [W / 2 - CORNER_RADIUS, side * L / 2]], line, .16);
    ctx.save(); ctx.scale(1, side);
    const color = side > 0 ? AMBER : CYAN;
    ctx.fillStyle = side > 0 ? '#ffc26808' : '#62dbe809'; ctx.fillRect(-12, L / 2 - 11, 24, 11);
    path(ctx, [[-12, L / 2], [-12, L / 2 - 11], [12, L / 2 - 11], [12, L / 2]], line, .13);
    path(ctx, [[-7.7, L / 2], [-7.7, L / 2 - 4.2], [7.7, L / 2 - 4.2], [7.7, L / 2]], line, .13);
    circle(ctx, 0, L / 2 - 8, .16, '#d0e6ce');
    path(ctx, [[-MOUTH / 2, L / 2], [MOUTH / 2, L / 2]], '#deefdf80', .09);
    // Team-coloured recessed lights, away from the playable surface.
    path(ctx, [[-W / 2 + 1, L / 2 + .8], [-MOUTH / 2 - 2, L / 2 + .8]], color, .15);
    path(ctx, [[MOUTH / 2 + 2, L / 2 + .8], [W / 2 - 1, L / 2 + .8]], color, .15);
    circle(ctx, -MOUTH / 2, L / 2, .22, '#e9f6eb'); circle(ctx, MOUTH / 2, L / 2, .22, '#e9f6eb');
    ctx.restore();
  }
  path(ctx, [[-W / 2, 0], [W / 2, 0]], line, .13);
  circle(ctx, 0, 0, 6.4, null, line, .13); circle(ctx, 0, 0, .22, '#d0e6ce');
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const start = z < 0 ? (x < 0 ? Math.PI : -Math.PI / 2) : (x < 0 ? Math.PI / 2 : 0);
    ctx.beginPath(); ctx.arc(x * (W / 2 - CORNER_RADIUS), z * (L / 2 - CORNER_RADIUS), CORNER_RADIUS, start, start + Math.PI / 2);
    ctx.strokeStyle = line; ctx.lineWidth = .16; ctx.stroke();
  }
  ctx.restore();
}

function vehicle(ctx, car, team, local, clock, reducedMotion) {
  if (!car) return;
  ctx.save(); ctx.translate(car.x, car.z); ctx.rotate(-car.yaw);
  const w = car.w, l = car.l;
  // The painted body and tyres fit the same oriented rectangle used by contacts.
  rounded(ctx, -w * .55 + .12, -l / 2 + .22, w * 1.1, l, .4, '#050c1170');
  if (car.boosting) {
    const flame = reducedMotion ? 2 : 1.5 + Math.sin(clock * 37) * .4;
    for (const side of [-1, 1]) {
      const x = side * w * .27;
      path(ctx, [[x - .22, l / 2 - .1], [x, l / 2 + flame + .8], [x + .22, l / 2 - .1]], team + '65', 0, true, true);
      path(ctx, [[x - .12, l / 2], [x, l / 2 + flame], [x + .12, l / 2]], '#f2faf2', 0, true, true);
    }
  }
  for (const side of [-1, 1]) for (const axle of [-1, 1]) {
    rounded(ctx, side * w * .47 - .15, axle * l * .29 - .4, .3, .8, .08, '#080f15', '#6f8590', .05);
  }
  const color = BODY[car.kind] || '#bbcbd2';
  if (car.kind === 'cybertruck') {
    path(ctx, [[-w * .45, l * .45], [-w * .49, -l * .24], [-w * .35, -l * .5], [w * .35, -l * .5], [w * .49, -l * .24], [w * .45, l * .45]], color, 0, true, true);
    path(ctx, [[-w * .39, -.25], [-w * .3, -l * .29], [w * .3, -l * .29], [w * .39, -.25]], '#172e3c', 0, true, true);
    rounded(ctx, -w * .33, l * .17, w * .66, l * .23, .05, '#687f8c');
    path(ctx, [[0, -.15], [0, l * .15]], '#eef8fe70', .07);
  } else if (car.kind === 'semi') {
    rounded(ctx, -w * .47, -l / 2, w * .94, l * .31, .25, color);
    rounded(ctx, -w * .39, -l * .44, w * .78, l * .08, .08, '#16303c');
    rounded(ctx, -w * .48, -l * .12, w * .96, l * .6, .16, '#c7cdd0', '#81959e', .08);
    for (let z = 0; z < l * .42; z += .55) path(ctx, [[-w * .36, z], [w * .36, z]], '#9dafb5', .06);
  } else {
    rounded(ctx, -w * .47, -l / 2, w * .94, l, [w * .35, w * .35, .32, .32], color);
    rounded(ctx, -w * .36, -l * .25, w * .72, l * .42, .24, '#193240');
    rounded(ctx, -w * .32, -l * .06, w * .64, l * .17, .08, color);
    path(ctx, [[-w * .26, -l * .2], [w * .24, -l * .13]], '#abcdd360', .1);
    if (car.kind === 'cybercab') rounded(ctx, -w * .25, -.1, w * .5, .24, .05, '#f4c35a');
  }
  path(ctx, [[-w * .34, -l * .43], [w * .34, -l * .43]], '#f0ffff', .13);
  path(ctx, [[-w * .34, l * .43], [w * .34, l * .43]], '#ff695c', .12);
  // Team sill strips distinguish ownership without recolouring the car identity.
  path(ctx, [[-w * .48, -l * .15], [-w * .48, l * .28]], team, .12);
  path(ctx, [[w * .48, -l * .15], [w * .48, l * .28]], team, .12);
  if (local) path(ctx, [[-.48, l / 2 + 1.5], [0, l / 2 + .9], [.48, l / 2 + 1.5]], team, .16);
  ctx.restore();
}

export function createPixelView() {
  const canvas = document.createElement('canvas'); canvas.id = 'pixelView';
  canvas.setAttribute('aria-label', 'Top-down football arena. Your car is marked with a chevron. Hold Space or Shift to boost.');
  canvas.style.display = 'none'; document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas'), bg = background.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = false, night = false, dirty = true, width = 0, height = 0, ratio = 1, layout;
  let trail = [], lastPoint = null;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (rect.width === width && rect.height === height && dpr === ratio && !dirty) return;
    width = rect.width; height = rect.height; ratio = dpr;
    canvas.width = background.width = Math.round(width * ratio);
    canvas.height = background.height = Math.round(height * ratio);
    layout = arenaLayout(width, height, W, L);
    bg.setTransform(ratio, 0, 0, ratio, 0, 0); stadium(bg, width, height, layout, night);
    dirty = false;
  }
  return {
    canvas,
    isActive: () => active,
    setActive(on) {
      if (active === !!on) return;
      active = !!on; canvas.style.display = active ? 'block' : 'none';
      document.body.classList.toggle('pixel-mode', active);
      dirty = true; trail = []; lastPoint = null;
    },
    setNight(on) { if (night !== !!on) { night = !!on; dirty = true; } },
    draw({ player, bot, ball, localIsBot = false }) {
      if (!active) return;
      resize(); if (!width || !height) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(background, 0, 0);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.save(); world(ctx, layout);
      const clock = performance.now() / 1000;
      if (ball) {
        const distance = lastPoint ? Math.hypot(ball.x - lastPoint.x, ball.z - lastPoint.z) : 0;
        if (distance > 10) trail = [];
        if (!lastPoint || distance > .4) { trail.push({ x: ball.x, z: ball.z, t: clock }); lastPoint = { x: ball.x, z: ball.z }; }
        trail = trail.filter(p => clock - p.t < .19);
        if (!reducedMotion && Math.hypot(ball.vx, ball.vz) > 8) for (const p of trail) {
          ctx.globalAlpha = (1 - (clock - p.t) / .19) * .16;
          circle(ctx, p.x, p.z, R * .6, '#f4f9e9');
        }
        ctx.globalAlpha = 1;
      }
      vehicle(ctx, player, AMBER, !localIsBot, clock, reducedMotion);
      vehicle(ctx, bot, CYAN, localIsBot, clock, reducedMotion);
      if (ball) {
        circle(ctx, ball.x + .15, ball.z + .25, R, '#050f1480');
        circle(ctx, ball.x, ball.z, R, '#f4f7e9', '#142d32', .12);
        ctx.save(); ctx.translate(ball.x, ball.z); ctx.rotate((ball.x + ball.z) * .55);
        const pentagon = Array.from({ length: 5 }, (_, i) => [Math.cos(i * Math.PI * 2 / 5) * R * .37, Math.sin(i * Math.PI * 2 / 5) * R * .37]);
        path(ctx, pentagon, '#27414a', 0, true, true);
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5;
          path(ctx, [[Math.cos(a) * R * .36, Math.sin(a) * R * .36], [Math.cos(a) * R * .81, Math.sin(a) * R * .81]], '#708b8980', .07);
          circle(ctx, Math.cos(a) * R * .83, Math.sin(a) * R * .83, R * .13, '#27414a');
        }
        ctx.restore();
      }
      ctx.restore();
    }
  };
}
