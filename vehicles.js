import * as THREE from "three";
function hull(points, width, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function lambert(color, extras = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extras });
}
function wheels(g, zF, zB, r, xOff, fat = 0.38) {
  const tire = lambert("#1a1420");
  const rim = lambert("#c9a227");
  const tireGeo = new THREE.CylinderGeometry(r, r, fat, 8);
  const rimGeo = new THREE.CylinderGeometry(r * 0.55, r * 0.55, fat + 0.04, 8);
  for (const [x, y, z] of [[xOff, r, zF], [-xOff, r, zF], [xOff, r, -zB], [-xOff, r, -zB]]) {
    const w = new THREE.Mesh(tireGeo, tire);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    w.castShadow = true;
    g.add(w);
    const cap = new THREE.Mesh(rimGeo, rim);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(x, y, z);
    g.add(cap);
  }
}
function stripeLight(w, color, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.08), new THREE.MeshBasicMaterial({ color }));
  m.position.set(0, y, z);
  return m;
}
function makeVehicle(id) {
  const g = new THREE.Group();
  g.userData.id = id;
  if (id === "cybertruck") {
    const steel = lambert("#d5dbe0");
    const shade = lambert("#9aa3ab");
    const glass = lambert("#15202c");
    g.add(hull([[2.48, 0.52], [2.36, 0.92], [0.62, 1.86], [-0.22, 1.86], [-2.38, 1.18], [-2.48, 0.52], [-2.22, 0.46], [2.22, 0.46]], 2.18, steel));
    g.add(hull([[2.18, 0.7], [0.58, 1.68], [-0.18, 1.68], [-2.1, 1.08], [-2.05, 0.72], [2.05, 0.72]], 2.02, shade));
    g.add(hull([[2.12, 0.96], [0.7, 1.78], [0.18, 1.78], [0.18, 1.42], [1.85, 0.98]], 1.92, glass));
    wheels(g, 1.55, 1.62, 0.5, 1.08, 0.42);
    g.add(stripeLight(1.72, "#e8fbff", 0.86, 2.46));
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: "#ff3b3b" }));
    tail.position.set(0, 0.92, -2.46);
    g.add(tail);
  } else if (id === "model3") {
    const paint = lambert("#3a6fff");
    const dark = lambert("#1a2740");
    const glass = lambert("#0b1524");
    g.add(hull([[2.18, 0.42], [2.05, 0.7], [1.15, 0.78], [0.55, 1.28], [-0.35, 1.32], [-1.15, 1.18], [-1.95, 0.72], [-2.12, 0.44], [-1.9, 0.38], [1.95, 0.38]], 1.78, paint));
    g.add(hull([[1.05, 0.82], [0.52, 1.22], [-0.32, 1.26], [-1.05, 1.1], [-1.05, 0.82]], 1.58, glass));
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 3.6), dark);
    skirt.position.set(0, 0.4, 0);
    g.add(skirt);
    wheels(g, 1.32, 1.22, 0.36, 0.92, 0.32);
    g.add(stripeLight(1.35, "#fff", 0.62, 2.14));
  } else if (id === "cybercab") {
    const paint = lambert("#e6ecf2");
    const blush = lambert("#c5d0dc");
    const glass = lambert("#101820");
    g.add(hull([[1.78, 0.4], [1.55, 0.78], [0.85, 1.22], [0.05, 1.38], [-0.75, 1.22], [-1.55, 0.78], [-1.78, 0.4], [-1.5, 0.36], [1.5, 0.36]], 1.68, paint));
    g.add(hull([[0.95, 0.82], [0.55, 1.28], [0.05, 1.36], [-0.55, 1.28], [-0.95, 0.82]], 1.42, glass));
    const chin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.35), blush);
    chin.position.set(0, 0.48, 1.62);
    g.add(chin);
    wheels(g, 1.05, 1, 0.32, 0.8, 0.3);
    g.add(stripeLight(1.05, "#fff", 0.56, 1.78));
  } else {
    const box = lambert("#e23b3b");
    const cab = lambert("#2a3038");
    const glass = lambert("#0c141c");
    g.add(hull([[-0.15, 0.55], [-0.15, 2.55], [-3.55, 2.55], [-3.62, 0.55], [-3.4, 0.5], [-0.3, 0.5]], 2.48, box));
    g.add(hull([[3.55, 0.5], [3.35, 1.15], [2.55, 2.15], [1.55, 2.28], [-0.05, 2.05], [-0.15, 0.52], [3.2, 0.48]], 2.35, cab));
    g.add(hull([[3.15, 1.18], [2.55, 2.05], [1.7, 2.18], [1.7, 1.22]], 2.15, glass));
    wheels(g, 2.55, 2.55, 0.55, 1.12, 0.46);
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.42, 8), lambert("#1a1420"));
    mid.rotation.z = Math.PI / 2;
    mid.position.set(1.12, 0.5, -0.15);
    g.add(mid);
    const mid2 = mid.clone();
    mid2.position.x = -1.12;
    g.add(mid2);
    g.add(stripeLight(1.7, "#fff6c8", 0.82, 3.52));
  }
  return g;
}
function makeBall() {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshLambertMaterial({ color: "#f4f0e6" }));
  m.castShadow = true;
  const patch = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 0), new THREE.MeshBasicMaterial({ color: "#1a1420", wireframe: true }));
  m.add(patch);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: "#111" }));
  eye.position.set(-0.18, 0.22, 0.42);
  m.add(eye);
  const eyeR = eye.clone();
  eyeR.position.x = 0.18;
  m.add(eyeR);
  return m;
}
export { makeBall, makeVehicle };
