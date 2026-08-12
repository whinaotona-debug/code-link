import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { playImpact, resumeAudio, setSoundEnabled } from './audio.js';
import {
  PART_DEFS,
  TOOLBAR_ORDER,
  TOOL_LABELS,
  restHeight,
  createMesh,
  makeWoodTexture,
  colliderParams,
  funnelShellPanels,
  scaleDef,
  asScale3,
} from './parts.js';

setSoundEnabled(true);
await RAPIER.init();

const canvas = document.getElementById('c');
const modeLabel = document.getElementById('modeLabel');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('clearBtn');
const deleteBtn = document.getElementById('deleteBtn');
const heightLabel = document.getElementById('heightLabel');
const gizmoPanel = document.getElementById('gizmoPanel');
const placePanel = document.getElementById('placePanel');
const ropeHint = document.getElementById('ropeHint');
const hintText = document.getElementById('hintText');
const toolGrid = document.getElementById('toolGrid');
const scaleLabel = document.getElementById('scaleLabel');
const snapBtn = document.getElementById('snapBtn');

const GRID = 0.5; // coarse placement / move snap (not too fine)
const HEIGHT_STEP = 0.5;
const SCALE_STEP = 0.25;
const SCALE_MIN = 0.25;
const SCALE_MAX = 3;
const MOVE_SNAP = 0.5;
const ROT_SNAP = (5 * Math.PI) / 180;
const SCALE_SNAP = 0.25;

let tool = 'select';
let viewMode = '2d';
let placeHeightExtra = 0.5;
let snapEnabled = true;
let playing = false;
/** @type {null | Entity} */
let selected = null;
/** @type {Entity[]} */
let selection = [];
/** @type {null | Entity} */
let ropeFirst = null;

/**
 * @typedef {{
 *  id: number,
 *  mesh: THREE.Object3D,
 *  body: RAPIER.RigidBody,
 *  colliders: RAPIER.Collider[],
 *  kind: string,
 *  material: string,
 *  scale: {x:number,y:number,z:number},
 *  pivotJoint?: RAPIER.ImpulseJoint,
 *  pivotBody?: RAPIER.RigidBody,
 *  snapshot: { x:number, y:number, z:number, rot: THREE.Quaternion, scale: {x:number,y:number,z:number} }
 * }} Entity
 */

/** @type {Entity[]} */
const entities = [];
/** @type {{ id: number, aId: number, bId: number, joint: RAPIER.ImpulseJoint, line: THREE.Line }[]} */
const ropes = [];
/** @type {Map<number, Entity | 'ground'>} */
const colliderMap = new Map();
let nextId = 1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e4da);
scene.fog = new THREE.Fog(0xe9e4da, 28, 60);

const perspectiveCamera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
perspectiveCamera.position.set(7, 5.2, 9);

const aspect = innerWidth / innerHeight;
const orthoSize = 4.5;
const orthoCamera = new THREE.OrthographicCamera(
  -orthoSize * aspect,
  orthoSize * aspect,
  orthoSize,
  -orthoSize,
  0.1,
  100,
);
orthoCamera.position.set(0, 1.2, 20);
orthoCamera.lookAt(0, 1.2, 0);

/** @type {THREE.PerspectiveCamera | THREE.OrthographicCamera} */
let activeCamera = orthoCamera;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const orbit = new OrbitControls(orthoCamera, canvas);
orbit.enableDamping = true;
orbit.target.set(0, 1.2, 0);
orbit.mouseButtons.LEFT = null;
orbit.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
orbit.enableRotate = false;
orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.screenSpacePanning = true;

const transform = new TransformControls(orthoCamera, canvas);
transform.setSize(0.85);
applySnapToTransform();

const selectionRoot = new THREE.Group();
selectionRoot.name = 'selectionRoot';
scene.add(selectionRoot);
/** @type {Map<number, THREE.BoxHelper>} */
const selectionHelpers = new Map();
transform.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value;
  if (!e.value && selection.length && !playing) {
    commitSelectionTransforms();
    pushHistory();
  }
});
transform.addEventListener('objectChange', () => {
  if (!selected || playing) return;

  if (transform.mode === 'scale') {
    const sc = {
      x: snapScaleComp(selected.mesh.scale.x),
      y: snapScaleComp(selected.mesh.scale.y),
      z: snapScaleComp(selected.mesh.scale.z),
    };
    for (const e of selection) applyScale(e, sc);
    updateScaleLabel();
  }

  if (viewMode === '2d') {
    if (selectionRoot.children.length) selectionRoot.position.z = 0;
    else selected.mesh.position.z = 0;
  }

  syncSelectionFromMeshes();
});
scene.add(transform.getHelper());

const hemi = new THREE.HemisphereLight(0xfff6e8, 0xb8c4a8, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3df, 2.1);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
sun.shadow.bias = -0.0002;
scene.add(sun);
scene.add(new THREE.DirectionalLight(0xddeaff, 0.55).translateX(-6).translateY(4).translateZ(-4));

const woodMap = makeWoodTexture();
const tableMap = woodMap.clone();
tableMap.repeat.set(6, 6);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 24),
  new THREE.MeshStandardMaterial({
    map: tableMap,
    color: 0xf0d7b0,
    roughness: 0.72,
    metalness: 0.02,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(24, 48, 0xb08960, 0xd2b48c);
grid.position.y = 0.003;
grid.material.transparent = true;
grid.material.opacity = 0.4;
scene.add(grid);

// Side-view helper grid (XY) — visible in 2D
const wallGrid = new THREE.GridHelper(24, 48, 0xc4b49a, 0xddd3c4);
wallGrid.rotation.x = Math.PI / 2;
wallGrid.position.z = -0.02;
wallGrid.material.transparent = true;
wallGrid.material.opacity = 0.55;
scene.add(wallGrid);

// Visible floor slab for side view
const floorSlab = new THREE.Mesh(
  new THREE.BoxGeometry(24, 0.12, 24),
  new THREE.MeshStandardMaterial({
    map: tableMap,
    color: 0xe8c9a0,
    roughness: 0.8,
  }),
);
floorSlab.position.y = -0.06;
floorSlab.receiveShadow = true;
scene.add(floorSlab);

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 60;
const eventQueue = new RAPIER.EventQueue(true);

const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
const groundCollider = world.createCollider(
  RAPIER.ColliderDesc.cuboid(12, 0.05, 12)
    .setTranslation(0, -0.05, 0)
    .setFriction(0.85)
    .setRestitution(0.08)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  groundBody,
);
colliderMap.set(groundCollider.handle, 'ground');

const ghostGroup = new THREE.Group();
scene.add(ghostGroup);
let ghost = null;

const ropePreviewMat = new THREE.LineBasicMaterial({ color: 0x8b5a2b });
const ropesGroup = new THREE.Group();
scene.add(ropesGroup);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // 3D place on floor
const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // 2D place on XY
const hitPoint = new THREE.Vector3();

// Build toolbar
for (const key of TOOLBAR_ORDER) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tool' + (key === 'select' ? ' active' : '');
  btn.dataset.tool = key;
  btn.textContent = TOOL_LABELS[key];
  btn.addEventListener('click', () => setTool(key));
  toolGrid.appendChild(btn);
}

function applyViewMode(mode) {
  viewMode = mode;
  document.querySelectorAll('.view-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === mode);
  });

  if (mode === '2d') {
    activeCamera = orthoCamera;
    orbit.object = orthoCamera;
    transform.camera = orthoCamera;
    orbit.enableRotate = false;
    orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    orbit.screenSpacePanning = true;
    wallGrid.visible = true;
    grid.visible = false;
    const t = orbit.target;
    orthoCamera.position.set(t.x, t.y, 20);
    orthoCamera.up.set(0, 1, 0);
    orthoCamera.lookAt(t);
    for (const e of entities) {
      e.mesh.position.z = 0;
      syncBodyFromMesh(e);
      lockEntityAxes(e, true);
      if (!playing) saveSnapshot(e);
    }
    updatePanels();
  } else {
    activeCamera = perspectiveCamera;
    orbit.object = perspectiveCamera;
    transform.camera = perspectiveCamera;
    orbit.enableRotate = true;
    orbit.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    wallGrid.visible = false;
    grid.visible = true;
    // Always reset to a clear 3/4 view so the funnel interior is visible
    perspectiveCamera.position.set(5.5, 6.2, 5.5);
    orbit.target.set(0, 1.2, 0);
    orbit.update();
    for (const e of entities) lockEntityAxes(e, false);
    updatePanels();
  }

  updateGizmoAxes();
  updateModeLabel();
  updateHint();
}

function lockEntityAxes(entity, lock2d) {
  if (lock2d) {
    entity.body.setEnabledTranslations(true, true, false, true);
    entity.body.setEnabledRotations(false, false, true, true);
    const t = entity.body.translation();
    entity.body.setTranslation({ x: t.x, y: t.y, z: 0 }, true);
  } else {
    entity.body.setEnabledTranslations(true, true, true, true);
    entity.body.setEnabledRotations(true, true, true, true);
  }
}

function updateGizmoAxes() {
  // Scale always shows XYZ so you can stretch / thin along each axis
  if (transform.mode === 'scale') {
    transform.showX = true;
    transform.showY = true;
    transform.showZ = true;
    return;
  }
  if (viewMode === '2d') {
    if (transform.mode === 'translate') {
      transform.showX = true;
      transform.showY = true;
      transform.showZ = false;
    } else {
      transform.showX = false;
      transform.showY = false;
      transform.showZ = true;
    }
  } else {
    transform.showX = true;
    transform.showY = true;
    transform.showZ = true;
  }
}

function updateModeLabel() {
  const view = viewMode.toUpperCase();
  modeLabel.textContent = playing ? `プレイ中 · ${view}` : `編集 · ${view}`;
  modeLabel.classList.toggle('playing', playing);
}

function updateHint() {
  if (viewMode === '2d') {
    hintText.innerHTML =
      'Ctrl+Z / Ctrl+Shift+Z 元に戻す・やり直し<br>Ctrl+C/V コピー・貼付 · 回転5°刻み<br>右ドラッグで視点移動';
  } else {
    hintText.innerHTML =
      'Ctrl+Z / Ctrl+Shift+Z 元に戻す・やり直し<br>Ctrl+C/V コピー・貼付 · 回転5°刻み<br>右ドラッグで回転';
  }
}

function setGizmoMode(mode) {
  // Bake multi-select group before switching (esp. into scale)
  if (selection.length > 1 && !playing && selectionRoot.children.length) {
    const baked = selection.map((e) => {
      e.mesh.updateWorldMatrix(true, false);
      return {
        e,
        pos: e.mesh.getWorldPosition(new THREE.Vector3()),
        quat: e.mesh.getWorldQuaternion(new THREE.Quaternion()),
        scale: e.scale,
      };
    });
    detachSelectionRoot();
    for (const b of baked) {
      snapVec3(b.pos);
      b.e.mesh.position.copy(b.pos);
      b.e.mesh.quaternion.copy(b.quat);
      applyScale(b.e, b.scale);
      syncBodyFromMesh(b.e);
      saveSnapshot(b.e);
      updatePivotFromEntity(b.e);
    }
  }

  transform.setMode(mode);
  document.querySelectorAll('.gizmo-mode').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  updateGizmoAxes();
  if (tool === 'select' && selection.length && !playing) attachSelectionToGizmo();
}

function getPickMeshes(root) {
  const list = [];
  root.traverse((o) => {
    if (o.isMesh || o.isSprite) list.push(o);
  });
  return list;
}

function createCollidersFor(kind, body, scale = 1) {
  const raw = PART_DEFS[kind];
  const sc = asScale3(scale);
  const def = scaleDef(raw, sc);
  const avg = (sc.x + sc.y + sc.z) / 3;
  const colliders = [];
  const events = RAPIER.ActiveEvents.COLLISION_EVENTS;

  if (kind === 'box') {
    const { x, y, z } = def.size;
    const t = 0.06 * avg;
    const parts = [
      { hx: x / 2, hy: t / 2, hz: z / 2, tx: 0, ty: -y / 2 + t / 2, tz: 0 },
      { hx: x / 2, hy: y / 2, hz: t / 2, tx: 0, ty: 0, tz: z / 2 - t / 2 },
      { hx: x / 2, hy: y / 2, hz: t / 2, tx: 0, ty: 0, tz: -z / 2 + t / 2 },
      { hx: t / 2, hy: y / 2, hz: z / 2, tx: x / 2 - t / 2, ty: 0, tz: 0 },
      { hx: t / 2, hy: y / 2, hz: z / 2, tx: -x / 2 + t / 2, ty: 0, tz: 0 },
    ];
    for (const p of parts) {
      const col = world.createCollider(
        RAPIER.ColliderDesc.cuboid(p.hx, p.hy, p.hz)
          .setTranslation(p.tx, p.ty, p.tz)
          .setFriction(0.7)
          .setRestitution(0.1)
          .setActiveEvents(events),
        body,
      );
      colliders.push(col);
    }
    return colliders;
  }

  if (kind === 'rail') {
    const { x, y, z } = def.size;
    const base = world.createCollider(
      RAPIER.ColliderDesc.cuboid(x / 2, (y * 0.4) / 2, z / 2)
        .setTranslation(0, -y * 0.2, 0)
        .setFriction(0.5)
        .setRestitution(0.05)
        .setActiveEvents(events),
      body,
    );
    colliders.push(base);
    for (const side of [-1, 1]) {
      const wall = world.createCollider(
        RAPIER.ColliderDesc.cuboid(x / 2, y / 2, 0.025 * sc.z)
          .setTranslation(0, y / 2 - y * 0.2, side * (z / 2 - 0.03 * sc.z))
          .setFriction(0.4)
          .setActiveEvents(events),
        body,
      );
      colliders.push(wall);
    }
    return colliders;
  }

  if (kind === 'funnel') {
    for (const p of funnelShellPanels(def)) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(p.tilt, p.yaw, 0, 'YXZ'),
      );
      const col = world.createCollider(
        RAPIER.ColliderDesc.cuboid(p.w / 2, p.h / 2, p.d / 2)
          .setTranslation(p.x, p.y, p.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setFriction(0.35)
          .setRestitution(0.05)
          .setActiveEvents(events),
        body,
      );
      colliders.push(col);
    }
    return colliders;
  }

  if (kind === 'car') {
    const wr = def.wheelR;
    const bodyH = 0.18 * sc.y;
    const { x, z } = def.size;
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid((x * 0.92) / 2, bodyH / 2, (z * 0.75) / 2)
        .setTranslation(0, wr + bodyH / 2, 0)
        .setFriction(1.1)
        .setRestitution(0.05)
        .setDensity(2.2)
        .setActiveEvents(events),
      body,
    );
    colliders.push(col);
    return colliders;
  }

  if (kind === 'gear') {
    const qCyl = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const hub = world.createCollider(
      RAPIER.ColliderDesc.cylinder(def.depth / 2, def.radius * 0.55)
        .setRotation({ x: qCyl.x, y: qCyl.y, z: qCyl.z, w: qCyl.w })
        .setFriction(0.9)
        .setRestitution(0.2)
        .setDensity(0.2)
        .setActiveEvents(events),
      body,
    );
    colliders.push(hub);

    const teeth = 14;
    const toothLen = def.radius * 0.42;
    const toothW = def.radius * 0.14;
    const toothD = def.depth * 0.95;
    const toothR = def.radius * 0.78;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a));
      const col = world.createCollider(
        RAPIER.ColliderDesc.cuboid(toothLen / 2, toothW / 2, toothD / 2)
          .setTranslation(Math.cos(a) * toothR, Math.sin(a) * toothR, 0)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setFriction(1.6)
          .setRestitution(0.25)
          .setDensity(0.08)
          .setActiveEvents(events),
        body,
      );
      colliders.push(col);
    }
    return colliders;
  }

  const p = colliderParams(kind);
  let desc;
  if (p.type === 'ball') {
    desc = RAPIER.ColliderDesc.ball(def.radius ?? p.radius * avg);
    if (kind === 'pinball') desc.setDensity(3.5).setRestitution(0.5).setFriction(0.25);
    else desc.setDensity(1.3).setRestitution(0.42).setFriction(0.35);
  } else {
    const sx = def.size?.x ?? p.x;
    const sy = def.size?.y ?? p.y;
    const sz = def.size?.z ?? p.z;
    desc = RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2)
      .setFriction(kind === 'car' ? 0.9 : 0.7)
      .setRestitution(kind === 'chopstick' || kind === 'domino' ? 0.15 : 0.1);
    if (raw.dynamic) desc.setDensity(kind === 'car' ? 1.8 : 0.8);
  }
  desc.setActiveEvents(events);
  colliders.push(world.createCollider(desc, body));
  return colliders;
}

function attachPivot(entity) {
  const def = PART_DEFS[entity.kind];
  if (!def?.pivoted) return;

  const p = entity.mesh.position;
  const pivotDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z);
  const pivotBody = world.createRigidBody(pivotDesc);
  // Revolute around Z (2D side view + facing-camera gear)
  const axis = { x: 0, y: 0, z: 1 };
  const jointData = RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, axis);
  const joint = world.createImpulseJoint(jointData, pivotBody, entity.body, true);
  entity.pivotBody = pivotBody;
  entity.pivotJoint = joint;
}

function updatePivotFromEntity(entity) {
  if (!entity.pivotBody) return;
  const p = entity.mesh.position;
  entity.pivotBody.setTranslation({ x: p.x, y: p.y, z: viewMode === '2d' ? 0 : p.z }, true);
}

function syncBodyFromMesh(entity) {
  const p = entity.mesh.position;
  const q = entity.mesh.quaternion;
  const z = viewMode === '2d' ? 0 : p.z;
  entity.body.setTranslation({ x: p.x, y: p.y, z }, true);
  entity.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  entity.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  entity.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function saveSnapshot(entity) {
  const sc = asScale3(entity.scale);
  entity.snapshot = {
    x: entity.mesh.position.x,
    y: entity.mesh.position.y,
    z: viewMode === '2d' ? 0 : entity.mesh.position.z,
    rot: entity.mesh.quaternion.clone(),
    scale: { x: sc.x, y: sc.y, z: sc.z },
  };
}

function clampScale(s) {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(s * 100) / 100));
}

function snapScaleComp(v) {
  const abs = Math.abs(v);
  if (!snapEnabled) return clampScale(Math.max(SCALE_MIN, abs || SCALE_MIN));
  const snapped = Math.round(abs / SCALE_SNAP) * SCALE_SNAP;
  return clampScale(Math.max(SCALE_MIN, snapped || SCALE_SNAP));
}

function cloneScale(scale) {
  const sc = asScale3(scale);
  return { x: sc.x, y: sc.y, z: sc.z };
}

function applyScale(entity, scale) {
  const sc = asScale3(scale);
  const next = {
    x: snapScaleComp(sc.x),
    y: snapScaleComp(sc.y),
    z: snapScaleComp(sc.z),
  };
  entity.scale = next;
  entity.mesh.scale.set(next.x, next.y, next.z);
}

function updateScaleLabel() {
  if (!scaleLabel) return;
  const sc = asScale3(selected?.scale ?? selection[0]?.scale ?? 1);
  scaleLabel.textContent = `${sc.x.toFixed(2)}×${sc.y.toFixed(2)}×${sc.z.toFixed(2)}`;
}

function rebuildColliders(entity) {
  for (const c of entity.colliders) {
    colliderMap.delete(c.handle);
    world.removeCollider(c, true);
  }
  entity.colliders = createCollidersFor(entity.kind, entity.body, entity.scale);
  for (const c of entity.colliders) colliderMap.set(c.handle, entity);
}

function nudgeScale(delta) {
  if (!selection.length || playing) return;
  for (const e of selection) {
    const sc = asScale3(e.scale);
    applyScale(e, { x: sc.x + delta, y: sc.y + delta, z: sc.z + delta });
    rebuildColliders(e);
    saveSnapshot(e);
  }
  updateScaleLabel();
  updateSelectionHelpers();
  pushHistory();
}

function addEntity(kind, position, rotation = new THREE.Quaternion(), scale = 1, opts = {}) {
  const def = PART_DEFS[kind];
  const mesh = createMesh(kind, woodMap);
  mesh.position.copy(position);
  if (viewMode === '2d') mesh.position.z = 0;
  mesh.quaternion.copy(rotation);
  const sc = cloneScale(scale);
  sc.x = clampScale(sc.x);
  sc.y = clampScale(sc.y);
  sc.z = clampScale(sc.z);
  mesh.scale.set(sc.x, sc.y, sc.z);
  const id = opts.id ?? nextId++;
  if (opts.id != null) nextId = Math.max(nextId, opts.id + 1);
  mesh.userData.entityId = id;
  scene.add(mesh);

  let bodyDesc;
  if (def.dynamic) {
    bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
      .setLinearDamping(kind === 'car' ? 0.4 : kind === 'pinball' ? 0.12 : kind === 'gear' ? 0.02 : 0.08)
      .setAngularDamping(kind === 'car' ? 2.5 : kind === 'gear' ? 0.03 : kind === 'seesaw' ? 0.2 : 0.15)
      .setCcdEnabled(true);
    if (kind === 'gear') bodyDesc.setCanSleep(false);
  } else {
    bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
  }

  const body = world.createRigidBody(bodyDesc);
  const colliders = createCollidersFor(kind, body, sc);

  /** @type {Entity} */
  const entity = {
    id,
    mesh,
    body,
    colliders,
    kind,
    scale: cloneScale(sc),
    material: def.material === 'marble' ? 'marble' : def.material === 'metal' ? 'metal' : 'wood',
    snapshot: {
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
      rot: rotation.clone(),
      scale: cloneScale(sc),
    },
  };

  for (const c of colliders) colliderMap.set(c.handle, entity);
  entities.push(entity);

  if (def.pivoted) {
    attachPivot(entity);
  }

  if (viewMode === '2d') lockEntityAxes(entity, true);
  if (def.dynamic && !playing) body.sleep();

  return entity;
}

function removeEntity(entity) {
  selection = selection.filter((e) => e !== entity);
  if (selected === entity) selected = selection[selection.length - 1] || null;
  if (ropeFirst === entity) ropeFirst = null;

  for (let i = ropes.length - 1; i >= 0; i--) {
    const r = ropes[i];
    if (r.aId === entity.id || r.bId === entity.id) removeRopeAt(i);
  }

  if (entity.pivotJoint) {
    world.removeImpulseJoint(entity.pivotJoint, true);
    entity.pivotJoint = undefined;
  }
  if (entity.pivotBody) {
    world.removeRigidBody(entity.pivotBody);
    entity.pivotBody = undefined;
  }

  for (const c of entity.colliders) colliderMap.delete(c.handle);
  if (entity.mesh.parent) entity.mesh.parent.remove(entity.mesh);
  entity.mesh.traverse((o) => {
    o.geometry?.dispose?.();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose?.();
    }
  });
  world.removeRigidBody(entity.body);
}

function removeRopeAt(index) {
  const r = ropes[index];
  world.removeImpulseJoint(r.joint, true);
  ropesGroup.remove(r.line);
  r.line.geometry.dispose();
  ropes.splice(index, 1);
}

function clearAll() {
  detachSelectionRoot();
  selection = [];
  selected = null;
  clearSelectionHelpers();
  ropeFirst = null;
  while (ropes.length) removeRopeAt(0);
  while (entities.length) {
    const e = entities.pop();
    removeEntity(e);
  }
  attachSelectionToGizmo();
}

function snap(v) {
  if (!snapEnabled) return v;
  return Math.round(v / MOVE_SNAP) * MOVE_SNAP;
}

function snapVec3(v) {
  v.x = snap(v.x);
  v.y = snap(v.y);
  if (viewMode === '2d') v.z = 0;
  else v.z = snap(v.z);
  return v;
}

function applySnapToTransform() {
  transform.setTranslationSnap(snapEnabled ? MOVE_SNAP : null);
  transform.setRotationSnap(snapEnabled ? ROT_SNAP : null);
  transform.setScaleSnap(snapEnabled ? SCALE_SNAP : null);
}

function updateSnapButton() {
  if (!snapBtn) return;
  snapBtn.classList.toggle('active', snapEnabled);
  snapBtn.textContent = snapEnabled ? 'スナップ ON' : 'スナップ OFF';
  snapBtn.title = snapEnabled
    ? 'スナップあり（移動0.5 / 回転5° / 拡大0.25）'
    : 'スナップなし（自由に動かす）';
}

function setSnapEnabled(next) {
  snapEnabled = next;
  applySnapToTransform();
  updateSnapButton();
}

function clearSelectionHelpers() {
  for (const h of selectionHelpers.values()) {
    scene.remove(h);
    h.geometry?.dispose?.();
    h.material?.dispose?.();
  }
  selectionHelpers.clear();
}

function updateSelectionHelpers() {
  clearSelectionHelpers();
  for (const e of selection) {
    const helper = new THREE.BoxHelper(e.mesh, 0x2f9e6b);
    helper.material.depthTest = false;
    scene.add(helper);
    selectionHelpers.set(e.id, helper);
  }
}

function detachSelectionRoot() {
  transform.detach();
  while (selectionRoot.children.length) {
    const ch = selectionRoot.children[0];
    scene.attach(ch);
  }
  selectionRoot.position.set(0, 0, 0);
  selectionRoot.rotation.set(0, 0, 0);
  selectionRoot.scale.set(1, 1, 1);
}

function attachSelectionToGizmo() {
  detachSelectionRoot();
  if (!selection.length || playing || tool !== 'select') {
    selected = null;
    updateSelectionHelpers();
    updateScaleLabel();
    return;
  }

  selected = selection[selection.length - 1];

  // Scale gizmo targets primary mesh (group scale would skew positions)
  if (selection.length === 1 || transform.mode === 'scale') {
    transform.attach(selected.mesh);
  } else {
    const box = new THREE.Box3();
    for (const e of selection) box.expandByObject(e.mesh);
    const center = box.getCenter(new THREE.Vector3());
    if (viewMode === '2d') center.z = 0;
    selectionRoot.position.copy(center);
    selectionRoot.rotation.set(0, 0, 0);
    selectionRoot.scale.set(1, 1, 1);
    for (const e of selection) selectionRoot.attach(e.mesh);
    transform.attach(selectionRoot);
  }
  updateGizmoAxes();
  updateSelectionHelpers();
  updateScaleLabel();
}

function setSelection(list, { additive = false } = {}) {
  if (!additive) selection = [];
  for (const e of list) {
    if (!e) continue;
    const idx = selection.indexOf(e);
    if (additive && idx >= 0) selection.splice(idx, 1);
    else if (idx < 0) selection.push(e);
  }
  attachSelectionToGizmo();
}

function selectEntity(entity, { additive = false } = {}) {
  if (!entity) {
    if (!additive) {
      selection = [];
      attachSelectionToGizmo();
    }
    return;
  }
  setSelection([entity], { additive });
}

function syncSelectionFromMeshes() {
  for (const e of selection) {
    // world pos after group transform
    e.mesh.updateWorldMatrix(true, false);
    const wp = e.mesh.getWorldPosition(new THREE.Vector3());
    const wq = e.mesh.getWorldQuaternion(new THREE.Quaternion());
    if (viewMode === '2d') wp.z = 0;
    // write back into body using world transform; mesh may be under selectionRoot
    e.body.setTranslation({ x: wp.x, y: wp.y, z: wp.z }, true);
    e.body.setRotation({ x: wq.x, y: wq.y, z: wq.z, w: wq.w }, true);
    e.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
}

function commitSelectionTransforms() {
  // Bake group transforms into each mesh in world space, then reparent to scene
  const baked = selection.map((e) => {
    e.mesh.updateWorldMatrix(true, false);
    return {
      e,
      pos: e.mesh.getWorldPosition(new THREE.Vector3()),
      quat: e.mesh.getWorldQuaternion(new THREE.Quaternion()),
      scale: {
        x: Math.abs(e.mesh.scale.x),
        y: Math.abs(e.mesh.scale.y),
        z: Math.abs(e.mesh.scale.z),
      },
    };
  });

  detachSelectionRoot();

  for (const b of baked) {
    snapVec3(b.pos);
    b.e.mesh.position.copy(b.pos);
    b.e.mesh.quaternion.copy(b.quat);
    applyScale(b.e, b.scale);
    syncBodyFromMesh(b.e);
    rebuildColliders(b.e);
    saveSnapshot(b.e);
    updatePivotFromEntity(b.e);
  }

  attachSelectionToGizmo();
  updateScaleLabel();
}

function alignSelection(axis, mode) {
  if (selection.length < 2 || playing) return;
  commitSelectionTransforms(); // ensure world-baked positions

  const vals = selection.map((e) => e.mesh.position[axis]);
  let target;
  if (mode === 'min') target = Math.min(...vals);
  else if (mode === 'max') target = Math.max(...vals);
  else target = (Math.min(...vals) + Math.max(...vals)) / 2;
  target = snap(target);

  for (const e of selection) {
    e.mesh.position[axis] = target;
    if (viewMode === '2d') e.mesh.position.z = 0;
    syncBodyFromMesh(e);
    saveSnapshot(e);
    updatePivotFromEntity(e);
  }
  attachSelectionToGizmo();
  pushHistory();
}

/** @type {{ kind: string, x: number, y: number, z: number, rot: {x:number,y:number,z:number,w:number}, scale: {x:number,y:number,z:number} }[]} */
let clipboard = [];
let pasteGeneration = 0;

function worldPoseOf(entity) {
  entity.mesh.updateWorldMatrix(true, false);
  const pos = entity.mesh.getWorldPosition(new THREE.Vector3());
  const quat = entity.mesh.getWorldQuaternion(new THREE.Quaternion());
  if (viewMode === '2d') pos.z = 0;
  return {
    kind: entity.kind,
    x: pos.x,
    y: pos.y,
    z: pos.z,
    rot: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
    scale: cloneScale(entity.scale),
  };
}

function copySelection() {
  if (!selection.length || playing) return;
  clipboard = selection.map(worldPoseOf);
  pasteGeneration = 0;
}

function cutSelection() {
  if (!selection.length || playing) return;
  copySelection();
  deleteBtn.click();
}

function pasteClipboard() {
  if (!clipboard.length || playing) return;
  pasteGeneration += 1;
  const ox = MOVE_SNAP * pasteGeneration;
  const oy = MOVE_SNAP * pasteGeneration;
  const created = [];
  for (const item of clipboard) {
    const pos = new THREE.Vector3(
      snap(item.x + ox),
      snap(item.y + oy),
      viewMode === '2d' ? 0 : snap(item.z),
    );
    const rot = new THREE.Quaternion(item.rot.x, item.rot.y, item.rot.z, item.rot.w);
    created.push(addEntity(item.kind, pos, rot, item.scale));
  }
  setTool('select');
  selection = created;
  attachSelectionToGizmo();
  pushHistory();
}

function duplicateSelection() {
  if (!selection.length || playing) return;
  copySelection();
  pasteClipboard();
}

function selectAllEntities() {
  if (playing || !entities.length) return;
  setTool('select');
  selection = [...entities];
  attachSelectionToGizmo();
}

const HISTORY_MAX = 60;
/** @type {ReturnType<typeof captureScene>[]} */
let history = [];
let historyIndex = -1;
let historyLocked = false;

function captureScene() {
  return {
    nextId,
    entities: entities.map((e) => ({ id: e.id, ...worldPoseOf(e) })),
    ropes: ropes.map((r) => ({ aId: r.aId, bId: r.bId })),
    selectionIds: selection.map((e) => e.id),
  };
}

function sceneStateKey(state) {
  return JSON.stringify(state);
}

function pushHistory() {
  if (historyLocked || playing) return;
  const state = captureScene();
  const prev = history[historyIndex];
  if (prev && sceneStateKey(prev) === sceneStateKey(state)) return;
  history = history.slice(0, historyIndex + 1);
  history.push(state);
  if (history.length > HISTORY_MAX) history.shift();
  else historyIndex += 1;
}

function restoreScene(state) {
  historyLocked = true;
  if (playing) {
    playing = false;
    updateModeLabel();
    playBtn.textContent = '▶ プレイ';
    playBtn.classList.remove('stop');
  }
  detachSelectionRoot();
  selection = [];
  selected = null;
  clearSelectionHelpers();
  ropeFirst = null;
  while (ropes.length) removeRopeAt(0);
  while (entities.length) {
    const e = entities.pop();
    removeEntity(e);
  }

  for (const item of state.entities) {
    const pos = new THREE.Vector3(item.x, item.y, viewMode === '2d' ? 0 : item.z);
    const rot = new THREE.Quaternion(item.rot.x, item.rot.y, item.rot.z, item.rot.w);
    addEntity(item.kind, pos, rot, item.scale, { id: item.id });
  }
  for (const r of state.ropes) {
    const a = entities.find((e) => e.id === r.aId);
    const b = entities.find((e) => e.id === r.bId);
    if (a && b) connectRope(a, b);
  }
  nextId = state.nextId;

  setTool('select');
  selection = state.selectionIds
    .map((id) => entities.find((e) => e.id === id))
    .filter(Boolean);
  attachSelectionToGizmo();
  historyLocked = false;
}

function undo() {
  if (playing || historyIndex <= 0) return;
  historyIndex -= 1;
  restoreScene(history[historyIndex]);
}

function redo() {
  if (playing || historyIndex < 0 || historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restoreScene(history[historyIndex]);
}

function findEntityByObject(obj) {
  let o = obj;
  while (o) {
    if (o.userData?.entityId != null) {
      return entities.find((e) => e.id === o.userData.entityId) || null;
    }
    o = o.parent;
  }
  return null;
}

function rebuildGhost() {
  while (ghostGroup.children.length) {
    const ch = ghostGroup.children[0];
    ghostGroup.remove(ch);
    ch.traverse?.((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose?.();
      }
    });
  }
  ghost = null;
  if (tool === 'select' || tool === 'rope' || playing || !PART_DEFS[tool]) {
    ghostGroup.visible = false;
    return;
  }
  ghost = createMesh(tool, woodMap);
  ghost.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    const fade = (m) => {
      const c = m.clone();
      c.transparent = true;
      c.opacity = 0.4;
      c.depthWrite = false;
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(fade) : fade(o.material);
  });
  ghostGroup.add(ghost);
  ghostGroup.visible = false;
}

function updateGhostPose(point) {
  if (!ghost || !PART_DEFS[tool] || playing) return;
  const pos = positionFromHit(tool, point);
  ghost.position.set(pos.x, pos.y, pos.z);
  ghostGroup.visible = true;
}

function positionFromHit(kind, point) {
  if (viewMode === '2d') {
    const y = snap(Math.max(restHeight(kind), point.y));
    return { x: snap(point.x), y, z: 0 };
  }
  return {
    x: snap(point.x),
    y: snap(restHeight(kind) + placeHeightExtra),
    z: snap(point.z),
  };
}

function intersectPlacement() {
  const plane = viewMode === '2d' ? wallPlane : floorPlane;
  return raycaster.ray.intersectPlane(plane, hitPoint);
}

function updatePanels() {
  const placing = !!PART_DEFS[tool];
  gizmoPanel.hidden = tool !== 'select';
  placePanel.hidden = !placing || viewMode === '2d';
  ropeHint.hidden = tool !== 'rope';
  if (tool !== 'select') {
    detachSelectionRoot();
  } else if (!playing) {
    attachSelectionToGizmo();
  }
  if (tool !== 'rope') ropeFirst = null;
  rebuildGhost();
}

function setTool(next) {
  tool = next;
  document.querySelectorAll('.tool').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  updatePanels();
}

function connectRope(a, b) {
  if (a.id === b.id) return;
  if (ropes.some((r) => (r.aId === a.id && r.bId === b.id) || (r.aId === b.id && r.bId === a.id))) return;

  const pa = a.mesh.position;
  const pb = b.mesh.position;
  const length = pa.distanceTo(pb);
  const jointData = RAPIER.JointData.rope(length, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  const joint = world.createImpulseJoint(jointData, a.body, b.body, true);

  const geo = new THREE.BufferGeometry().setFromPoints([pa.clone(), pb.clone()]);
  const line = new THREE.Line(geo, ropePreviewMat.clone());
  ropesGroup.add(line);

  // Ensure dynamic if fixed (rope on two static is useless — wake dynamics)
  if (a.body.isFixed() && b.body.isFixed()) {
    // still allow visual rope between static — skip joint? keep joint anyway
  }

  ropes.push({ id: nextId++, aId: a.id, bId: b.id, joint, line });
  if (!historyLocked) pushHistory();
}

function updateRopeVisuals() {
  for (const r of ropes) {
    const a = entities.find((e) => e.id === r.aId);
    const b = entities.find((e) => e.id === r.bId);
    if (!a || !b) continue;
    const arr = r.line.geometry.attributes.position.array;
    arr[0] = a.mesh.position.x;
    arr[1] = a.mesh.position.y;
    arr[2] = a.mesh.position.z;
    arr[3] = b.mesh.position.x;
    arr[4] = b.mesh.position.y;
    arr[5] = b.mesh.position.z;
    r.line.geometry.attributes.position.needsUpdate = true;
  }
}

function setPlaying(next) {
  playing = next;
  updateModeLabel();
  playBtn.textContent = playing ? '■ 停止' : '▶ プレイ';
  playBtn.classList.toggle('stop', playing);
  ghostGroup.visible = false;
  resumeAudio();

  if (playing) {
    if (selection.length) commitSelectionTransforms();
    detachSelectionRoot();
    clearSelectionHelpers();
    for (const e of entities) {
      saveSnapshot(e);
      syncBodyFromMesh(e);
      updatePivotFromEntity(e);
      if (PART_DEFS[e.kind].dynamic) {
        e.body.wakeUp();
        e.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  } else {
    resetPositions();
    if (tool === 'select') attachSelectionToGizmo();
  }
}

function resetPositions() {
  for (const e of entities) {
    const { x, y, z, rot, scale } = e.snapshot;
    const s = asScale3(scale ?? e.scale ?? 1);
    applyScale(e, s);
    e.body.setTranslation({ x, y, z: viewMode === '2d' ? 0 : z }, true);
    e.body.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w }, true);
    e.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    e.mesh.position.set(x, y, viewMode === '2d' ? 0 : z);
    e.mesh.quaternion.copy(rot);
    rebuildColliders(e);
    updatePivotFromEntity(e);
    if (PART_DEFS[e.kind].dynamic) e.body.sleep();
  }
  updateRopeVisuals();
  updateScaleLabel();
}

function syncMeshes() {
  for (const e of entities) {
    const t = e.body.translation();
    const r = e.body.rotation();
    e.mesh.position.set(t.x, t.y, t.z);
    e.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
  updateRopeVisuals();
}

function materialOf(handle) {
  const hit = colliderMap.get(handle);
  if (hit === 'ground') return 'wood';
  if (!hit) return null;
  if (hit.material === 'metal') return 'metal';
  if (hit.material === 'marble') return 'marble';
  return 'wood';
}

function handleCollisions() {
  eventQueue.drainCollisionEvents((h1, h2, started) => {
    if (!started || !playing) return;
    const a = materialOf(h1);
    const b = materialOf(h2);
    if (!a || !b) return;

    let type = 'wood';
    const pair = [a, b].sort().join('-');
    if (pair === 'marble-marble') type = 'marble';
    else if (pair.includes('marble') || pair.includes('metal')) type = 'marble-wood';

    const ea = colliderMap.get(h1);
    const eb = colliderMap.get(h2);
    const vel = (body) => {
      if (!body || body === 'ground') return { x: 0, y: 0, z: 0 };
      return body.body.linvel();
    };
    const va = vel(ea);
    const vb = vel(eb);
    const speed = Math.hypot(va.x - vb.x, va.y - vb.y, va.z - vb.z);
    const intensity = Math.min(1, 0.15 + speed * 0.22);
    if (intensity < 0.18) return;
    playImpact(type, intensity);
  });
}

function setPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, activeCamera);
}

function pickEntity() {
  const meshes = entities.flatMap((e) => getPickMeshes(e.mesh));
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  return findEntityByObject(hits[0].object);
}

canvas.addEventListener('pointermove', (event) => {
  if (playing || tool === 'select' || tool === 'rope' || transform.dragging) return;
  setPointerFromEvent(event);
  if (!intersectPlacement()) {
    ghostGroup.visible = false;
    return;
  }
  updateGhostPose(hitPoint);
});

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || playing) return;
  resumeAudio();
  setPointerFromEvent(event);
  if (transform.axis) return;

  if (tool === 'select') {
    const hit = pickEntity();
    if (!hit) {
      if (!event.shiftKey) selectEntity(null);
      return;
    }
    selectEntity(hit, { additive: event.shiftKey });
    return;
  }

  if (tool === 'rope') {
    const hit = pickEntity();
    if (!hit) return;
    if (!ropeFirst) {
      ropeFirst = hit;
      ropeHint.querySelector('.mini').textContent = `紐：${TOOL_LABELS[hit.kind]} を選択中 → もう一方をクリック`;
    } else {
      connectRope(ropeFirst, hit);
      ropeFirst = null;
      ropeHint.querySelector('.mini').textContent = '紐：1つ目のパーツ → 2つ目のパーツをクリックしてつなぐ';
      setTool('select');
    }
    return;
  }

  if (!PART_DEFS[tool]) return;
  if (!intersectPlacement()) return;
  const pos = positionFromHit(tool, hitPoint);
  const entity = addEntity(tool, new THREE.Vector3(pos.x, pos.y, pos.z));
  setTool('select');
  selectEntity(entity);
  pushHistory();
});

canvas.addEventListener(
  'wheel',
  (event) => {
    if (playing || !PART_DEFS[tool]) return;
    // allow orbit zoom when select; when placing, height adjust
    event.preventDefault();
    placeHeightExtra = Math.max(0, Math.min(6, placeHeightExtra + (event.deltaY < 0 ? HEIGHT_STEP : -HEIGHT_STEP)));
    heightLabel.textContent = `${placeHeightExtra.toFixed(1)}m`;
    if (ghost) updateGhostPose(ghost.position);
  },
  { passive: false },
);

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.querySelectorAll('.gizmo-mode').forEach((btn) => {
  btn.addEventListener('click', () => setGizmoMode(btn.dataset.mode));
});
document.querySelectorAll('.view-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyViewMode(btn.dataset.view));
});

document.getElementById('heightDown').addEventListener('click', () => {
  placeHeightExtra = Math.max(0, placeHeightExtra - HEIGHT_STEP);
  heightLabel.textContent = `${placeHeightExtra.toFixed(1)}m`;
});
document.getElementById('heightUp').addEventListener('click', () => {
  placeHeightExtra = Math.min(6, placeHeightExtra + HEIGHT_STEP);
  heightLabel.textContent = `${placeHeightExtra.toFixed(1)}m`;
});
document.getElementById('scaleDown').addEventListener('click', () => nudgeScale(-SCALE_STEP));
document.getElementById('scaleUp').addEventListener('click', () => nudgeScale(SCALE_STEP));
snapBtn.addEventListener('click', () => setSnapEnabled(!snapEnabled));

playBtn.addEventListener('click', () => setPlaying(!playing));
resetBtn.addEventListener('click', () => {
  if (playing) setPlaying(false);
  else resetPositions();
});
clearBtn.addEventListener('click', () => {
  setPlaying(false);
  clearAll();
  pushHistory();
});
deleteBtn.addEventListener('click', () => {
  if (!selection.length || playing) return;
  const toRemove = [...selection];
  detachSelectionRoot();
  selection = [];
  selected = null;
  for (const e of toRemove) {
    const idx = entities.indexOf(e);
    if (idx >= 0) entities.splice(idx, 1);
    removeEntity(e);
  }
  clearSelectionHelpers();
  attachSelectionToGizmo();
  pushHistory();
});

document.querySelectorAll('#alignPanel [data-align]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const [axis, mode] = btn.dataset.align.split('-');
    alignSelection(axis, mode);
  });
});

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;

  const mod = e.ctrlKey || e.metaKey;
  if (mod) {
    const k = e.key.toLowerCase();
    if (k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (k === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (k === 'c') {
      e.preventDefault();
      copySelection();
      return;
    }
    if (k === 'x') {
      e.preventDefault();
      cutSelection();
      return;
    }
    if (k === 'v') {
      e.preventDefault();
      pasteClipboard();
      return;
    }
    if (k === 'd') {
      e.preventDefault();
      duplicateSelection();
      return;
    }
    if (k === 'a') {
      e.preventDefault();
      selectAllEntities();
      return;
    }
    return;
  }

  if (e.key === 'Escape') {
    selectEntity(null);
    return;
  }
  if (e.key === 'q' || e.key === 'Q') setTool('select');
  if (e.key === 'w' || e.key === 'W') setGizmoMode('translate');
  if (e.key === 'e' || e.key === 'E') setGizmoMode('rotate');
  if (e.key === 'r' || e.key === 'R') setGizmoMode('scale');
  if (e.key === '[' || e.key === '-') nudgeScale(-SCALE_STEP);
  if (e.key === ']' || e.key === '=') nudgeScale(SCALE_STEP);
  if (e.key === '2') applyViewMode(viewMode === '2d' ? '3d' : '2d');
  if (e.key === 's' || e.key === 'S') {
    setSnapEnabled(!snapEnabled);
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteBtn.click();
  }
  if (e.key === ' ') {
    e.preventDefault();
    setPlaying(!playing);
  }
});

window.addEventListener('resize', () => {
  const a = innerWidth / innerHeight;
  perspectiveCamera.aspect = a;
  perspectiveCamera.updateProjectionMatrix();
  const s = orthoSize;
  orthoCamera.left = -s * a;
  orthoCamera.right = s * a;
  orthoCamera.top = s;
  orthoCamera.bottom = -s;
  orthoCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

heightLabel.textContent = `${placeHeightExtra.toFixed(1)}m`;
applyViewMode('2d');
updatePanels();
setGizmoMode('translate');
updateScaleLabel();
setTool('select');
updateSnapButton();
pushHistory();

const clock = new THREE.Clock();
let accumulator = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  orbit.update();

  // Keep ortho camera facing flat in 2D
  if (viewMode === '2d') {
    const t = orbit.target;
    orthoCamera.position.x = t.x;
    orthoCamera.position.y = t.y;
    orthoCamera.position.z = 20;
    orthoCamera.lookAt(t);
  }

  if (playing) {
    accumulator += dt;
    while (accumulator >= world.timestep) {
      world.step(eventQueue);
      handleCollisions();
      accumulator -= world.timestep;
    }
    syncMeshes();
  } else if (selection.length) {
    for (const h of selectionHelpers.values()) h.update();
  }

  renderer.render(scene, activeCamera);
}

frame();
