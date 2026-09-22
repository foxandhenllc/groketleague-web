/**
 * PIXEL-mode simulation in clamp-pixel space.
 * Uses characters.json contract: uniform scale, no 44×68 anisotropic map.
 * Export ESM for browser or Node.
 */
import chars from "./characters.js";

const PIXEL = chars.modes.pixel;
const DRIVE = chars.drive;
const BALL = chars.ball;
const [CLAMP_L, CLAMP_T, CLAMP_R, CLAMP_B] = PIXEL.physics_clamp_xyxy;
const PLAY_W = CLAMP_R - CLAMP_L + 1;
const PLAY_H = CLAMP_B - CLAMP_T + 1;
const GOAL_MOUTH = PIXEL.goal_mouth_px;
const GOAL_DEPTH = PIXEL.goal_depth_px;
const NO_REHIT = BALL.no_rehit_s;
const HEAVY = DRIVE.heavy_mass_threshold;

const byId = Object.fromEntries(chars.characters.map((c) => [c.id, c]));

function forward(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Spawn car at pitch pixel coords (origin top-left of full 384×216). */
function bodyFrom(id, x, z, yaw) {
  const c = byId[id];
  if (!c) throw new Error("unknown character " + id);
  const max = PIXEL.max_px_s[id];
  const accel = PIXEL.accel_px_s2[id];
  return {
    kind: id,
    mass: c.mass,
    w: c.draw_width_px,
    l: c.draw_length_px,
    w_bu: c.w_bu,
    l_bu: c.l_bu,
    accel,
    max,
    turn: c.turn,
    grip: c.grip,
    boostMax: c.boostMax,
    boost: c.boostMax,
    boosting: false,
    x,
    z,
    yaw,
    vx: 0,
    vz: 0,
    _noRehit: 0,
    _ai: { orbit: 0, lastAng: 0, t: 0 }
  };
}

function makeBall(x, z) {
  return {
    x: x ?? (CLAMP_L + CLAMP_R) / 2,
    z: z ?? (CLAMP_T + CLAMP_B) / 2,
    y: BALL.pixel.radius_px,
    vx: 0,
    vy: 0,
    vz: 0,
    r: BALL.pixel.radius_px
  };
}

function clampCar(c) {
  const padX = c.w * 0.5;
  const padZ = c.l * 0.35;
  const loX = CLAMP_L + padX;
  const hiX = CLAMP_R - padX;
  const loZ = CLAMP_T + padZ;
  const hiZ = CLAMP_B - padZ;
  if (c.x > hiX) {
    c.x = hiX;
    c.vx *= -0.18;
  }
  if (c.x < loX) {
    c.x = loX;
    c.vx *= -0.18;
  }
  if (c.z > hiZ) {
    c.z = hiZ;
    c.vz *= -0.18;
  }
  if (c.z < loZ) {
    c.z = loZ;
    c.vz *= -0.18;
  }
}

function drive(c, throttle, steer, wantBoost, dt) {
  const { x: fwdX, z: fwdZ } = forward(c.yaw);
  const heavy = c.mass > HEAVY;
  c.boosting = false;
  if (wantBoost && c.boost > 0.05) {
    const punch = (heavy ? DRIVE.boost_punch_heavy : DRIVE.boost_punch_light) * (PIXEL.px_per_bu / 4.2);
    c.vx += fwdX * punch * dt;
    c.vz += fwdZ * punch * dt;
    c.boost -= dt * (heavy ? DRIVE.boost_drain_heavy : DRIVE.boost_drain_light);
    c.boosting = true;
  } else {
    c.boost = Math.min(c.boostMax, c.boost + dt * DRIVE.boost_regen);
  }
  c.vx += fwdX * throttle * c.accel * dt;
  c.vz += fwdZ * throttle * c.accel * dt;
  const rightX = Math.cos(c.yaw);
  const rightZ = -Math.sin(c.yaw);
  const lat = c.vx * rightX + c.vz * rightZ;
  c.vx -= rightX * lat * Math.min(1, c.grip * dt * DRIVE.grip_lat_factor);
  c.vz -= rightZ * lat * Math.min(1, c.grip * dt * DRIVE.grip_lat_factor);
  const drag = heavy ? DRIVE.drag_heavy : DRIVE.drag_light;
  c.vx *= 1 - drag * dt;
  c.vz *= 1 - drag * dt;
  const cap = c.max * (c.boosting ? (heavy ? DRIVE.boost_cap_heavy : DRIVE.boost_cap_light) : 1);
  const sp = Math.hypot(c.vx, c.vz);
  if (sp > cap) {
    c.vx *= cap / sp;
    c.vz *= cap / sp;
  }
  const speedFactor = 0.35 + Math.min(sp / Math.max(c.max, 1), 1) * 0.65;
  const heavySlow = heavy && sp > DRIVE.heavy_turn_slow_speed * PIXEL.px_per_bu ? DRIVE.heavy_turn_slow : 1;
  const reverse = throttle < -0.2 ? -1 : 1;
  if (Math.abs(throttle) > 0.05 || sp > 1) {
    c.yaw += steer * c.turn * speedFactor * heavySlow * reverse * dt;
  }
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  if (c._noRehit > 0) c._noRehit = Math.max(0, c._noRehit - dt);
  clampCar(c);
}

function carBall(c, ball) {
  if (c._noRehit > 0) return null;
  const dx = ball.x - c.x;
  const dz = ball.z - c.z;
  const { x: fwdX, z: fwdZ } = forward(c.yaw);
  const rightX = Math.cos(c.yaw);
  const rightZ = -Math.sin(c.yaw);
  const localZ = dx * fwdX + dz * fwdZ;
  const localX = dx * rightX + dz * rightZ;
  const hx = c.w * DRIVE.hitbox.w_factor + DRIVE.hitbox.pad_px;
  const hz = c.l * DRIVE.hitbox.l_factor + DRIVE.hitbox.pad_px;
  if (Math.abs(localX) < hx && Math.abs(localZ) < hz) {
    const nlen = Math.hypot(dx, dz) || 1;
    const ux = dx / nlen;
    const uz = dz / nlen;
    const rel = (ball.vx - c.vx) * ux + (ball.vz - c.vz) * uz;
    const speed = Math.hypot(c.vx, c.vz);
    let impulse = Math.max(9, 11 / c.mass + Math.abs(rel) * 1.15);
    // scale impulse into px/s feel
    impulse *= PIXEL.px_per_bu / 4.2;
    let ev = "hit";
    if ((c.kind === "cybertruck" || c.kind === "semi") && c.boosting) {
      impulse *= BALL.pancake_mult;
      ev = "pancake";
    }
    ball.vx += ux * impulse;
    ball.vz += uz * impulse;
    ball.x = c.x + ux * (hx + 0.5);
    ball.z = c.z + uz * (Math.min(hz, Math.abs(localZ)) + 0.5);
    c.vx -= ux * impulse * (0.12 * c.mass / 3);
    c.vz -= uz * impulse * (0.12 * c.mass / 3);
    c._noRehit = NO_REHIT;
    return ev;
  }
  return null;
}

function carCar(P, B) {
  const dx = P.x - B.x;
  const dz = P.z - B.z;
  const d = Math.hypot(dx, dz);
  const min = (P.l + B.l) * DRIVE.car_car_sep;
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

/** Flat PIXEL ball: no y gravity; walls = clamp; goals N/S mouths. Returns "A"|"B"|null. */
function stepBall(ball, dt) {
  ball.x += ball.vx * dt;
  ball.z += ball.vz * dt;
  ball.vx *= BALL.ground_friction;
  ball.vz *= BALL.ground_friction;

  const midX = (CLAMP_L + CLAMP_R) / 2;
  const halfMouth = GOAL_MOUTH / 2;
  const inMouth = Math.abs(ball.x - midX) < halfMouth - ball.r * 0.25;

  if (ball.x > CLAMP_R - ball.r) {
    ball.x = CLAMP_R - ball.r;
    ball.vx *= BALL.wall_restitution;
  }
  if (ball.x < CLAMP_L + ball.r) {
    ball.x = CLAMP_L + ball.r;
    ball.vx *= BALL.wall_restitution;
  }

  // North goal (team A scores when ball exits south? — match 3D: z<=-halfZ scores A)
  // PIXEL: z increases downward. North=top=smaller z. Ball past north mouth → score for south attacker = "B"
  // Keep labels: "A" = scored in north net (bottom player scores), "B" = scored in south net.
  if (inMouth && ball.z <= CLAMP_T + GOAL_DEPTH) {
    return "A";
  }
  if (inMouth && ball.z >= CLAMP_B - GOAL_DEPTH) {
    return "B";
  }

  if (!inMouth) {
    if (ball.z > CLAMP_B - ball.r) {
      ball.z = CLAMP_B - ball.r;
      ball.vz *= BALL.wall_restitution;
    }
    if (ball.z < CLAMP_T + ball.r) {
      ball.z = CLAMP_T + ball.r;
      ball.vz *= BALL.wall_restitution;
    }
  } else {
    // inside mouth corridor: allow deeper into goal depth then score
    if (ball.z < CLAMP_T - 2) return "A";
    if (ball.z > CLAMP_B + 2) return "B";
  }
  return null;
}

/** Column index 0..7 from yaw; N = screen-down = yaw≈0 in our forward(). */
function yawToCol(yaw) {
  const a = wrapPi(yaw);
  // N=0 when facing +screen-down; forward uses -sin/-cos so yaw 0 → (0,-1) screen up in y-down? 
  // Contract: N faces screen-DOWN. With z+ down, forward screen-down is +z → yaw = π
  // Use 8 sectors centered on directions.
  const twoPi = Math.PI * 2;
  let t = (a + twoPi) % twoPi;
  // Map: facing +z (down) = N = col 0. atan2(x,z) with x right z down.
  const facing = Math.atan2(-Math.sin(a), -Math.cos(a)); // dir of forward in (x,z)
  // forward vector (fx,fz); angle from +z axis
  const fx = -Math.sin(a);
  const fz = -Math.cos(a);
  let ang = Math.atan2(fx, fz); // 0 = +z = screen down = N
  if (ang < 0) ang += twoPi;
  const col = Math.round(ang / (Math.PI / 4)) % 8;
  return col;
}

function kickoffPositions() {
  const cx = (CLAMP_L + CLAMP_R) / 2;
  const cy = (CLAMP_T + CLAMP_B) / 2;
  return {
    ball: { x: cx, z: cy },
    // P north of center facing south; B south facing north — tune in integration
    P: { x: cx, z: cy - 40, yaw: Math.PI },
    B: { x: cx, z: cy + 40, yaw: 0 }
  };
}

const PIXEL_BOUNDS = {
  clamp: [CLAMP_L, CLAMP_T, CLAMP_R, CLAMP_B],
  playable: [PLAY_W, PLAY_H],
  goalMouth: GOAL_MOUTH,
  goalDepth: GOAL_DEPTH
};

export {
  chars,
  byId,
  PIXEL_BOUNDS,
  bodyFrom,
  makeBall,
  drive,
  carBall,
  carCar,
  stepBall,
  yawToCol,
  kickoffPositions,
  forward,
  wrapPi
};
