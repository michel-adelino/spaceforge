import { Vec2 } from '../core/geometry';
import { Wall } from './Wall';
import { Room } from './Room';
import { Opening } from './Opening';
import { Furniture } from './Furniture';
import { FurnitureKind } from './catalog';
import { ProjectData } from './project';

const P = (x: number, y: number): Vec2 => ({ x, y });

/** A small two-room apartment used as the starting project and for the landing-page preview. */
export function createDemoProject(): ProjectData {
  const top = Wall.create(P(0, 0), P(8.5, 0));
  const right = Wall.create(P(8.5, 0), P(8.5, 5.5));
  const bottom = Wall.create(P(8.5, 5.5), P(0, 5.5));
  const left = Wall.create(P(0, 5.5), P(0, 0));
  const partition = Wall.create(P(5, 0), P(5, 5.5), { thickness: 0.1 });
  const walls = [top, right, bottom, left, partition];

  const rooms = [
    Room.create('Living room', [P(0, 0), P(5, 0), P(5, 5.5), P(0, 5.5)], 'floor-oak'),
    Room.create('Bedroom', [P(5, 0), P(8.5, 0), P(8.5, 5.5), P(5, 5.5)], 'floor-walnut'),
  ];

  const doors = [Opening.create('door', bottom.id, 7.3), Opening.create('door', partition.id, 4.45)];
  const windows = [
    Opening.create('window', top.id, 2.5, { width: 1.8 }),
    Opening.create('window', top.id, 6.8, { width: 1.4 }),
    Opening.create('window', left.id, 2.75, { width: 1.6 }),
    Opening.create('window', right.id, 2.75, { width: 1.4 }),
  ];

  const F = (kind: FurnitureKind, x: number, y: number, rotation = 0, material?: string): Furniture => {
    const f = Furniture.create(kind, P(x, y));
    f.rotation = rotation;
    if (material) f.material = material;
    return f;
  };

  const furniture = [
    F('carpet', 2.5, 3.5, 0, 'sand-fabric'),
    F('sofa', 2.5, 4.95, 180, 'blue-fabric'),
    F('table', 2.5, 1.5, 0, 'oak'),
    F('chair', 2.1, 0.88, 0),
    F('chair', 2.9, 0.88, 0),
    F('chair', 2.1, 2.12, 180),
    F('chair', 2.9, 2.12, 180),
    F('plant', 0.55, 0.55),
    F('lamp', 4.15, 5.05),
    F('picture', 4.93, 2.75, 90),
    F('bed', 6.08, 2.75, 270, 'green-fabric'),
    F('wardrobe', 7.6, 5.125, 180, 'white'),
    F('wardrobe', 6.35, 5.125, 180, 'walnut'),
    F('lamp', 7.45, 1.85),
    F('plant', 8.1, 0.6),
  ];

  return {
    version: 1,
    name: 'My Apartment',
    rooms: rooms.map((r) => r.toJSON()),
    walls: walls.map((w) => w.toJSON()),
    furniture: furniture.map((f) => f.toJSON()),
    doors: doors.map((d) => d.toJSON()),
    windows: windows.map((w) => w.toJSON()),
  };
}
