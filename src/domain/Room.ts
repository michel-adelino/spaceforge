import { newId } from '../core/ids';
import { Vec2, polygonArea, polygonCentroid } from '../core/geometry';
import { Entity } from './Entity';

export interface RoomData {
  id: string;
  name: string;
  points: Vec2[];
  material: string;
}

export class Room extends Entity<RoomData> {
  readonly type = 'room' as const;
  protected readonly fields = ['name', 'points', 'material'] as const;
  name: string;
  points: Vec2[];
  material: string;

  constructor(data: RoomData) {
    super(data.id);
    this.name = data.name;
    this.points = data.points.map((p) => ({ ...p }));
    this.material = data.material;
  }

  static create(name: string, points: Vec2[], material = 'floor-oak'): Room {
    return new Room({ id: newId('room'), name, points, material });
  }

  get area(): number {
    return polygonArea(this.points);
  }
  get centroid(): Vec2 {
    return polygonCentroid(this.points);
  }
}
