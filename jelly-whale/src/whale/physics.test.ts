import { describe, expect, it } from 'vitest';
import { createLattice, whaleSdf } from './shape';
import { SoftWhale } from './physics';

describe('blue whale tetrahedral body', () => {
  it('has a wide head, tapered tail and a complete connected volume', () => {
    expect(whaleSdf(-1.7, 0.7, 0)).toBeLessThan(0);
    expect(whaleSdf(0, 0.8, 0)).toBeLessThan(0);
    expect(whaleSdf(0, 2.5, 0)).toBeGreaterThan(0);
    const body = createLattice(0.12);
    expect(body.rest.length / 3).toBeGreaterThan(400);
    expect(body.tets.length / 4).toBeGreaterThan(1200);
    const parent = Array.from({ length: body.rest.length / 3 }, (_, i) => i);
    const root = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const active = new Set<number>();
    for (let t = 0; t < body.tets.length; t += 4) {
      for (let j = 0; j < 4; j++) { active.add(body.tets[t + j]); parent[root(body.tets[t + j])] = root(body.tets[t]); }
    }
    expect(new Set([...active].map(root)).size).toBe(1);
    const simulation = new SoftWhale(body);
    expect(simulation.volume()).toBeGreaterThan(3);
    const point = [-1.5, 0.6, 0.2] as const;
    const embedded = simulation.embed(...point);
    const result = simulation.evaluate(embedded);
    result.forEach((v, i) => expect(v).toBeCloseTo(point[i], 4));
    expect(embedded.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it('inflates the production-resolution body by approximately 35 percent without collapse', () => {
    const simulation = new SoftWhale(createLattice(0.12));
    const initial = simulation.volume();
    for (let i = 0; i < 120; i++) simulation.step(1 / 60, Math.min(1, i / 39));
    expect(simulation.volume() / initial).toBeGreaterThan(1.25);
    expect(simulation.volume() / initial).toBeLessThan(1.46);
  });

  it('recovers after a grab and twist without nonfinite positions', () => {
    const simulation = new SoftWhale(createLattice(0.20));
    const initial = simulation.volume();
    simulation.startGrab(-1.0, 0.85, 0.75);
    simulation.grab!.target = [-0.8, 1.3, 0.9];
    simulation.grab!.twist = 0.35;
    for (let i = 0; i < 30; i++) simulation.step(1 / 60, 0);
    expect([...simulation.positions].every(Number.isFinite)).toBe(true);
    simulation.grab = null;
    for (let i = 0; i < 60; i++) simulation.step(1 / 60, 0);
    expect(simulation.volume() / initial).toBeGreaterThan(0.95);
    expect(simulation.volume() / initial).toBeLessThan(1.05);
  });

  it('keeps production-resolution cells from folding during a firm pull and release', () => {
    const simulation = new SoftWhale(createLattice(0.12));
    const { rest, tets, positions } = simulation;
    const tetVolume = (p: Float32Array, t: number) => {
      const [a, b, c, d] = Array.from(tets.subarray(t, t + 4), i => i * 3);
      const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
      const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      const w = [p[d] - p[a], p[d + 1] - p[a + 1], p[d + 2] - p[a + 2]];
      return (u[0] * (v[1] * w[2] - v[2] * w[1]) + u[1] * (v[2] * w[0] - v[0] * w[2]) + u[2] * (v[0] * w[1] - v[1] * w[0])) / 6;
    };
    const initial = simulation.volume();
    const volumes = Array.from({ length: tets.length / 4 }, (_, i) => tetVolume(rest, i * 4));
    simulation.startGrab(-1, .85, .75);
    simulation.grab!.target = [-.6, 2.05, 1.05];
    simulation.grab!.twist = .7;
    for (let frame = 0; frame < 225; frame++) {
      if (frame === 45) simulation.grab = null;
      simulation.step(1 / 60, 0);
      if (frame % 15 === 14) {
        let minimumRatio = Infinity;
        for (let t = 0; t < tets.length; t += 4) minimumRatio = Math.min(minimumRatio, tetVolume(positions, t) / volumes[t / 4]);
        expect(minimumRatio).toBeGreaterThan(.049);
      }
    }
    expect(simulation.volume() / initial).toBeGreaterThan(.98);
    expect(simulation.volume() / initial).toBeLessThan(1.02);
    const rmsError = Math.sqrt(positions.reduce((sum, value, i) => sum + (value - rest[i]) ** 2, 0) / positions.length);
    expect(rmsError).toBeLessThan(.04);
  }, 20000);

  it('stays finite on the floor, expands its true volume and resets', () => {
    const simulation = new SoftWhale(createLattice(0.24));
    const initial = simulation.volume();
    for (let i = 0; i < 45; i++) simulation.step(1 / 60, 0);
    expect([...simulation.positions].every(Number.isFinite)).toBe(true);
    for (let i = 1; i < simulation.positions.length; i += 3) expect(simulation.positions[i]).toBeGreaterThanOrEqual(0.018);
    for (let i = 0; i < 90; i++) simulation.step(1 / 60, 1);
    expect(simulation.volume()).toBeGreaterThan(initial * 1.12);
    simulation.reset();
    expect(simulation.volume()).toBeCloseTo(initial, 4);
  });
});
