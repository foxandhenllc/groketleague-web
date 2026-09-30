import * as THREE from 'three';
import { cosmetic } from './progression.js';
import { byId } from './catalog.js';

/** Cosmetic planes are decorations; vehicle dimensions and contact geometry stay authoritative. */
export function paintRoofDecal(mesh, id, equipped) {
  if (mesh.userData.decal === equipped) return;
  mesh.userData.decal = equipped;
  const old = mesh.getObjectByName('earned-decal');
  if (old) { mesh.remove(old); old.geometry.dispose(); old.material.map?.dispose(); old.material.dispose(); }
  const c = cosmetic(equipped); if (!c.glyph) return;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101b29'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = c.color; ctx.lineWidth = 8; ctx.strokeRect(5, 5, 118, 118);
  ctx.fillStyle = c.color; ctx.font = 'bold 90px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.glyph, 64, 69);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const size = Math.min(1.05, byId(id).spec.w * .55);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({map:texture, side:THREE.DoubleSide}));
  plane.name = 'earned-decal'; plane.userData.decoration = true;
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0, new THREE.Box3().setFromObject(mesh.getObjectByName('solid-body')).max.y + .03, id === 'semi' ? 1.1 : 0);
  mesh.add(plane);
}
