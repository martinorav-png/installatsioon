import { expect, it } from 'vitest';
import { createNormalSmoother } from './surface';

it('softens adjacent normal discontinuities without losing unit length or isolated normals', () => {
  const normals = new Float32Array([0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  createNormalSmoother(new Uint32Array([0, 1, 2]), 4)(normals);
  expect(normals[0]).toBeGreaterThan(.1);
  expect(normals[4]).toBeGreaterThan(.1);
  expect(normals[0] * normals[3] + normals[1] * normals[4]).toBeGreaterThan(.5);
  for (let i = 0; i < normals.length; i += 3) expect(Math.hypot(normals[i], normals[i + 1], normals[i + 2])).toBeCloseTo(1, 5);
  expect(Array.from(normals.slice(9))).toEqual([0, 0, 1]);
});
