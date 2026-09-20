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
  return { kind: id, ...c.spec, x, z, yaw, vx: 0, vz: 0, boost: c.spec.boostMax, boosting: false, _ai: { t: 0, stuck: 0, lx: 0, lz: 0, mode: "hunt", modeT: 0, side: 1, orbit: 0, lastAng: 0, escape: 0, commit: 0 } };
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
function botAI(me, foe, ball, dt, attackSign, boostIntent) {
  if (attackSign !== 1 && attackSign !== -1) attackSign = 1;
  boostIntent = !!boostIntent;
  if (!me._ai) {
    me._ai = {
      t: 0, stuck: 0, lx: me.x, lz: me.z,
      mode: "hunt", modeT: 0,
      side: Math.random() < 0.5 ? 1 : -1,
      orbit: 0, lastAng: 0, escape: 0, commit: 0
    };
  }
  const ai = me._ai;
  ai.t += dt;
  ai.modeT += dt;
  if (ai.commit > 0) ai.commit = Math.max(0, ai.commit - dt);

  const goalZ = attackSign * (FL / 2);
  const ownZ = -attackSign * (FL / 2);
  const padX = FW / 2 - 2.6;
  const padZ = FL / 2 - 2.2;
  const clampApproach = (x, z) => ({
    x: Math.max(-padX, Math.min(padX, x)),
    z: Math.max(-padZ, Math.min(padZ, z))
  });

  const speed = Math.hypot(me.vx, me.vz);
  const moved = Math.hypot(me.x - ai.lx, me.z - ai.lz);
  // Stuck on boards / in place
  const nearWall = Math.abs(me.x) > FW / 2 - 3.2 || Math.abs(me.z) > FL / 2 - 2.4;
  if ((moved < 0.26 && speed < 4.2) || (nearWall && speed < 3.2 && moved < 0.45)) ai.stuck += dt;
  else {
    ai.stuck = Math.max(0, ai.stuck - dt * 1.35);
    if (ai.stuck < 0.15 && speed > 5) ai.escape = 0;
  }
  ai.lx = me.x;
  ai.lz = me.z;

  const predT = 0.14 + Math.min(0.28, Math.hypot(ball.vx, ball.vz) * 0.011);
  const pred = { x: ball.x + ball.vx * predT, z: ball.z + ball.vz * predT };
  const dBall = Math.hypot(pred.x - me.x, pred.z - me.z);
  const ballToGoal = Math.hypot(goalZ - pred.z, pred.x);
  const ballToOwn = Math.hypot(ownZ - pred.z, pred.x);
  const behindBall = (me.z - pred.z) * attackSign < -0.55;
  const betweenOwn = Math.abs(me.z - ownZ) < Math.abs(pred.z - ownZ) + 2.5;
  const rushingOwn = (ball.vz * attackSign) < -6.5 && ballToOwn < 22;
  const kickoff = Math.abs(ball.x) < 1.8 && Math.abs(ball.z) < 3.4 && Math.hypot(ball.vx, ball.vz) < 5.5 && ai.t < 2.4;

  // Anti-orbit: track bearing to ball; sustained spinning without closing = peel/commit
  const angToBall = Math.atan2(-(pred.x - me.x), -(pred.z - me.z));
  let dAng = wrapPi(angToBall - ai.lastAng);
  ai.lastAng = angToBall;
  if (dBall < 7.5 && Math.abs(dAng) > 0.45 && speed > 5 && moved > 0.15) ai.orbit += dt;
  else ai.orbit = Math.max(0, ai.orbit - dt * 0.7);

  const toGoalX = -pred.x;
  const toGoalZ = goalZ - pred.z;
  const glen = Math.hypot(toGoalX, toGoalZ) || 1;
  const ux = toGoalX / glen;
  const uz = toGoalZ / glen;

  // Desired mode (with urgency)
  let want = "strike";
  if (ai.stuck > 0.5 || ai.escape > 0) want = "unstuck";
  else if (rushingOwn || (betweenOwn && ballToOwn < 16)) want = "save";
  else if (kickoff) want = "kick";
  else if (ai.orbit > 1.35) want = "commit";
  else if (behindBall || dBall > 9.5) want = "flank";
  else want = "strike";

  // Human Ludicrous hold = commit harder (boost-as-intent)
  if (boostIntent) {
    if (want === "flank" || want === "strike") want = "commit";
    else if (want === "kick") want = "strike";
  }

  // Hysteresis / sticky modes — don't flip every frame
  const sticky = {
    unstuck: 0.95,
    save: 0.55,
    kick: 0.4,
    commit: 0.7,
    flank: 0.45,
    strike: 0.35,
    hunt: 0.3
  };
  if (want !== ai.mode) {
    const canLeave = ai.modeT >= (sticky[ai.mode] || 0.35);
    const urgent = want === "unstuck" || want === "save" || (want === "commit" && (ai.orbit > 1.8 || boostIntent));
    if (canLeave || urgent) {
      if (want === "unstuck") {
        ai.escape = Math.min(3, ai.escape + 1);
        ai.side *= -1;
      }
      if (want === "commit") ai.commit = 0.85;
      ai.mode = want;
      ai.modeT = 0;
    }
  }
  if (ai.escape > 3) ai.escape = 1;
  if (ai.mode === "unstuck" && ai.modeT > 0.7) {
    ai.mode = "flank";
    ai.modeT = 0;
    ai.stuck = 0;
  }
  if (ai.mode === "commit" && ai.modeT > 0.9) {
    ai.mode = "strike";
    ai.modeT = 0;
    ai.orbit = 0;
  }
  // Occasional side flip while flanking, but not on a short metronome
  if (ai.mode === "flank" && ai.modeT > 3.6) {
    ai.side *= -1;
    ai.modeT = 0;
  }

  let tx, tz;
  if (ai.mode === "save") {
    // Shadow the goal mouth, slide with the ball — don't kamikaze-chase
    const mouthX = Math.max(-GOAL_W * 0.42, Math.min(GOAL_W * 0.42, pred.x * 0.78));
    tx = mouthX;
    tz = ownZ + attackSign * (3.2 + Math.min(4, ballToOwn * 0.08));
  } else if (ai.mode === "kick") {
    tx = pred.x * 0.08;
    tz = pred.z - attackSign * 0.45;
  } else if (ai.mode === "unstuck") {
    // Escape ladder: reverse along facing → wide lateral → peel to open field
    const tier = ai.escape;
    const f = forwardXZ(me.yaw);
    if (tier <= 1) {
      tx = me.x - f.x * 5;
      tz = me.z - f.z * 5;
    } else if (tier === 2) {
      tx = me.x + ai.side * 8 - f.x * 2;
      tz = me.z - attackSign * 2 - f.z * 2;
    } else {
      tx = Math.max(-padX, Math.min(padX, ai.side * (FW * 0.28)));
      tz = Math.max(-padZ, Math.min(padZ, ownZ + attackSign * 12));
      ai.stuck = 0;
    }
  } else if (ai.mode === "commit") {
    // Stop orbiting — drive through the ball toward goal
    tx = pred.x + ux * 0.4;
    tz = pred.z + uz * 0.4;
  } else if (ai.mode === "flank") {
    const wide = 3.1 + Math.min(2.2, dBall * 0.08);
    tx = pred.x - ux * 4.8 + ai.side * wide;
    tz = pred.z - uz * 4.8;
  } else {
    // strike: sit just behind ball on goal line
    tx = pred.x - ux * 1.15;
    tz = pred.z - uz * 1.15;
  }

  ({ x: tx, z: tz } = clampApproach(tx, tz));

  const ax = tx - me.x;
  const az = tz - me.z;
  const err = wrapPi(Math.atan2(-ax, -az) - me.yaw);
  const dist = Math.hypot(ax, az);
  const gain =
    ai.mode === "save" ? 1.75 :
    ai.mode === "strike" || ai.mode === "commit" ? 1.2 :
    ai.mode === "unstuck" ? 1.55 : 1.4;
  const steer = Math.max(-1, Math.min(1, err * gain));

  let throttle = 1;
  if (ai.mode === "unstuck") {
    if (ai.escape <= 1) throttle = Math.abs(err) > 0.9 ? -0.75 : -0.35;
    else throttle = Math.abs(err) > 1.05 ? -0.5 : 0.85;
  } else if (ai.mode === "save") {
    throttle = dist > 5 ? 1 : (Math.abs(err) > 0.8 ? 0.35 : 0.75);
  } else if (ai.mode === "commit") {
    throttle = 1;
  } else if (Math.abs(err) > 1.35) {
    throttle = dist < 7 ? -0.4 : 0.2;
  } else if (Math.abs(err) > 0.7 && dist < 4) {
    throttle = 0.35;
  }
  if (ai.mode === "kick") throttle = Math.abs(err) > 0.85 ? 0.5 : 1;

  const lined = Math.abs(err) < (ai.mode === "strike" || ai.mode === "commit" ? 0.3 : 0.38);
  let boost = false;
  if (ai.mode === "save" && lined && dist < 8 && rushingOwn) boost = true;
  if ((ai.mode === "strike" || ai.mode === "commit") && lined && dBall < 5.8 && ballToGoal < 32) boost = true;
  if (ai.mode === "flank" && lined && dist > 9 && dBall < 13 && me.boost > 0.35) boost = ((ai.t * 3.1) % 1) < 0.18;
  if (ai.mode === "unstuck" && ai.escape >= 2 && lined) boost = true;
  if (boostIntent) boost = true;

  drive(me, throttle, steer, boost, dt);
}


export { bodyFrom, botAI, carBall, carCar, drive, forwardXZ, stepBall };
