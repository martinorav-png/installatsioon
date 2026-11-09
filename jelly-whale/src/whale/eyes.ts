import * as THREE from 'three';
import { SoftWhale } from './physics';
import { section } from './shape';

export function createEyeSurface(soft: SoftWhale, side: number) {
  const x = -1.18, y = .87, [width, height, cy] = section(x);
  const z = side * width * Math.sqrt(Math.max(0, 1 - ((y - cy) / height) ** 2));
  // A small gel drop sits partly inside the cheek, with a soft oval silhouette.
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  geometry.scale(.060, .069, .026);
  geometry.translate(x, y, z + .014 * side);
  const positions = geometry.attributes.position.array as Float32Array;
  const binding = soft.bind(positions);
  return {
    geometry,
    update() {
      soft.skin(binding, positions);
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
    },
  };
}
