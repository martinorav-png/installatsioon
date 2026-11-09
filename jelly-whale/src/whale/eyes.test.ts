import { expect, it } from 'vitest';
import { SoftWhale } from './physics';
import { createLattice } from './shape';
import { createEyeSurface } from './eyes';

it('transfers the cheek volume stretch and squash into the eye surface', () => {
  const soft = new SoftWhale(createLattice(.18));
  const eye = createEyeSurface(soft, 1);
  const positions = eye.geometry.attributes.position.array as Float32Array;
  const rest = positions.slice();
  // An affine, volume-preserving strain isolates deformation transfer from
  // solver stiffness: stretch x by 40%, squash y by 15%, then lift by .7.
  for (let i = 0; i < soft.positions.length; i += 3) {
    soft.positions[i] = -1.18 + (soft.rest[i] + 1.18) * 1.4;
    soft.positions[i + 1] = .87 + (soft.rest[i + 1] - .87) * .85 + .7;
    soft.positions[i + 2] = soft.rest[i + 2] / (1.4 * .85);
  }
  eye.update();
  let meanLift = 0;
  const widths = (values: Float32Array, axis: number) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = axis; i < values.length; i += 3) {lo = Math.min(lo, values[i]);hi = Math.max(hi, values[i]);}
    return hi - lo;
  };
  for (let i = 0; i < positions.length; i += 3) {
    meanLift += positions[i + 1] - rest[i + 1];
    expect(Number.isFinite(positions[i])).toBe(true);
  }
  expect(meanLift / (positions.length / 3)).toBeCloseTo(.7, 3);
  expect(widths(positions, 0) / widths(rest, 0)).toBeCloseTo(1.4, 3);
  expect(widths(positions, 1) / widths(rest, 1)).toBeCloseTo(.85, 3);
  eye.geometry.dispose();
});
