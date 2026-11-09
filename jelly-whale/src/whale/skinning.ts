export type SkinBinding = { ids: Uint32Array; weights: Float32Array; offsets: Uint32Array; rest: Float32Array };

// Fit overlapping local affine fields instead of exposing the piecewise-linear
// tetrahedra. These weights are built once; animation only blends displacements.
export function bindSmoothSkin(rest: Float32Array, points: Float32Array, spacing: number): SkinBinding {
  const radius = spacing * 2.3;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < rest.length; i += 3) {
    const key = `${Math.floor(rest[i] / radius)},${Math.floor(rest[i + 1] / radius)},${Math.floor(rest[i + 2] / radius)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i); else grid.set(key, [i]);
  }
  const ids: number[] = [], weights: number[] = [], offsets = new Uint32Array(points.length / 3 + 1);
  const matrix = new Float64Array(20), basis = new Float64Array(4);
  for (let p = 0; p < points.length; p += 3) {
    const candidates: number[] = [], kernels: number[] = [];
    const cx = Math.floor(points[p] / radius), cy = Math.floor(points[p + 1] / radius), cz = Math.floor(points[p + 2] / radius);
    matrix.fill(0);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) {
      const bucket = grid.get(`${x},${y},${z}`);
      if (!bucket) continue;
      for (const i of bucket) {
        basis[0] = 1;
        basis[1] = (rest[i] - points[p]) / radius;
        basis[2] = (rest[i + 1] - points[p + 1]) / radius;
        basis[3] = (rest[i + 2] - points[p + 2]) / radius;
        const distance = Math.hypot(basis[1], basis[2], basis[3]);
        if (distance >= 1) continue;
        // Compact C2 kernel: neighbours enter and leave with zero slope.
        const kernel = (1 - distance) ** 4 * (1 + 4 * distance);
        candidates.push(i); kernels.push(kernel);
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) matrix[a * 5 + b] += kernel * basis[a] * basis[b];
      }
    }
    // Solve M c = (1,0,0,0). A tiny regularizer keeps thin fin tips stable.
    matrix[4] = 1;
    const total = matrix[0];
    for (let a = 1; a < 4; a++) matrix[a * 5 + a] += total * 1e-10;
    let valid = total > 1e-12;
    for (let a = 0; a < 4 && valid; a++) {
      let pivot = a;
      for (let b = a + 1; b < 4; b++) if (Math.abs(matrix[b * 5 + a]) > Math.abs(matrix[pivot * 5 + a])) pivot = b;
      if (Math.abs(matrix[pivot * 5 + a]) < 1e-14) { valid = false; break; }
      if (pivot !== a) for (let b = 0; b < 5; b++) [matrix[a * 5 + b], matrix[pivot * 5 + b]] = [matrix[pivot * 5 + b], matrix[a * 5 + b]];
      const divisor = matrix[a * 5 + a];
      for (let b = a; b < 5; b++) matrix[a * 5 + b] /= divisor;
      for (let b = 0; b < 4; b++) {
        if (b === a) continue;
        const factor = matrix[b * 5 + a];
        for (let c = a; c < 5; c++) matrix[b * 5 + c] -= factor * matrix[a * 5 + c];
      }
    }
    let sum = 0;
    for (let n = 0; n < candidates.length; n++) {
      const i = candidates[n];
      const w = valid ? kernels[n] * (matrix[4] + matrix[9] * (rest[i] - points[p]) / radius + matrix[14] * (rest[i + 1] - points[p + 1]) / radius + matrix[19] * (rest[i + 2] - points[p + 2]) / radius) : kernels[n] / total;
      ids.push(i); weights.push(w); sum += w;
    }
    if (!candidates.length) {
      let nearest = 0, distance = Infinity;
      for (let i = 0; i < rest.length; i += 3) {
        const d = (rest[i] - points[p]) ** 2 + (rest[i + 1] - points[p + 1]) ** 2 + (rest[i + 2] - points[p + 2]) ** 2;
        if (d < distance) { distance = d; nearest = i; }
      }
      ids.push(nearest); weights.push(1); sum = 1;
    }
    for (let n = offsets[p / 3]; n < weights.length; n++) weights[n] /= sum;
    offsets[p / 3 + 1] = weights.length;
  }
  return { ids: new Uint32Array(ids), weights: new Float32Array(weights), offsets, rest: points.slice() };
}

export function skinSmoothSurface(binding: SkinBinding, rest: Float32Array, deformed: Float32Array, result: Float32Array) {
  for (let i = 0; i < result.length; i += 3) {
    let x = binding.rest[i], y = binding.rest[i + 1], z = binding.rest[i + 2];
    for (let n = binding.offsets[i / 3]; n < binding.offsets[i / 3 + 1]; n++) {
      const j = binding.ids[n], w = binding.weights[n];
      x += (deformed[j] - rest[j]) * w;
      y += (deformed[j + 1] - rest[j + 1]) * w;
      z += (deformed[j + 2] - rest[j + 2]) * w;
    }
    result[i] = x; result[i + 1] = Math.max(.025, y); result[i + 2] = z;
  }
}
