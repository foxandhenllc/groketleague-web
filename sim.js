import { SINK, drainGoal } from './sink.js';
import { updateMove, movePhase } from './skills.js';
import { updateBoost } from "./boost.js";
import { createContactSolver } from "./contacts.js";
import { byId } from "./catalog.js";
import { planDrive } from "./autopilot.js";
import { simulationConfig } from "./simulation-config.js";
import { createDiagnostics } from "./diagnostics.js";
import { cornerContact } from "./arena-geometry.js";
export function createSimulation(mode = '3d', config = simulationConfig, diagnostics = createDiagnostics()) {
  const CHARACTERS = config;
  const contactSolver = createContactSolver(config, diagnostics);
  const solveContacts = (cars, ball, dt) => contactSolver.solve(cars, ball, getField(), dt);
  const resetContacts = () => contactSolver.reset();
function forwardXZ(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
function bodyFrom(id, x, z, yaw) {
  const spec = config.cars.find(c => c.id === id);
  if (!spec) throw new TypeError("Unknown car: " + id);
  const { id: _id, ...stats } = spec;
  return { kind: id, ...byId(id).spec, ...stats, hx:stats.w*config.drive.hitbox.w_factor, hz:stats.l*config.drive.hitbox.l_factor, x, z, yaw, vx: 0, vz: 0, boost: spec.boostMax, boosting: false, _noRehit: 0, _ai: {} };
}
let sink = false;
function setSink(on) { sink=!!on; }
let pixelTight = mode === 'pixel';
let fieldW = config.modes[mode].width;
let fieldL = config.modes[mode].length;
const NO_REHIT = (CHARACTERS.ball && CHARACTERS.ball.no_rehit_s) || 0.08;
function setPixelTight(on) {
  pixelTight = !!on;
  const geometry = config.modes[on ? 'pixel' : '3d'];
  fieldW = geometry.width; fieldL = geometry.length;
}
function getField() {
  return { sink, drainZ:sink?SINK.drainZ:undefined, FW: fieldW, FL: fieldL, pixelTight, corner:config.modes[pixelTight ? 'pixel' : '3d'].corner, GOAL_W: goalW(), goalDepth: config.modes[pixelTight ? 'pixel' : '3d'].depth, ballRadius: getBallRadius(), config };
}
function getBallRadius() { return pixelTight ? config.ball.radiusPixel : config.ball.radius3d; }
function goalW() {
  return config.modes[pixelTight ? 'pixel' : '3d'].goalWidth;
}

function clampFieldCar(c) {
  const sin = Math.abs(Math.sin(c.yaw)), cos = Math.abs(Math.cos(c.yaw));
  const extentX = cos * c.hx + sin * c.hz;
  const extentZ = sin * c.hx + cos * c.hz;
  const inGoal = !sink && pixelTight && Math.abs(c.x) + extentX < goalW() / 2;
  const limX = fieldW / 2 - extentX;
  const limZ = fieldL / 2 + (inGoal ? config.modes.pixel.depth : 0) - extentZ;
  if (c.x > limX) { c.x = limX; if (c.vx > 0) c.vx *= -config.drive.boardRestitution; }
  if (c.x < -limX) { c.x = -limX; if (c.vx < 0) c.vx *= -config.drive.boardRestitution; }
  if (c.z > limZ) { c.z = limZ; if (c.vz > 0) c.vz *= -config.drive.boardRestitution; }
  if (c.z < -limZ) { c.z = -limZ; if (c.vz < 0) c.vz *= -config.drive.boardRestitution; }
  if (getField().corner > 0) {
    const f = forwardXZ(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const contact = cornerContact(c.x + rx * c.hx * sx + f.x * c.hz * sz,
        c.z + rz * c.hx * sx + f.z * c.hz * sz, fieldW / 2, fieldL / 2, 0, getField().corner);
      if (!contact) continue;
      c.x -= contact.nx * contact.depth; c.z -= contact.nz * contact.depth;
      const outward = c.vx * contact.nx + c.vz * contact.nz;
      if (outward > 0) { c.vx -= (1 + config.drive.boardRestitution) * outward * contact.nx; c.vz -= (1 + config.drive.boardRestitution) * outward * contact.nz; }
    }
  }
}

function drive(c, throttle, steer, wantBoost, dt, command = {}) {
  c.shock=Math.max(0,(c.shock||0)-dt);
  if(c.shock>0) { throttle=0; command={...command,safe:false,reason:'ZAPPED',desiredSpeed:0}; }
  const phase = movePhase(c, config), move = config.skills.moves[c.kind];
  if (phase === 'windup' || phase === 'active') steer *= move.turn;
  if (phase === 'recovery') command = {...command, safe:false, reason:'RECOVERING', desiredSpeed:Math.min(command.desiredSpeed ?? c.max, c.max*.55)};
  if (phase === 'active' && c.kind === 'semi') { throttle = 0; command = {...command, safe:false, reason:'BRACING', desiredSpeed:0}; }
  const d = config.drive, heavy = c.mass > d.heavy_mass_threshold;
  const { x: fwdX, z: fwdZ } = forwardXZ(c.yaw);
  const u = c.vx * fwdX + c.vz * fwdZ;
  const active = updateBoost(c, !!wantBoost, command.safe !== false, dt, config, command.reason);
  const cap = c.max * (c.boosting ? heavy ? d.boost_cap_heavy : d.boost_cap_light : 1);
  const drag = heavy ? d.drag_heavy : d.drag_light;
  const brake = c.brake;
  let acceleration;
  if (command.desiredSpeed !== undefined) {
    const target = c.boosting ? Math.max(command.desiredSpeed, cap) : command.desiredSpeed;
    acceleration = Math.max(-brake, Math.min(c.accel, (target - u) / d.controlSeconds + u * drag));
  } else acceleration = throttle >= 0 ? throttle * c.accel : (u > d.reverseEntry ? throttle * brake : throttle * c.accel);
  if (command.desiredSpeed === undefined && !c.boosting && throttle < 0 && u > d.reverseEntry) acceleration = Math.max(-brake, throttle * brake);
  if (u < -d.reverseMax && acceleration < 0) acceleration = 0;
  if (acceleration > 0) acceleration *= Math.max(.75, Math.min(1, 1 - d.accelerationTaper * (u / cap) ** 2));
  if (u >= cap && acceleration > 0) acceleration = 0;
  const punch = heavy ? d.boost_punch_heavy : d.boost_punch_light;
  // Propulsion stops at its target; existing collision overspeed is never snapped down.
  const propulsion = acceleration * dt + (u < cap ? punch * active : 0);
  const applied = propulsion > 0 ? Math.min(propulsion, Math.max(0, cap - u)) : propulsion;
  c.vx += fwdX * applied; c.vz += fwdZ * applied;
  const rightX = Math.cos(c.yaw), rightZ = -Math.sin(c.yaw);
  const lat = c.vx * rightX + c.vz * rightZ;
  const damping = 1 - Math.exp(-c.grip * d.grip_lat_factor * dt);
  c.vx -= rightX * lat * damping; c.vz -= rightZ * lat * damping;
  const decay = Math.exp(-drag * dt); c.vx *= decay; c.vz *= decay;
  const sp = Math.hypot(c.vx, c.vz);
  if (sp > c.max * (heavy ? d.boost_cap_heavy : d.boost_cap_light) * 1.1) diagnostics.count('carOverspeed');
  if (!Number.isFinite(sp) || sp > d.invalidSpeed) { diagnostics.count('invalidCarSpeed'); throw new Error('Invalid car speed'); }
  const speedFactor = .55 + Math.min(sp / c.max, 1) * .45;
  const heavySlow = heavy && sp > d.heavy_turn_slow_speed ? d.heavy_turn_slow : 1;
  const longitudinal = c.vx * fwdX + c.vz * fwdZ;
  const reverse = Math.abs(longitudinal) > .3 ? Math.sign(longitudinal) : (throttle < 0 ? -1 : 1);
  if (Math.abs(throttle) > .05 || sp > 1) c.yaw += steer * c.turn * speedFactor * heavySlow * reverse * dt;
  if (phase === 'active' && c.shock<=0) {
    if (c.kind === 'semi') { const stop=Math.exp(-12*dt); c.vx*=stop; c.vz*=stop; }
    else if (c.kind === 'cybercab') { c.vx += rightX*c.move.side*move.push*dt; c.vz += rightZ*c.move.side*move.push*dt; }
    else if (u < c.max*1.35) { c.vx += fwdX*move.push*dt; c.vz += fwdZ*move.push*dt; }
  }
  c.x += c.vx * dt; c.z += c.vz * dt;
  if (c._noRehit > 0) c._noRehit = Math.max(0, c._noRehit - dt);
  clampFieldCar(c);
}
function carBall(c, ball) {
  const radius = getBallRadius();
  if (!pixelTight && ball.y - radius >= config.ball.carHeight) return null;
  const dx = ball.x - c.x;
  const dz = ball.z - c.z;
  const { x: fwdX, z: fwdZ } = forwardXZ(c.yaw);
  const rightX = Math.cos(c.yaw);
  const rightZ = -Math.sin(c.yaw);
  const localZ = dx * fwdX + dz * fwdZ;
  const localX = dx * rightX + dz * rightZ;
  const hx = c.hx;
  const hz = c.hz;
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
  const extent = (c, basis, axis) => Math.abs(basis[0].x * axis.x + basis[0].z * axis.z) * c.hx
    + Math.abs(basis[1].x * axis.x + basis[1].z * axis.z) * c.hz;
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
  const impulse = -(1 + config.drive.carRestitution) * closing / total;
  P.vx += nx * impulse * invP; P.vz += nz * impulse * invP;
  B.vx -= nx * impulse * invB; B.vz -= nz * impulse * invB;
  return closing < -2;
}
function stepBall(ball, dt) {
  const radius = getBallRadius();
  // Hard caps so a sticky contact can never send transforms to Infinity
  const spd = Math.hypot(ball.vx, ball.vz);
  if (spd > config.ball.maxSpeed || ball.vy > config.ball.maxUp || ball.vy < config.ball.maxDown || ball.y > config.ball.maxHeight) {
    diagnostics.count("ballSafetyCap"); diagnostics.lastFailure = { type:'ballSafetyCap', ball:{...ball}, speed:spd };
    if (diagnostics.enabled) throw new Error('Ball safety cap would activate; inspect exported trace');
  }
  if (spd > config.ball.maxSpeed) { ball.vx *= config.ball.maxSpeed / spd; ball.vz *= config.ball.maxSpeed / spd; }
  if (ball.vy > config.ball.maxUp) ball.vy = config.ball.maxUp;
  if (ball.vy < config.ball.maxDown) ball.vy = config.ball.maxDown;
  if (ball.y > config.ball.maxHeight) { ball.y = config.ball.maxHeight; ball.vy = Math.min(ball.vy, 0); }
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
      ball.y = radius; ball.vy *= -config.ball.floor_restitution;
      if (Math.abs(ball.vy) < config.ball.settleSpeed) ball.vy = 0;
    }
  }
  const halfZ = fieldL / 2;
  const wallX = fieldW / 2 + config.modes[pixelTight ? 'pixel' : '3d'].sideOffset - radius;
  if (ball.x > wallX) { ball.x = wallX; if (ball.vx > 0) ball.vx *= -config.ball.wall_restitution; }
  if (ball.x < -wallX) { ball.x = -wallX; if (ball.vx < 0) ball.vx *= -config.ball.wall_restitution; }
  if (getField().corner > 0) {
    const corner = cornerContact(ball.x, ball.z, fieldW / 2, halfZ, radius, getField().corner);
    if (corner) {
      ball.x -= corner.nx * corner.depth; ball.z -= corner.nz * corner.depth;
      const outward = ball.vx * corner.nx + ball.vz * corner.nz;
      if (outward > 0) { ball.vx -= (1 + config.ball.wall_restitution) * outward * corner.nx; ball.vz -= (1 + config.ball.wall_restitution) * outward * corner.nz; }
    }
  }
  if(sink) { const goal=drainGoal(ball,radius); if(goal)return goal; }
  const inMouth = !sink && Math.abs(ball.x) + radius < goalW() / 2 && (pixelTight || ball.y + radius < config.modes['3d'].goalHeight);
  if (inMouth && ball.z + radius <= -halfZ) return "A";
  if (inMouth && ball.z - radius >= halfZ) return "B";
  if (!inMouth) {
    const endWall = halfZ - radius;
    if (ball.z > endWall) { ball.z = endWall; if (ball.vz > 0) ball.vz *= -config.ball.wall_restitution; }
    if (ball.z < -endWall) { ball.z = -endWall; if (ball.vz < 0) ball.vz *= -config.ball.wall_restitution; }
  }
  return null;
}
function botAI(me, foe, ball, dt, attackSign = 1, boostIntent, controls = {}) {
  me.attackSign = attackSign;
  me.tactic = ['attack','defend'].includes(controls.tactic) ? controls.tactic : 'auto';
  const distance = Math.hypot(ball.x-me.x,ball.z-me.z);
  const cpuMove = boostIntent === undefined && (me.kind === 'semi'
    ? ball.vz*attackSign < -5 && distance < me.l/2+7 && (me.z-ball.z)*attackSign < 0
    : me._ai?.mode === 'strike' && distance < me.l/2+7 && distance > me.l/2+1);
  updateMove(me, ball, dt, controls.special === true || cpuMove, config);
  const input = planDrive(me, foe, ball, dt, attackSign, getField(), boostIntent);
  drive(me, input.throttle, input.steer, input.boost, dt, input);
}

return { setSink, bodyFrom, botAI, carBall, carCar, drive, forwardXZ, stepBall, getField, getBallRadius, setPixelTight, diagnostics, solveContacts, resetContacts };
}
const defaultSimulation = createSimulation();
export const { setSink, bodyFrom, botAI, carBall, carCar, drive, forwardXZ, stepBall, getField, getBallRadius, setPixelTight, diagnostics, solveContacts, resetContacts } = defaultSimulation;
