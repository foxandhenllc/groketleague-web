import { cornerContact } from './arena-geometry.js';

const dot = (a, b) => a.x * b.x + a.z * b.z;
const basis = c => [{ x: Math.cos(c.yaw), z: -Math.sin(c.yaw) }, { x: -Math.sin(c.yaw), z: -Math.cos(c.yaw) }];
const extent = (c, axis) => { const [r, f] = basis(c); return Math.abs(dot(r, axis)) * c.hx + Math.abs(dot(f, axis)) * c.hz; };

export function ballManifold(c, b, radius, previous) {
  const [r, f] = basis(c), delta = { x: b.x - c.x, z: b.z - c.z };
  const x = dot(delta, r), z = dot(delta, f), hx = c.hx, hz = c.hz;
  const cx = Math.max(-hx, Math.min(hx, x)), cz = Math.max(-hz, Math.min(hz, z));
  const dx = x - cx, dz = z - cz, distance = Math.hypot(dx, dz);
  if (distance > radius + .005) return null;
  let nx, nz, depth;
  if (distance > 1e-8) { nx = dx / distance; nz = dz / distance; depth = radius - distance; }
  else {
    const useX = hx - Math.abs(x) < hz - Math.abs(z);
    const axis = useX ? r : f;
    const coordinate = useX ? x : z;
    const prior = previous ? previous.nx * axis.x + previous.nz * axis.z : 0;
    const relative = (b.vx - c.vx) * axis.x + (b.vz - c.vz) * axis.z;
    const sign = Math.sign(coordinate) || Math.sign(prior) || Math.sign(relative) || 1;
    nx = useX ? sign : 0; nz = useX ? 0 : sign;
    depth = (useX ? hx - Math.abs(x) : hz - Math.abs(z)) + radius;
  }
  const wx = nx * r.x + nz * f.x, wz = nx * r.z + nz * f.z;
  return { nx: wx, nz: wz, depth, x: b.x - wx * radius, z: b.z - wz * radius };
}

export function carManifold(a, b) {
  let depth = Infinity, normal;
  for (const axis of [...basis(a), ...basis(b)]) {
    const d = (b.x - a.x) * axis.x + (b.z - a.z) * axis.z;
    const overlap = extent(a, axis) + extent(b, axis) - Math.abs(d);
    if (overlap < -.005) return null;
    if (overlap < depth) { depth = overlap; const sign = Math.sign(d) || 1; normal = { nx: axis.x * sign, nz: axis.z * sign }; }
  }
  // Clip the footprints to locate the real overlap, instead of flashing at the
  // midpoint of two differently sized cars (which can be far from the touch).
  const [r, f] = basis(a);
  let polygon = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz]) => ({
    x:a.x+r.x*a.hx*sx+f.x*a.hz*sz, z:a.z+r.z*a.hx*sx+f.z*a.hz*sz
  }));
  for (const [axis, limit] of basis(b).map((axis,i) => [axis,i ? b.hz : b.hx])) for (const sign of [-1,1]) {
    const distance = p => sign*((p.x-b.x)*axis.x+(p.z-b.z)*axis.z)-limit;
    const clipped = [];
    for (let i=0;i<polygon.length;i++) {
      const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=distance(p),dq=distance(q);
      if(dp<=0)clipped.push(p);
      if((dp<=0)!==(dq<=0)) { const t=dp/(dp-dq);clipped.push({x:p.x+t*(q.x-p.x),z:p.z+t*(q.z-p.z)}); }
    }
    polygon=clipped;
  }
  const point = polygon.length ? { x:polygon.reduce((s,p)=>s+p.x,0)/polygon.length,z:polygon.reduce((s,p)=>s+p.z,0)/polygon.length }
    : { x:(a.x+b.x)/2,z:(a.z+b.z)/2 };
  return { ...normal, depth, ...point };
}

/** All normals point from the actor toward static geometry. */
function boards(body, isBall, field, config) {
  const r = field.ballRadius, halfW = field.FW / 2, halfL = field.FL / 2;
  const ex = isBall ? r : extent(body, { x: 1, z: 0 });
  const ez = isBall ? r : extent(body, { x: 0, z: 1 });
  const mouth = Math.abs(body.x) + ex < field.GOAL_W / 2;
  const inMouth = mouth && (!isBall || field.pixelTight || body.y + r < config.modes['3d'].goalHeight);
  const limX = halfW + (isBall && !field.pixelTight ? config.modes['3d'].sideOffset : 0) - ex;
  const limZ = halfL + (!isBall && field.pixelTight && mouth ? field.goalDepth : 0) - ez;
  const out = [];
  for (const sign of [-1, 1]) {
    if (sign * body.x - limX >= -.005) out.push({ feature: `x${sign}`, nx: sign, nz: 0, depth: sign * body.x - limX, x: sign * (limX + ex), z: body.z });
    if ((!isBall || !inMouth) && sign * body.z - limZ >= -.005) out.push({ feature: `z${sign}`, nx: 0, nz: sign, depth: sign * body.z - limZ, x: body.x, z: sign * (limZ + ez) });
  }
  if (field.pixelTight) {
    const points = isBall ? [{ x: body.x, z: body.z }] : [-1, 1].flatMap(sx => [-1, 1].map(sz => {
      const [r, f] = basis(body); return { x: body.x + r.x * body.hx * sx + f.x * body.hz * sz, z: body.z + r.z * body.hx * sx + f.z * body.hz * sz };
    }));
    points.forEach((p, i) => { const hit = cornerContact(p.x, p.z, halfW, halfL, isBall ? r : 0); if (hit) out.push({ ...hit, feature: `corner${i}`, x: p.x, z: p.z }); });
  }
  return out;
}

export function createContactSolver(config, diagnostics) {
  const cache = new Map(), cooldowns = new Map(); let tick = 0;
  const settings = config.contacts;
  function gather(cars, ball, field) {
    const list = [];
    const add = (id, a, b, m, e, type, heavyBoost = false) => {
      if (m) list.push({ id, a, b, ...m, wa: a === ball ? 1 / config.ball.mass : 1 / a.mass, wb: b ? (b === ball ? 1 / config.ball.mass : 1 / b.mass) : 0, e, type, heavyBoost });
    };
    cars.forEach((c, i) => {
      const id = `${i ? 'B' : 'P'}:ball`, heavy = c.mass > 3 && c.boosting;
      if (field.pixelTight || ball.y - field.ballRadius < config.ball.carHeight)
        add(id, c, ball, ballManifold(c, ball, field.ballRadius, cache.get(id)), config.ball.contact_restitution * (heavy ? config.ball.pancake_mult : 1), 'ballHit', heavy);
    });
    if (cars.length === 2) add('P:B', cars[0], cars[1], carManifold(...cars), config.drive.carRestitution, 'carHit');
    [...cars, ball].forEach((body, i) => {
      for (const m of boards(body, body === ball, field, config)) add(`${body === ball ? 'ball' : i ? 'B' : 'P'}:${m.feature}`, body, null, m, body === ball ? config.ball.wall_restitution : config.drive.boardRestitution, 'boardHit');
    });
    return list;
  }
  return {
    reset() { cache.clear(); cooldowns.clear(); tick = 0; },
    solve(cars, ball, field, dt = 1 / 120) {
      for (const [id,time] of cooldowns) { const left = time - dt; if (left <= 1e-9) cooldowns.delete(id); else cooldowns.set(id,left); }
      const list = gather(cars, ball, field), seen = new Set(), events = [];
      for (const c of list) {
        seen.add(c.id); const old = cache.get(c.id);
        c.vn0 = ((c.b?.vx || 0) - c.a.vx) * c.nx + ((c.b?.vz || 0) - c.a.vz) * c.nz;
        c.fresh = !old; c.lambda = 0;
        c.bounce = c.fresh && -c.vn0 >= settings.bounceThreshold ? -c.e * c.vn0 : 0;
        // Arcade material becomes dissipative on extreme returns. Reduce restitution,
        // never clip velocity: the same impulse/recoil still conserves pair momentum.
        // 48 is the ordinary launch envelope; 55 remains a defect-detecting safety guard.
        if (c.b === ball && c.bounce > 0) {
          const normalSpeed = ball.vx*c.nx + ball.vz*c.nz;
          const tangent2 = Math.max(0,ball.vx*ball.vx+ball.vz*ball.vz-normalSpeed*normalSpeed);
          const maxNormal = Math.sqrt(Math.max(0,settings.launchRestitutionSpeed**2-tangent2));
          const maxImpulse = Math.max(0,(maxNormal-normalSpeed)/c.wb);
          c.bounce = Math.min(c.bounce,Math.max(0,maxImpulse*(c.wa+c.wb)+c.vn0));
        }
        // Opposing normals on either shared body suppress the whole constrained bounce batch.
        for (const other of list) if (other !== c) {
          for (const body of [c.a, c.b]) if (body && (other.a === body || other.b === body)) {
            const sign = (c.a === body ? 1 : -1) * (other.a === body ? 1 : -1);
            if (sign * (c.nx * other.nx + c.nz * other.nz) < settings.opposingDot) c.bounce = 0;
          }
        }
      }
      const ordered = tick++ % 2 ? [...list].reverse() : list;
      for (let i = 0; i < settings.velocityIterations; i++) for (const c of ordered) {
        const vn = ((c.b?.vx || 0) - c.a.vx) * c.nx + ((c.b?.vz || 0) - c.a.vz) * c.nz;
        const next = Math.max(0, c.lambda + (c.bounce - vn) / (c.wa + c.wb));
        const impulse = next - c.lambda; c.lambda = next;
        c.a.vx -= c.wa * impulse * c.nx; c.a.vz -= c.wa * impulse * c.nz;
        if (c.b) { c.b.vx += c.wb * impulse * c.nx; c.b.vz += c.wb * impulse * c.nz; }
      }
      const beforeZ = ball.z;
      for (let i = 0; i < settings.positionIterations; i++) for (const c of gather(cars, ball, field)) {
        const correction = Math.min(settings.maxCorrection, settings.correction * Math.max(c.depth - settings.slop, 0)) / (c.wa + c.wb);
        c.a.x -= c.nx * correction * c.wa; c.a.z -= c.nz * correction * c.wa;
        if (c.b) { c.b.x += c.nx * correction * c.wb; c.b.z += c.nz * correction * c.wb; }
      }
      // Separation is not a goal crossing; restore the pre-correction side of the plane.
      const plane = field.FL / 2 + field.ballRadius;
      if (Math.abs(beforeZ) < plane && Math.abs(ball.z) >= plane) ball.z = Math.sign(ball.z) * (plane - 1e-6);
      for (const c of list) {
        const old = cache.get(c.id), closing = Math.max(0, -c.vn0);
        const cooldown = cooldowns.get(c.id) || 0;
        const freshPeak = closing > (old?.closing || 0) + 1;
        if (c.type === 'ballHit' && c.fresh && closing >= 1 && c.lambda > 0 && !field.pixelTight)
          ball.vy = Math.max(ball.vy, Math.min(c.heavyBoost ? config.ball.liftHeavy : config.ball.liftOrdinary, closing * config.ball.lift));
        if ((c.fresh || freshPeak) && closing >= 1 && c.lambda > 0 && cooldown === 0) {
          cooldowns.set(c.id,config.ball.no_rehit_s);
          events.push({ type: c.type, pair: c.id, tick, x: c.x, y: c.type === 'ballHit' ? ball.y : .4, z: c.z, nx: c.nx, ny: 0, nz: c.nz, closing, impulse: c.lambda, heavyBoost: c.heavyBoost });
        }
        cache.set(c.id, { nx: c.nx, nz: c.nz, closing });
      }
      for (const id of cache.keys()) if (!seen.has(id)) cache.delete(id);
      if (![...cars, ball].every(b => [b.x, b.z, b.vx, b.vz].every(Number.isFinite))) { diagnostics.count('invalidContactState'); throw new Error('Invalid contact state'); }
      return events;
    }
  };
}
