import { newId } from '../core/ids';
import { Vec2, distance, normalize, sub, lerp } from '../core/geometry';
import { Entity } from './Entity';

export interface WallData {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
  material: string;
}

export class Wall extends Entity<WallData> {
  readonly type = 'wall' as const;
  protected readonly fields = ['a', 'b', 'thickness', 'height', 'material'] as const;
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
  material: string;

  constructor(data: WallData) {
    super(data.id);
    this.a = { ...data.a };
    this.b = { ...data.b };
    this.thickness = data.thickness;
    this.height = data.height;
    this.material = data.material;
  }

  static create(
    a: Vec2,
    b: Vec2,
    opts: Partial<Pick<WallData, 'thickness' | 'height' | 'material'>> = {},
  ): Wall {
    return new Wall({
      id: newId('wall'),
      a: { ...a },
      b: { ...b },
      thickness: opts.thickness ?? 0.15,
      height: opts.height ?? 2.7,
      material: opts.material ?? 'wall-white',
    });
  }

  get length(): number {
    return distance(this.a, this.b);
  }
  get direction(): Vec2 {
    return normalize(sub(this.b, this.a));
  }
  get midpoint(): Vec2 {
    return lerp(this.a, this.b, 0.5);
  }
}
