import * as THREE from "three";
import { createExhibit } from "./exhibit.js";

// Clear sizes from the KUU plan "EKA galerii platvorm", 1:100, 28.03.2025.
// The hall is simplified to a right-angled room of the measured area.
// Street entrance is at x = 0. The masonry / mezzanine end is at x = length.
const HALL = { length: 18.65, width: 8.64, height: 5.2 };
const DECK = 2.72;
const SOFFIT = 2.49;
const SCREEN = 2.14;
const PLAT = { x0: 11.84, x1: 18.65, z0: 2.9, z1: HALL.width };
const STAIR = { x0: 11.84, run: 4.68, z0: 1.6, z1: 2.9, risers: 16 };
const JOG = 1.45;
const SIDE = { x0: 12.85, x1: 14.05 };
const TAMBUR = { x0: -2.6, x1: 0, z0: 3.02, z1: 5.52 };
const EYE = 1.62;
const RADIUS = 0.28;

const RISER = DECK / STAIR.risers;
const TREAD = STAIR.run / (STAIR.risers - 1);

const canvas = document.createElement("canvas");
document.body.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#e4ddd4");
scene.fog = new THREE.Fog("#e4ddd4", 28, 48);
const galleryRoot = new THREE.Group();
scene.add(galleryRoot);
const presence = { open: false };

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 400);
camera.rotation.order = "YXZ";

const player = { x: 4.6, y: EYE, z: 4.2, yaw: -Math.PI / 2, pitch: 0, feet: 0 };

const boxes = [];

function addBox(minx, miny, minz, maxx, maxy, maxz, kind = "gallery") {
  boxes.push({ minx, miny, minz, maxx, maxy, maxz, kind });
}

function makeTexture(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

const plywoodMap = makeTexture(256, 512, (g, w, h) => {
  g.fillStyle = "#e6d2b3";
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 2) {
    const v = 150 + Math.random() * 40;
    g.strokeStyle = `rgba(${v - 30}, ${v - 55}, ${v - 80}, 0.18)`;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + Math.sin(x) * 2, h);
    g.stroke();
  }
  g.strokeStyle = "rgba(90, 60, 30, 0.28)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128, h);
  g.stroke();
});

const concreteMap = makeTexture(256, 256, (g, w, h) => {
  g.fillStyle = "#8e9194";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) {
    const v = 90 + Math.random() * 70;
    g.fillStyle = `rgba(${v},${v},${v + 2},${0.05 + Math.random() * 0.12})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.strokeStyle = "rgba(60,60,62,0.35)";
  g.lineWidth = 2;
  g.strokeRect(1, 1, w - 2, h - 2);
});
concreteMap.repeat.set(6, 3);

const stoneMap = makeTexture(256, 256, (g, w, h) => {
  g.fillStyle = "#e7e2d8";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i++) {
    g.fillStyle = `rgba(150, 145, 135, ${0.08 + Math.random() * 0.2})`;
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 8 + Math.random() * 24, Math.random(), 0, Math.PI * 2);
    g.fill();
  }
});

const wallMat = new THREE.MeshStandardMaterial({ color: "#f6f1e8", roughness: 0.9 });
const concreteMat = new THREE.MeshStandardMaterial({ map: concreteMap, color: "#c9c3ba", roughness: 0.62, metalness: 0.02 });
plywoodMap.repeat.set(2, 3);
const plyMat = new THREE.MeshStandardMaterial({ map: plywoodMap, color: "#f3e0c4", roughness: 0.78 });
const plyEdge = plyMat.clone();
plyEdge.map = plywoodMap.clone();
plyEdge.map.repeat.set(0.4, 1);
const stoneMat = new THREE.MeshStandardMaterial({ map: stoneMap, roughness: 0.95 });
const metalMat = new THREE.MeshStandardMaterial({ color: "#e4e7ea", roughness: 0.42, metalness: 0.45 });
const darkMat = new THREE.MeshStandardMaterial({ color: "#1c1e22", roughness: 0.4, metalness: 0.15 });
const glassMat = new THREE.MeshStandardMaterial({
  color: "#d5e2ea",
  roughness: 0.05,
  metalness: 0.0,
  transparent: true,
  opacity: 0.22,
});
const frameMat = new THREE.MeshStandardMaterial({ color: "#2a2c30", roughness: 0.45, metalness: 0.4 });

function mesh(w, h, d, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  galleryRoot.add(m);
  return m;
}

function buildShell() {
  mesh(HALL.length, 0.16, HALL.width, concreteMat, HALL.length / 2, -0.08, HALL.width / 2, false);
  mesh(HALL.length, 0.12, HALL.width, wallMat, HALL.length / 2, HALL.height + 0.06, HALL.width / 2, false);

  mesh(0.24, HALL.height, HALL.width, wallMat, HALL.length + 0.12, HALL.height / 2, HALL.width / 2);

  const doorZ0 = TAMBUR.z0 + 0.15;
  const doorZ1 = TAMBUR.z1 - 0.15;
  // Street wall, split by the opening into the tambur.
  mesh(0.16, HALL.height, doorZ0, wallMat, -0.08, HALL.height / 2, doorZ0 / 2);
  mesh(0.16, HALL.height, HALL.width - doorZ1, wallMat, -0.08, HALL.height / 2, (doorZ1 + HALL.width) / 2);
  mesh(0.16, HALL.height - 2.2, doorZ1 - doorZ0, wallMat, -0.08, 2.2 + (HALL.height - 2.2) / 2, (doorZ0 + doorZ1) / 2);

  addBox(-0.4, 0, -0.4, HALL.length + 0.4, HALL.height, 0);
  addBox(HALL.length, 0, -0.4, HALL.length + 0.4, HALL.height, HALL.width + 0.4);
  buildRightWall();
  addBox(-0.3, 0, -0.2, 0, HALL.height, doorZ0);
  addBox(-0.3, 0, doorZ1, 0, HALL.height, HALL.width + 0.2);
  addBox(-0.3, 2.2, doorZ0, 0, HALL.height, doorZ1);

  // Tambur, 2.6 m × 2.5 m = 6.5 m².
  mesh(TAMBUR.x1 - TAMBUR.x0, 0.12, TAMBUR.z1 - TAMBUR.z0, concreteMat, (TAMBUR.x0 + TAMBUR.x1) / 2, -0.06, (TAMBUR.z0 + TAMBUR.z1) / 2, false);
  mesh(0.08, 2.6, TAMBUR.z1 - TAMBUR.z0, glassMat, TAMBUR.x0, 1.3, (TAMBUR.z0 + TAMBUR.z1) / 2, false);
  mesh(TAMBUR.x1 - TAMBUR.x0, 2.6, 0.08, glassMat, (TAMBUR.x0 + TAMBUR.x1) / 2, 1.3, TAMBUR.z0, false);
  mesh(TAMBUR.x1 - TAMBUR.x0, 2.6, 0.08, glassMat, (TAMBUR.x0 + TAMBUR.x1) / 2, 1.3, TAMBUR.z1, false);
  mesh(0.06, 2.6, 0.06, frameMat, TAMBUR.x0, 1.3, TAMBUR.z0, false);
  mesh(0.06, 2.6, 0.06, frameMat, TAMBUR.x0, 1.3, TAMBUR.z1, false);
  addBox(TAMBUR.x0 - 0.2, 0, TAMBUR.z0, TAMBUR.x0, 2.6, TAMBUR.z1);
  addBox(TAMBUR.x0, 0, TAMBUR.z0 - 0.2, 0.1, 2.6, TAMBUR.z0);
  addBox(TAMBUR.x0, 0, TAMBUR.z1, 0.1, 2.6, TAMBUR.z1 + 0.2);
  addBox(TAMBUR.x0, 2.6, TAMBUR.z0, 0, 4, TAMBUR.z1);
  mesh(TAMBUR.x1 - TAMBUR.x0, 0.1, TAMBUR.z1 - TAMBUR.z0, wallMat, (TAMBUR.x0 + TAMBUR.x1) / 2, 2.65, (TAMBUR.z0 + TAMBUR.z1) / 2, false);
}

function buildCeiling() {
  const pitch = 0.12;
  const count = Math.floor((HALL.length - 0.4) / pitch);
  const geo = new THREE.BoxGeometry(0.018, 0.1, HALL.width - 0.5);
  const slats = new THREE.InstancedMesh(geo, metalMat, count);
  slats.castShadow = false;
  slats.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(0.3 + i * pitch, HALL.height - 0.16, HALL.width / 2);
    dummy.updateMatrix();
    slats.setMatrixAt(i, dummy.matrix);
  }
  galleryRoot.add(slats);

  for (const z of [2.15, 6.5]) {
    mesh(HALL.length - 0.8, 0.04, 0.08, darkMat, HALL.length / 2, HALL.height - 0.28, z, false);
  }
}

function buildLeftWall() {
  // Straight wall, then in toward the stair, along the flight, then back left at the top.
  const end = STAIR.x0 + STAIR.run;
  const t = 0.16;
  mesh(STAIR.x0, HALL.height, t, wallMat, STAIR.x0 / 2, HALL.height / 2, -t / 2, false);
  mesh(t, HALL.height, JOG, wallMat, STAIR.x0 - t / 2, HALL.height / 2, JOG / 2, false);
  mesh(end - STAIR.x0, HALL.height, t, wallMat, (STAIR.x0 + end) / 2, HALL.height / 2, JOG - t / 2, false);
  mesh(t, HALL.height, JOG, wallMat, end + t / 2, HALL.height / 2, JOG / 2, false);
  mesh(HALL.length - end, HALL.height, t, wallMat, (end + HALL.length) / 2, HALL.height / 2, -t / 2, false);

  addBox(STAIR.x0 - t, 0, 0, STAIR.x0, HALL.height, JOG);
  addBox(STAIR.x0, 0, JOG - t, end, HALL.height, JOG);
  addBox(end, 0, 0, end + t, HALL.height, JOG);
}

function buildRightWall() {
  // Door below, window above, both in the right-hand wall beside the mezzanine.
  const z = HALL.width + 0.08;
  const t = 0.16;
  const doorH = 2.16;
  const win0 = DECK + 0.06;
  const win1 = DECK + SCREEN;
  const ox = (SIDE.x0 + SIDE.x1) / 2;
  const ow = SIDE.x1 - SIDE.x0;

  const solid = (x0, x1, y0, y1) => {
    if (x1 <= x0 || y1 <= y0) return;
    mesh(x1 - x0, y1 - y0, t, wallMat, (x0 + x1) / 2, (y0 + y1) / 2, z, false);
    addBox(x0, y0, HALL.width, x1, y1, HALL.width + 0.28);
  };
  solid(0, SIDE.x0, 0, HALL.height);
  solid(SIDE.x1, HALL.length, 0, HALL.height);
  solid(SIDE.x0, SIDE.x1, doorH, win0);
  solid(SIDE.x0, SIDE.x1, win1, HALL.height);

  mesh(0.06, doorH, 0.06, frameMat, SIDE.x0, doorH / 2, HALL.width);
  mesh(0.06, doorH, 0.06, frameMat, SIDE.x1, doorH / 2, HALL.width);
  mesh(ow, 0.06, 0.06, frameMat, ox, doorH, HALL.width);
  mesh(ow - 0.14, doorH - 0.08, 0.02, glassMat, ox, (doorH - 0.06) / 2, HALL.width, false);
  mesh(0.04, doorH - 0.1, 0.04, frameMat, ox, doorH / 2, HALL.width);

  const winH = win1 - win0;
  const winY = (win0 + win1) / 2;
  mesh(0.06, winH, 0.06, frameMat, SIDE.x0, winY, HALL.width);
  mesh(0.06, winH, 0.06, frameMat, SIDE.x1, winY, HALL.width);
  mesh(ow, 0.06, 0.06, frameMat, ox, win0, HALL.width);
  mesh(ow, 0.06, 0.06, frameMat, ox, win1, HALL.width);
  mesh(ow - 0.14, winH - 0.12, 0.02, glassMat, ox, winY, HALL.width, false);
  addBox(SIDE.x0, win0, HALL.width, SIDE.x1, win1, HALL.width + 0.2);

  const niche = 1.15;
  mesh(ow + 0.2, 0.1, niche, concreteMat, ox, -0.05, HALL.width + niche / 2, false);
  mesh(0.12, HALL.height, niche, wallMat, SIDE.x0 - 0.06, HALL.height / 2, HALL.width + niche / 2, false);
  mesh(0.12, HALL.height, niche, wallMat, SIDE.x1 + 0.06, HALL.height / 2, HALL.width + niche / 2, false);
  mesh(ow + 0.2, HALL.height, 0.12, wallMat, ox, HALL.height / 2, HALL.width + niche, false);
  addBox(SIDE.x0 - 0.2, 0, HALL.width, SIDE.x0, HALL.height, HALL.width + niche + 0.1);
  addBox(SIDE.x1, 0, HALL.width, SIDE.x1 + 0.2, HALL.height, HALL.width + niche + 0.1);
  addBox(SIDE.x0, 0, HALL.width + niche, SIDE.x1, HALL.height, HALL.width + niche + 0.2);
}

function buildPlatform() {
  const w = PLAT.z1 - PLAT.z0;
  const d = PLAT.x1 - PLAT.x0;
  const cx = (PLAT.x0 + PLAT.x1) / 2;
  const cz = (PLAT.z0 + PLAT.z1) / 2;

  const floorW = HALL.width - PLAT.z0 - 0.04;
  mesh(d, 0.045, floorW, plyMat, cx, DECK - 0.022, PLAT.z0 + floorW / 2);

  // Joists. Large ones drop to 2.49 m, the rest to 2.64 m.
  const joistCount = 8;
  for (let i = 0; i < joistCount; i++) {
    const x = PLAT.x0 + ((i + 0.5) * d) / joistCount;
    const deep = i % 2 === 0;
    const bottom = deep ? SOFFIT : 2.64;
    const top = DECK - 0.045;
    mesh(deep ? 0.16 : 0.1, top - bottom, w - 0.08, plyEdge, x, (top + bottom) / 2, cz);
  }

  mesh(0.14, 0.22, w, plyEdge, PLAT.x0 + 0.02, DECK - 0.08, cz);
  mesh(d, 0.22, 0.06, plyEdge, cx, DECK - 0.08, PLAT.z0);

  // Timber screen above the deck, open between studs but solid enough to stop a fall.
  const screenTop = DECK + SCREEN;
  const studs = Math.round(w / 0.92);
  for (let i = 0; i <= studs; i++) {
    const z = PLAT.z0 + (i * w) / studs;
    mesh(0.045, SCREEN, 0.045, plyEdge, PLAT.x0 + 0.02, DECK + SCREEN / 2, z);
  }
  mesh(0.06, 0.09, w, plyEdge, PLAT.x0 + 0.02, DECK + 0.08, cz);
  mesh(0.08, 0.1, w, plyEdge, PLAT.x0 + 0.02, screenTop - 0.05, cz);
  mesh(0.03, 0.03, w, metalMat, PLAT.x0 + 0.05, DECK + 1.05, cz, false);
  addBox(PLAT.x0 - 0.02, DECK, PLAT.z0, PLAT.x0 + 0.08, screenTop, PLAT.z1, "walk");

  // Rails on the open long edges. The stair landing is the gap in the left rail.
  const land0 = STAIR.x0 + STAIR.run - 0.15;
  const land1 = STAIR.x0 + STAIR.run + 0.7;
  mesh(land0 - PLAT.x0, 1.02, 0.04, plyEdge, (PLAT.x0 + land0) / 2, DECK + 0.51, PLAT.z0 + 0.02);
  mesh(PLAT.x1 - land1, 1.02, 0.04, plyEdge, (land1 + PLAT.x1) / 2, DECK + 0.51, PLAT.z0 + 0.02);
  addBox(PLAT.x0, DECK, PLAT.z0 - 0.02, land0, DECK + 1.05, PLAT.z0 + 0.08, "walk");
  addBox(land1, DECK, PLAT.z0 - 0.02, PLAT.x1, DECK + 1.05, PLAT.z0 + 0.08, "walk");

  // Nook on the left of the mezzanine, past the top of the stair.
  const landX0 = STAIR.x0 + STAIR.run;
  const nookD = HALL.length - landX0;
  mesh(nookD, 0.045, PLAT.z0, plyMat, landX0 + nookD / 2, DECK - 0.022, PLAT.z0 / 2);
}

function buildStair() {
  const width = STAIR.z1 - STAIR.z0;
  const cz = (STAIR.z0 + STAIR.z1) / 2;
  for (let i = 0; i < STAIR.risers - 1; i++) {
    const h = (i + 1) * RISER;
    mesh(TREAD, h, width, plyMat, STAIR.x0 + i * TREAD + TREAD / 2, h / 2, cz, false);
  }

  // Wall on the open side of the flight, so the right-hand edge is closed.
  const land0 = STAIR.x0 + STAIR.run - 0.15;
  const run = land0 - STAIR.x0;
  const rise = DECK * (run / STAIR.run);
  const guard = 1.1;
  const t = 0.08;
  const angle = Math.atan2(rise, run);
  const len = Math.hypot(run, rise);
  const wall = mesh(len, guard, t, plyMat, 0, 0, 0, false);
  wall.rotation.z = angle;
  wall.position.set(
    STAIR.x0 + run / 2 - Math.sin(angle) * (guard / 2),
    rise / 2 + Math.cos(angle) * (guard / 2),
    STAIR.z1 + t / 2
  );
  for (let i = 0; i < STAIR.risers - 1; i++) {
    const x0 = STAIR.x0 + i * TREAD;
    const x1 = Math.min(x0 + TREAD, land0);
    if (x1 <= x0) break;
    const step = (i + 1) * RISER;
    if (i < 2) continue;
    addBox(x0 + 0.06, step, STAIR.z1 + 0.02, x1, step + guard, STAIR.z1 + t + 0.06, "walk");
  }
}

function floorAt(x, z, feet = player.feet) {
  const stairEnd = STAIR.x0 + STAIR.run;
  const onStair = x >= STAIR.x0 - 0.08 && x <= stairEnd + 0.15 && z >= STAIR.z0 - 0.2 && z <= STAIR.z1 + 0.08;
  if (onStair) {
    if (x >= stairEnd - 0.02) return DECK;
    const i = Math.max(0, Math.floor((x - STAIR.x0) / TREAD));
    return Math.min(DECK, (i + 1) * RISER);
  }
  // The deck and the top landing only exist if you are already up there.
  // From the floor, the same footprint is the room under the mezzanine.
  const up = feet > 1.6;
  if (up && x >= stairEnd - 0.15 && x <= HALL.length && z >= 0 && z <= PLAT.z0 + 0.04) return DECK;
  if (up && x >= stairEnd - 0.3 && x <= HALL.length && z >= STAIR.z0 - 0.02 && z <= PLAT.z0 + 0.04) return DECK;
  if (up && x >= PLAT.x0 - 0.02 && x <= PLAT.x1 && z >= PLAT.z0 - 0.02 && z <= HALL.width) return DECK;
  return 0;
}

function hits(x, z, feet) {
  const body0 = feet + 0.12;
  const body1 = feet + 1.72;
  for (const b of boxes) {
    if (presence.open && b.kind !== "station" && b.kind !== "walk") continue;
    if (b.maxy < body0 || b.miny > body1) continue;
    const cx = Math.max(b.minx, Math.min(x, b.maxx));
    const cz = Math.max(b.minz, Math.min(z, b.maxz));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < RADIUS * RADIUS) return true;
  }
  return false;
}

function inBounds(x, z) {
  const inHall = x >= RADIUS && x <= HALL.length - RADIUS && z >= RADIUS && z <= HALL.width - RADIUS;
  if (presence.open) return inHall;
  const inTambur = x >= TAMBUR.x0 + RADIUS && x <= 0.05 && z >= TAMBUR.z0 + RADIUS && z <= TAMBUR.z1 - RADIUS;
  const inNiche = x >= SIDE.x0 + RADIUS && x <= SIDE.x1 - RADIUS && z >= HALL.width - 1.2 && z <= HALL.width + 0.85;
  return inHall || inTambur || inNiche;
}

const keys = new Set();
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.code));

const enter = document.getElementById("enter");
const cross = document.getElementById("cross");
enter.addEventListener("click", () => canvas.requestPointerLock());
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  enter.classList.toggle("hidden", locked);
  cross.classList.toggle("hidden", !locked);
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight("#fff1df", "#c2ae9a", 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffd7b0", 0.85);
sun.position.set(2, 12, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -16;
sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16;
sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0004;
scene.add(sun);
const ambient = new THREE.AmbientLight("#ffe6cf", 0.22);
scene.add(ambient);

// Warm track spots: a pool on the left wall, the stair, and the plywood under the deck.
const spots = [];
function spot(x, z, tx, tz, ty, intensity, angle) {
  const s = new THREE.SpotLight("#ffc98a", intensity, 20, angle, 0.72, 1.2);
  s.position.set(x, HALL.height - 0.4, z);
  s.target.position.set(tx, ty, tz);
  s.castShadow = false;
  scene.add(s, s.target);
  spots.push(s);
}
spot(5.2, 1.6, 3.2, 0.3, 2.4, 10, 0.42);
spot(12.6, 2.0, 14.6, 2.15, 1.3, 7, 0.38);
spot(9.2, 5.4, 12.1, 6.2, 1.5, 9, 0.5);
spot(15.4, 6.2, 16.4, 6.8, 3.4, 5, 0.46);
spot(7.5, 7.4, 13.2, 8.2, 2.2, 4.5, 0.4);

buildShell();
buildCeiling();
buildLeftWall();
buildPlatform();
buildStair();

const exhibit = createExhibit({
  scene, renderer, player, keys, hemi, sun, ambient, spots, wallMat, addBox, HALL, galleryRoot, presence, camera,
});

const clock = new THREE.Clock();
const look = new THREE.Vector3();
const right = new THREE.Vector3();

function step(dt) {
  const lookSpeed = 1.5 * dt;
  if (keys.has("ArrowLeft")) player.yaw += lookSpeed;
  if (keys.has("ArrowRight")) player.yaw -= lookSpeed;
  if (keys.has("ArrowUp")) player.pitch += lookSpeed;
  if (keys.has("ArrowDown")) player.pitch -= lookSpeed;
  player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));

  look.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  right.set(-look.z, 0, look.x);
  let mx = 0;
  let mz = 0;
  if (keys.has("KeyW")) { mx += look.x; mz += look.z; }
  if (keys.has("KeyS")) { mx -= look.x; mz -= look.z; }
  if (keys.has("KeyD")) { mx += right.x; mz += right.z; }
  if (keys.has("KeyA")) { mx -= right.x; mz -= right.z; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 3.3 : 1.65) * dt;
    mx = (mx / len) * speed;
    mz = (mz / len) * speed;
    const parts = 3;
    for (let i = 0; i < parts; i++) tryStep(mx / parts, mz / parts);
  }
  player.y = player.feet + EYE;
  camera.position.set(player.x, player.y, player.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function tryStep(dx, dz) {
  const feet = player.feet;
  const nx = player.x + dx;
  const nz = player.z + dz;
  if (!inBounds(nx, nz)) return;
  const nf = floorAt(nx, nz, feet);
  const blocked = nf > feet + 0.34 || hits(nx, nz, Math.max(feet, nf));
  if (!blocked) {
    player.x = nx;
    player.z = nz;
    player.feet = nf;
    return;
  }
  const fx = floorAt(nx, player.z, feet);
  const fz = floorAt(player.x, nz, feet);
  if (fx <= feet + 0.34 && !hits(nx, player.z, Math.max(feet, fx)) && inBounds(nx, player.z)) {
    player.x = nx;
    player.feet = fx;
  } else if (fz <= feet + 0.34 && !hits(player.x, nz, Math.max(feet, fz)) && inBounds(player.x, nz)) {
    player.z = nz;
    player.feet = fz;
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  step(dt);
  exhibit.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

window.__gallery = { player, floorAt, hits, inBounds, tryStep, HALL, PLAT, STAIR, DECK, camera, scene, use: exhibit.use };
