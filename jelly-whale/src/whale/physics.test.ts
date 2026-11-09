import { describe, expect, it } from 'vitest';
import { createLattice, whaleSdf } from './shape';
import { SoftWhale } from './physics';
import { applyDisplayHop } from './display';

describe('blue whale tetrahedral body', () => {
  it('recovers its full shape after a downward squash without locking compressed cells', () => {
    const simulation = new SoftWhale(createLattice(.18));
    const volume = simulation.volume();
    for (let frame = 0; frame < 6; frame++) simulation.step(1 / 60, 0);
    const start = [-.6611350906702453, 1.5704078215962012, -.01190705394544267] as const;
    const end = [-.5537371014263304, .6596702315938509, .4144640542891054] as const;
    simulation.startGrab(...start);
    for (let frame = 1; frame <= 12; frame++) {
      simulation.grab!.target = start.map((v, i) => v + (end[i] - v) * frame / 12);
      simulation.step(1 / 60, 0);
    }
    for (let frame = 0; frame < 15; frame++) simulation.step(1 / 60, 0);
    simulation.grab = null;
    let lateMovement = 0;
    for (let frame = 0; frame < 300; frame++) {
      const before = simulation.positions.slice();
      simulation.step(1 / 60, 0);
      if (frame >= 270) {
        const rms = Math.sqrt(simulation.positions.reduce((sum, value, i) => sum + (value - before[i]) ** 2, 0) / (before.length / 3));
        lateMovement = Math.max(lateMovement, rms);
      }
    }
    expect(simulation.volume() / volume).toBeGreaterThan(.98);
    expect(lateMovement).toBeLessThan(.001);
  });

  it('repeated display hops lift the body and settle without accumulating motion or losing volume', () => {
    const simulation = new SoftWhale(createLattice(.18));
    const initialVolume = simulation.volume();
    const meanHeight = () => {
      let sum = 0;
      for (let i = 1; i < simulation.positions.length; i += 3) sum += simulation.positions[i];
      return sum / (simulation.positions.length / 3);
    };
    const restingHeight = meanHeight();
    for (let hop = 0; hop < 6; hop++) {
      applyDisplayHop(simulation, hop + 1);
      let peak = -Infinity;
      for (let frame = 0; frame < 168; frame++) {simulation.step(1 / 60, 0);peak = Math.max(peak, meanHeight());}
      expect(peak).toBeGreaterThan(restingHeight + .30);
      expect(simulation.volume() / initialVolume).toBeGreaterThan(.95);
      expect(simulation.volume() / initialVolume).toBeLessThan(1.05);
      const rmsSpeed = Math.sqrt(simulation.velocities.reduce((sum, value) => sum + value * value, 0) / (simulation.velocities.length / 3));
      expect(rmsSpeed).toBeLessThan(.15);
    }
  }, 15000);

  it('dissipates release vibrations instead of sustaining rapid frame-to-frame shaking', () => {
    const simulation = new SoftWhale(createLattice(.18));
    simulation.startGrab(-1, .85, .75);
    for (let frame = 0; frame < 45; frame++) {
      const amount = Math.min(1, frame / 30);
      simulation.grab!.target = [-1 + .35 * amount, .85 + .9 * amount, .75 + .2 * amount];
      simulation.step(1 / 60, 0);
    }
    simulation.grab = null;
    for (let frame = 0; frame < 240; frame++) {
      const before = simulation.positions.slice();
      simulation.step(1 / 60, 0);
      if (frame >= 210) {
        const rmsMovement = Math.sqrt(simulation.positions.reduce((sum, value, i) => sum + (value - before[i]) ** 2, 0) / (before.length / 3));
        expect(rmsMovement).toBeLessThan(.001);
      }
    }
  });

  it.each([.12, .18])('keeps a downward grab and twist above the floor at spacing %s', (spacing) => {
    const simulation = new SoftWhale(createLattice(spacing));
    simulation.startGrab(-1, .85, .75);
    simulation.grab!.target = [-.6, .06, 1.05];
    simulation.grab!.twist = .7;
    for (let frame = 0; frame < 90; frame++) {
      if (frame === 45) simulation.grab = null;
      simulation.step(1 / 60, 0);
      let lowest = Infinity;
      for (let i = 1; i < simulation.positions.length; i += 3) lowest = Math.min(lowest, simulation.positions[i]);
      expect(lowest).toBeGreaterThanOrEqual(.022 - 1e-7);
    }
  });

  it('follows a sustained upward pull instead of being dragged back to its rest height', () => {
    const simulation = new SoftWhale(createLattice(.18));
    const point = [-1, .85, .75] as const;
    const contact = simulation.embed(...point);
    const initialVolume = simulation.volume();
    simulation.startGrab(...point);
    for (let frame = 0; frame < 60; frame++) {
      const amount = Math.min(1, frame / 30);
      simulation.grab!.target = [-1 + .35 * amount, .85 + .9 * amount, .75 + .2 * amount];
      simulation.step(1 / 60, 0);
    }
    const held = simulation.evaluate(contact);
    expect(held[1] - point[1]).toBeGreaterThan(.81);
    expect(held[0] - point[0]).toBeGreaterThan(.3);
    for (let frame = 0; frame < 30; frame++) simulation.step(1 / 60, 0);
    expect(simulation.evaluate(contact)[1]).toBeGreaterThan(held[1] - .03);
    expect(simulation.volume() / initialVolume).toBeGreaterThan(.9);
    expect(simulation.volume() / initialVolume).toBeLessThan(1.12);
  });

  it('retains a visible rebound after releasing a stretch instead of snapping to rest', () => {
    const simulation = new SoftWhale(createLattice(.18));
    const contact = simulation.embed(-1, .85, .75);
    simulation.startGrab(-1, .85, .75);
    simulation.grab!.target = [-.65, 1.75, .95];
    for (let frame = 0; frame < 45; frame++) simulation.step(1 / 60, 0);
    const heldHeight = simulation.evaluate(contact)[1] - .85;
    simulation.grab = null;
    for (let frame = 0; frame < 6; frame++) simulation.step(1 / 60, 0);
    expect(simulation.evaluate(contact)[1] - .85).toBeGreaterThan(heldHeight * .2);
    let lowest = Infinity;
    for (let frame = 0; frame < 90; frame++) {
      simulation.step(1 / 60, 0);
      lowest = Math.min(lowest, simulation.evaluate(contact)[1]);
    }
    expect(lowest).toBeLessThan(.83);
  });

  it.each([.12, .18])('has a wide head, tapered tail and a connected volume at spacing %s', (spacing) => {
    expect(whaleSdf(-1.7, 0.7, 0)).toBeLessThan(0);
    expect(whaleSdf(0, 0.8, 0)).toBeLessThan(0);
    expect(whaleSdf(0, 2.5, 0)).toBeGreaterThan(0);
    const body = createLattice(spacing);
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

  it.each([.12, .18])('inflates by approximately 35 percent without collapse at spacing %s', (spacing) => {
    const simulation = new SoftWhale(createLattice(spacing));
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

  it.each([.12, .18])('keeps cells from folding during a firm pull and release at spacing %s', (spacing) => {
    const simulation = new SoftWhale(createLattice(spacing));
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
