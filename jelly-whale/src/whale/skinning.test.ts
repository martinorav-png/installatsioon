import { expect, it } from 'vitest';
import { SoftWhale } from './physics';
import { createLattice } from './shape';

it('blends a squash continuously across internal cell boundaries', () => {
  const soft = new SoftWhale(createLattice(.18));
  const points = new Float32Array([-.002, 1.2, .1, -.001, 1.2, .1, 0, 1.2, .1, .001, 1.2, .1, .002, 1.2, .1]);
  const binding = soft.bind(points);
  // A crease in the coarse cage must not appear as a crease in the gel skin.
  for (let i = 0; i < soft.positions.length; i += 3) soft.positions[i + 1] += .3 * Math.abs(soft.rest[i]);
  soft.skin(binding, points);
  const leftSlope = (points[7] - points[4]) / .001;
  const rightSlope = (points[10] - points[7]) / .001;
  expect(Math.abs(rightSlope - leftSlope)).toBeLessThan(.015);
});

it('preserves the whale outline and transfers affine strains without shrinking the skin', () => {
  const soft = new SoftWhale(createLattice(.18));
  const rest = new Float32Array([-2.48, .7, .2, -1, 1.3, .2, -.3, .32, 1.2, 2.65, .5, .9]);
  const points = rest.slice(), binding = soft.bind(rest);
  soft.skin(binding, points);
  for (let i = 0; i < points.length; i++) expect(points[i]).toBeCloseTo(rest[i], 5);
  for (let i = 0; i < soft.positions.length; i += 3) {
    soft.positions[i] = soft.rest[i] * 1.4 + .2 * soft.rest[i + 1] + .7;
    soft.positions[i + 1] = soft.rest[i + 1] * .65 + .4;
    soft.positions[i + 2] = soft.rest[i + 2] / (1.4 * .65) - .3;
  }
  soft.skin(binding, points);
  for (let i = 0; i < points.length; i += 3) {
    expect(points[i]).toBeCloseTo(rest[i] * 1.4 + .2 * rest[i + 1] + .7, 3);
    expect(points[i + 1]).toBeCloseTo(rest[i + 1] * .65 + .4, 3);
    expect(points[i + 2]).toBeCloseTo(rest[i + 2] / (1.4 * .65) - .3, 3);
  }
});
