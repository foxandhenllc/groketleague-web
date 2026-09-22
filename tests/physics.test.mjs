import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyFrom, carBall, drive, stepBall, getBallRadius, getField, setPixelTight } from '../sim.js';
import { CATALOG, CHARACTERS, pixelFieldSize } from '../catalog.js';
import { createPhysicsClock, PHYSICS_DT } from '../physics-clock.js';

const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const ballAt = (overrides = {}) => ({ x: 0, y: getBallRadius(), z: 0, vx: 0, vy: 0, vz: 0, ...overrides });
const speed = b => Math.hypot(b.vx, b.vz);
const energy = (c, b) => (c.mass * speed(c) ** 2 + CHARACTERS.ball.mass * speed(b) ** 2) / 2;

for (const pixel of [false, true]) {
  const mode = pixel ? 'pixel' : '3D';
  test(`${mode}: resting and separating overlaps add no energy`, () => {
    setPixelTight(pixel);
    for (const vz of [0, -10]) {
      const c = bodyFrom('model3', 0, 0, 0);
      const b = ballAt({ z: -(c.l / 2 + getBallRadius() / 2), vz });
      assert.equal(carBall(c, b), null);
      near(b.vz, vz); near(c.vz, 0);
      assert.ok(b.z < -(c.l / 2 + getBallRadius()));
      assert.equal(carBall(c, b), null);
      near(b.vz, vz);
    }
  });

  test(`${mode}: every car and rotation separates in car-local coordinates`, () => {
    setPixelTight(pixel);
    for (const spec of CATALOG) for (let i = 0; i < 32; i++) {
      const yaw = i * Math.PI / 16;
      const c = bodyFrom(spec.id, 7, -3, yaw);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      for (const [lx, lz] of [[0, c.l / 2], [c.w * .55, 0], [0, 0], [-c.w * .55, -c.l / 2]]) {
        const b = ballAt({ x: c.x + lx * Math.cos(yaw) + lz * fx,
          z: c.z - lx * Math.sin(yaw) + lz * fz });
        c._noRehit = .08; // Positional repair must still happen during cooldown.
        carBall(c, b);
        const dx = b.x - c.x, dz = b.z - c.z;
        const bx = dx * Math.cos(yaw) - dz * Math.sin(yaw), bz = dx * fx + dz * fz;
        const outside = Math.hypot(Math.max(0, Math.abs(bx) - c.w * .55), Math.max(0, Math.abs(bz) - c.l / 2));
        assert.ok(outside >= getBallRadius() - 1e-8, `${spec.id} yaw ${yaw}: ball still overlaps`);
        near(speed(b), 0);
      }
    }
  });

  test(`${mode}: approaching hits conserve horizontal momentum and do not create energy`, () => {
    setPixelTight(pixel);
    for (const spec of CATALOG) for (const boosting of [false, true]) {
      const c = bodyFrom(spec.id, 0, 0, 0);
      c.vz = -18; c.boosting = boosting;
      const b = ballAt({ z: -(c.l / 2 + getBallRadius() / 2) });
      const before = energy(c, b), momentum = c.mass * c.vz;
      assert.ok(carBall(c, b));
      assert.ok(b.vz < -10, 'a moving car produces a useful shot');
      assert.ok(energy(c, b) <= before + 1e-8);
      near(c.mass * c.vz + CHARACTERS.ball.mass * b.vz, momentum);
    }
  });

  test(`${mode}: contact cooldown never disables physical response`, () => {
    setPixelTight(pixel);
    const c = bodyFrom('model3', 0, 0, 0);
    c._noRehit = 1;
    const b = ballAt({ z: -(c.l / 2 + getBallRadius() / 2), vz: 10 });
    assert.equal(carBall(c, b), null); // Suppress repeated sound, not the bounce.
    assert.ok(b.vz < 0);
  });

  test(`${mode}: rolling friction and distance agree at 30, 60, 144 and 240 Hz`, () => {
    setPixelTight(pixel);
    const results = [30, 60, 144, 240].map(hz => {
      const b = ballAt({ x: -10, z: 10, vx: 20 });
      for (let i = 0; i < hz; i++) stepBall(b, 1 / hz);
      return b;
    });
    for (const b of results) {
      near(b.vx, 20 * .986 ** 60);
      near(b.x, results[0].x);
      near(b.y, getBallRadius());
    }
  });

  test(`${mode}: walls reflect outgoing balls only and include their radius`, () => {
    setPixelTight(pixel);
    const f = getField(), r = getBallRadius();
    const wall = f.FW / 2 + (pixel ? 0 : .9) - r;
    for (const side of [-1, 1]) {
      const outgoing = ballAt({ x: side * (wall + 1), vx: side * 10 });
      stepBall(outgoing, PHYSICS_DT);
      near(outgoing.x, side * wall);
      assert.ok(outgoing.vx * side < 0);
      const returning = ballAt({ x: side * (wall + 1), vx: -side * 10 });
      stepBall(returning, PHYSICS_DT);
      assert.ok(returning.vx * side < 0, 'an inward ball must not reflect back out');
    }
  });

  test(`${mode}: scoring needs the whole ball over the line and inside the mouth`, () => {
    setPixelTight(pixel);
    const f = getField(), r = getBallRadius();
    for (const side of [-1, 1]) {
      const b = ballAt({ z: side * (f.FL / 2 + r / 2) });
      assert.equal(stepBall(b, PHYSICS_DT), null);
      b.z = side * (f.FL / 2 + r + .01);
      assert.equal(stepBall(b, PHYSICS_DT), side < 0 ? 'A' : 'B');
      const besidePost = ballAt({ x: f.GOAL_W / 2, z: side * f.FL / 2, vz: side * 10 });
      assert.equal(stepBall(besidePost, PHYSICS_DT), null);
      assert.ok(besidePost.vz * side < 0);
    }
  });
}

test('pixel ball size uses one scale for rendering, collision and both axes', () => {
  setPixelTight(true);
  const f = pixelFieldSize();
  near((f.clamp.x1 - f.clamp.x0) / f.fieldW, f.pixelsPerUnit);
  near((f.clamp.y1 - f.clamp.y0) / f.fieldL, f.pixelsPerUnit);
  near(getBallRadius() * 2 * f.pixelsPerUnit, CHARACTERS.ball.pixel.diameter_px);
  const b = ballAt({ vy: 6, y: 4 });
  stepBall(b, PHYSICS_DT);
  near(b.y, getBallRadius()); near(b.vy, 0);
});

test('3D still supports airborne balls and floor bounce', () => {
  setPixelTight(false);
  const c = bodyFrom('model3', 0, 0, 0);
  const b = ballAt({ y: 3, vy: -2 });
  assert.equal(carBall(c, b), null);
  let bounced = false;
  for (let i = 0; i < 120; i++) { stepBall(b, PHYSICS_DT); if (b.vy > 0) bounced = true; }
  assert.ok(bounced);
});

test('fixed clock produces identical motion across refresh rates and irregular frames', () => {
  setPixelTight(true);
  const run = frames => {
    const c = bodyFrom('model3', 0, 10, 0), b = ballAt({ x: -10, vx: 20 });
    let elapsed = 0, steps = 0;
    const clock = createPhysicsClock(dt => { drive(c, 1, .2, true, dt); stepBall(b, dt); elapsed += dt; steps++; });
    for (const dt of frames) clock.advance(dt);
    return { c, b, elapsed, steps };
  };
  const baseline = run(Array(60).fill(1 / 60));
  for (const frames of [Array(30).fill(1 / 30), Array(144).fill(1 / 144), Array(240).fill(1 / 240), Array(5).fill([.1, .025, .075]).flat()]) {
    const actual = run(frames);
    assert.deepEqual(actual, baseline);
    assert.equal(actual.steps, 120); near(actual.elapsed, 1);
  }
});

test('fixed clock discards pause residue and bounds suspended-tab catch-up', () => {
  let steps = 0;
  const clock = createPhysicsClock(() => steps++);
  clock.advance(PHYSICS_DT / 2); clock.reset(); clock.advance(PHYSICS_DT / 2);
  assert.equal(steps, 0);
  clock.reset(); clock.advance(5);
  assert.equal(steps, 30);
});
