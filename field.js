import * as THREE from "three";
import { FW, FL, GOAL_W, GOAL_H } from "./catalog.js";
const lamps = [];
function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}
function makeField(scene, fieldRoot, nightExtra) {
  lamps.length = 0;
  const turf = new THREE.Mesh(new THREE.BoxGeometry(FW + 4, 0.4, FL + 6), lambert("#2f9a3a"));
  turf.position.y = -0.2;
  turf.receiveShadow = true;
  turf.name = "turf";
  fieldRoot.add(turf);
  const stripeMat = lambert("#247a30");
  for (let i = -6; i <= 6; i++) {
    if (i % 2 === 0) continue;
    const s = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.02, FL / 13), stripeMat);
    s.position.set(0, 0.01, i * (FL / 13));
    s.receiveShadow = true;
    fieldRoot.add(s);
  }
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
  const circ = new THREE.Mesh(new THREE.RingGeometry(4.25, 4.55, 16), new THREE.MeshBasicMaterial({ color: "#f7f1d0", side: THREE.DoubleSide }));
  circ.rotation.x = -Math.PI / 2;
  circ.position.y = 0.04;
  fieldRoot.add(circ);
  line(GOAL_W + 4, 0.16, 0, -FL / 2 + 5);
  line(GOAL_W + 4, 0.16, 0, FL / 2 - 5);
  line(0.16, 5, -(GOAL_W / 2 + 2), -FL / 2 + 2.5);
  line(0.16, 5, GOAL_W / 2 + 2, -FL / 2 + 2.5);
  line(0.16, 5, -(GOAL_W / 2 + 2), FL / 2 - 2.5);
  line(0.16, 5, GOAL_W / 2 + 2, FL / 2 - 2.5);
  const boardMat = lambert("#1a2230");
  const yell = lambert("#f0c020");
  const board = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boardMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    fieldRoot.add(m);
  };
  board(FW + 6, 1.5, 0.55, 0, 0.75, -FL / 2 - 3.2);
  board(FW + 6, 1.5, 0.55, 0, 0.75, FL / 2 + 3.2);
  board(0.55, 1.5, FL + 7, -FW / 2 - 2.4, 0.75, 0);
  board(0.55, 1.5, FL + 7, FW / 2 + 2.4, 0.75, 0);
  const ht = new THREE.Mesh(new THREE.BoxGeometry(FW + 6, 0.16, 0.58), yell);
  ht.position.set(0, 1.52, -FL / 2 - 3.2);
  fieldRoot.add(ht);
  const ht2 = ht.clone();
  ht2.position.z = FL / 2 + 3.2;
  fieldRoot.add(ht2);
  function goal(z, color) {
    const grp = new THREE.Group();
    const post = lambert(color);
    const netM = new THREE.MeshLambertMaterial({ color: "#fff8dc", transparent: true, opacity: 0.22, side: THREE.DoubleSide });
    const posts = [
      [-(GOAL_W / 2), GOAL_H / 2, z > 0 ? 0.2 : -0.2, 0.32, GOAL_H, 0.32],
      [GOAL_W / 2, GOAL_H / 2, z > 0 ? 0.2 : -0.2, 0.32, GOAL_H, 0.32],
      [0, GOAL_H, z > 0 ? 0.2 : -0.2, GOAL_W + 0.32, 0.32, 0.32]
    ];
    for (const p of posts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), post);
      m.position.set(p[0], p[1], p[2]);
      m.castShadow = true;
      grp.add(m);
    }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, GOAL_H, 6, 3), netM);
    net.position.set(0, GOAL_H / 2, z > 0 ? 1.4 : -1.4);
    grp.add(net);
    grp.position.z = z;
    return grp;
  }
  fieldRoot.add(goal(-FL / 2 - 0.2, "#3a6fff"));
  fieldRoot.add(goal(FL / 2 + 0.2, "#f0c020"));
  const trunkM = lambert("#5a3318");
  const leafM = lambert("#1f6b2a");
  const leaf2 = lambert("#3a9a3a");
  for (const [x, z] of [[-24, -18], [24, -18], [-24, 18], [24, 18], [-26, 0], [26, 0], [-22, 30], [22, 30], [-22, -30], [22, -30]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.4, 6), trunkM);
    trunk.position.set(x, 0.7, z);
    fieldRoot.add(trunk);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.4, 6), Math.abs(x + z) % 2 ? leafM : leaf2);
    leaf.position.set(x, 2.4, z);
    leaf.castShadow = true;
    fieldRoot.add(leaf);
  }
  for (const [x, z] of [[-20, -24], [20, -24], [-20, 24], [20, 24]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 10, 6), lambert("#2a2430"));
    pole.position.set(x, 5, z);
    fieldRoot.add(pole);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.35, 0.4, 8), lambert("#f0c020"));
    bowl.position.set(x, 10.1, z);
    fieldRoot.add(bowl);
    const lamp = new THREE.PointLight("#fff2cc", 28, 48, 2);
    lamp.position.set(x, 10.2, z);
    scene.add(lamp);
    lamps.push(lamp);
  }
  const plant = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 6), lambert("#243044"));
  plant.position.set(0, 5, -42);
  nightExtra.add(plant);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.2), new THREE.MeshBasicMaterial({ color: "#f0c020" }));
  sign.position.set(0, 9.2, -38.8);
  nightExtra.add(sign);
  const neon = new THREE.PointLight("#f0c020", 35, 60, 2);
  neon.position.set(0, 10, -36);
  nightExtra.add(neon);
  for (let i = -3; i <= 3; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.1), new THREE.MeshBasicMaterial({ color: "#7fd0ff" }));
    win.position.set(i * 3.4, 3.4, -38.95);
    nightExtra.add(win);
  }
}
export { lamps, makeField };
