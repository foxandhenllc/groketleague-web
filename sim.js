import { byId, FW, FL, GOAL_W, GOAL_H } from "./catalog.js";
function forwardXZ(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
function bodyFrom(id, x, z, yaw) {
  const c = byId(id);
  return { kind: id, ...c.spec, x, z, yaw, vx: 0, vz: 0, boost: c.spec.boostMax, boosting: false };
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
function botAI(B, P, ball, dt) {
  const pred = { x: ball.x + ball.vx * 0.35, z: ball.z + ball.vz * 0.35 };
  const ballInOwnThird = pred.z < -FL * 0.18;
  const dBall = Math.hypot(pred.x - B.x, pred.z - B.z);
  const youCloser = Math.hypot(ball.x - P.x, ball.z - P.z) + 1.2 < dBall;
  let tx, tz;
  if (ballInOwnThird && (youCloser || pred.z < -18)) {
    tx = pred.x * 0.7;
    tz = Math.min(pred.z - 2.2, -20);
  } else {
    tx = pred.x;
    tz = pred.z - 3.1;
  }
  if (B.z > ball.z + 0.6 && Math.abs(B.x - ball.x) < 3 && !ballInOwnThird) {
    tx = ball.x + (B.x >= ball.x ? 4.5 : -4.5);
    tz = ball.z - 4;
  }
  const ax = tx - B.x;
  const az = tz - B.z;
  let err = Math.atan2(-ax, -az) - B.yaw;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, err * 2.1));
  const dist = Math.hypot(ax, az);
  let throttle = dist > 1 ? 1 : 0.35;
  if (Math.abs(err) > 1.2 && dist < 5) throttle = 0.25;
  const shouldBoost = Math.abs(err) < 0.38 && (dBall > 7 || dBall < 5);
  drive(B, throttle, steer, shouldBoost, dt);
}
export { bodyFrom, botAI, carBall, carCar, drive, forwardXZ, stepBall };
