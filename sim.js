import { byId, FW, FL, GOAL_W, GOAL_H } from "./catalog.js";
function forwardXZ(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function bodyFrom(id, x, z, yaw) {
  const c = byId(id);
  return { kind: id, ...c.spec, x, z, yaw, vx: 0, vz: 0, boost: c.spec.boostMax, boosting: false, _ai: { orbit: 0, lastAng: 0, t: 0 } };
}
function clampFieldCar(c) {
  const limX = FW / 2 - 0.55;
  const limZ = FL / 2 + 0.35;
  if (c.x > limX) { c.x = limX; c.vx *= -0.18; }
  if (c.x < -limX) { c.x = -limX; c.vx *= -0.18; }
  if (c.z > limZ) { c.z = limZ; c.vz *= -0.18; }
  if (c.z < -limZ) { c.z = -limZ; c.vz *= -0.18; }
}

function drive(c, throttle, steer, wantBoost, dt) {
  const { x: fwdX, z: fwdZ } = forwardXZ(c.yaw);
  c.boosting = false;
  if (wantBoost && c.boost > 0.05) {
    const punch = c.kind === "cybertruck" || c.kind === "semi" ? 40 : 30;
    c.vx += fwdX * punch * dt;
    c.vz += fwdZ * punch * dt;
    c.boost -= dt * (c.mass > 3 ? 0.8 : 1.05);
    c.boosting = true;
  } else {
    c.boost = Math.min(c.boostMax, c.boost + dt * 0.28);
  }
  c.vx += fwdX * throttle * c.accel * dt;
  c.vz += fwdZ * throttle * c.accel * dt;
  const rightX = Math.cos(c.yaw);
  const rightZ = -Math.sin(c.yaw);
  const lat = c.vx * rightX + c.vz * rightZ;
  c.vx -= rightX * lat * Math.min(1, c.grip * dt * 1.12);
  c.vz -= rightZ * lat * Math.min(1, c.grip * dt * 1.12);
  const drag = c.mass > 3 ? 1.85 : 1.45;
  c.vx *= 1 - drag * dt;
  c.vz *= 1 - drag * dt;
  const cap = c.max * (c.boosting ? c.mass > 3 ? 1.42 : 1.28 : 1);
  const sp = Math.hypot(c.vx, c.vz);
  if (sp > cap) { c.vx *= cap / sp; c.vz *= cap / sp; }
  const speedFactor = 0.35 + Math.min(sp / Math.max(c.max, 1), 1) * 0.65;
  const heavySlow = c.mass > 3 && sp > 11 ? 0.7 : 1;
  const reverse = throttle < -0.2 ? -1 : 1;
  if (Math.abs(throttle) > 0.05 || sp > 1) {
    c.yaw += steer * c.turn * speedFactor * heavySlow * reverse * dt;
  }
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  clampFieldCar(c);
}
function carBall(c, ball) {
  const dx = ball.x - c.x;
  const dz = ball.z - c.z;
  const { x: fwdX, z: fwdZ } = forwardXZ(c.yaw);
  const rightX = Math.cos(c.yaw);
  const rightZ = -Math.sin(c.yaw);
  const localZ = dx * fwdX + dz * fwdZ;
  const localX = dx * rightX + dz * rightZ;
  const hx = (Number.isFinite(c.w) ? c.w : 1.8) * 0.55 + 0.55;
  const hz = (Number.isFinite(c.l) ? c.l : 4) * 0.5 + 0.55;
  if (Math.abs(localX) < hx && Math.abs(localZ) < hz && ball.y < 1.8) {
    const nlen = Math.hypot(dx, dz);
    // Degenerate center overlap used to yield ux=uz=0, parking the ball inside
    // the hitbox so vy stacked every frame and transforms went non-finite.
    let ux, uz;
    if (nlen < 0.05) {
      ux = fwdX;
      uz = fwdZ;
    } else {
      ux = dx / nlen;
      uz = dz / nlen;
    }
    const rel = (ball.vx - c.vx) * ux + (ball.vz - c.vz) * uz;
    const speed = Math.hypot(c.vx, c.vz);
    const mass = (Number.isFinite(c.mass) && c.mass > 0.2) ? c.mass : 1.5;
    let impulse = Math.max(9, 11 / mass + Math.abs(rel) * 1.15);
    if (!Number.isFinite(impulse)) impulse = 9;
    impulse = Math.min(impulse, 42);
    let ev = "hit";
    if ((c.kind === "cybertruck" || c.kind === "semi") && c.boosting) {
      impulse *= 1.35;
      ball.vy = Math.max(ball.vy, 1.2);
      ev = "pancake";
    } else {
      ball.vy = Math.max(ball.vy, 2 + Math.min(4.2, speed * 0.12));
    }
    ball.vx += ux * impulse;
    ball.vz += uz * impulse;
    ball.x = c.x + ux * (hx + 0.2);
    ball.z = c.z + uz * (hz + 0.2);
    c.vx -= ux * impulse * (0.12 * mass / 3);
    c.vz -= uz * impulse * (0.12 * mass / 3);
    return ev;
  }
  return null;
}
function carCar(P, B) {
  const dx = P.x - B.x;
  const dz = P.z - B.z;
  const d = Math.hypot(dx, dz);
  const min = (P.l + B.l) * 0.38;
  if (d < min && d > 0.01) {
    const ux = dx / d;
    const uz = dz / d;
    const overlap = min - d;
    const pW = B.mass / (P.mass + B.mass);
    const bW = P.mass / (P.mass + B.mass);
    P.x += ux * overlap * pW;
    P.z += uz * overlap * pW;
    B.x -= ux * overlap * bW;
    B.z -= uz * overlap * bW;
    const rel = (P.vx - B.vx) * ux + (P.vz - B.vz) * uz;
    P.vx += ux * (-rel * 0.4 + 2);
    P.vz += uz * (-rel * 0.4 + 2);
    B.vx -= ux * (-rel * 0.4 + 2);
    B.vz -= uz * (-rel * 0.4 + 2);
    return true;
  }
  return false;
}
function stepBall(ball, dt) {
  ball.vy -= 22 * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;
  // Hard caps so a sticky contact can never send transforms to Infinity
  const spd = Math.hypot(ball.vx, ball.vz);
  if (spd > 55) { ball.vx *= 55 / spd; ball.vz *= 55 / spd; }
  if (ball.vy > 28) ball.vy = 28;
  if (ball.vy < -40) ball.vy = -40;
  if (ball.y > 18) { ball.y = 18; ball.vy = Math.min(ball.vy, 0); }
  if (ball.y < 0.55) {
    ball.y = 0.55;
    if (ball.vy < 0) ball.vy *= -0.42;
    if (Math.abs(ball.vy) < 1.1) ball.vy = 0;
    ball.vx *= 0.986;
    ball.vz *= 0.986;
  }
  const halfZ = FL / 2;
  const wallX = FW / 2 + 0.9;
  const backZ = halfZ + 1.4;
  if (ball.x > wallX) { ball.x = wallX; ball.vx *= -0.62; }
  if (ball.x < -wallX) { ball.x = -wallX; ball.vx *= -0.62; }
  const inMouth = Math.abs(ball.x) < GOAL_W / 2 - 0.05 && ball.y < GOAL_H - 0.08;
  if (inMouth && ball.z <= -halfZ) return "A";
  if (inMouth && ball.z >= halfZ) return "B";
  if (ball.z > backZ) { ball.z = backZ; ball.vz *= -0.55; }
  if (ball.z < -backZ) { ball.z = -backZ; ball.vz *= -0.55; }
  if (!inMouth) {
    if (ball.z > halfZ) { ball.z = halfZ; ball.vz *= -0.62; }
    if (ball.z < -halfZ) { ball.z = -halfZ; ball.vz *= -0.62; }
  }
  return null;
}
function botAI(me, foe, ball, dt, attackSign) {
  if (attackSign !== 1 && attackSign !== -1) attackSign = 1;
  if (!me._ai) me._ai = { t: 0, stuck: 0, lx: me.x, lz: me.z, mode: "hunt", modeT: 0, side: Math.random() < 0.5 ? 1 : -1 };
  const ai = me._ai;
  ai.t += dt;
  ai.modeT += dt;
  const goalZ = attackSign * (FL / 2);
  const ownZ = -attackSign * (FL / 2);
  const speed = Math.hypot(me.vx, me.vz);
  const moved = Math.hypot(me.x - ai.lx, me.z - ai.lz);
  if (moved < 0.28 && speed < 4.5) ai.stuck += dt;
  else ai.stuck = Math.max(0, ai.stuck - dt * 1.6);
  ai.lx = me.x; ai.lz = me.z;
  const predT = 0.16 + Math.min(0.3, Math.hypot(ball.vx, ball.vz) * 0.012);
  const pred = { x: ball.x + ball.vx * predT, z: ball.z + ball.vz * predT };
  const dBall = Math.hypot(pred.x - me.x, pred.z - me.z);
  const ballToGoal = Math.hypot(goalZ - pred.z, pred.x);
  const behindBall = (me.z - pred.z) * attackSign < -0.55;
  const betweenOwn = Math.abs(me.z - ownZ) < Math.abs(pred.z - ownZ) + 2.5;
  const rushingOwn = (ball.vz * attackSign) < -7 && Math.abs(pred.z - ownZ) < 18;
  const kickoff = Math.abs(ball.x) < 1.6 && Math.abs(ball.z) < 3.2 && Math.hypot(ball.vx, ball.vz) < 5 && ai.t < 2.2;
  if (ai.stuck > 0.55) { ai.mode = "unstuck"; ai.modeT = 0; ai.side *= -1; }
  else if (rushingOwn || (betweenOwn && Math.abs(pred.z - ownZ) < 14)) ai.mode = "save";
  else if (kickoff) ai.mode = "kick";
  else if (behindBall || dBall > 10) ai.mode = "flank";
  else ai.mode = "strike";
  if (ai.mode === "unstuck" && ai.modeT > 0.7) ai.mode = "flank";
  const toGoalX = -pred.x;
  const toGoalZ = goalZ - pred.z;
  const glen = Math.hypot(toGoalX, toGoalZ) || 1;
  const ux = toGoalX / glen;
  const uz = toGoalZ / glen;
  let tx, tz;
  if (ai.mode === "save") { tx = pred.x * 0.92; tz = pred.z - attackSign * 1.15; }
  else if (ai.mode === "kick") { tx = pred.x * 0.1; tz = pred.z - attackSign * 0.35; }
  else if (ai.mode === "unstuck") { tx = me.x + ai.side * 7; tz = me.z - attackSign * 5; }
  else if (ai.mode === "flank") { tx = pred.x - ux * 4.6 + ai.side * 2.4; tz = pred.z - uz * 4.6; }
  else { tx = pred.x - ux * 1.1; tz = pred.z - uz * 1.1; }
  tx = Math.max(-FW / 2 + 2.2, Math.min(FW / 2 - 2.2, tx));
  tz = Math.max(-FL / 2 + 1.8, Math.min(FL / 2 - 1.8, tz));
  const ax = tx - me.x;
  const az = tz - me.z;
  const err = wrapPi(Math.atan2(-ax, -az) - me.yaw);
  const dist = Math.hypot(ax, az);
  const gain = ai.mode === "save" ? 1.85 : ai.mode === "strike" ? 1.25 : 1.45;
  const steer = Math.max(-1, Math.min(1, err * gain));
  let throttle = 1;
  if (ai.mode === "unstuck") throttle = Math.abs(err) > 1.0 ? -0.55 : 0.7;
  else if (Math.abs(err) > 1.35) throttle = dist < 7 ? -0.45 : 0.2;
  else if (Math.abs(err) > 0.7 && dist < 4) throttle = 0.35;
  if (ai.mode === "kick") throttle = Math.abs(err) > 0.85 ? 0.5 : 1;
  const lined = Math.abs(err) < (ai.mode === "strike" ? 0.28 : 0.36);
  let boost = false;
  if (ai.mode === "save" && lined) boost = true;
  if (ai.mode === "strike" && lined && dBall < 5.5 && ballToGoal < 30) boost = true;
  if (ai.mode === "flank" && lined && dist > 8 && dBall < 14) boost = ((ai.t * 7) % 1) < 0.28;
  if (ai.modeT > 2.8 && (ai.mode === "flank" || ai.mode === "strike")) { ai.side *= -1; ai.modeT = 0; }
  drive(me, throttle, steer, boost, dt);
}

export { bodyFrom, botAI, carBall, carCar, drive, forwardXZ, stepBall };
