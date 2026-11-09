export function createNormalSmoother(indices: Uint32Array, vertexCount: number) {
  const counts = new Uint32Array(vertexCount);
  for (const i of indices) counts[i] += 2;
  const offsets = new Uint32Array(vertexCount + 1);
  for (let i = 0; i < vertexCount; i++) offsets[i + 1] = offsets[i] + counts[i];
  const neighbours = new Uint32Array(offsets[vertexCount]);
  const cursor = offsets.slice(0, vertexCount);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    neighbours[cursor[a]++] = b;neighbours[cursor[a]++] = c;
    neighbours[cursor[b]++] = a;neighbours[cursor[b]++] = c;
    neighbours[cursor[c]++] = a;neighbours[cursor[c]++] = b;
  }
  const result = new Float32Array(vertexCount * 3);
  return (normals: Float32Array) => {
    for (let i = 0; i < vertexCount; i++) {
      const o = i * 3, count = counts[i];
      let x = normals[o], y = normals[o + 1], z = normals[o + 2];
      if (count) {
        x *= .6;y *= .6;z *= .6;
        const weight = .4 / count;
        for (let j = offsets[i]; j < offsets[i + 1]; j++) {
          const n = neighbours[j] * 3;
          x += normals[n] * weight;y += normals[n + 1] * weight;z += normals[n + 2] * weight;
        }
      }
      const length = Math.hypot(x, y, z) || 1;
      result[o] = x / length;result[o + 1] = y / length;result[o + 2] = z / length;
    }
    normals.set(result);
  };
}
