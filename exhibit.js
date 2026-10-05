import * as THREE from "three";
import { MTLLoader } from "./vendor/MTLLoader.js";
import { OBJLoader } from "./vendor/OBJLoader.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";

// Nature models are Kenney's Nature Kit, CC0.
// https://kenney.nl/assets/nature-kit
const MODEL_BASE = "./assets/nature/Models/OBJ%20format/";
// Night city blocks are Kenney's Retro Urban Kit, CC0.
// https://kenney.nl/assets/retro-urban-kit
const CITY_BASE = "./assets/city/Models/GLB%20format/";

const STATIONS = [
  { id: "forest", name: "LIFE", x: 3.15, z: 2.25, color: "#7dff9a" },
  { id: "sea", name: "LONELINESS", x: 3.15, z: 6.45, color: "#7ee7ff" },
  { id: "city", name: "INDUSTRY", x: 7.55, z: 2.25, color: "#ffb15a" },
  { id: "snow", name: "STILLNESS", x: 7.55, z: 6.45, color: "#f4f8ff" },
];

const LOOKS = {
  gallery: {
    bg: "#e4ddd4",
    fog: "#e4ddd4",
    fogNear: 28,
    fogFar: 48,
    hemiSky: "#fff1df",
    hemiGround: "#c2ae9a",
    hemi: 0.55,
    sun: "#ffd7b0",
    sunI: 0.85,
    ambient: 0.22,
    exposure: 1.02,
    wall: "#f6f1e8",
    spots: 1,
  },
  forest: {
    bg: "#8aa86a",
    fog: "#6d8c55",
    fogNear: 28,
    fogFar: 220,
    hemiSky: "#d5eead",
    hemiGround: "#3a4a28",
    hemi: 0.85,
    sun: "#ffe3a4",
    sunI: 1.35,
    ambient: 0.32,
    exposure: 1.05,
    wall: "#e4ecda",
    spots: 0.35,
    sky: "day",
  },
  sea: {
    bg: "#9ec8d6",
    fog: "#6ea4b8",
    fogNear: 32,
    fogFar: 240,
    hemiSky: "#ffe8cc",
    hemiGround: "#143848",
    hemi: 0.55,
    sun: "#fff1d2",
    sunI: 1.75,
    ambient: 0.26,
    exposure: 1.08,
    wall: "#e4eef2",
    spots: 0.4,
    sky: "morning",
  },
  city: {
    bg: "#070b12",
    fog: "#0b1018",
    fogNear: 20,
    fogFar: 170,
    hemiSky: "#000000",
    hemiGround: "#000000",
    hemi: 0,
    sun: "#000000",
    sunI: 0,
    ambient: 0,
    exposure: 1.05,
    wall: "#141820",
    spots: 0,
    sky: "night",
  },
  snow: {
    bg: "#eef3f8",
    fog: "#e4edf5",
    fogNear: 24,
    fogFar: 240,
    hemiSky: "#ffffff",
    hemiGround: "#c5d2e0",
    hemi: 1.05,
    sun: "#f7fbff",
    sunI: 1.45,
    ambient: 0.62,
    exposure: 1.18,
    wall: "#f7f8fa",
    spots: 0.45,
    sky: "day",
  },
};

export function createExhibit(ctx) {
  const { scene, renderer, player, keys, hemi, sun, ambient, spots, wallMat } = ctx;
  renderer.localClippingEnabled = true;

  const formPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1);
  const wirePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1);
  const wireMat = new THREE.MeshBasicMaterial({
    color: "#8af4ff",
    wireframe: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    clippingPlanes: [wirePlane],
  });

  const worlds = {};
  for (const id of ["forest", "sea", "city", "snow"]) {
    const g = new THREE.Group();
    g.visible = false;
    g.name = id;
    scene.add(g);
    worlds[id] = g;
  }

  const scanSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshBasicMaterial({
      color: "#b9fbff",
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  scanSheet.rotation.x = -Math.PI / 2;
  scanSheet.visible = false;
  scene.add(scanSheet);

  const stationMeshes = STATIONS.map((s) => {
    ctx.addBox(s.x - 0.4, 0, s.z - 0.4, s.x + 0.4, 1.12, s.z + 0.4, "station");
    return buildStation(s, scene);
  });

  buildCity(worlds.city, formPlane, ctx.HALL);
  buildSea(worlds.sea, formPlane);
  buildGround(worlds.forest, "#ffffff", 0.94, formPlane, 300, grassTexture(renderer));
  buildGround(worlds.snow, "#f4f7fb", 0.98, formPlane, 320);
  const snow = buildSnow(worlds.snow, formPlane);
  buildMountains(worlds.snow, formPlane);
  loadNature(worlds, formPlane, wireMat, ctx.HALL);
  const border = buildGalleryBorder(ctx.galleryRoot, formPlane, scene);

  let active = null;
  let queued = undefined;
  let phase = "idle";
  let scan = -1;
  let eWas = false;
  const clock = { t: 0 };
  const prompt = document.getElementById("prompt");
  const baseWall = wallMat.color.clone();
  const baseSpots = spots.map((s) => s.intensity);
  const gallery = LOOKS.gallery;
  const skies = {};
  const skyLoader = new THREE.TextureLoader();
  for (const name of ["day", "morning", "night"]) {
    skyLoader.load(`./assets/skyboxes/Skyboxes/skybox-${name}.png`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      skies[name] = tex;
    });
  }

  function setScan(y) {
    scan = y;
    formPlane.constant = y;
    wirePlane.constant = -y;
    scanSheet.position.set(ctx.HALL.length / 2, Math.max(y, 0.05), ctx.HALL.width / 2);
    if (worlds.sea.userData.water) worlds.sea.userData.water.uniforms.uScan.value = y;
    if (snow.material.uniforms) snow.material.uniforms.uScan.value = y;
    const moving = phase === "in" || phase === "out";
    scanSheet.visible = moving && y > -0.2 && y < ctx.HALL.height + 1;
  }

  function startIn(id) {
    active = id;
    queued = undefined;
    phase = "in";
    worlds[id].visible = true;
    setScan(-0.15);
  }

  function startOut() {
    phase = "out";
  }

  function use(id) {
    if (id && id === active && phase !== "out") {
      queued = null;
      startOut();
      return;
    }
    if (id == null) {
      queued = null;
      if (active) startOut();
      return;
    }
    queued = id;
    if (active) startOut();
    else startIn(id);
  }

  function nearest() {
    let best = null;
    let bestD = 1.7;
    for (const s of STATIONS) {
      const d = Math.hypot(player.x - s.x, player.z - s.z);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  function applyLook(look, blend) {
    const fog = new THREE.Color(gallery.fog).lerp(new THREE.Color(look.fog), blend);
    const sky = look.sky && skies[look.sky];
    if (sky && blend > 0.4) {
      scene.background = sky;
    } else {
      if (!scene.background || !scene.background.isColor) scene.background = new THREE.Color();
      scene.background.copy(new THREE.Color(gallery.bg).lerp(new THREE.Color(look.bg), blend));
    }
    scene.fog.color.copy(fog);
    scene.fog.near = THREE.MathUtils.lerp(gallery.fogNear, look.fogNear, blend);
    scene.fog.far = THREE.MathUtils.lerp(gallery.fogFar, look.fogFar, blend);
    hemi.color.copy(new THREE.Color(gallery.hemiSky).lerp(new THREE.Color(look.hemiSky), blend));
    hemi.groundColor.copy(new THREE.Color(gallery.hemiGround).lerp(new THREE.Color(look.hemiGround), blend));
    hemi.intensity = THREE.MathUtils.lerp(gallery.hemi, look.hemi, blend);
    sun.color.copy(new THREE.Color(gallery.sun).lerp(new THREE.Color(look.sun), blend));
    sun.intensity = THREE.MathUtils.lerp(gallery.sunI, look.sunI, blend);
    ambient.intensity = THREE.MathUtils.lerp(gallery.ambient, look.ambient, blend);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(gallery.exposure, look.exposure, blend);
    wallMat.color.copy(baseWall).lerp(new THREE.Color(look.wall), blend);
    if (ctx.galleryRoot) ctx.galleryRoot.visible = blend < 0.16;
    ctx.presence.open = blend > 0.16;
    if (border) {
      border.group.visible = blend > 0.08;
      border.mat.opacity = THREE.MathUtils.clamp((blend - 0.08) / 0.35, 0, 0.9);
    }
    const spotK = THREE.MathUtils.lerp(gallery.spots, look.spots, blend);
    spots.forEach((s, i) => {
      s.intensity = baseSpots[i] * spotK;
    });
  }

  function update(dt) {
    clock.t += dt;
    if (phase === "in") {
      const speed = scan < ctx.HALL.height + 1.2 ? 4.4 : 90;
      setScan(scan + dt * speed);
      if (scan >= 180) {
        setScan(180);
        phase = "idle";
      }
    } else if (phase === "out") {
      const speed = scan > ctx.HALL.height + 1.4 ? 90 : 5.2;
      setScan(scan - dt * speed);
      if (scan <= -0.4) {
        if (active) worlds[active].visible = false;
        active = null;
        phase = "idle";
        setScan(-1);
        if (queued) startIn(queued);
      }
    }

    const look = active ? LOOKS[active] : gallery;
    const blend = active ? THREE.MathUtils.clamp(scan / ctx.HALL.height, 0, 1) : 0;
    applyLook(look, blend);

    const water = worlds.sea.userData.water;
    if (water) {
      water.uniforms.uTime.value = clock.t;
      if (ctx.camera) water.uniforms.uCam.value.copy(ctx.camera.position);
    }
    stepSnow(snow, dt);

    for (const station of stationMeshes) {
      const on = station.id === active;
      const pulse = 0.65 + Math.sin(clock.t * 3 + station.phase) * 0.2;
      station.ring.material.emissiveIntensity = on ? 1.6 : pulse;
      station.ring.material.opacity = on ? 1 : 0.85;
    }

    const down = keys.has("KeyE");
    if (down && !eWas) {
      const hit = nearest();
      if (hit) use(hit.id);
    }
    eWas = down;

    const hit = nearest();
    if (prompt) {
      if (hit) {
        const back = hit.id === active && phase !== "out";
        prompt.textContent = back ? "E   RETURN TO THE GALLERY" : `E   ${hit.name}`;
        prompt.classList.remove("hidden");
      } else {
        prompt.classList.add("hidden");
      }
    }
  }

  return { update, use, worlds };
}

function buildGalleryBorder(root, formPlane, scene) {
  if (!root) return null;
  const group = new THREE.Group();
  group.name = "galleryBorder";
  group.visible = false;
  const mat = new THREE.LineBasicMaterial({
    color: "#9af6ff",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    clippingPlanes: [formPlane],
  });
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || !obj.geometry) return;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(obj.geometry, 15), mat);
    lines.applyMatrix4(obj.matrixWorld);
    lines.frustumCulled = false;
    group.add(lines);
  });
  scene.add(group);
  return { group, mat };
}

function buildStation(spec, scene) {
  const group = new THREE.Group();
  group.position.set(spec.x, 0, spec.z);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 1.02, 20),
    new THREE.MeshStandardMaterial({ color: "#2c3036", roughness: 0.45, metalness: 0.55 })
  );
  base.position.y = 0.51;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20),
    new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.color,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.1,
    })
  );
  ring.position.y = 1.06;
  const label = labelSprite(spec.name, spec.color);
  label.position.y = 1.42;
  group.add(base, ring, label);
  scene.add(group);
  return { id: spec.id, ring, phase: Math.random() * 6 };
}

function labelSprite(text, color) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(8,10,14,0.72)";
  roundRect(g, 16, 24, 480, 80, 16);
  g.fill();
  g.font = "600 44px Segoe UI, sans-serif";
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(Math.max(1.15, text.length * 0.125), 0.29, 1);
  return sprite;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function grassTexture(renderer) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#3a5c2c";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = Math.random() < 0.55 ? "rgba(28,52,20,0.4)" : "rgba(126,168,72,0.28)";
    g.beginPath();
    g.ellipse(
      Math.random() * size,
      Math.random() * size,
      16 + Math.random() * 46,
      10 + Math.random() * 30,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    g.fill();
  }
  const blades = ["#234818", "#315c24", "#4a7a34", "#629445", "#86b85a"];
  g.lineCap = "round";
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const h = 7 + Math.random() * 24;
    const lean = (Math.random() - 0.5) * 12;
    g.strokeStyle = blades[(Math.random() * blades.length) | 0];
    g.lineWidth = 0.7 + Math.random() * 1.5;
    const draw = (ox, oy) => {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + lean * 0.4, y + oy - h * 0.55, x + ox + lean, y + oy - h);
      g.stroke();
    };
    draw(0, 0);
    if (x < 28) draw(size, 0);
    if (x > size - 28) draw(-size, 0);
    if (y < 32) draw(0, size);
    if (y > size - 32) draw(0, -size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(96, 96);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function buildGround(group, color, roughness, formPlane, span = 220, map = null) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    map,
    roughness,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    clippingPlanes: [formPlane],
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(span, span), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(9, 0.02, 4);
  mesh.receiveShadow = true;
  group.add(mesh);
}

const CITY_PARTS = [
  "wall-a-window",
  "wall-b-window",
  "detail-light-single",
];

function buildCity(group, formPlane, hall) {
  const loader = new GLTFLoader();
  const templates = {};
  let left = CITY_PARTS.length;
  for (const name of CITY_PARTS) {
    loader.load(CITY_BASE + name + ".glb", (gltf) => {
      templates[name] = gltf.scene;
      if (--left === 0) placeCity(group, templates, formPlane, hall);
    }, undefined, (err) => {
      console.warn(name, err);
      if (--left === 0) placeCity(group, templates, formPlane, hall);
    });
  }
}

function nightMat(source, formPlane) {
  const map = source && source.map ? source.map : null;
  if (map) {
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
  }
  return new THREE.MeshLambertMaterial({
    map,
    color: "#ffffff",
    clippingPlanes: [formPlane],
  });
}

function kitParts(root, formPlane) {
  const parts = [];
  if (!root) return parts;
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const geo = obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    parts.push({ geo, material: nightMat(materials[0], formPlane) });
  });
  return parts;
}

function tileUVs(geo, tilesX, tilesY) {
  const uv = geo.getAttribute("uv");
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * tilesX, uv.getY(i) * tilesY);
}

function placeCity(group, templates, formPlane, hall) {
  const faces = {
    "wall-a-window": kitParts(templates["wall-a-window"], formPlane),
    "wall-b-window": kitParts(templates["wall-b-window"], formPlane),
  };

  function addTower(piece, x, z, w, h, d) {
    const parts = faces[piece];
    if (!parts || parts.length === 0) return;
    const tower = new THREE.Group();
    const tilesX = Math.max(2, Math.round(w / 5));
    const tilesY = Math.max(2, Math.round(h / 5));
    for (const part of parts) {
      const geo = part.geo.clone();
      tileUVs(geo, tilesX, tilesY);
      tower.add(new THREE.Mesh(geo, part.material));
    }
    tower.scale.set(w, h, d);
    tower.position.set(x, 0, z);
    group.add(tower);
  }

  const sizes = [
    [22, 48, 16],
    [18, 72, 14],
    [26, 40, 18],
    [16, 86, 14],
    [24, 58, 16],
    [20, 64, 15],
    [28, 46, 18],
  ];
  let cursor = -36;
  for (let i = 0; i < sizes.length; i++) {
    const [w, h, d] = sizes[i];
    const piece = i % 2 ? "wall-b-window" : "wall-a-window";
    addTower(piece, cursor + w / 2, -0.7 - d / 2, w, h, d);
    const [w2, h2, d2] = sizes[(i + 3) % sizes.length];
    addTower(piece, cursor + w2 / 2 + 3, hall.width + 0.7 + d2 / 2, w2, h2, d2);
    if (i % 2 === 0) {
      addTower(piece, cursor + 6, -0.7 - d - 22, 18, h + 28, 16);
      addTower(piece, cursor + 4, hall.width + 0.7 + d2 + 24, 16, h2 + 24, 16);
    }
    cursor += Math.max(w, w2) + 7;
  }

  const lamp = templates["detail-light-single"];
  if (lamp) {
    lamp.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      const map = materials[0] && materials[0].map ? materials[0].map : null;
      if (map) {
        map.magFilter = THREE.NearestFilter;
        map.minFilter = THREE.NearestFilter;
        map.generateMipmaps = false;
      }
      obj.material = new THREE.MeshBasicMaterial({
        map,
        color: "#ffc56a",
        clippingPlanes: [formPlane],
      });
    });
    for (const x of [-6, 3, 11, 20, 34]) {
      for (const z of [0.35, hall.width - 0.35]) {
        const towardStreet = z < hall.width / 2 ? 1 : -1;
        const pole = lamp.clone(true);
        pole.scale.setScalar(5.5);
        pole.position.set(x, 0, z);
        if (towardStreet > 0) pole.rotation.y = Math.PI;
        const bulb = new THREE.PointLight("#ffb03a", 160, 28, 2);
        bulb.position.set(x, 4.8, z + towardStreet * 1.15);
        group.add(pole, bulb);
      }
    }
  }

  const lot = lotTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 360),
    new THREE.MeshLambertMaterial({
      map: lot,
      color: "#ffffff",
      clippingPlanes: [formPlane],
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(hall.length / 2, 0, hall.width / 2);
  ground.receiveShadow = true;
  group.add(ground);

  const road = streetTexture();
  const span = 210;
  const roadMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(span, hall.width - 0.3),
    new THREE.MeshLambertMaterial({
      map: road,
      color: "#ffffff",
      clippingPlanes: [formPlane],
    })
  );
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(hall.length / 2, 0.04, hall.width / 2);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
}

function lotTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#2c3038";
  g.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 48; i++) {
    g.fillStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.28})`;
    g.fillRect((Math.random() * 32) | 0, (Math.random() * 32) | 0, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(76, 60);
  return tex;
}

function streetTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#4a4e58";
  g.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
    g.fillRect((Math.random() * 32) | 0, (Math.random() * 32) | 0, 1, 1);
  }
  g.fillStyle = "#d2ae3a";
  g.fillRect(4, 14, 8, 4);
  g.fillRect(20, 14, 8, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(34, 1);
  return tex;
}

function buildSea(group, formPlane) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uScan: { value: -1 },
      uCam: { value: new THREE.Vector3(4, 2, 4) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vH;
      float hAt(vec2 p) {
        float h = 0.0;
        h += sin(dot(p, vec2(0.11, 0.035)) + uTime * 0.75) * 0.42;
        h += sin(dot(p, vec2(-0.05, 0.15)) + uTime * 1.05) * 0.24;
        h += sin(dot(p, vec2(0.24, -0.13)) + uTime * 1.55) * 0.1;
        return h;
      }
      void main() {
        vec3 p = position;
        float h = hAt(p.xy);
        p.z = h;
        float e = 0.45;
        float hx = hAt(p.xy + vec2(e, 0.0)) - hAt(p.xy - vec2(e, 0.0));
        float hy = hAt(p.xy + vec2(0.0, e)) - hAt(p.xy - vec2(0.0, e));
        vec3 n = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * n);
        vH = h;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uScan;
      uniform vec3 uCam;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vH;
      void main() {
        if (vWorld.y > uScan) discard;
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(uCam - vWorld);
        float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
        vec3 deep = vec3(0.012, 0.08, 0.13);
        vec3 shallow = vec3(0.07, 0.36, 0.4);
        vec3 col = mix(deep, shallow, clamp(vH * 1.4 + 0.4, 0.0, 1.0));
        vec3 sun = normalize(vec3(-0.4, 0.84, 0.22));
        float spec = pow(max(dot(reflect(-sun, n), viewDir), 0.0), 50.0);
        float foam = smoothstep(0.32, 0.52, vH);
        col = mix(col, vec3(0.78, 0.9, 0.88), foam * 0.7);
        col += vec3(1.0, 0.96, 0.88) * spec * 0.9;
        col = mix(col, vec3(0.58, 0.82, 0.84), fres * 0.55);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 240, 96, 96), mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(9, 0.28, 4);
  group.add(water);
  group.userData.water = mat;
}

function buildMountains(group, formPlane) {
  const snow = new THREE.MeshStandardMaterial({
    color: "#e8eef4",
    roughness: 0.94,
    flatShading: true,
    clippingPlanes: [formPlane],
  });
  const rock = new THREE.MeshStandardMaterial({
    color: "#8e98a4",
    roughness: 0.96,
    flatShading: true,
    clippingPlanes: [formPlane],
  });
  const peaks = [
    [-48, -36, 32, 58, snow],
    [-16, -52, 28, 46, rock],
    [14, -58, 38, 72, snow],
    [52, -30, 26, 44, snow],
    [68, 10, 30, 56, rock],
    [42, 46, 28, 50, snow],
    [4, 58, 36, 68, snow],
    [-36, 34, 24, 40, snow],
  ];
  for (const [x, z, radius, height, mat] of peaks) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), mat);
    peak.position.set(x, height / 2, z);
    peak.rotation.y = x * 0.17;
    peak.scale.x = 1.2;
    group.add(peak);
    const shoulder = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.55, height * 0.62, 6), mat);
    shoulder.position.set(x + radius * 0.35, height * 0.31, z + radius * 0.22);
    group.add(shoulder);
  }
}

function buildSnow(group, formPlane) {
  const count = 1600;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -40 + Math.random() * 100;
    positions[i * 3 + 1] = Math.random() * 12;
    positions[i * 3 + 2] = -40 + Math.random() * 90;
    speeds[i] = 0.35 + Math.random() * 0.7;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScan: { value: -1 } },
    vertexShader: `
      uniform float uScan;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_PointSize = wp.y > uScan ? 0.0 : 28.0 / gl_Position.w;
      }
    `,
    fragmentShader: `
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        if (dot(p, p) > 1.0) discard;
        gl_FragColor = vec4(0.95, 0.97, 1.0, 0.85);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.speeds = speeds;
  points.frustumCulled = false;
  group.add(points);
  return points;
}

function stepSnow(points, dt) {
  const pos = points.geometry.attributes.position;
  const speeds = points.userData.speeds;
  for (let i = 0; i < speeds.length; i++) {
    let y = pos.getY(i) - speeds[i] * dt;
    if (y < 0) y = 12;
    pos.setY(i, y);
    let x = pos.getX(i) + Math.sin(y * 2 + i) * dt * 0.05;
    pos.setX(i, x);
  }
  pos.needsUpdate = true;
}

function addWire(mesh, wireMat) {
  const wire = new THREE.Mesh(mesh.geometry, wireMat);
  wire.userData.wire = true;
  wire.castShadow = false;
  wire.receiveShadow = false;
  mesh.add(wire);
}

const GRASS_MODELS = ["grass", "grass_large", "grass_leafs", "grass_leafsLarge"];

function loadNature(worlds, formPlane, wireMat, hall) {
  const names = ["tree_tall", "tree_pineTallA", "tree_pineRoundA", "rock_largeA", "rock_smallA", "plant_bushLarge", ...GRASS_MODELS];
  const templates = {};
  let left = names.length;
  for (const name of names) {
    loadObj(name).then((root) => {
      templates[name] = root;
      if (--left === 0) placeNature(worlds, templates, formPlane, wireMat, hall);
    }).catch((err) => {
      console.warn(name, err);
      if (--left === 0) placeNature(worlds, templates, formPlane, wireMat, hall);
    });
  }
}

function loadObj(name) {
  const mtlLoader = new MTLLoader();
  return new Promise((resolve, reject) => {
    mtlLoader.load(MODEL_BASE + name + ".mtl", (mtl) => {
      mtl.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(mtl);
      objLoader.load(MODEL_BASE + name + ".obj", resolve, undefined, reject);
    }, undefined, reject);
  });
}

function placeNature(worlds, templates, formPlane, wireMat, hall) {
  const forest = [
    ["tree_tall", 1.35, 1.05, 4.4, 0.4],
    ["tree_pineTallA", 1.7, 4.6, 5.2, 1.1],
    ["tree_pineRoundA", 1.45, 7.15, 4.2, 2.0],
    ["tree_tall", 5.5, 1.05, 4.0, 0.6],
    ["tree_pineRoundA", 8.7, 1.2, 4.8, 1.4],
    ["tree_pineTallA", 10.0, 3.3, 5.0, 0.2],
    ["tree_tall", 9.7, 6.9, 4.3, 2.4],
    ["plant_bushLarge", 5.8, 7.3, 1.3, 0.5],
    ["plant_bushLarge", 8.4, 4.6, 1.15, 1.2],
    ["tree_pineRoundA", 10.6, 5.4, 3.4, 0.8],
  ];
  const snow = [
    ["tree_pineTallA", 1.4, 1.2, 4.8, 0.3],
    ["tree_pineRoundA", 1.8, 4.4, 4.2, 1.5],
    ["tree_pineTallA", 5.2, 1.15, 5.1, 0.7],
    ["tree_pineRoundA", 8.6, 1.25, 4.4, 2.1],
    ["tree_pineTallA", 10.1, 4.0, 5.3, 0.4],
    ["tree_pineRoundA", 9.5, 7.0, 4.0, 1.2],
    ["tree_pineTallA", 4.8, 7.2, 4.6, 0.9],
  ];
  const rocks = [
    ["rock_largeA", 6.4, 4.4, 0.85, 0.4],
    ["rock_largeA", 2.1, 4.7, 0.65, 1.2],
    ["rock_smallA", 8.9, 6.3, 0.42, 0.2],
    ["rock_smallA", 5.1, 2.0, 0.38, 1.6],
    ["plant_bushLarge", 9.4, 5.2, 0.9, 0.5],
  ];
  for (const spot of forest) putModel(worlds.forest, templates, spot, formPlane, wireMat, false);
  for (const spot of snow) putModel(worlds.snow, templates, spot, formPlane, wireMat, true);
  for (const spot of rocks) putModel(worlds.sea, templates, spot, formPlane, wireMat, false);
  const broadleaf = ["tree_tall", "tree_pineTallA", "tree_pineRoundA", "plant_bushLarge"];
  const pines = ["tree_pineTallA", "tree_pineRoundA", "tree_pineTallA"];
  fillGrove(worlds.forest, templates, broadleaf, 56, 4.4, false, formPlane, wireMat, hall);
  fillGrove(worlds.snow, templates, pines, 48, 4.8, true, formPlane, wireMat, hall);
  scatterOutside(worlds.forest, templates, ["tree_tall", "tree_pineTallA", "tree_pineRoundA"], 5.2, false, formPlane, wireMat, hall, 3);
  scatterOutside(worlds.snow, templates, ["tree_pineTallA", "tree_pineRoundA"], 5.4, true, formPlane, wireMat, hall, 3);
  scatterOutside(worlds.sea, templates, ["rock_largeA", "rock_smallA"], 0.9, false, formPlane, wireMat, hall, 1);
  plantGrass(worlds.forest, templates, formPlane, hall);
}

function plantGrass(group, templates, formPlane, hall) {
  const names = GRASS_MODELS.filter((name) => templates[name]);
  if (!names.length) return;
  const spots = [];
  const addField = (x0, x1, z0, z1, step, outerOnly) => {
    for (let x = x0; x < x1; x += step) {
      for (let z = z0; z < z1; z += step) {
        const px = x + (Math.random() - 0.5) * step;
        const pz = z + (Math.random() - 0.5) * step;
        if (outerOnly && px > -2 && px < hall.length + 2 && pz > -2 && pz < hall.width + 2) continue;
        let buried = false;
        for (const s of STATIONS) {
          if (Math.hypot(px - s.x, pz - s.z) < 0.85) buried = true;
        }
        if (buried) continue;
        spots.push(px, pz);
      }
    }
  };
  addField(-1.2, hall.length + 1.2, -1.2, hall.width + 1.2, 0.38, false);
  addField(-22, hall.length + 26, -16, hall.width + 20, 1.15, true);

  const buckets = names.map(() => []);
  const count = spots.length / 2;
  for (let i = 0; i < count; i++) buckets[i % names.length].push(spots[i * 2], spots[i * 2 + 1]);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const greens = [0x2c4e22, 0x3a682c, 0x4c8238, 0x5c9442, 0x6eaa52];
  for (let n = 0; n < names.length; n++) {
    const src = templates[names[n]];
    const geos = [];
    src.updateMatrixWorld(true);
    src.traverse((obj) => {
      if (!obj.isMesh) return;
      const geo = obj.geometry.clone();
      geo.applyMatrix4(obj.matrixWorld);
      geo.computeBoundingBox();
      geos.push(geo);
    });
    if (!geos.length) continue;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const geo of geos) {
      minY = Math.min(minY, geo.boundingBox.min.y);
      maxY = Math.max(maxY, geo.boundingBox.max.y);
    }
    const height = Math.max(0.001, maxY - minY);
    const list = buckets[n];
    const nInst = list.length / 2;
    for (const geo of geos) {
      const mesh = new THREE.InstancedMesh(
        geo,
        new THREE.MeshLambertMaterial({ color: "#ffffff", clippingPlanes: [formPlane] }),
        nInst
      );
      for (let i = 0; i < nInst; i++) {
        const s = (0.34 + Math.random() * 0.62) / height;
        dummy.position.set(list[i * 2], -minY * s + 0.02, list[i * 2 + 1]);
        dummy.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.15);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color.setHex(greens[(Math.random() * greens.length) | 0]);
        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    }
  }
}

function fillGrove(group, templates, names, count, height, snowy, formPlane, wireMat, hall) {
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 12) {
    tries++;
    const x = -18 + Math.random() * (hall.length + 40);
    const z = -16 + Math.random() * (hall.width + 36);
    if (nearStation(x, z)) continue;
    if (Math.hypot(x - 4.6, z - 4.2) < 1.4) continue;
    const name = names[placed % names.length];
    const h = height * (0.6 + Math.random() * 0.85);
    putModel(group, templates, [name, x, z, h, Math.random() * Math.PI * 2], formPlane, wireMat, snowy);
    placed++;
  }
}

function nearStation(x, z) {
  for (const s of STATIONS) {
    if (Math.hypot(x - s.x, z - s.z) < 1.7) return true;
  }
  return false;
}

function scatterOutside(group, templates, names, height, snowy, formPlane, wireMat, hall, rings) {
  const cx = hall.length / 2;
  const cz = hall.width / 2;
  for (let ring = 0; ring < rings; ring++) {
    const count = 22 + ring * 8;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + ring * 0.4;
      const dist = 18 + ring * 16 + (i % 5) * 3.5;
      const x = cx + Math.cos(ang) * dist;
      const z = cz + Math.sin(ang) * dist * 0.9;
      if (x > -1 && x < hall.length + 1 && z > -1 && z < hall.width + 1) continue;
      const name = names[(i + ring) % names.length];
      const h = height * (0.7 + (i % 5) * 0.16 + ring * 0.12);
      putModel(group, templates, [name, x, z, h, ang], formPlane, wireMat, snowy);
    }
  }
}

function putModel(group, templates, spot, formPlane, wireMat, snowy) {
  const [name, x, z, height, rot] = spot;
  const src = templates[name];
  if (!src) return;
  const model = src.clone(true);
  const meshes = [];
  model.traverse((obj) => {
    if (obj.isMesh && obj.material) meshes.push(obj);
  });
  for (const obj of meshes) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = mats.map((m) => {
      const s = new THREE.MeshStandardMaterial({
        color: m.color ? m.color.clone() : new THREE.Color("#888888"),
        map: m.map || null,
        roughness: 0.84,
        metalness: 0.02,
        clippingPlanes: [formPlane],
      });
      if (snowy && s.color) {
        s.color.lerp(new THREE.Color("#f5f8fc"), 0.8);
        s.emissive = new THREE.Color("#d5e2ee");
        s.emissiveIntensity = 0.18;
      }
      return s;
    });
    obj.material = Array.isArray(obj.material) ? next : next[0];
    obj.castShadow = true;
    obj.receiveShadow = true;
    addWire(obj, wireMat);
  }
  const box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  const s = height / h;
  model.scale.setScalar(s);
  model.rotation.y = rot;
  model.position.set(x, -box.min.y * s, z);
  group.add(model);
}
