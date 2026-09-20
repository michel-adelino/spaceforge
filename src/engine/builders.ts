import * as THREE from 'three';
import { Wall } from '../domain/Wall';
import { Opening, clampOpeningOffset } from '../domain/Opening';
import { Room } from '../domain/Room';
import { fixedMaterial, getMaterial, glassMaterial } from './materials';

const WHITE_FRAME = () => fixedMaterial(0xf7f7f5, 0.6);
const DOOR_LEAF = () => fixedMaterial(0xb08968, 0.6);

function tag<T extends THREE.Object3D>(o: T, id: string): T {
  o.userData.entityId = id;
  o.traverse((c) => (c.userData.entityId = id));
  return o;
}

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  shadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/**
 * A wall is one extruded slab with a rectangular hole per door/window, plus frames, leaves and glass.
 * Local x runs along the wall from its start point; the group is then placed and rotated in the scene.
 * Both ends extend by half the thickness so corners close without notches.
 */
export function buildWallGroup(wall: Wall, openings: readonly Opening[]): THREE.Group {
  const group = new THREE.Group();
  const L = wall.length;
  const t = wall.thickness;
  const H = wall.height;
  const ext = t / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-ext, 0);
  shape.lineTo(L + ext, 0);
  shape.lineTo(L + ext, H);
  shape.lineTo(-ext, H);
  shape.closePath();

  const placed: { o: Opening; c: number }[] = [];
  for (const o of openings) {
    const c = clampOpeningOffset(o, L);
    if (c === null) continue;
    placed.push({ o, c });
    const y0 = o.kind === 'door' ? 0.002 : o.sill;
    const y1 = Math.min(H - 0.05, y0 + o.height);
    const hole = new THREE.Path();
    hole.moveTo(c - o.width / 2, y0);
    hole.lineTo(c + o.width / 2, y0);
    hole.lineTo(c + o.width / 2, y1);
    hole.lineTo(c - o.width / 2, y1);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  geo.translate(0, 0, -t / 2);
  const slab = mesh(geo, getMaterial(wall.material), 0, 0, 0);
  group.add(tag(slab, wall.id));

  for (const { o, c } of placed) {
    const w = o.width;
    const h = Math.min(o.height, H - 0.05);
    const x0 = c - w / 2;
    const depth = t + 0.02;
    const y0 = o.kind === 'door' ? 0 : o.sill;
    const piece = new THREE.Group();
    const frame = WHITE_FRAME();
    piece.add(mesh(new THREE.BoxGeometry(0.05, h, depth), frame, x0 + 0.025, y0 + h / 2, 0));
    piece.add(mesh(new THREE.BoxGeometry(0.05, h, depth), frame, x0 + w - 0.025, y0 + h / 2, 0));
    piece.add(mesh(new THREE.BoxGeometry(w, 0.05, depth), frame, c, y0 + h - 0.025, 0));

    if (o.kind === 'door') {
      const pivot = new THREE.Group();
      pivot.position.set(x0 + 0.05, 0, 0);
      pivot.rotation.y = -THREE.MathUtils.degToRad(72);
      pivot.add(
        mesh(new THREE.BoxGeometry(w - 0.1, h - 0.06, 0.04), DOOR_LEAF(), (w - 0.1) / 2, (h - 0.06) / 2, 0),
      );
      piece.add(pivot);
    } else {
      piece.add(mesh(new THREE.BoxGeometry(w, 0.05, depth), frame, c, y0 + 0.025, 0));
      piece.add(mesh(new THREE.BoxGeometry(0.03, h, 0.05), frame, c, y0 + h / 2, 0));
      piece.add(mesh(new THREE.BoxGeometry(w, 0.03, 0.05), frame, c, y0 + h / 2, 0));
      piece.add(mesh(new THREE.BoxGeometry(w + 0.14, 0.035, t + 0.1), frame, c, y0 - 0.0175, 0));
      const glass = mesh(
        new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.012),
        glassMaterial,
        c,
        y0 + h / 2,
        0,
        false,
      );
      glass.renderOrder = 2;
      piece.add(glass);
    }
    group.add(tag(piece, o.id));
  }

  group.position.set(wall.a.x, 0, wall.a.y);
  group.rotation.y = -Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
  group.userData.entityId = wall.id;
  return group;
}

/** Floor (pickable) and ceiling (one-sided, invisible from above so orbiting stays unobstructed). */
export function buildRoomGroup(room: Room, ceilingHeight: number): THREE.Group {
  const group = new THREE.Group();
  const floorShape = new THREE.Shape(room.points.map((p) => new THREE.Vector2(p.x, -p.y)));
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), getMaterial(room.material));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.receiveShadow = true;
  group.add(tag(floor, room.id));

  const ceilShape = new THREE.Shape(room.points.map((p) => new THREE.Vector2(p.x, p.y)));
  const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(ceilShape), fixedMaterial(0xfafaf8, 0.95));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ceilingHeight;
  ceiling.raycast = () => undefined;
  group.add(ceiling);
  group.userData.entityId = room.id;
  return group;
}

export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
