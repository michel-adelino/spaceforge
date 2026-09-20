import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FurnitureKind } from '../domain/catalog';
import { fixedMaterial, getMaterial, lampShadeMaterial } from './materials';
import { modelLibrary } from './ModelLibrary';
import { makeArtTexture } from './textures';

type Role = 'primary' | 'fixed';
type V3 = [number, number, number];

const DARK = () => fixedMaterial(0x2a2d33, 0.5, 0.1);
const WHITE = () => fixedMaterial(0xf4f4f2, 0.85);
const FRAME = () => fixedMaterial(0x7a5a40, 0.7);

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const rbox = (w: number, h: number, d: number, r = 0.04) =>
  new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (rt: number, rb: number, h: number, seg = 24, open = false) =>
  new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

function part(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: V3,
  role: Role = 'fixed',
  shadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (role === 'primary') m.userData.role = 'primary';
  return m;
}
const P = () => getMaterial('white'); // placeholder — replaced per instance

function sofa(): THREE.Group {
  const g = new THREE.Group();
  const W = 2.2,
    D = 0.95;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      g.add(part(box(0.06, 0.1, 0.06), DARK(), [sx * (W / 2 - 0.08), 0.05, sz * (D / 2 - 0.08)]));
  g.add(part(rbox(W, 0.22, D, 0.05), P(), [0, 0.21, 0], 'primary'));
  g.add(part(rbox(W, 0.53, 0.22, 0.08), P(), [0, 0.585, -D / 2 + 0.11], 'primary'));
  for (const sx of [-1, 1])
    g.add(part(rbox(0.2, 0.3, D - 0.02, 0.07), P(), [sx * (W / 2 - 0.1), 0.47, 0], 'primary'));
  const cw = (W - 0.4) / 2 - 0.02;
  for (const sx of [-1, 1]) {
    g.add(part(rbox(cw, 0.16, D - 0.3, 0.05), P(), [sx * (cw / 2 + 0.01), 0.4, 0.11], 'primary'));
    g.add(part(rbox(cw, 0.34, 0.16, 0.06), P(), [sx * (cw / 2 + 0.01), 0.65, -D / 2 + 0.3], 'primary'));
  }
  return g;
}

function bed(): THREE.Group {
  const g = new THREE.Group();
  const W = 1.6,
    D = 2.05;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      g.add(part(box(0.08, 0.1, 0.08), DARK(), [sx * (W / 2 - 0.06), 0.05, sz * (D / 2 - 0.06)]));
  g.add(part(box(W, 0.25, D), FRAME(), [0, 0.225, 0]));
  g.add(part(rbox(W - 0.1, 0.2, D - 0.1, 0.05), WHITE(), [0, 0.45, 0]));
  const dl = D * 0.62;
  g.add(part(rbox(W - 0.06, 0.07, dl, 0.03), P(), [0, 0.585, D / 2 - dl / 2 - 0.03], 'primary'));
  for (const sx of [-1, 1])
    g.add(part(rbox(0.6, 0.13, 0.38, 0.05), WHITE(), [sx * W * 0.25, 0.61, -D / 2 + 0.4]));
  g.add(part(box(W + 0.04, 0.9, 0.08), FRAME(), [0, 0.55, -D / 2 + 0.04]));
  return g;
}

function table(): THREE.Group {
  const g = new THREE.Group();
  const W = 1.6,
    D = 0.9;
  g.add(part(box(W, 0.05, D), P(), [0, 0.725, 0], 'primary'));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      g.add(part(box(0.07, 0.7, 0.07), DARK(), [sx * (W / 2 - 0.08), 0.35, sz * (D / 2 - 0.08)]));
  return g;
}

function chair(): THREE.Group {
  const g = new THREE.Group();
  g.add(part(box(0.45, 0.04, 0.45), P(), [0, 0.45, 0.025], 'primary'));
  g.add(part(box(0.45, 0.42, 0.04), P(), [0, 0.69, -0.23], 'primary'));
  for (const sx of [-1, 1]) {
    g.add(part(box(0.04, 0.44, 0.04), DARK(), [sx * 0.19, 0.22, 0.2]));
    g.add(part(box(0.04, 0.9, 0.04), DARK(), [sx * 0.19, 0.45, -0.23]));
  }
  return g;
}

function wardrobe(): THREE.Group {
  const g = new THREE.Group();
  const W = 1.2,
    D = 0.6,
    H = 2.1;
  g.add(part(box(W - 0.06, 0.08, D - 0.06), DARK(), [0, 0.04, 0]));
  g.add(part(box(W, H - 0.08, D - 0.02), P(), [0, 0.08 + (H - 0.08) / 2, -0.01], 'primary'));
  for (const sx of [-1, 1])
    g.add(
      part(
        box(W / 2 - 0.015, H - 0.16, 0.02),
        P(),
        [(sx * W) / 4, 0.12 + (H - 0.16) / 2, D / 2 - 0.01],
        'primary',
      ),
    );
  g.add(part(box(0.006, H - 0.16, 0.004), DARK(), [0, 0.12 + (H - 0.16) / 2, D / 2 + 0.001], 'fixed', false));
  for (const sx of [-1, 1]) g.add(part(box(0.02, 0.28, 0.02), DARK(), [sx * 0.05, 1.05, D / 2 + 0.02]));
  return g;
}

function plant(): THREE.Group {
  const g = new THREE.Group();
  g.add(part(cyl(0.17, 0.13, 0.34), P(), [0, 0.17, 0], 'primary'));
  g.add(part(cyl(0.16, 0.16, 0.02), fixedMaterial(0x3b2f26, 1), [0, 0.34, 0]));
  g.add(part(cyl(0.015, 0.02, 0.5), fixedMaterial(0x6b4f33, 0.9), [0, 0.6, 0]));
  const leaves: [number, number, number, number][] = [
    [0, 0.88, 0, 0.22],
    [0.12, 0.72, 0.08, 0.16],
    [-0.13, 0.74, -0.05, 0.17],
    [0.05, 0.66, -0.14, 0.14],
    [-0.08, 0.95, 0.1, 0.15],
    [0.14, 0.92, -0.06, 0.13],
  ];
  leaves.forEach(([x, y, z, r], i) => {
    const m = part(new THREE.IcosahedronGeometry(r, 2), fixedMaterial(i % 2 ? 0x3d7a45 : 0x4c8a4f, 0.85), [
      x,
      y,
      z,
    ]);
    m.scale.set(1, 1.25, 1);
    g.add(m);
  });
  return g;
}

function lamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(part(cyl(0.18, 0.2, 0.03), DARK(), [0, 0.015, 0]));
  g.add(part(cyl(0.015, 0.015, 1.3), DARK(), [0, 0.68, 0]));
  g.add(part(cyl(0.13, 0.2, 0.3, 32, true), lampShadeMaterial, [0, 1.45, 0], 'fixed', false));
  const light = new THREE.PointLight(0xffc880, 0, 8, 2);
  light.position.set(0, 1.4, 0);
  g.add(light);
  return g;
}

function picture(): THREE.Group {
  const g = new THREE.Group();
  const W = 0.9,
    H = 0.6;
  g.add(part(box(W, H, 0.04), P(), [0, H / 2, 0], 'primary'));
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.1, H - 0.1),
    new THREE.MeshStandardMaterial({ map: makeArtTexture(), roughness: 0.6 }),
  );
  art.position.set(0, H / 2, 0.021);
  g.add(art);
  return g;
}

function carpet(): THREE.Group {
  const g = new THREE.Group();
  g.add(part(box(2.4, 0.02, 1.6), P(), [0, 0.01, 0], 'primary', false));
  return g;
}

const BUILDERS: Record<FurnitureKind, () => THREE.Group> = {
  sofa,
  bed,
  table,
  chair,
  wardrobe,
  plant,
  lamp,
  picture,
  carpet,
};
const templates = new Map<FurnitureKind, THREE.Group>();

/** Assigns the shared preset material to every "primary" (paintable) part of the node. */
export function applyMaterial(node: THREE.Object3D, materialId: string): void {
  const mat = getMaterial(materialId);
  node.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData.role === 'primary') o.material = mat;
  });
}

/**
 * Templates are built once per kind; every instance is a `clone()` that shares geometry and materials.
 * Dimensions of a template equal the catalog defaults, so an instance is resized with a plain scale.
 */
export function createFurnitureNode(kind: FurnitureKind, materialId: string): THREE.Group {
  // A real .glb from public/models/ wins over the procedural stand-in and keeps its own materials.
  const glb = modelLibrary.get(kind);
  if (glb) return glb.clone(true);
  let tpl = templates.get(kind);
  if (!tpl) {
    tpl = BUILDERS[kind]();
    templates.set(kind, tpl);
  }
  const node = tpl.clone(true);
  applyMaterial(node, materialId);
  return node;
}

export function disposeFurnitureTemplates(): void {
  for (const tpl of templates.values())
    tpl.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  templates.clear();
}
