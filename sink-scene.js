import * as THREE from 'three';
import { SINK, sinkHeight, sinkSurface, faucetPhase } from './sink.js';

/** View-only kitchen theatre. Every surface cue follows the shared arena rules. */
export function makeSinkScene(scene) {
  const root = new THREE.Group();
  root.name = 'kitchen-sink';
  scene.add(root);
  root.visible = false;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide});
  const soft = (color, roughness = .65) => new THREE.MeshStandardMaterial({color, roughness, metalness: .05});
  const add = (geometry, material, x = 0, y = 0, z = 0, parent = root) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const box = (w, h, d, x, y, z, material, parent = root) => {
    const mesh = add(cube, material, x, y, z, parent);
    mesh.scale.set(w, h, d);
    return mesh;
  };
  const cylinder = (r1, r2, height, x, y, z, material, segments = 32, parent = root) =>
    add(new THREE.CylinderGeometry(r1, r2, height, segments), material, x, y, z, parent);
  const ring = (inner, outer, x, y, z, material, parent = root) => {
    const mesh = add(new THREE.RingGeometry(inner, outer, 64), material, x, y, z, parent);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };
  const conformRing = (mesh, x, z, centerHeight) => {
    const attribute = mesh.geometry.getAttribute('position');
    for (let i = 0; i < attribute.count; i++) {
      const px = attribute.getX(i) * mesh.scale.x, pz = -attribute.getY(i) * mesh.scale.y;
      attribute.setZ(i, (sinkHeight(x + px, z + pz) - centerHeight) / mesh.scale.z);
    }
    attribute.needsUpdate = true;
    // The bounding volume must follow displaced shoulder vertices, especially on a phone.
    mesh.geometry.computeBoundingSphere();
  };
  const tube = (points, radius, material, parent = root, segments = 40) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 6, false), material, 0, 0, 0, parent);
  const instancePool = (geometry, material, count, parent = root) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    parent.add(mesh);
    const parts = Array.from({length: count}, () => new THREE.Object3D());
    return {mesh, parts, sync() {
      if (!mesh.visible) return;
      parts.forEach((part, i) => {part.updateMatrix(); mesh.setMatrixAt(i, part.matrix);});
      mesh.instanceMatrix.needsUpdate = true;
    }};
  };

  // Small, shared procedural textures avoid downloads and keep the toy-scale kitchen crisp.
  const texture = (kind) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = kind === 'steel' ? '#a1b5b8' : '#987e67';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i++) {
      const n = ((i * 73 + 19) % 101) / 101;
      ctx.strokeStyle = kind === 'steel' ? `rgba(235,251,251,${.02 + n * .16})` : `rgba(62,40,30,${.025 + n * .065})`;
      ctx.lineWidth = kind === 'steel' ? 1 : 1 + n * 2;
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i + (kind === 'steel' ? 0 : Math.sin(i) * 4));
      ctx.stroke();
    }
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.repeat.set(kind === 'steel' ? 2 : 1, kind === 'steel' ? 3 : 5);
    result.anisotropy = 4;
    return result;
  };
  const metal = new THREE.MeshStandardMaterial({color: '#63818d', map: texture('steel'), metalness: .38, roughness: .46, vertexColors: true});
  const chrome = new THREE.MeshStandardMaterial({color: '#b4ced8', metalness: .55, roughness: .24});
  const darkMetal = new THREE.MeshStandardMaterial({color: '#304956', metalness: .45, roughness: .6});
  const wood = new THREE.MeshStandardMaterial({color: '#e2d2bf', map: texture('wood'), roughness: .86});
  const cream = soft('#c1c7bd'), teal = soft('#35b4ac'), yellow = soft('#dfb43f');
  const amber = basic('#ffc56b'), cyan = basic('#6fe7f3');

  // The floor is a sampled height field, with real open drain throats below the basin.
  const positions = [], colors = [], uvs = [];
  const floorColor = new THREE.Color();
  const put = (x, z) => {
    const y = sinkHeight(x, z);
    positions.push(x, y, z);
    floorColor.set(y > .05 ? '#b1c4c7' : '#f0f3ed');
    colors.push(floorColor.r, floorColor.g, floorColor.b);
    uvs.push((x + 22) / 44, (z + 34) / 68);
  };
  const hole = (x, z) => [-1, 1].some(s => Math.hypot(x, z - s * SINK.drainZ) < SINK.drainRadius - .12);
  for (let x = -22; x < 22; x += .5) for (let z = -34; z < 34; z += .5) {
    if (!hole(x + 1 / 3, z + 1 / 6)) { put(x, z); put(x + .5, z + .5); put(x + .5, z); }
    if (!hole(x + 1 / 6, z + 1 / 3)) { put(x, z); put(x, z + .5); put(x + .5, z + .5); }
  }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  floor.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  floor.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  floor.computeVertexNormals();
  add(floor, metal);
  box(44, 1, 68, 0, -3.3, 0, darkMetal);

  // Continuous metal shoulders rise with the real roll-back slope. Etched chevrons point downhill.
  const etching = basic('#b1d0d5', .3);
  const slopeInk = basic('#284c60', .42);
  const floorLines = [];
  const lineOnFloor = (points, material = etching, thickness = .07) => {
    const mesh = tube(points.map(([x, z]) => [x, sinkHeight(x, z) + .035, z]), thickness, material, root, Math.max(2, points.length * 2));
    floorLines.push(mesh);
    return mesh;
  };
  for (const side of [-1, 1]) {
    for (const distance of [15, 18.5, 21]) lineOnFloor(Array.from({length: 35}, (_, i) => [side * distance, -33 + i * 66 / 34]));
    for (const distance of [27, 30, 33]) lineOnFloor(Array.from({length: 23}, (_, i) => [-21 + i * 42 / 22, side * distance]));
    for (let z = -22; z <= 22; z += 11) {
      lineOnFloor([[side * 20, z - 1.1], [side * 18.3, z], [side * 20, z + 1.1]], slopeInk, .14);
    }
    for (const x of [-10, 0, 10]) lineOnFloor([[x - 1.1, side * 32], [x, side * 30.2], [x + 1.1, side * 32]], slopeInk, .14);
    box(1.2, .8, 69.5, side * 22.2, 3.15, 0, chrome);
    box(45.5, .8, 1.2, 0, 3.15, side * 34.4, chrome);
  }

  box(21, 3, 106, -33.5, 1, 0, wood);
  box(21, 3, 106, 33.5, 1, 0, wood);
  box(45, 3, 19, 0, 1, -44.5, wood);
  box(45, 3, 19, 0, 1, 44.5, wood);
  for (const side of [-1, 1]) {
    box(.3, .18, 101, side * 43, 2.6, 0, darkMetal);
    box(84, .18, .3, 0, 2.6, side * 52, darkMetal);
  }

  // The goals have colored collars and visible depth; the weak pull halo matches the simulation radius.
  const drains = [];
  for (const side of [-1, 1]) {
    const z = side * SINK.drainZ, color = side > 0 ? '#ffc56b' : '#6fe7f3';
    const group = new THREE.Group(); group.position.z = z; root.add(group);
    const throat = new THREE.LatheGeometry([new THREE.Vector2(1.65, -2.9), new THREE.Vector2(2.25, -2.2), new THREE.Vector2(3.7, -.13), new THREE.Vector2(4.3, .04)], 64);
    add(throat, darkMetal, 0, 0, 0, group);
    cylinder(2, 2, .06, 0, -2.87, 0, basic('#071c2a'), 40, group);
    ring(3.88, 4.55, 0, .06, 0, chrome, group);
    ring(4.52, 4.82, 0, .08, 0, side > 0 ? amber : cyan, group);
    ring(4.83, 5, 0, .045, 0, darkMetal, group);
    const pullMat = basic(color, .07);
    ring(5, SINK.drainPullRadius, 0, .012, 0, pullMat, group);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const slot = box(.25, .05, .5, Math.cos(a) * 4.2, .12, Math.sin(a) * 4.2, darkMetal, group);
      slot.rotation.y = -a + Math.PI / 2;
    }
    const swirl = new THREE.Group(); group.add(swirl);
    const swirlMat = basic(color, .52);
    for (let strand = 0; strand < 3; strand++) {
      const points = Array.from({length: 25}, (_, i) => {
        const t = i / 24, a = strand * Math.PI * 2 / 3 + t * Math.PI * 1.25, r = 3.6 - t * 1.95;
        return [Math.cos(a) * r, -.15 - t * 2.35, Math.sin(a) * r];
      });
      tube(points, .1, swirlMat, swirl, 28);
    }
    // Four inward ticks describe the pull zone without obscuring the ball or pretending to be walls.
    const pullTicks = new THREE.Group(); group.add(pullTicks);
    const pullInk = basic(color, .34);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const points = [[-.5, 6.1], [0, 5.6], [.5, 6.1]].map(([x, r]) => [Math.cos(a) * r - Math.sin(a) * x, .035, Math.sin(a) * r + Math.cos(a) * x]);
      tube(points, .085, pullInk, pullTicks, 4);
    }
    drains.push({swirl, pullTicks, pullMat, swirlMat, z, color});
  }

  // A swan-neck faucet and hot/cold handles anchor the water to an obvious physical source.
  const faucet = new THREE.Group(); root.add(faucet);
  tube([[-27, 3, 0], [-27, 15, 0], [-23, 19.5, 0], [-15, 19.5, 0], [-9, 15, 0], [-9, 11, 0]], .85, chrome, faucet, 44);
  cylinder(2.2, 2.6, .8, -27, 3, 0, chrome, 32, faucet);
  cylinder(1.05, 1.05, .75, -9, 11, 0, darkMetal, 24, faucet);
  for (const [z, color] of [[-4.5, '#71c7f5'], [4.5, '#ef896a']]) {
    cylinder(1.2, 1.5, 1.2, -27, 3.5, z, chrome, 24, faucet);
    box(3, .5, .7, -27, 4.35, z, chrome, faucet);
    cylinder(.45, .45, .12, -27, 4.66, z, basic(color), 16, faucet);
  }
  const waterMat = basic('#a5f2ff', .4);
  const jet = cylinder(.43, .7, 10.6, -9, 5.4, 0, waterMat, 16);
  const jetCore = cylinder(.15, .35, 10.55, -9, 5.4, 0, basic('#eaffff', .55), 12);
  const nozzleLight = ring(.9, 1.1, -9, 10.5, 0, basic('#ffd073', .6));
  const impactMat = basic('#d9fcff', .42);
  const splashRing = ring(.8, 1.5, -9, .12, 0, impactMat);
  const wetPos = [], wetColor = [];
  const wetRGB = new THREE.Color('#75d5e4');
  const wetVertex = (x, z) => {
    wetPos.push(x, sinkHeight(x, z) + .035, z);
    const wet = sinkSurface(x, z, {surge: 1}).wet;
    wetColor.push(wetRGB.r, wetRGB.g, wetRGB.b, wet * .3);
  };
  for (let x = SINK.wetStartX; x < SINK.wetEndX; x++) for (let z = -SINK.wetHalfZ; z < SINK.wetHalfZ; z++) {
    wetVertex(x, z); wetVertex(x + 1, z + 1); wetVertex(x + 1, z);
    wetVertex(x, z); wetVertex(x, z + 1); wetVertex(x + 1, z + 1);
  }
  const wetGeometry = new THREE.BufferGeometry();
  wetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wetPos, 3));
  wetGeometry.setAttribute('color', new THREE.Float32BufferAttribute(wetColor, 4));
  const wetMat = new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, depthWrite: false});
  add(wetGeometry, wetMat);

  const flowMat = basic('#c2f6fb', .4);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-.8, -.15); arrowShape.lineTo(.15, -.15); arrowShape.lineTo(.15, -.45);
  arrowShape.lineTo(.9, 0); arrowShape.lineTo(.15, .45); arrowShape.lineTo(.15, .15); arrowShape.lineTo(-.8, .15);
  const flowGeometry = new THREE.ShapeGeometry(arrowShape); flowGeometry.rotateX(-Math.PI / 2);
  const flowPool = instancePool(flowGeometry, flowMat, 18);
  const flow = flowPool.parts.map((mesh, i) => ({mesh, lane: (i % 3 - 1) * 1.6, phase: Math.floor(i / 3) / 6}));
  const foamGeo = new THREE.SphereGeometry(.16, 6, 4);
  const foamMat = basic('#e5ffff', .7);
  const foam = new THREE.InstancedMesh(foamGeo, foamMat, 30); foam.frustumCulled = false; root.add(foam);
  const transform = new THREE.Object3D();
  const wakeMat = basic('#bcecf3', .5);
  const wakeGeo = new THREE.RingGeometry(.3, .55, 18, 1, .2, Math.PI * 1.65); wakeGeo.rotateX(-Math.PI / 2);
  const wakes = Array.from({length: 3}, () => add(wakeGeo, wakeMat));

  // A small still life outside the playing surface gives the oversized arena a lived-in scale.
  const dishBlue = soft('#5d899f'), spongeGreen = soft('#377564');
  for (const [x, z, r] of [[32, -21, 8], [33, 19, 7]]) {
    for (let stack = 0; stack < 3; stack++) cylinder(r, r - .35, .35, x, 2.9 + stack * .42, z, cream, 40);
    const lip = add(new THREE.TorusGeometry(r - .9, .24, 8, 48), dishBlue, x, 4, z); lip.rotation.x = Math.PI / 2;
    cylinder(r - 1.7, r - 1.7, .06, x, 3.96, z, soft('#91a8ac'), 40);
  }
  const sponge = new THREE.Group(); sponge.position.set(-33, 4, -20); sponge.rotation.y = -.3; root.add(sponge);
  box(8, 2, 5, 0, 0, 0, yellow, sponge); box(8, .4, 5, 0, 1.2, 0, spongeGreen, sponge);
  const poreMat = soft('#b38528');
  for (let i = 0; i < 12; i++) {
    const pore = add(new THREE.SphereGeometry(.18 + i % 3 * .05, 6, 4), poreMat, -3.3 + i % 4 * 2.1, -.6 + Math.floor(i / 4) * .6, 2.51, sponge);
    pore.scale.z = .15;
  }
  cylinder(2.6, 3.1, 7.5, -33, 6.3, 22, teal, 20);
  cylinder(1.6, 2.5, 1.4, -33, 10.7, 22, teal, 20);
  cylinder(.6, .6, 1.9, -33, 12, 22, chrome, 16);
  box(4.6, .6, 1.2, -31.5, 13, 22, cream);
  box(.7, 1.2, 1, -29.6, 12.6, 22, cream);
  // A simple wave emblem reads as soap at a glance, without tiny decorative type.
  box(3.6, 3.3, .12, -33, 6.7, 24.7, cream);
  for (let i = 0; i < 3; i++) box(2.4, .17, .16, -33, 5.9 + i * .65, 24.79, teal);
  const clothMat = soft('#b96253');
  box(11, .18, 13, 30, 2.68, 39.5, clothMat);
  for (let i = 0; i < 5; i++) {
    box(.35, .025, 13, 26 + i * 2, 2.79, 39.5, cream);
    box(11, .025, .35, 30, 2.79, 35.5 + i * 2, cream);
  }
  const utensil = new THREE.Group(); utensil.position.set(-33, 3, -39); utensil.rotation.y = -.45; root.add(utensil);
  box(1.1, .4, 10, 0, 0, 0, chrome, utensil);
  box(4.2, .35, 2, 0, 0, -5, chrome, utensil);
  for (let i = 0; i < 4; i++) box(.55, .3, 3.2, -1.65 + i * 1.1, 0, -7, chrome, utensil);

  // Batch the still life and contour ink: richer detail should not mean one draw call per screw.
  root.updateMatrixWorld(true);
  const boxBatches = new Map();
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.geometry !== cube) return;
    if (!boxBatches.has(mesh.material)) boxBatches.set(mesh.material, []);
    boxBatches.get(mesh.material).push(mesh);
  });
  for (const [material, meshes] of boxBatches) {
    const batch = new THREE.InstancedMesh(cube, material, meshes.length);
    batch.receiveShadow = true;
    meshes.forEach((mesh, i) => { batch.setMatrixAt(i, mesh.matrixWorld); mesh.removeFromParent(); });
    root.add(batch);
  }
  for (const material of [etching, slopeInk]) {
    const meshes = floorLines.filter(mesh => mesh.material === material), merged = new THREE.BufferGeometry();
    for (const key of ['position', 'normal', 'uv']) {
      const arrays = meshes.map(mesh => mesh.geometry.getAttribute(key)), size = arrays.reduce((n, a) => n + a.array.length, 0), values = new Float32Array(size);
      let offset = 0;
      for (const attr of arrays) { values.set(attr.array, offset); offset += attr.array.length; }
      merged.setAttribute(key, new THREE.BufferAttribute(values, arrays[0].itemSize));
    }
    const indices = []; let vertexOffset = 0;
    for (const mesh of meshes) {
      for (const index of mesh.geometry.index.array) indices.push(index + vertexOffset);
      vertexOffset += mesh.geometry.getAttribute('position').count;
      mesh.removeFromParent(); mesh.geometry.dispose();
    }
    merged.setIndex(indices); add(merged, material);
  }

  // A goal plays out at its actual drain: a stronger vortex, then a brief fountain of suds.
  const goalFX = new THREE.Group(); goalFX.name = 'drain-celebration'; goalFX.visible = false; root.add(goalFX);
  const goalRingMat = basic('#ffda91', .55);
  const goalRings = Array.from({length: 3}, () => ring(3.8, 4.05, 0, .1, 0, goalRingMat.clone(), goalFX));
  const goalBubbleMat = basic('#daf8ff', .43);
  const goalBubbles = instancePool(new THREE.SphereGeometry(1, 10, 7), goalBubbleMat, 36, goalFX);
  const goalGlints = instancePool(new THREE.SphereGeometry(1, 6, 4), basic('#ffffff', .8), 36, goalFX);
  const goalFoamMat = basic('#defaff', .44);
  const goalFoam = ring(1.6, 3.1, 0, .12, 0, goalFoamMat, goalFX);

  // Fixed-size effect pools: no geometry, materials or particles are allocated during a frame.
  const hazard = new THREE.Group(); root.add(hazard);
  const warningMat = basic('#ff8a54', .78), countdownMat = basic('#ffd494', .8), diskMat = basic('#e46b32', .12);
  const warningRing = ring(SINK.radius - .25, SINK.radius, 0, .09, 0, warningMat, hazard);
  const countdown = ring(SINK.radius - .4, SINK.radius, 0, .1, 0, countdownMat, hazard);
  const warningDisk = ring(0, SINK.radius, 0, .055, 0, diskMat, hazard);
  const boltShape = new THREE.Shape();
  boltShape.moveTo(.3, 1.8); boltShape.lineTo(-1.1, -.2); boltShape.lineTo(-.2, -.2);
  boltShape.lineTo(-.5, -1.8); boltShape.lineTo(1.2, .5); boltShape.lineTo(.3, .5); boltShape.closePath();
  const boltMark = add(new THREE.ShapeGeometry(boltShape), basic('#c6f6ff', .64), 0, .075, 0, hazard);
  boltMark.rotation.x = -Math.PI / 2;
  const impactRing = ring(SINK.radius - .7, SINK.radius, 0, .12, 0, basic('#ffda98', .85), hazard);
  const hazardTicks = new THREE.Group(); hazard.add(hazardTicks);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const tick = box(.25, .045, .8, Math.sin(a) * (SINK.radius + .6), .1, Math.cos(a) * (SINK.radius + .6), warningMat, hazardTicks);
    tick.rotation.y = a;
  }
  const rockMat = new THREE.MeshStandardMaterial({color: '#654338', roughness: .92, flatShading: true, emissive: '#d65112', emissiveIntensity: .5});
  const rock = add(new THREE.IcosahedronGeometry(1.55, 0), rockMat, 0, 0, 0, hazard);
  const emberMat = basic('#ffad50', .6);
  const tail = instancePool(new THREE.IcosahedronGeometry(.85, 0), emberMat, 5, hazard);
  const debrisGeo = new THREE.IcosahedronGeometry(.3, 0);
  const debrisMat = basic('#ffb45d', .9);
  const debris = instancePool(debrisGeo, debrisMat, 12, hazard);
  const smokeMat = basic('#d1b9a1', .28);
  const smoke = instancePool(new THREE.IcosahedronGeometry(1, 1), smokeMat, 6, hazard);
  const lightningMat = basic('#cbfbff');
  const lightningCoreMat = basic('#ffffff');
  const lightning = new THREE.Group(); hazard.add(lightning);
  tube([[0, 24, 0], [-1.3, 18, .4], [.7, 18.2, 0], [-.8, 11, .2], [1.1, 11.4, 0], [0, 0, 0]], .22, lightningMat, lightning, 12);
  tube([[0, 24, 0], [-1.3, 18, .4], [.7, 18.2, 0], [-.8, 11, .2], [1.1, 11.4, 0], [0, 0, 0]], .07, lightningCoreMat, lightning, 12);
  tube([[-.8, 11, .2], [-3, 7, -.2], [-2.3, 6.7, 0], [-4, 2, -1]], .1, lightningMat, lightning, 7);
  const electric = new THREE.Group(); hazard.add(electric);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    tube([[0, .2, 0], [Math.cos(a + .13) * 1.6, .2, Math.sin(a + .13) * 1.6], [Math.cos(a - .12) * 2.4, .2, Math.sin(a - .12) * 2.4], [Math.cos(a) * 4.5, .12, Math.sin(a) * 4.5]], .075, lightningMat, electric, 6);
  }
  const scorchMat = basic('#363236', .27);
  const scorches = Array.from({length: 3}, () => ({mesh: ring(0, 3.2, 0, .018, 0, scorchMat), at: -99}));
  scorches.forEach(s => {s.mesh.visible = false; s.mesh.material = scorchMat.clone();});
  let lastImpact = '', previousTime = 0, nextScorch = 0;

  return {root, update(state, {cars = [], ball = null, reducedMotion = false, goal = null} = {}) {
    if (!root.visible) return;
    const time = state?.time || 0, motion = reducedMotion ? 0 : time;
    const phase = state?.faucet || faucetPhase(time), strength = state?.surge || 0;
    const flowing = strength > .01;
    if (time < previousTime) {lastImpact = ''; for (const s of scorches) s.at = -99;}
    previousTime = time;
    jet.visible = jetCore.visible = splashRing.visible = flowing;
    jet.scale.set(1 + strength * .4, 1, 1 + strength * .4);
    waterMat.opacity = .25 + strength * .28;
    jetCore.material.opacity = .22 + strength * .28;
    splashRing.scale.setScalar(1 + strength * .4 + (reducedMotion ? 0 : Math.sin(time * 7) * .1));
    impactMat.opacity = .2 + strength * .3;
    nozzleLight.visible = phase.phase === 'warning';
    nozzleLight.material.opacity = reducedMotion ? .65 : .5 + Math.sin(time * Math.PI * 2) * .15;
    wetMat.opacity = .45 + strength * .55;
    flowMat.opacity = .14 + strength * .48;
    for (const f of flow) {
      const x = SINK.wetCoreStartX + ((f.phase + motion * (.045 + strength * .14)) % 1) * (SINK.wetEndX - SINK.wetCoreStartX);
      f.mesh.position.set(x, sinkHeight(x, f.lane) + .095, f.lane);
      f.mesh.scale.setScalar((.7 + strength * .35) * sinkSurface(x, f.lane, state).wet);
    }
    flowPool.mesh.visible = flowing; flowPool.sync();
    for (let i = 0; i < 30; i++) {
      const p = (i / 30 + motion * (.07 + strength * .2)) % 1;
      const x = SINK.wetCoreStartX + p * (SINK.wetEndX - SINK.wetCoreStartX), z = Math.sin(i * 2.4) * (SINK.wetCoreHalfZ + .2);
      transform.position.set(x, sinkHeight(x, z) + .1 + (reducedMotion ? 0 : Math.sin(p * Math.PI * 5 + i) * .04), z);
      transform.scale.setScalar((.65 + (i % 4) * .22) * strength * sinkSurface(x, z, state).wet);
      transform.updateMatrix(); foam.setMatrixAt(i, transform.matrix);
    }
    foam.visible = flowing; foam.instanceMatrix.needsUpdate = flowing;
    const bodies = [cars[0], cars[1], ball];
    wakes.forEach((wake, i) => {
      const body = bodies[i], wet = body ? sinkSurface(body.x, body.z, state).wet : 0;
      const speed = body ? Math.hypot(body.vx || 0, body.vz || 0) : 0;
      wake.visible = wet > .15 && speed > 2 && (i !== 2 || (body.y || 0) <= SINK.surfaceBallMaxHeight);
      if (!wake.visible) return;
      wake.position.set(body.x, sinkHeight(body.x, body.z) + .11, body.z);
      wake.rotation.y = Math.atan2(body.vx, body.vz);
      wake.scale.set(i === 2 ? 1.5 : 3, 1, i === 2 ? 1.8 : 4);
    });
    const goalColor = goal?.team === 'B' ? '#77eaff' : '#ffd17e';
    for (const drain of drains) {
      const near = ball ? clamp(1 - Math.hypot(ball.x, ball.z - drain.z) / 9) : 0;
      const celebrating = goal && Math.abs(goal.z - drain.z) < 1;
      const catchPhase = celebrating ? clamp(goal.age / .7) : 0;
      drain.swirl.rotation.y = -motion * .8 - (celebrating && !reducedMotion ? goal.age * 5 : 0);
      drain.pullTicks.rotation.y = celebrating && !reducedMotion ? -goal.age * 1.2 : 0;
      drain.pullMat.opacity = celebrating ? .09 + Math.sin(Math.min(goal.age, 2.65) / 2.65 * Math.PI) * .08 : .055 + near * .045;
      drain.swirlMat.opacity = celebrating ? .72 + catchPhase * .2 : .42 + near * .32;
      drain.swirlMat.color.set(celebrating ? goalColor : drain.color);
      drain.pullMat.color.set(celebrating ? goalColor : drain.color);
    }
    goalFX.visible = !!goal;
    if (goal) {
      const age = Math.max(0, goal.age), burst = age - 1.15;
      goalFX.position.set(goal.x, sinkHeight(goal.x, goal.z), goal.z);
      goalFoam.visible = age >= .5 && age < 2.4;
      goalFoam.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(clamp((age - .5) / 1.9) * Math.PI) * .2);
      goalFoam.material.opacity = .36 * Math.sin(clamp((age - .5) / 1.9) * Math.PI);
      for (let i = 0; i < goalRings.length; i++) {
        const ringAge = age - .65 - i * .24, progress = clamp(ringAge / 1.15), active = ringAge >= 0 && ringAge < 1.15;
        const ripple = goalRings[i]; ripple.visible = active;
        ripple.material.color.set(goalColor);
        ripple.material.opacity = (reducedMotion ? .3 : .6) * Math.sin(progress * Math.PI);
        ripple.scale.setScalar(reducedMotion ? 1 + i * .16 : .75 + progress * .8);
      }
      goalBubbles.mesh.visible = goalGlints.mesh.visible = burst >= 0 && burst < 1.3 && !reducedMotion;
      goalBubbleMat.color.set(goal.team === 'B' ? '#b1efff' : '#fff0c5');
      goalBubbles.parts.forEach((bubble, i) => {
        const life = (burst - (i % 12) * .024) / .94, active = life >= 0 && life <= 1, t = clamp(life);
        const angle = i * 2.39996, distance = (.4 + i % 7 * .25) * (.4 + t * .9);
        const scale = active ? (.2 + (i % 5) * .095) * Math.pow(Math.sin(t * Math.PI), .45) : 0;
        bubble.position.set(Math.cos(angle) * distance, .15 + 7 * t - 2 * t * t, Math.sin(angle) * distance);
        bubble.scale.setScalar(scale);
        const glint = goalGlints.parts[i]; glint.position.copy(bubble.position); glint.position.x -= scale * .32; glint.position.y += scale * .4;
        glint.scale.setScalar(scale * .16);
      });
      goalBubbles.sync(); goalGlints.sync();
    }
    const h = goal ? null : state?.hazard;
    hazard.visible = !!h;
    for (const s of scorches) {
      const age = time - s.at;
      s.mesh.visible = age >= 0 && age < 7;
      s.mesh.material.opacity = .25 * clamp(1 - age / 7);
    }
    if (!h) return;
    const meteor = h.kind === 'meteor', progress = clamp(h.age / SINK.warning), hit = h.age >= SINK.warning, age = Math.max(0, h.age - SINK.warning);
    const hazardHeight = sinkHeight(h.x, h.z);
    hazard.position.set(h.x, hazardHeight, h.z);
    warningMat.color.set(meteor ? '#ff8a54' : '#8feaff');
    countdownMat.color.set(meteor ? '#ffd494' : '#e3ffff');
    diskMat.color.set(meteor ? '#d86032' : '#5cb7dc');
    warningRing.visible = countdown.visible = hazardTicks.visible = !hit;
    boltMark.visible = !meteor && !hit;
    warningMat.opacity = .76;
    countdown.scale.setScalar(Math.max(.06, 1 - progress));
    countdownMat.opacity = .78;
    diskMat.opacity = hit ? .1 * clamp(1 - age / .7) : .06 + progress * .09;
    impactRing.visible = hit && meteor;
    // The first beat must clear a truck's silhouette; keep the entire wave inside the real blast.
    impactRing.scale.setScalar(reducedMotion ? .65 : Math.min(1, .5 + age * .95));
    impactRing.material.opacity = (reducedMotion ? .32 : .85) * clamp(1 - age / .65);
    for (const footprint of [warningRing, countdown, warningDisk, impactRing]) {
      if (footprint.visible) conformRing(footprint, h.x, h.z, hazardHeight);
    }
    for (const tick of hazardTicks.children) tick.position.y = sinkHeight(h.x + tick.position.x, h.z + tick.position.z) - hazardHeight + .1;
    rock.visible = meteor && !hit;
    rock.position.set(0, 1 + (1 - progress * progress) * 31, 0);
    rock.rotation.set(reducedMotion ? .4 : h.age * 2, h.age * .8, .3);
    tail.mesh.visible = meteor && !hit && !reducedMotion;
    tail.parts.forEach((ember, i) => {
      ember.position.set(0, rock.position.y + 1.2 + i * 1.5, 0);
      ember.scale.setScalar(1 - i * .13);
    });
    tail.sync();
    debris.mesh.visible = hit && meteor && !reducedMotion;
    debrisMat.opacity = .9 * clamp(1 - age / .9);
    debris.parts.forEach((piece, i) => {
      const a = i * Math.PI * 2 / 12, distance = Math.min(SINK.radius - .75, 1.8 + age * (5 + i % 4));
      piece.position.set(Math.cos(a) * distance, Math.max(.15, 1.1 + 3 * age - 4 * age * age), Math.sin(a) * distance);
      piece.rotation.set(age * (i + 1), i, age * 3);
      piece.scale.setScalar(.65 + (i % 3) * .3);
    });
    debris.sync();
    smokeMat.opacity = .28 * clamp(1 - age / .9);
    smoke.mesh.visible = hit && meteor && !reducedMotion;
    smoke.parts.forEach((cloud, i) => {
      const a = i * Math.PI / 3;
      const distance = 1.4 + age * 1.6;
      cloud.position.set(Math.cos(a) * distance, 1.1 + age * 2.4, Math.sin(a) * distance);
      cloud.scale.setScalar(.5 + age * 1.1);
    });
    smoke.sync();
    lightning.visible = !meteor && hit && age < (reducedMotion ? .14 : .28);
    electric.visible = !meteor && hit && age < .5;
    electric.scale.setScalar(reducedMotion ? 1 : .85 + age * .4);
    if (hit && meteor && lastImpact !== `${state.seed}:${h.id}`) {
      lastImpact = `${state.seed}:${h.id}`;
      const s = scorches[nextScorch++ % scorches.length];
      s.at = time; s.mesh.position.set(h.x, sinkHeight(h.x, h.z) + .018, h.z);
      conformRing(s.mesh, h.x, h.z, hazardHeight);
    }
  }};
}
