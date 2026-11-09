import { expect, it } from 'vitest';
import { createNormalSmoother, relaxSurface } from './surface';

it('softens adjacent normal discontinuities without losing unit length or isolated normals', () => {
  const normals = new Float32Array([0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  createNormalSmoother(new Uint32Array([0, 1, 2]), 4)(normals);
  expect(normals[0]).toBeGreaterThan(.1);
  expect(normals[4]).toBeGreaterThan(.1);
  expect(normals[0] * normals[3] + normals[1] * normals[4]).toBeGreaterThan(.5);
  for (let i = 0; i < normals.length; i += 3) expect(Math.hypot(normals[i], normals[i + 1], normals[i + 2])).toBeCloseTo(1, 5);
  expect(Array.from(normals.slice(9))).toEqual([0, 0, 1]);
});

it('rounds tessellation ripples without erasing the broad surface shape', () => {
  const positions: number[] = [], indices: number[] = [], size = 25;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) positions.push(x * .1, y * .1, .3 + ((x + y) % 2 ? .015 : -.015));
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const a = y * size + x;
    indices.push(a, a + 1, a + size, a + 1, a + size + 1, a + size);
  }
  const result = new Float32Array(positions);
  relaxSurface(result, new Uint32Array(indices));
  // Interior samples retain the plane while the checkerboard ripple disappears.
  for (let y = 10; y < 15; y++) for (let x = 10; x < 15; x++) {
    const i = (y * size + x) * 3;
    expect(result[i]).toBeCloseTo(x * .1, 3);
    expect(result[i + 1]).toBeCloseTo(y * .1, 3);
    expect(Math.abs(result[i + 2] - .3)).toBeLessThan(.002);
  }
});
