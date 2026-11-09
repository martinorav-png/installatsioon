// Rest coordinates: x runs from the broad nose to the tail, y is up.
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
const roundedIntersection = (a: number, b: number, radius: number) => Math.hypot(Math.max(a + radius, 0), Math.max(b + radius, 0)) + Math.min(Math.max(a + radius, b + radius), 0) - radius;
const profiles = [
  [-2.55, 0.04, 0.20, 0.68], [-2.40, 0.59, 0.42, 0.67], [-2.12, 0.76, 0.53, 0.67],
  [-1.6, 0.83, 0.64, 0.71], [-0.75, 0.86, 0.77, 0.80], [0, 0.75, 0.73, 0.76],
  [0.85, 0.51, 0.51, 0.58], [1.55, 0.27, 0.29, 0.41], [2.15, 0.13, 0.16, 0.34], [2.65, 0.055, 0.075, 0.35],
];

export function section(x: number): [number, number, number] {
  let i = 0;
  while (i < profiles.length - 2 && x > profiles[i + 1][0]) i++;
  const t = clamp((x - profiles[i][0]) / (profiles[i + 1][0] - profiles[i][0]));
  const result: number[] = [];
  for (let c = 1; c <= 3; c++) {
    const a = profiles[Math.max(0, i - 1)][c], b = profiles[i][c], d = profiles[i + 1][c], e = profiles[Math.min(profiles.length - 1, i + 2)][c];
    result.push(Math.max(0.02, 0.5 * ((2 * b) + (-a + d) * t + (2 * a - 5 * b + 4 * d - e) * t * t + (-a + 3 * b - 3 * d + e) * t * t * t)));
  }
  return result as [number, number, number];
}

function triangle2(x: number, z: number, ax: number, az: number, bx: number, bz: number, cx: number, cz: number) {
  const points = [[ax, az], [bx, bz], [cx, cz]];
  let distance = Infinity, positive = false, negative = false;
  for (let i = 0; i < 3; i++) {
    const a = points[i], b = points[(i + 1) % 3];
    const vx = b[0] - a[0], vz = b[1] - a[1], px = x - a[0], pz = z - a[1];
    const t = clamp((px * vx + pz * vz) / (vx * vx + vz * vz));
    distance = Math.min(distance, Math.hypot(px - t * vx, pz - t * vz));
    const cross = vx * pz - vz * px;
    positive ||= cross > 0; negative ||= cross < 0;
  }
  return (positive && negative ? 1 : -1) * distance;
}

export function whaleSdf(x: number, y: number, z: number, rounded = false): number {
  const [w, h, cy] = section(x);
  const p = mix(2.85, 2.04, smooth(-2.1, -0.6, x));
  let d = (Math.pow(Math.pow(Math.abs(z) / w, p) + Math.pow(Math.abs(y - cy) / h, p), 1 / p) - 1) * Math.min(w, h);
  d = rounded ? Math.max(smax(d, -2.55 - x, .08), x - 2.65) : Math.max(d, -2.55 - x, x - 2.65);
  // Short, pointed pectoral fins, with a firm shoulder and rounded thin edge.
  const fin = triangle2(x, Math.abs(z), -1.02, 0.50, -0.28, 1.35, -0.48, 0.64);
  const finY = 0.24 + 0.11 * (Math.abs(z) - 0.5);
  const finD = rounded ? roundedIntersection(fin - 0.055, Math.abs(y - finY) - (0.075 + 0.045 * (1 - smooth(0.5, 1.4, Math.abs(z)))), .05) : Math.max(fin - 0.025, Math.abs(y - finY) - (0.055 + 0.045 * (1 - smooth(0.5, 1.4, Math.abs(z)))));
  d = smin(d, finD, 0.14);
  // Two broad swept triangular lobes leave a natural central notch.
  const tail = triangle2(x, Math.abs(z), 2.12, 0.025, 2.81, 1.25, 2.86, 0.20);
  const tailY = 0.36 + 0.13 * smooth(0.15, 1.25, Math.abs(z));
  d = rounded ? smin(d, roundedIntersection(tail - 0.07, Math.abs(y - tailY) - 0.10, .075), 0.16) : smin(d, Math.max(tail - 0.035, Math.abs(y - tailY) - 0.065), 0.11);
  // Small, swept dorsal fin, well behind the centre of the body.
  const dorsal = triangle2(x, y, 1.05, 0.86, 1.42, 1.05, 1.53, 0.65);
  d = rounded ? smin(d, roundedIntersection(dorsal - 0.06, Math.abs(z) - 0.075, .05), 0.12) : smin(d, Math.max(dorsal - 0.035, Math.abs(z) - 0.055), 0.10);
  return Math.max(d, 0.035 - y);
}

export function pouchDisplacement(x: number, y: number, z: number): [number, number, number] {
  const longitudinal = smooth(-2.6, -2.1, x) * (1 - smooth(-0.7, 0.0, x));
  const lower = 1 - smooth(0.65, 1.25, y);
  const amount = longitudinal * lower;
  return [-0.045 * amount, -0.35 * amount, z * 0.34 * amount];
}

export type Lattice = { rest: Float32Array; tets: Uint32Array; cellTets: Map<string, number[]>; h: number; };
const corners = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
const five = [[0,1,2,4],[1,2,3,7],[1,4,5,7],[2,4,6,7],[1,2,4,7]];
export function createLattice(h = 0.12): Lattice {
  const vertices: number[] = [], tets: number[] = [];
  const vertexMap = new Map<string, number>(), cellTets = new Map<string, number[]>();
  const vertex = (i: number, j: number, k: number) => {
    const key = `${i},${j},${k}`;
    const found = vertexMap.get(key); if (found !== undefined) return found;
    let x = i * h, y = j * h, z = k * h;
    // Snap the outer hex lattice to the actual implicit surface.
    const d = whaleSdf(x, y, z);
    if (d > 0) {
      const e = 0.002;
      const gx = whaleSdf(x+e,y,z)-whaleSdf(x-e,y,z), gy = whaleSdf(x,y+e,z)-whaleSdf(x,y-e,z), gz = whaleSdf(x,y,z+e)-whaleSdf(x,y,z-e);
      const l = Math.hypot(gx,gy,gz) || 1;
      const amount = Math.min(d, h * 0.68);
      x -= gx/l*amount; y -= gy/l*amount; z -= gz/l*amount;
    }
    const id = vertices.length / 3; vertices.push(x, Math.max(0.035,y), z); vertexMap.set(key,id); return id;
  };
  for (let i = Math.floor(-2.65/h); i < Math.ceil(2.96/h); i++)
    for (let j = 0; j < Math.ceil(1.65/h); j++)
      for (let k = Math.floor(-1.55/h); k < Math.ceil(1.55/h); k++) {
        if (whaleSdf((i+.5)*h,(j+.5)*h,(k+.5)*h) > h*0.12) continue;
        const ids = corners.map(([a,b,c])=>vertex(i+a,j+b,k+c));
        const cell: number[] = [];
        const odd = (i+j+k)&1;
        for (const tet of five) {
          const t = tet.map(n=>ids[odd ? n^7 : n]);
          const [a,b,c,d] = t.map(n=>[vertices[n*3],vertices[n*3+1],vertices[n*3+2]]);
          const ab = b.map((v,n)=>v-a[n]), ac = c.map((v,n)=>v-a[n]), ad = d.map((v,n)=>v-a[n]);
          const vol = (ab[0]*(ac[1]*ad[2]-ac[2]*ad[1])+ab[1]*(ac[2]*ad[0]-ac[0]*ad[2])+ab[2]*(ac[0]*ad[1]-ac[1]*ad[0]))/6;
          if (Math.abs(vol) < h*h*h*0.003) continue;
          if (vol < 0) [t[1],t[2]]=[t[2],t[1]];
          cell.push(tets.length/4); tets.push(...t);
        }
        cellTets.set(`${i},${j},${k}`,cell);
      }
  return { rest: new Float32Array(vertices), tets: new Uint32Array(tets), cellTets, h };
}

// Indexed marching tetrahedra, with gradient-aligned winding and shared vertices.
export function createSurface(step = 0.065) {
  // Round the visible shell while keeping the validated internal lattice.
  const sdf = (x:number,y:number,z:number) => whaleSdf(x,y,z,true);
  const points: number[] = [], indices: number[] = [], cache = new Map<string,number>();
  const six = [[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
  const edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  const nx = Math.ceil(5.7/step)+1, ny = Math.ceil(1.75/step)+1, nz = Math.ceil(3.2/step)+1;
  const field = new Float32Array(nx*ny*nz);
  const idx = (i:number,j:number,k:number)=>(i*ny+j)*nz+k;
  const pos = (i:number,j:number,k:number)=>[-2.7+i*step,-0.025+j*step,-1.6+k*step];
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)for(let k=0;k<nz;k++) field[idx(i,j,k)]=sdf(...pos(i,j,k) as [number,number,number]);
  const add=(p:number[])=>{const key=p.map(v=>Math.round(v*100000)).join(',');const old=cache.get(key);if(old!==undefined)return old;const n=points.length/3;points.push(...p);cache.set(key,n);return n;};
  for(let i=0;i<nx-1;i++)for(let j=0;j<ny-1;j++)for(let k=0;k<nz-1;k++){
    const cube=corners.map(([a,b,c])=>({p:pos(i+a,j+b,k+c),d:field[idx(i+a,j+b,k+c)]}));
    if(cube.every(v=>v.d>0)||cube.every(v=>v.d<=0))continue;
    for(const tet of six){
      const cross:number[][]=[];
      for(const [a,b] of edges){const u=cube[tet[a]],v=cube[tet[b]];if((u.d<=0)===(v.d<=0))continue;const t=u.d/(u.d-v.d);cross.push(u.p.map((n,c)=>mix(n,v.p[c],t)));}
      if(cross.length<3)continue;
      const c=[0,0,0];cross.forEach(p=>p.forEach((v,n)=>c[n]+=v/cross.length));
      const e=.002;
      const n=[sdf(c[0]+e,c[1],c[2])-sdf(c[0]-e,c[1],c[2]),sdf(c[0],c[1]+e,c[2])-sdf(c[0],c[1]-e,c[2]),sdf(c[0],c[1],c[2]+e)-sdf(c[0],c[1],c[2]-e)];
      const l=Math.hypot(...n)||1;n.forEach((v,a)=>n[a]=v/l);
      const u=cross[0].map((v,a)=>v-c[a]),ul=Math.hypot(...u)||1;u.forEach((v,a)=>u[a]=v/ul);
      const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
      const angle=(p:number[])=>Math.atan2(p.reduce((s,q,a)=>s+(q-c[a])*v[a],0),p.reduce((s,q,a)=>s+(q-c[a])*u[a],0));
      cross.sort((a,b)=>angle(a)-angle(b));
      for(let a=1;a<cross.length-1;a++)indices.push(add(cross[0]),add(cross[a]),add(cross[a+1]));
    }
  }
  return {positions:new Float32Array(points),indices:new Uint32Array(indices)};
}
