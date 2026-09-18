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
  const limX = FW / 2 - 0.3;
  const limZ = FL / 2 + 1.6;
  if (c.x > limX) { c.x = limX; c.vx *= -0.25; }
  if (c.x < -limX) { c.x = -limX; c.vx *= -0.25; }
  if (c.z > limZ) { c.z = limZ; c.vz *= -0.25; }
  if (c.z < -limZ) { c.z = -limZ; c.vz *= -0.25; }
}
function drive(c, throttle, steer, wantBoost, dt) {
  const { x: fwdX, z: fwdZ } = forwardXZ(c.yaw);
  c.boosting = false;
  if (wantBoost && c.boost > 0.05) {
    const punch = c.kind === "cybertruck" || c.kind === "semi" ? 46 : 34;
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
  c.vx -= rightX * lat * Math.min(1, c.grip * dt);
  c.vz -= rightZ * lat * Math.min(1, c.grip * dt);
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
  const hx = c.w * 0.55 + 0.55;
  const hz = c.l * 0.5 + 0.55;
  if (Math.abs(localX) < hx && Math.abs(localZ) < hz && ball.y < 1.8) {
    const nlen = Math.hypot(dx, dz) || 1;
    const ux = dx / nlen;
    const uz = dz / nlen;
    const rel = (ball.vx - c.vx) * ux + (ball.vz - c.vz) * uz;
    const speed = Math.hypot(c.vx, c.vz);
    let impulse = Math.max(9, 11 / c.mass + Math.abs(rel) * 1.15);
    let ev = "hit";
    if ((c.kind === "cybertruck" || c.kind === "semi") && c.boosting) {
      impulse *= 1.35;
      ball.vy = 1.2;
      ev = "pancake";
    } else {
      ball.vy += 2 + Math.min(4.2, speed * 0.12);
    }
    ball.vx += ux * impulse;
    ball.vz += uz * impulse;
    ball.x = c.x + ux * (hx + 0.06);
    ball.z = c.z + uz * (Math.min(hz, Math.abs(localZ)) + 0.06);
    c.vx -= ux * impulse * (0.12 * c.mass / 3);
    c.vz -= uz * impulse * (0.12 * c.mass / 3);
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
  if (ball.y < 0.55) {
    ball.y = 0.55;
    if (ball.vy < 0) ball.vy *= -0.42;
    if (Math.abs(ball.vy) < 1.1) ball.vy = 0;
    ball.vx *= 0.986;
    ball.vz *= 0.986;
  }
  const halfZ = FL / 2;
  const wallX = FW / 2 + 1.6;
  const backZ = halfZ + 2.2;
  if (ball.x > wallX) { ball.x = wallX; ball.vx *= -0.55; }
  if (ball.x < -wallX) { ball.x = -wallX; ball.vx *= -0.55; }
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
  if (!me._ai) me._ai = { orbit: 0, lastAng: 0, t: 0 };
  const ai = me._ai;
  ai.t += dt;
  const predT = attackSign > 0 ? 0.22 : 0.32;
  const pred = { x: ball.x + ball.vx * predT, z: ball.z + ball.vz * predT };
  const dBall = Math.hypot(pred.x - me.x, pred.z - me.z);
  const ownGoalZ = -attackSign * (FL / 2);
  const ang = Math.atan2(me.x - pred.x, me.z - pred.z);
  const spin = Math.abs(wrapPi(ang - ai.lastAng)) / Math.max(dt, 0.008);
  ai.lastAng = ang;
  if (dBall < 7.5 && spin > 1.7) ai.orbit += dt;
  else ai.orbit = Math.max(0, ai.orbit - dt * 0.9);
  const kickoff = Math.abs(ball.x) < 1.4 && Math.abs(ball.z) < 2.8 && Math.hypot(ball.vx, ball.vz) < 5 && ai.t < 2.4;
  const inBox = attackSign > 0 ? pred.z < -FL * 0.16 : pred.z > FL * 0.16;
  const rushingOwn = (ball.vz * attackSign) < -6 && Math.abs(pred.z - ownGoalZ) < 16;
  const needSave = inBox || rushingOwn;
  const wrongSide = (me.z - pred.z) * attackSign > 1.0;
  let tx = pred.x * 0.82;
  let tz = pred.z - attackSign * 2.5;
  if (kickoff) {
    tx = pred.x * 0.15;
    tz = pred.z;
  } else if (needSave) {
    tx = pred.x;
    tz = pred.z - attackSign * 1.1;
  } else if (wrongSide) {
    const side = me.x >= pred.x ? 1 : -1;
    tx = pred.x + side * 5.4;
    tz = pred.z - attackSign * 3.6;
  }
  if (ai.orbit > 0.5) {
    const side = me.x >= 0 ? 1 : -1;
    tx = side * 8.5;
    tz = pred.z - attackSign * 6.5;
    if (ai.orbit > 1.35) ai.orbit = 0;
  }
  const ax = tx - me.x;
  const az = tz - me.z;
  const err = wrapPi(Math.atan2(-ax, -az) - me.yaw);
  const dist = Math.hypot(ax, az);
  const gain = kickoff ? 0.85 : attackSign > 0 ? 1.35 : 1.7;
  const steer = Math.max(-1, Math.min(1, err * gain));
  let throttle = 1;
  if (Math.abs(err) > 1.25) throttle = dist < 6.5 ? -0.4 : 0.18;
  else if (Math.abs(err) > 0.65 && dist < 3.8) throttle = 0.32;
  if (kickoff) throttle = Math.abs(err) > 0.9 ? 0.45 : 1;
  const lined = Math.abs(err) < (attackSign > 0 ? 0.24 : 0.32);
  let boost = lined && !kickoff && dBall < (attackSign > 0 ? 4.2 : 6.2);
  if (needSave && lined) boost = true;
  drive(me, throttle, steer, boost, dt);
}
export { bodyFrom, botAI, carBall, carCar, drive, forwardXZ, stepBall };
