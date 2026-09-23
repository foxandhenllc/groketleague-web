import { byId, FW, FL, GOAL_W, GOAL_H, pixelFieldSize, ballRadius, CHARACTERS } from "./catalog.js";
import { planDrive } from "./autopilot.js";
import { cornerContact, GOAL_DEPTH } from "./arena-geometry.js";
function forwardXZ(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
function bodyFrom(id, x, z, yaw) {
  const c = byId(id);
  return { kind: id, ...c.spec, x, z, yaw, vx: 0, vz: 0, boost: c.spec.boostMax, boosting: false, _noRehit: 0, _ai: {} };
}
let pixelTight = false;
let fieldW = FW;
let fieldL = FL;
const NO_REHIT = (CHARACTERS.ball && CHARACTERS.ball.no_rehit_s) || 0.08;
export function setPixelTight(on) {
  pixelTight = !!on;
  if (on) {
    const p = pixelFieldSize();
    fieldW = p.fieldW;
    fieldL = p.fieldL;
  } else {
    fieldW = FW;
    fieldL = FL;
  }
}
export function getField() {
  return { FW: fieldW, FL: fieldL, pixelTight, GOAL_W: goalW(), goalDepth: pixelTight ? GOAL_DEPTH : 0, ballRadius: getBallRadius() };
}
export function getBallRadius() { return ballRadius(pixelTight); }
function goalW() {
  return GOAL_W * (fieldW / FW);
}

function clampFieldCar(c) {
  const sin = Math.abs(Math.sin(c.yaw)), cos = Math.abs(Math.cos(c.yaw));
  const extentX = cos * c.w * .55 + sin * c.l * .5;
  const extentZ = sin * c.w * .55 + cos * c.l * .5;
  const inGoal = pixelTight && Math.abs(c.x) + extentX < goalW() / 2;
  const limX = fieldW / 2 - extentX;
  const limZ = fieldL / 2 + (inGoal ? GOAL_DEPTH : 0) - extentZ;
  if (c.x > limX) { c.x = limX; if (c.vx > 0) c.vx *= -.18; }
  if (c.x < -limX) { c.x = -limX; if (c.vx < 0) c.vx *= -.18; }
  if (c.z > limZ) { c.z = limZ; if (c.vz > 0) c.vz *= -.18; }
  if (c.z < -limZ) { c.z = -limZ; if (c.vz < 0) c.vz *= -.18; }
  if (pixelTight) {
    const f = forwardXZ(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const contact = cornerContact(c.x + rx * c.w * .55 * sx + f.x * c.l * .5 * sz,
        c.z + rz * c.w * .55 * sx + f.z * c.l * .5 * sz, fieldW / 2, fieldL / 2);
      if (!contact) continue;
      c.x -= contact.nx * contact.depth; c.z -= contact.nz * contact.depth;
      const outward = c.vx * contact.nx + c.vz * contact.nz;
      if (outward > 0) { c.vx -= 1.18 * outward * contact.nx; c.vz -= 1.18 * outward * contact.nz; }
    }
  }
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
  const speedFactor = 0.55 + Math.min(sp / Math.max(c.max, 1), 1) * 0.45;
  const heavySlow = c.mass > 3 && sp > 11 ? 0.7 : 1;
  const longitudinal = c.vx * fwdX + c.vz * fwdZ;
  const reverse = Math.abs(longitudinal) > .3 ? Math.sign(longitudinal) : (throttle < 0 ? -1 : 1);
  if (Math.abs(throttle) > 0.05 || sp > 1) {
    c.yaw += steer * c.turn * speedFactor * heavySlow * reverse * dt;
  }
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  if (c._noRehit > 0) c._noRehit = Math.max(0, c._noRehit - dt);
  clampFieldCar(c);
}
function carBall(c, ball) {
  const radius = getBallRadius();
  if (!pixelTight && ball.y - radius >= 1.25) return null;
  const dx = ball.x - c.x;
  const dz = ball.z - c.z;
  const { x: fwdX, z: fwdZ } = forwardXZ(c.yaw);
  const rightX = Math.cos(c.yaw);
  const rightZ = -Math.sin(c.yaw);
  const localZ = dx * fwdX + dz * fwdZ;
  const localX = dx * rightX + dz * rightZ;
  const hx = c.w * 0.55;
  const hz = c.l * 0.5;
  const closestX = Math.max(-hx, Math.min(hx, localX));
  const closestZ = Math.max(-hz, Math.min(hz, localZ));
  const edgeX = localX - closestX, edgeZ = localZ - closestZ;
  const distance = Math.hypot(edgeX, edgeZ);
  if (distance >= radius) return null;

  let nx, nz, penetration;
  if (distance > 1e-8) {
    nx = edgeX / distance; nz = edgeZ / distance;
    penetration = radius - distance;
  } else if (hx - Math.abs(localX) < hz - Math.abs(localZ)) {
    nx = localX < 0 ? -1 : 1; nz = 0;
    penetration = hx - Math.abs(localX) + radius;
  } else {
    nx = 0; nz = localZ < 0 ? -1 : 1;
    penetration = hz - Math.abs(localZ) + radius;
  }
  const ux = nx * rightX + nz * fwdX;
  const uz = nx * rightZ + nz * fwdZ;
  // Resolve in the rotated contact direction, even during the sound cooldown.
  const invBall = 1 / CHARACTERS.ball.mass, invCar = 1 / c.mass;
  const separation = (penetration + 1e-5) / (invBall + invCar);
  ball.x += ux * separation * invBall; ball.z += uz * separation * invBall;
  c.x -= ux * separation * invCar; c.z -= uz * separation * invCar;
  const rel = (ball.vx - c.vx) * ux + (ball.vz - c.vz) * uz;
  if (rel >= 0) return null; // Separating/resting contacts must never add a kick.

  const pancake = (c.kind === "cybertruck" || c.kind === "semi") && c.boosting;
  const restitution = -rel < 1 ? 0 : Math.min(1,
    CHARACTERS.ball.contact_restitution * (pancake ? CHARACTERS.ball.pancake_mult : 1));
  const impulse = -(1 + restitution) * rel / (invBall + invCar);
  ball.vx += ux * impulse * invBall;
  ball.vz += uz * impulse * invBall;
  c.vx -= ux * impulse * invCar;
  c.vz -= uz * impulse * invCar;
  if (c._noRehit > 0 || -rel < 1) return null;
  c._noRehit = NO_REHIT;
  if (!pixelTight) ball.vy = Math.max(ball.vy, Math.min(pancake ? 1.2 : 5.5, -rel * 0.2));
  return pancake ? "pancake" : "hit";
}
function carCar(P, B) {
  const axes = c => [{ x: Math.cos(c.yaw), z: -Math.sin(c.yaw) }, forwardXZ(c.yaw)];
  const pAxes = axes(P), bAxes = axes(B);
  const extent = (c, basis, axis) => Math.abs(basis[0].x * axis.x + basis[0].z * axis.z) * c.w * .55
    + Math.abs(basis[1].x * axis.x + basis[1].z * axis.z) * c.l * .5;
  let overlap = Infinity, nx = 0, nz = 0;
  for (const axis of [...pAxes, ...bAxes]) {
    const distance = (P.x - B.x) * axis.x + (P.z - B.z) * axis.z;
    const penetration = extent(P, pAxes, axis) + extent(B, bAxes, axis) - Math.abs(distance);
    if (penetration <= 0) return false;
    if (penetration < overlap) { overlap = penetration; const sign = distance < 0 ? -1 : 1; nx = axis.x * sign; nz = axis.z * sign; }
  }
  const invP = 1 / P.mass, invB = 1 / B.mass, total = invP + invB;
  P.x += nx * (overlap + 1e-5) * invP / total; P.z += nz * (overlap + 1e-5) * invP / total;
  B.x -= nx * (overlap + 1e-5) * invB / total; B.z -= nz * (overlap + 1e-5) * invB / total;
  clampFieldCar(P); clampFieldCar(B);
  const closing = (P.vx - B.vx) * nx + (P.vz - B.vz) * nz;
  if (closing >= 0) return false;
  const impulse = -(1 + .25) * closing / total;
  P.vx += nx * impulse * invP; P.vz += nz * impulse * invP;
  B.vx -= nx * impulse * invB; B.vz -= nz * impulse * invB;
  return closing < -2;
}
function stepBall(ball, dt) {
  const radius = getBallRadius();
  // Hard caps so a sticky contact can never send transforms to Infinity
  const spd = Math.hypot(ball.vx, ball.vz);
  if (spd > 55) { ball.vx *= 55 / spd; ball.vz *= 55 / spd; }
  if (ball.vy > 28) ball.vy = 28;
  if (ball.vy < -40) ball.vy = -40;
  if (ball.y > 18) { ball.y = 18; ball.vy = Math.min(ball.vy, 0); }
  if (pixelTight) { ball.y = radius; ball.vy = 0; }
  const rolling = pixelTight || (ball.y <= radius + 1e-6 && ball.vy <= 0);
  if (rolling) {
    // The old 0.986-per-frame drag is calibrated at 60 Hz. Integrate it in seconds.
    const drag = -Math.log(CHARACTERS.ball.ground_friction) * 60;
    const decay = Math.exp(-drag * dt);
    const travel = (1 - decay) / drag;
    ball.x += ball.vx * travel; ball.z += ball.vz * travel;
    ball.vx *= decay; ball.vz *= decay;
    ball.y = radius; ball.vy = 0;
  } else {
    ball.x += ball.vx * dt; ball.z += ball.vz * dt;
    ball.y += ball.vy * dt - 0.5 * CHARACTERS.ball.gravity_3d * dt * dt;
    ball.vy -= CHARACTERS.ball.gravity_3d * dt;
    if (ball.y < radius) {
      ball.y = radius; ball.vy *= -0.42;
      if (Math.abs(ball.vy) < 1.1) ball.vy = 0;
    }
  }
  const halfZ = fieldL / 2;
  const wallX = fieldW / 2 + (pixelTight ? 0 : 0.9) - radius;
  if (ball.x > wallX) { ball.x = wallX; if (ball.vx > 0) ball.vx *= -0.62; }
  if (ball.x < -wallX) { ball.x = -wallX; if (ball.vx < 0) ball.vx *= -0.62; }
  if (pixelTight) {
    const corner = cornerContact(ball.x, ball.z, fieldW / 2, halfZ, radius);
    if (corner) {
      ball.x -= corner.nx * corner.depth; ball.z -= corner.nz * corner.depth;
      const outward = ball.vx * corner.nx + ball.vz * corner.nz;
      if (outward > 0) { ball.vx -= 1.62 * outward * corner.nx; ball.vz -= 1.62 * outward * corner.nz; }
    }
  }
  const inMouth = Math.abs(ball.x) + radius < goalW() / 2 && (pixelTight || ball.y + radius < GOAL_H);
  if (inMouth && ball.z + radius <= -halfZ) return "A";
  if (inMouth && ball.z - radius >= halfZ) return "B";
  if (!inMouth) {
    const endWall = halfZ - radius;
    if (ball.z > endWall) { ball.z = endWall; if (ball.vz > 0) ball.vz *= -0.62; }
    if (ball.z < -endWall) { ball.z = -endWall; if (ball.vz < 0) ball.vz *= -0.62; }
  }
  return null;
}
function botAI(me, foe, ball, dt, attackSign = 1, boostIntent) {
  const input = planDrive(me, foe, ball, dt, attackSign, getField(), boostIntent);
  drive(me, input.throttle, input.steer, input.boost, dt);
}

export { bodyFrom, botAI, carBall, carCar, drive, forwardXZ, stepBall };



