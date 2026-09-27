import * as THREE from 'three';
import { SINK, sinkHeight, sinkSurface } from './sink.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };
const HALF_HEIGHT = .35, PROXY_RADIUS = SINK.soap.radius;
const VISUAL_OFFSET = PROXY_RADIUS - HALF_HEIGHT;

function roundedRect(width, length, radius) {
  const shape = new THREE.Shape(), x = -width / 2, y = -length / 2;
  shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + length - radius);
  shape.quadraticCurveTo(x + width, y + length, x + width - radius, y + length);
  shape.lineTo(x + radius, y + length);
  shape.quadraticCurveTo(x, y + length, x, y + length - radius);
  shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/** Deterministic score choreography. Entry/worldY remain physics proxy-center coordinates. */
export function soapGoalPose(goal, reducedMotion = false) {
  const age = Math.max(0, goal?.age || 0), entry = goal?.entry || {};
  const gx = goal?.x || 0, gz = goal?.z || 0;
  const dx = (entry.x ?? gx) - gx, dz = (entry.z ?? gz) - gz;
  const initialRadius = Math.hypot(dx, dz), initialAngle = Math.atan2(dz, dx);
  const capture = smooth(age / .7), drop = smooth((age - .7) / .55);
  const direction = Math.sign(dx * (entry.vz || 0) - dz * (entry.vx || 0)) || -1;
  const turn = reducedMotion ? 0 : direction * (capture * Math.PI * 1.25 + drop * Math.PI * 1.1);
  const radius = (initialRadius * (1 - capture * .75) + (reducedMotion ? 0 : Math.sin(capture * Math.PI) * .2)) * (1 - drop);
  const drift = reducedMotion ? 0 : age * .07 * (1 - capture);
  const entryHeight = (entry.worldY ?? ((entry.y ?? PROXY_RADIUS) + sinkHeight(entry.x ?? gx, entry.z ?? gz))) - VISUAL_OFFSET;
  const orientation = entry.soap || entry;
  return {
    x: gx + Math.cos(initialAngle + turn) * radius + (entry.vx || 0) * drift,
    y: entryHeight * (1 - capture) + HALF_HEIGHT * capture - drop * 3.8,
    z: gz + Math.sin(initialAngle + turn) * radius + (entry.vz || 0) * drift,
    pitch: (orientation.pitch || 0) * (1 - drop) + (reducedMotion ? 0 : drop * .9),
    yaw: (orientation.yaw ?? Math.atan2(entry.vx || 0, entry.vz || 0)) + turn,
    roll: (orientation.roll || 0) * (1 - drop) + (reducedMotion ? 0 : Math.sin(capture * Math.PI) * .22),
    scale: 1 - drop * .3,
    visible: age < 1.3
  };
}

/** One world-space group: moving soap body plus a fixed, reusable suds pool. */
export function makeSoap() {
  const root = new THREE.Group(); root.name = 'sink-soap';
  const body = new THREE.Group(); body.name = 'pastel-soap'; body.rotation.order = 'YXZ'; root.add(body);
  // Rounded footprint is 1.35 x 2.0, centered on the shared one-unit contact proxy.
  const geometry = new THREE.ExtrudeGeometry(roundedRect(1.17, 1.82, .26), {
    depth: .52, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: .09, bevelThickness: .09, curveSegments: 10
  });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, -.26, 0);
  geometry.computeVertexNormals();
  const soapMaterial = new THREE.MeshPhysicalMaterial({
    color: '#f5b4ce', roughness: .22, metalness: 0, clearcoat: .85, clearcoatRoughness: .15,
    emissive: '#5c2540', emissiveIntensity: .13
  });
  const soap = new THREE.Mesh(geometry, soapMaterial); soap.castShadow = true; soap.receiveShadow = true; body.add(soap);
  const inset = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(.88, 1.28, .2), 8), new THREE.MeshStandardMaterial({color: '#e899b7', roughness: .3, metalness: 0}));
  inset.rotation.x = -Math.PI / 2; inset.position.y = .354; body.add(inset);

  // The pressed maker's mark adds identity on the closer goal shot, while the bar silhouette carries play.
  const stampCanvas = document.createElement('canvas'); stampCanvas.width = 256; stampCanvas.height = 384;
  const ctx = stampCanvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 384); ctx.translate(128, 192); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 61px Arial';
  ctx.fillStyle = '#af5d82'; ctx.fillText('SOAP', 0, 2);
  ctx.fillStyle = '#ffe9f2'; ctx.fillText('SOAP', 0, -1);
  const stampTexture = new THREE.CanvasTexture(stampCanvas); stampTexture.colorSpace = THREE.SRGBColorSpace;
  const stamp = new THREE.Mesh(new THREE.PlaneGeometry(.76, 1.12), new THREE.MeshBasicMaterial({map: stampTexture, transparent: true, depthWrite: false, opacity: .88}));
  stamp.rotation.x = -Math.PI / 2; stamp.position.y = .36; body.add(stamp);
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(.09, 1.0), new THREE.MeshBasicMaterial({color: '#fff6fb', transparent: true, opacity: .42, depthWrite: false}));
  sheen.rotation.x = -Math.PI / 2; sheen.position.set(-.43, .364, -.05); body.add(sheen);

  const sudsMaterial = new THREE.MeshBasicMaterial({color: '#e5f8ff', transparent: true, opacity: .52, depthWrite: false});
  const suds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), sudsMaterial, 28);
  suds.frustumCulled = false; suds.visible = false; root.add(suds);
  const trail = Array.from({length: 28}, () => ({x: 0, z: 0, at: -99, radius: 0}));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.86, 28), new THREE.MeshBasicMaterial({color: '#152631', transparent: true, opacity: .2, depthWrite: false}));
  shadow.rotation.x = -Math.PI / 2; shadow.visible = false; root.add(shadow);
  root.userData = {body, suds, shadow, trail, cursor: 0, lastTime: -1, lastEmit: -1, lastX: 0, lastZ: 0,
    transform: new THREE.Object3D(), targetPosition: new THREE.Vector3(), targetQuaternion: new THREE.Quaternion(),
    targetEuler: new THREE.Euler(0, 0, 0, 'YXZ'), resetTrail: true, hasPose: false, lastGoalId: null};
  return root;
}

/** Render adapter only: authoritative position/orientation are read, never modified. Returns visual center. */
export function updateSoap(root, ball, {time = 0, dt = 0, interpolate = false, reducedMotion = false, goal = null} = {}) {
  const data = root.userData, body = data.body, surface = sinkSurface(ball.x, ball.z);
  const soap = ball.soap;
  if (!Number.isFinite(time)) time = 0;
  const reset = time < data.lastTime || Math.hypot(ball.x - data.lastX, ball.z - data.lastZ) > 12 || (data.lastGoalId !== null && !goal);
  if (reset) data.resetTrail = true;
  if (data.resetTrail) {
    data.trail.forEach(drop => {drop.at = -99;}); data.lastEmit = time; data.resetTrail = false;
  }
  const worldY = soap?.worldY ?? (ball.y + surface.height);
  if (goal) {
    const pose = soapGoalPose(goal, reducedMotion);
    body.position.set(pose.x, pose.y, pose.z); body.rotation.set(pose.pitch, pose.yaw, pose.roll);
    body.scale.setScalar(pose.scale); body.visible = pose.visible;
  } else {
    body.visible = true; body.scale.setScalar(1);
    data.targetPosition.set(ball.x, worldY - VISUAL_OFFSET, ball.z);
    data.targetEuler.set(soap?.pitch || 0, soap?.yaw || 0, soap?.roll || 0);
    data.targetQuaternion.setFromEuler(data.targetEuler);
    if (interpolate && dt > 0 && data.hasPose && !reset) {
      const blend = 1 - Math.exp(-dt / .05);
      body.position.lerp(data.targetPosition, blend); body.quaternion.slerp(data.targetQuaternion, blend);
    } else {
      body.position.copy(data.targetPosition); body.quaternion.copy(data.targetQuaternion);
    }
  }
  const airborne = soap?.airborne ?? ball.y > PROXY_RADIUS + .05;
  const speed = Math.hypot(ball.vx || 0, ball.vz || 0);
  // Suds are deposited in world space, only along real floor contact; no mid-air skid trail.
  if (!goal && !airborne && speed > 1.5 && time - data.lastEmit > .055 && !reducedMotion) {
    const count = surface.wet > .15 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const k = data.cursor++, drop = data.trail[k % data.trail.length], a = k * 2.39996;
      drop.x = body.position.x + Math.cos(a) * .3; drop.z = body.position.z + Math.sin(a) * .4;
      drop.at = time; drop.radius = .11 + (k % 4) * .035;
    }
    data.lastEmit = time;
  }
  data.trail.forEach((drop, i) => {
    const age = time - drop.at, life = 1.25, active = age >= 0 && age < life && !reducedMotion && !goal;
    data.transform.position.set(drop.x, sinkHeight(drop.x, drop.z) + .055, drop.z);
    const scale = active ? drop.radius * (1 - smooth(age / life)) : 0;
    data.transform.scale.set(scale, scale * .35, scale);
    data.transform.updateMatrix(); data.suds.setMatrixAt(i, data.transform.matrix);
  });
  data.suds.instanceMatrix.needsUpdate = true; data.suds.visible = !reducedMotion && !goal;
  data.shadow.visible = !goal && airborne;
  data.shadow.position.set(ball.x, surface.height + .04, ball.z);
  data.shadow.scale.setScalar(clamp(1 - (worldY - surface.height - PROXY_RADIUS) * .04, .45, 1));
  data.shadow.material.opacity = clamp(.23 - (worldY - surface.height - PROXY_RADIUS) * .015, .07, .23);
  data.lastTime = time; data.lastX = ball.x; data.lastZ = ball.z; data.hasPose = true; data.lastGoalId = goal ? goal.id ?? 'goal' : null;
  return body.position;
}
