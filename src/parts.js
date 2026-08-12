import * as THREE from 'three';

/** Shared wood texture factory */
export function makeWoodTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a06a';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * size;
    g.strokeStyle = `rgba(90, 55, 25, ${0.05 + Math.random() * 0.12})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Catalog of placeable parts.
 * kind → definition used by mesh / collider / gameplay.
 */
export const PART_DEFS = {
  marble: {
    label: 'ビー玉',
    group: 'ball',
    material: 'marble',
    dynamic: true,
    radius: 0.12,
  },
  pinball: {
    label: 'ぴん球',
    group: 'ball',
    material: 'metal',
    dynamic: true,
    radius: 0.09,
  },
  gear: {
    label: '歯車',
    group: 'mech',
    material: 'wood',
    dynamic: true,
    pivoted: true,
    radius: 0.48,
    depth: 0.16,
  },
  car: {
    label: 'ミニカー',
    group: 'mech',
    material: 'paint',
    dynamic: true,
    // side-view friendly: long X, low Y
    size: { x: 0.85, y: 0.32, z: 0.42 },
    wheelR: 0.1,
  },
  chopstick: {
    label: '割りばし',
    group: 'wood',
    material: 'wood',
    dynamic: true,
    size: { x: 1.8, y: 0.08, z: 0.08 },
  },
  pillar: {
    label: '柱',
    group: 'wood',
    material: 'wood',
    dynamic: false,
    size: { x: 0.35, y: 1.2, z: 0.35 },
  },
  board: {
    label: '板',
    group: 'wood',
    material: 'wood',
    dynamic: false,
    size: { x: 1.6, y: 0.08, z: 0.45 },
  },
  box: {
    label: '箱',
    group: 'wood',
    material: 'wood',
    dynamic: false,
    size: { x: 0.9, y: 0.5, z: 0.7 },
    openTop: true,
  },
  domino: {
    label: 'ドミノ',
    group: 'wood',
    material: 'wood',
    dynamic: true,
    size: { x: 0.14, y: 0.55, z: 0.3 },
  },
  rail: {
    label: 'レール',
    group: 'wood',
    material: 'wood',
    dynamic: false,
    size: { x: 1.8, y: 0.14, z: 0.4 },
  },
  seesaw: {
    label: 'シーソー',
    group: 'mech',
    material: 'wood',
    dynamic: true,
    pivoted: true,
    size: { x: 2.0, y: 0.1, z: 0.4 },
  },
  funnel: {
    label: 'ろうと',
    group: 'wood',
    material: 'wood',
    dynamic: false,
    // classic 漏斗 proportions
    topRadius: 0.85,
    mouthRadius: 0.18,
    height: 0.85,
    spout: 0.28,
    thick: 0.045,
    segments: 16,
  },
};

/** Tools that are not physical parts */
export const TOOL_ONLY = ['select', 'rope'];

export const TOOLBAR_ORDER = [
  'select',
  'rope',
  'marble',
  'pinball',
  'gear',
  'car',
  'chopstick',
  'pillar',
  'board',
  'box',
  'domino',
  'rail',
  'seesaw',
  'funnel',
];

export const TOOL_LABELS = {
  select: '選択',
  rope: '紐',
  ...Object.fromEntries(Object.entries(PART_DEFS).map(([k, v]) => [k, v.label])),
};

/** @param {number|{x?:number,y?:number,z?:number}} s */
export function asScale3(s = 1) {
  if (typeof s === 'number') return { x: s, y: s, z: s };
  return { x: s?.x ?? 1, y: s?.y ?? 1, z: s?.z ?? 1 };
}

export function restHeight(kind, scale = 1) {
  const def = PART_DEFS[kind];
  const sc = asScale3(scale);
  if (!def) return 0.1;
  if (kind === 'funnel') return ((def.height + def.spout) / 2) * sc.y + 0.001;
  if (kind === 'car') return def.wheelR * sc.y + 0.001;
  if (kind === 'gear') return def.radius * ((sc.x + sc.y) / 2) + 0.001;
  if (def.radius != null) return def.radius * ((sc.x + sc.y + sc.z) / 3) + 0.001;
  if (def.size) return (def.size.y / 2) * sc.y + 0.001;
  return 0.2;
}

/** Scale a part definition for colliders / placement (supports per-axis). */
export function scaleDef(def, s = 1) {
  if (!def) return def;
  const sc = asScale3(s);
  if (sc.x === 1 && sc.y === 1 && sc.z === 1) return def;
  const out = { ...def };
  if (out.size) {
    out.size = {
      x: out.size.x * sc.x,
      y: out.size.y * sc.y,
      z: out.size.z * sc.z,
    };
  }
  if (out.topRadius != null) {
    const xz = (sc.x + sc.z) / 2;
    out.topRadius *= xz;
    if (out.mouthRadius != null) out.mouthRadius *= xz;
    if (out.height != null) out.height *= sc.y;
    if (out.spout != null) out.spout *= sc.y;
    if (out.thick != null) out.thick *= (sc.x + sc.y + sc.z) / 3;
  } else if (out.radius != null && out.depth != null) {
    out.radius *= (sc.x + sc.y) / 2;
    out.depth *= sc.z;
  } else if (out.radius != null) {
    out.radius *= (sc.x + sc.y + sc.z) / 3;
  }
  if (out.wheelR != null) out.wheelR *= sc.y;
  if (out.width != null) out.width *= sc.x;
  return out;
}

/**
 * Thin wall panels approximating a hollow conical funnel shell (for Rapier).
 * Origin matches mesh: total height = height + spout, centered at y=0.
 */
export function funnelShellPanels(def) {
  const {
    topRadius,
    mouthRadius,
    height,
    spout,
    thick = 0.07,
    segments = 16,
  } = def;
  const totalH = height + spout;
  const bodyCenterY = totalH / 2 - height / 2;
  const panels = [];
  const slant = Math.hypot(topRadius - mouthRadius, height);
  const tilt = Math.atan2(topRadius - mouthRadius, height);
  const arc = (Math.PI * 2) / segments;
  const midR = (topRadius + mouthRadius) / 2;
  const panelW = 2 * midR * Math.sin(arc / 2) + thick;

  for (let i = 0; i < segments; i++) {
    const a = (i + 0.5) * arc;
    panels.push({
      x: Math.cos(a) * midR,
      y: bodyCenterY,
      z: Math.sin(a) * midR,
      yaw: a + Math.PI / 2,
      tilt,
      w: panelW,
      h: slant,
      d: thick,
    });
  }

  // spout tube wall panels (vertical cylinder shell)
  const spoutY = -totalH / 2 + spout / 2;
  const spoutR = mouthRadius;
  const spoutW = 2 * spoutR * Math.sin(arc / 2) + thick;
  for (let i = 0; i < segments; i++) {
    const a = (i + 0.5) * arc;
    panels.push({
      x: Math.cos(a) * spoutR,
      y: spoutY,
      z: Math.sin(a) * spoutR,
      yaw: a + Math.PI / 2,
      tilt: 0,
      w: spoutW,
      h: spout,
      d: thick,
    });
  }

  return panels;
}

function gearShape(radius, teeth = 12) {
  const shape = new THREE.Shape();
  const tooth = radius * 0.12;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.35) / teeth) * Math.PI * 2;
    const a2 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a3 = ((i + 0.85) / teeth) * Math.PI * 2;
    const rIn = radius - tooth;
    const rOut = radius + tooth;
    const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    if (i === 0) shape.moveTo(...p(rIn, a0));
    shape.lineTo(...p(rIn, a1));
    shape.lineTo(...p(rOut, a1));
    shape.lineTo(...p(rOut, a2));
    shape.lineTo(...p(rIn, a2));
    shape.lineTo(...p(rIn, a3));
  }
  shape.closePath();
  // hub hole as hole? skip for solid look with axle visual
  return shape;
}

/**
 * @param {string} kind
 * @param {THREE.Texture} woodMap
 */
export function createMesh(kind, woodMap) {
  const def = PART_DEFS[kind];

  if (kind === 'marble') {
    return mesh(
      new THREE.SphereGeometry(def.radius, 32, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0x7ad7ff,
        roughness: 0.08,
        metalness: 0.05,
        transmission: 0.55,
        thickness: 0.55,
        ior: 1.5,
        clearcoat: 1,
        transparent: true,
        opacity: 0.92,
      }),
    );
  }

  if (kind === 'pinball') {
    return mesh(
      new THREE.SphereGeometry(def.radius, 28, 20),
      new THREE.MeshStandardMaterial({
        color: 0xd0d6de,
        roughness: 0.25,
        metalness: 0.92,
      }),
    );
  }

  if (kind === 'gear') {
    const geo = new THREE.ExtrudeGeometry(gearShape(def.radius, 14), {
      depth: def.depth,
      bevelEnabled: false,
    });
    geo.center();
    const group = new THREE.Group();
    const gear = mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: woodMap,
        color: 0xd4a574,
        roughness: 0.55,
        metalness: 0.05,
      }),
    );
    group.add(gear);
    const axle = mesh(
      new THREE.CylinderGeometry(0.06, 0.06, def.depth + 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7, roughness: 0.35 }),
    );
    axle.rotation.x = Math.PI / 2;
    group.add(axle);
    group.userData.kind = kind;
    return group;
  }

  if (kind === 'car') {
    const group = new THREE.Group();
    const { x, z } = def.size;
    const wr = def.wheelR;
    const bodyH = 0.18;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(x * 0.92, bodyH, z * 0.75),
      new THREE.MeshStandardMaterial({ color: 0xe85d4c, roughness: 0.4, metalness: 0.15 }),
    );
    body.position.y = wr + bodyH / 2;
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(x * 0.4, 0.14, z * 0.65),
      new THREE.MeshStandardMaterial({
        color: 0x9ad4f0,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
      }),
    );
    cabin.position.set(-x * 0.08, wr + bodyH + 0.05, 0);
    cabin.castShadow = true;
    group.add(cabin);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.85 });
    // Two wheels visible in side view (along Z stacked → look like one pair)
    for (const wx of [-x * 0.28, x * 0.28]) {
      for (const wz of [-z * 0.28, z * 0.28]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.07, 16), wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, wr, wz);
        w.castShadow = true;
        group.add(w);
      }
    }
    group.userData.kind = kind;
    return group;
  }

  if (kind === 'funnel') {
    // True 漏斗: lathed profile with rim + taper + spout (hollow inside)
    const group = new THREE.Group();
    const { topRadius, mouthRadius, height, spout, thick = 0.07 } = def;
    const totalH = height + spout;
    const y0 = -totalH / 2;
    const t = thick;

    const pts = [
      // outer bottom of spout → up outer wall → rim → down inner wall → spout hole
      new THREE.Vector2(mouthRadius * 0.9 + t, y0),
      new THREE.Vector2(mouthRadius + t, y0 + spout),
      new THREE.Vector2(topRadius + t, y0 + spout + height),
      new THREE.Vector2(topRadius + t + 0.05, y0 + spout + height),
      new THREE.Vector2(topRadius + t + 0.05, y0 + spout + height + 0.045),
      new THREE.Vector2(topRadius - 0.01, y0 + spout + height + 0.045),
      new THREE.Vector2(topRadius, y0 + spout + height),
      new THREE.Vector2(mouthRadius, y0 + spout),
      new THREE.Vector2(mouthRadius * 0.9, y0),
      new THREE.Vector2(mouthRadius * 0.9 + t, y0),
    ];

    const geo = new THREE.LatheGeometry(pts, 64);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc4a06a,
      roughness: 0.62,
      metalness: 0.05,
      flatShading: false,
    });
    const funnel = new THREE.Mesh(geo, mat);
    funnel.castShadow = true;
    funnel.receiveShadow = true;
    group.add(funnel);

    // darkish inside cue — subtle second lathe inset (optional skip, lathe already hollow)

    group.userData.kind = kind;
    return group;
  }

  if (kind === 'box') {
    const group = new THREE.Group();
    const { x, y, z } = def.size;
    const t = 0.06;
    const mat = new THREE.MeshStandardMaterial({
      map: woodMap.clone(),
      color: 0xd2a86a,
      roughness: 0.65,
    });
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(x, t, z), mat);
    bottom.position.y = -y / 2 + t / 2;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    group.add(bottom);
    const walls = [
      { s: [x, y, t], p: [0, 0, z / 2 - t / 2] },
      { s: [x, y, t], p: [0, 0, -z / 2 + t / 2] },
      { s: [t, y, z], p: [x / 2 - t / 2, 0, 0] },
      { s: [t, y, z], p: [-x / 2 + t / 2, 0, 0] },
    ];
    for (const w of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...w.s), mat);
      m.position.set(...w.p);
      m.castShadow = true;
      group.add(m);
    }
    group.userData.kind = kind;
    return group;
  }

  if (kind === 'rail') {
    const group = new THREE.Group();
    const { x, y, z } = def.size;
    const mat = new THREE.MeshStandardMaterial({
      map: woodMap,
      color: 0xc9955a,
      roughness: 0.6,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(x, y * 0.4, z), mat);
    base.position.y = -y * 0.2;
    base.castShadow = true;
    group.add(base);
    const lip = y;
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(x, lip, 0.05), mat);
      wall.position.set(0, lip / 2 - y * 0.2, side * (z / 2 - 0.03));
      wall.castShadow = true;
      group.add(wall);
    }
    group.userData.kind = kind;
    return group;
  }

  // default boxy wood / chopstick / pillar / board / domino / seesaw
  const { x, y, z } = def.size;
  const map = woodMap.clone();
  map.repeat.set(Math.max(1, x), Math.max(1, z));
  let color = 0xd2a86a;
  if (kind === 'pillar') color = 0xe2c08a;
  if (kind === 'domino') color = 0xe8d5a8;
  if (kind === 'chopstick') color = 0xf0d9a8;
  return mesh(
    new THREE.BoxGeometry(x, y, z),
    new THREE.MeshStandardMaterial({
      map,
      color,
      roughness: 0.62,
      metalness: 0.04,
    }),
  );
}

function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Collider half-extents / radius helpers for Rapier setup in main */
export function colliderParams(kind) {
  const def = PART_DEFS[kind];
  if (kind === 'marble' || kind === 'pinball') {
    return { type: 'ball', radius: def.radius };
  }
  if (kind === 'gear') {
    return { type: 'ball', radius: def.radius * 0.92 }; // approx tooth circle
  }
  if (kind === 'funnel') {
    return { type: 'funnel' };
  }
  if (kind === 'rail') {
    return { type: 'box', ...def.size };
  }
  if (kind === 'car') {
    return { type: 'box', ...def.size };
  }
  return { type: 'box', ...def.size };
}
