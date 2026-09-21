import * as THREE from "three";
import { FW, FL, GOAL_W, GOAL_H } from "./catalog.js";

const lamps = [];

function lambert(color, map = null) {
  const m = new THREE.MeshLambertMaterial({ color });
  if (map) {
    m.map = map;
    m.color.set("#ffffff");
  }
  return m;
}

function pixelTex(draw, size = 64, repeatX = 8, repeatZ = 8) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatZ);
  return tex;
}

function grassTex() {
  return pixelTex((ctx, s) => {
    const a = "#2f9a3a", b = "#278634", c = "#3aad45", d = "#1e6b28";
    for (let y = 0; y < s; y += 8) {
      for (let x = 0; x < s; x += 8) {
        const odd = ((x / 8) + (y / 8)) % 2;
        ctx.fillStyle = odd ? a : b;
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = odd ? c : d;
        ctx.fillRect(x + 1, y + 1, 2, 2);
        ctx.fillRect(x + 5, y + 4, 2, 2);
      }
    }
  }, 64, (FW + 8) / 4, (FL + 10) / 4);
}

function stoneTex() {
  return pixelTex((ctx, s) => {
    const mortar = "#3a2a22";
    const bricks = ["#6b5344", "#5a4538", "#7a5e4c", "#4e3b30", "#82664f"];
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, s, s);
    const bh = 8, bw = 16;
    for (let row = 0, y = 0; y < s; y += bh, row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < s + bw; x += bw) {
        ctx.fillStyle = bricks[(row * 7 + ((x + off) / bw | 0) + 3) % bricks.length];
        ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
      }
    }
  }, 64, 6, 2);
}

function dirtTex() {
  return pixelTex((ctx, s) => {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = ((x * 17 + y * 31) ^ (x * y)) & 3;
        ctx.fillStyle = ["#4a3828", "#3d2e22", "#5a4330", "#2f241c"][n];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, 32, 10, 12);
}

function addBox(root, w, h, d, x, y, z, mat, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (shadow) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  root.add(m);
  return m;
}

function crenellate(root, mat, alongZ, wallY, wallThick, length, centerX, centerZ) {
  // battlements along a wall; alongZ=true means wall runs on X (north/south)
  const step = 2.2;
  const count = Math.floor(length / step);
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) continue;
    const t = (i + 0.5) / count - 0.5;
    if (alongZ) {
      addBox(root, 1.1, 0.9, wallThick + 0.15, centerX + t * length, wallY + 0.45, centerZ, mat);
    } else {
      addBox(root, wallThick + 0.15, 0.9, 1.1, centerX, wallY + 0.45, centerZ + t * length, mat);
    }
  }
}

function tower(root, stone, accent, x, z) {
  const g = new THREE.Group();
  addBox(g, 3.2, 6.5, 3.2, 0, 3.25, 0, stone);
  addBox(g, 3.8, 0.45, 3.8, 0, 6.6, 0, stone);
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    addBox(g, 0.9, 1.1, 0.9, sx * 1.45, 7.3, sz * 1.45, stone);
  }
  // torch glow pot
  addBox(g, 0.55, 0.35, 0.55, 0, 5.2, 1.7, accent, false);
  g.position.set(x, 0, z);
  root.add(g);
  return g;
}

function banner(root, x, z, color) {
  const pole = lambert("#3a2a1a");
  addBox(root, 0.22, 5.2, 0.22, x, 2.6, z, pole);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.2),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  );
  cloth.position.set(x + 0.85, 4.0, z);
  root.add(cloth);
  const crest = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.9),
    new THREE.MeshBasicMaterial({ color: "#f0c020", side: THREE.DoubleSide })
  );
  crest.position.set(x + 0.85, 4.35, z + 0.02);
  root.add(crest);
}

function makeField(scene, fieldRoot, nightExtra) {
  for (const l of lamps) {
    if (l.parent) l.parent.remove(l);
  }
  lamps.length = 0;
  while (fieldRoot.children.length) fieldRoot.remove(fieldRoot.children[0]);
  while (nightExtra.children.length) nightExtra.remove(nightExtra.children[0]);

  const grass = grassTex();
  const stone = stoneTex();
  const dirt = dirtTex();
  const stoneMat = lambert("#ffffff", stone);
  const grassMat = lambert("#ffffff", grass);
  const dirtMat = lambert("#ffffff", dirt);
  const gold = lambert("#f0c020");
  const moonMat = new THREE.MeshBasicMaterial({ color: "#f5e6a0" });

  // apron / courtyard dirt
  const apron = addBox(fieldRoot, FW + 16, 0.28, FL + 18, 0, -0.38, 0, dirtMat);
  apron.name = "apron";

  // pixel turf
  const turf = addBox(fieldRoot, FW + 8, 0.4, FL + 10, 0, -0.2, 0, grassMat);
  turf.name = "turf";

  // pitch lines (creamy SNES UI cream)
  const lineMat = new THREE.MeshBasicMaterial({ color: "#f7f1d0" });
  const line = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), lineMat);
    m.position.set(x, 0.03, z);
    fieldRoot.add(m);
  };
  line(FW, 0.22, 0, -FL / 2);
  line(FW, 0.22, 0, FL / 2);
  line(0.22, FL, -FW / 2, 0);
  line(0.22, FL, FW / 2, 0);
  line(FW, 0.2, 0, 0);
  const circ = new THREE.Mesh(
    new THREE.RingGeometry(4.25, 4.55, 16),
    new THREE.MeshBasicMaterial({ color: "#f7f1d0", side: THREE.DoubleSide })
  );
  circ.rotation.x = -Math.PI / 2;
  circ.position.y = 0.04;
  fieldRoot.add(circ);
  line(GOAL_W + 4, 0.16, 0, -FL / 2 + 5);
  line(GOAL_W + 4, 0.16, 0, FL / 2 - 5);
  line(0.16, 5, -(GOAL_W / 2 + 2), -FL / 2 + 2.5);
  line(0.16, 5, GOAL_W / 2 + 2, -FL / 2 + 2.5);
  line(0.16, 5, -(GOAL_W / 2 + 2), FL / 2 - 2.5);
  line(0.16, 5, GOAL_W / 2 + 2, FL / 2 - 2.5);

  // castle walls (same footprint as old boards)
  const wallH = 3.4;
  const wallY = wallH / 2;
  const nZ = -FL / 2 - 3.6;
  const sZ = FL / 2 + 3.6;
  const wX = -FW / 2 - 2.8;
  const eX = FW / 2 + 2.8;
  addBox(fieldRoot, FW + 8, wallH, 1.1, 0, wallY, nZ, stoneMat);
  addBox(fieldRoot, FW + 8, wallH, 1.1, 0, wallY, sZ, stoneMat);
  addBox(fieldRoot, 1.1, wallH, FL + 8, wX, wallY, 0, stoneMat);
  addBox(fieldRoot, 1.1, wallH, FL + 8, eX, wallY, 0, stoneMat);
  crenellate(fieldRoot, stoneMat, true, wallH, 1.1, FW + 8, 0, nZ);
  crenellate(fieldRoot, stoneMat, true, wallH, 1.1, FW + 8, 0, sZ);
  crenellate(fieldRoot, stoneMat, false, wallH, 1.1, FL + 8, wX, 0);
  crenellate(fieldRoot, stoneMat, false, wallH, 1.1, FL + 8, eX, 0);

  // corner towers
  const tOffX = FW / 2 + 3.6;
  const tOffZ = FL / 2 + 4.2;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    tower(fieldRoot, stoneMat, gold, sx * tOffX, sz * tOffZ);
  }

  // team banners
  banner(fieldRoot, -FW / 2 + 2, -FL / 2 + 3, "#3a6fff");
  banner(fieldRoot, FW / 2 - 2, -FL / 2 + 3, "#3a6fff");
  banner(fieldRoot, -FW / 2 + 2, FL / 2 - 3, "#e24a3a");
  banner(fieldRoot, FW / 2 - 2, FL / 2 - 3, "#e24a3a");

  // ivy tufts on walls
  const ivy = lambert("#1f6b2a");
  for (const z of [nZ + 0.7, sZ - 0.7]) {
    for (let i = -4; i <= 4; i++) {
      addBox(fieldRoot, 1.4, 0.9, 0.25, i * 4.5, 0.7, z, ivy, false);
    }
  }

  // castle-gate goals
  function goal(z, color) {
    const grp = new THREE.Group();
    const post = lambert(color);
    const stonePost = stoneMat;
    const netM = new THREE.MeshLambertMaterial({
      color: "#fff8dc",
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    // stone gate pillars
    for (const sx of [-1, 1]) {
      addBox(grp, 1.1, GOAL_H + 1.2, 1.1, sx * (GOAL_W / 2 + 0.55), (GOAL_H + 1.2) / 2, z > 0 ? 0.1 : -0.1, stonePost);
      addBox(grp, 0.9, 0.7, 0.9, sx * (GOAL_W / 2 + 0.55), GOAL_H + 1.35, z > 0 ? 0.1 : -0.1, stonePost);
    }
    addBox(grp, GOAL_W + 2.2, 0.7, 1.0, 0, GOAL_H + 0.85, z > 0 ? 0.1 : -0.1, stonePost);
    // colored crossbar accent
    addBox(grp, GOAL_W + 0.4, 0.28, 0.28, 0, GOAL_H, z > 0 ? 0.25 : -0.25, post, false);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, GOAL_H, 6, 3), netM);
    net.position.set(0, GOAL_H / 2, z > 0 ? 1.4 : -1.4);
    grp.add(net);
    grp.position.z = z;
    return grp;
  }
  fieldRoot.add(goal(-FL / 2 - 0.2, "#3a6fff"));
  fieldRoot.add(goal(FL / 2 + 0.2, "#f0c020"));

  // torch posts (replace stadium floodlights)
  // Outside playable bounds (cars clamp to FW/FL) - sit on apron / wall line
  const torchPositions = [
    [-FW / 2 - 1.6, -FL / 2 - 1.2], [FW / 2 + 1.6, -FL / 2 - 1.2],
    [-FW / 2 - 1.6, FL / 2 + 1.2], [FW / 2 + 1.6, FL / 2 + 1.2],
    [-FW / 2 - 3.4, 0], [FW / 2 + 3.4, 0]
  ];
  for (const [x, z] of torchPositions) {
    addBox(fieldRoot, 0.35, 3.2, 0.35, x, 1.6, z, lambert("#3a2a1a"));
    addBox(fieldRoot, 0.7, 0.35, 0.7, x, 3.35, z, lambert("#5a3a18"), false);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.9, 5),
      new THREE.MeshBasicMaterial({ color: "#ffb040" })
    );
    flame.position.set(x, 4.0, z);
    fieldRoot.add(flame);
    const lamp = new THREE.PointLight("#ffb060", 28, 42, 2);
    lamp.position.set(x, 4.1, z);
    scene.add(lamp);
    lamps.push(lamp);
  }

  // chunky trees outside walls (SNES cones)
  const trunkM = lambert("#5a3318");
  const leafM = lambert("#1f6b2a");
  const leaf2 = lambert("#3a9a3a");
  for (const [x, z] of [
    [-FW / 2 - 8, -FL / 2 - 6], [FW / 2 + 8, -FL / 2 - 6],
    [-FW / 2 - 8, FL / 2 + 6], [FW / 2 + 8, FL / 2 + 6],
    [-FW / 2 - 10, 0], [FW / 2 + 10, 0],
    [-FW / 2 - 6, -FL / 2 + 8], [FW / 2 + 6, -FL / 2 + 8],
    [-FW / 2 - 6, FL / 2 - 8], [FW / 2 + 6, FL / 2 - 8]
  ]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.4, 6), trunkM);
    trunk.position.set(x, 0.7, z);
    fieldRoot.add(trunk);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.4, 6), Math.abs(x + z) % 2 ? leafM : leaf2);
    leaf.position.set(x, 2.4, z);
    leaf.castShadow = true;
    fieldRoot.add(leaf);
  }

  // night-only: big pixel moon + distant keep
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 10), moonMat);
  moon.position.set(22, 28, -40);
  nightExtra.add(moon);
  const keep = addBox(nightExtra, 22, 12, 8, 0, 6, -46, stoneMat);
  keep.castShadow = false;
  for (let i = -2; i <= 2; i++) {
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.2, 0.15),
      new THREE.MeshBasicMaterial({ color: "#7fd0ff" })
    );
    win.position.set(i * 3.2, 5.5, -41.9);
    nightExtra.add(win);
  }
  const neon = new THREE.PointLight("#f0c020", 18, 55, 2);
  neon.position.set(0, 11, -40);
  nightExtra.add(neon);
}

export { lamps, makeField };
