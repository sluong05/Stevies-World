// A little 3D door back to the living room, kept in the top-left corner of every room's view.
// It sits in the scene (not the DOM) and follows the camera, so it's always in reach.
import * as THREE from '../vendor/three.module.min.js';

function paint() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 400;
  const g = c.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, 256, 400);
    g.fillStyle = '#f3ead8'; g.fillRect(14, 70, 228, 330); // frame
    g.fillStyle = '#8a5a3a'; g.fillRect(34, 88, 188, 312); // door
    g.fillStyle = '#76492e'; g.fillRect(56, 110, 144, 110); g.fillRect(56, 240, 144, 140); // panels
    g.fillStyle = '#d8b45a'; g.beginPath(); g.arc(196, 250, 10, 0, Math.PI * 2); g.fill(); // knob
    g.fillStyle = '#c89a5a'; g.fillRect(0, 0, 256, 66); g.fillStyle = '#f6e7c4'; g.fillRect(5, 5, 246, 56); // plaque
    g.fillStyle = '#4a3220'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 30px "Kiwi Maru", Georgia, serif'; g.fillText('← Living room', 128, 35);
  };
  draw();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  document.fonts?.ready.then(() => { draw(); tex.needsUpdate = true; });
  return tex;
}

export function exitDoor() {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 1), new THREE.MeshBasicMaterial({ map: paint(), transparent: true, depthTest: false, depthWrite: false }));
  mesh.renderOrder = 999; mesh.rotation.y = 0.35; // turned a little toward the room, like a real door on a side wall
  group.add(mesh);
  return {
    group, mesh,
    // Call right before rendering: pins the door to the top-left of what the camera sees.
    place(cam, inset = 0) { // inset: fraction of the view height covered at the top (by the floating top bar)
      const d = 1, halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * d, halfW = halfH * cam.aspect;
      const h = Math.min(halfH * 0.5, halfW * 0.6), m = Math.min(halfW, halfH) * 0.05;
      mesh.scale.set(h, h, 1);
      mesh.position.set(-halfW + m + h * 0.32, halfH * (1 - 2 * inset) - m - h / 2, -d);
      group.position.copy(cam.position); group.quaternion.copy(cam.quaternion);
      group.updateMatrixWorld(true);
    },
    hit(ray) { return ray.intersectObject(mesh, false).length > 0; },
  };
}
