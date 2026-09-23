import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CATALOG } from '../catalog.js';
import { planDrive } from '../autopilot.js';
import { bodyFrom, botAI, carBall, carCar, drive, stepBall, getField, getBallRadius, setPixelTight } from '../sim.js';
import { arenaLayout } from '../arena-layout.js';
import { cornerContact, CORNER_RADIUS } from '../arena-geometry.js';

const dt = 1 / 120;
const ballAt = (x = 0, z = 0) => ({ x, z, y: getBallRadius(), vx: 0, vz: 0, vy: 0 });

for (const car of CATALOG) {
  for (const wrongSide of [false, true]) test(`${car.id}: ${wrongSide ? 'go around the ball and shoot' : 'take an open straight shot'}`, () => {
    setPixelTight(true);
    const me = bodyFrom(car.id, 0, wrongSide ? -8 : 14, 0);
    const foe = bodyFrom('model3', -18, -28, Math.PI), ball = ballAt();
    let goal = null;
    for (let i = 0; i < 30 / dt && !goal; i++) {
      botAI(me, foe, ball, dt, -1, false); carBall(me, ball); goal = stepBall(ball, dt);
    }
    assert.equal(goal, 'A', 'finish in the opposing goal instead of orbiting or scoring an own goal');
  });
  test(`${car.id}: recover when initially facing into a board`, () => {
    setPixelTight(true);
    const me = bodyFrom(car.id, 20, 14, -Math.PI / 2), foe = bodyFrom('model3', -18, -28, Math.PI), ball = ballAt();
    let closest = Infinity;
    for (let i = 0; i < 10 / dt; i++) {
      botAI(me, foe, ball, dt, -1, false); carBall(me, ball); stepBall(ball, dt);
      closest = Math.min(closest, Math.hypot(me.x - ball.x, me.z - ball.z));
    }
    assert.ok(closest < me.l / 2 + getBallRadius() + 1, 'leave the board and reach the ball within ten seconds');
  });
}

test('a player does not spend boost without input, and a lined-up hold does boost', () => {
  setPixelTight(true);
  const me = bodyFrom('model3', 0, 10, 0), foe = bodyFrom('cybercab', 0, -20, Math.PI), ball = ballAt();
  for (let i = 0; i < 120; i++) botAI(me, foe, ball, dt, -1, false);
  assert.equal(me.boost, me.boostMax);
  Object.assign(me, { x: 0, z: 10, yaw: 0, vx: 0, vz: 0, _ai: {} });
  botAI(me, foe, ball, dt, -1, true);
  assert.equal(me.boosting, true);
});

test('an incoming ball triggers a retreat toward the defended goal', () => {
  setPixelTight(true);
  const me = bodyFrom('model3', 9, 0, 0), foe = bodyFrom('cybercab', 0, 5, Math.PI), ball = ballAt(0, 18);
  ball.vz = 12;
  const plan = planDrive(me, foe, ball, dt, -1, getField(), false);
  assert.equal(plan.state, 'defend');
  assert.ok(me._ai.target.z > ball.z, 'recover goal-side of the incoming ball');
  assert.equal(plan.boost, false);
});

test('braking while travelling forward does not reverse steering', () => {
  setPixelTight(true);
  const me = bodyFrom('model3', 0, 10, 0); me.vz = -10;
  drive(me, -1, 1, false, dt);
  assert.ok(me.yaw > 0);
});

test('car contacts use oriented footprints and never kick resting/separating cars', () => {
  setPixelTight(true);
  const a = bodyFrom('semi', 0, 0, 0), b = bodyFrom('model3', 3, 0, 0);
  const before = [a.x, a.z, b.x, b.z];
  assert.equal(carCar(a, b), false); assert.deepEqual([a.x, a.z, b.x, b.z], before, 'long cars can pass side by side');
  b.x = 1.5; assert.equal(carCar(a, b), false);
  assert.equal(Math.hypot(a.vx, a.vz, b.vx, b.vz), 0);
  b.x = 1.5; b.vx = 8;
  carCar(a, b); assert.equal(b.vx, 8); assert.equal(a.vx, 0);
});

test('rounded corner rebounds match the painted boards without adding energy', () => {
  setPixelTight(true);
  const f = getField(), r = getBallRadius();
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const b = ballAt(x * (f.FW / 2 - 1), z * (f.FL / 2 - 1));
    b.vx = x * 12; b.vz = z * 12;
    stepBall(b, dt);
    assert.equal(cornerContact(b.x, b.z, f.FW / 2, f.FL / 2, r - 1e-6), null);
    assert.ok(b.vx * x + b.vz * z < 0);
    assert.ok(Math.hypot(b.vx, b.vz) < Math.hypot(12, 12));
    assert.ok(CORNER_RADIUS > r);
  }
});

test('vehicle corners remain inside the arena while rotating against a wall', () => {
  setPixelTight(true);
  for (const spec of CATALOG) for (let i = 0; i < 32; i++) {
    const yaw = i * Math.PI / 16, c = bodyFrom(spec.id, 22, 34, yaw);
    drive(c, 1, 1, false, dt);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = c.x + Math.cos(c.yaw) * c.w * .55 * sx - Math.sin(c.yaw) * c.l * .5 * sz;
      const z = c.z - Math.sin(c.yaw) * c.w * .55 * sx - Math.cos(c.yaw) * c.l * .5 * sz;
      assert.ok(Math.abs(x) <= 22 + 1e-6 && Math.abs(z) <= 34 + 1e-6);
      assert.equal(cornerContact(x, z, 22, 34, -1e-6), null);
    }
  }
});

test('portrait and landscape fit the complete arena at one uniform scale', () => {
  for (const [width, height] of [[1440, 640], [390, 624], [320, 348], [844, 260]]) {
    const view = arenaLayout(width, height);
    const worldW = view.landscape ? 83 : 54, worldH = view.landscape ? 54 : 83;
    assert.ok(view.scale * worldW <= width && view.scale * worldH <= height);
    assert.equal(view.cx, width / 2); assert.equal(view.cy, height / 2);
  }
});

test('sixteen 90-second matchups stay finite and break stationary-ball stalemates', () => {
  setPixelTight(true);
  const results = [];
  for (const a of CATALOG) for (const b of CATALOG) {
    let P = bodyFrom(a.id, 0, 14, 0), B = bodyFrom(b.id, 0, -14, Math.PI), ball = ballAt();
    let stationary = 0, longest = 0, contacts = 0;
    const goals = [0, 0];
    for (let i = 0; i < 90 / dt; i++) {
      botAI(P, B, ball, dt, -1, false); botAI(B, P, ball, dt, 1);
      carCar(P, B); if (carBall(P, ball)) contacts++; if (carBall(B, ball)) contacts++;
      const goal = stepBall(ball, dt);
      assert.ok([P.x, P.z, P.yaw, B.x, B.z, B.yaw, ball.x, ball.z, ball.vx, ball.vz].every(Number.isFinite));
      stationary = Math.hypot(ball.vx, ball.vz) < .5 ? stationary + dt : 0;
      longest = Math.max(longest, stationary);
      if (goal) {
        goals[goal === 'A' ? 0 : 1]++;
        P = bodyFrom(a.id, 0, 14, 0); B = bodyFrom(b.id, 0, -14, Math.PI); ball = ballAt();
      }
    }
    assert.ok(contacts > 15, `${a.id}/${b.id}: too little interaction with the ball`);
    assert.ok(longest < 12, `${a.id}/${b.id}: ball untouched for ${longest.toFixed(1)}s`);
    results.push({ cars: [a.id, b.id], goals, contacts, longestStationarySeconds: +longest.toFixed(2) });
  }
  fs.mkdirSync('output/arena-rebuild', { recursive: true });
  fs.writeFileSync('output/arena-rebuild/ai-soak.json', JSON.stringify(results, null, 2));
});
