import { newId } from '../core/ids';
import { Vec2 } from '../core/geometry';
import { Entity } from './Entity';
import { FurnitureKind, getCatalogItem } from './catalog';

export interface FurnitureData {
  id: string;
  kind: FurnitureKind;
  name: string;
  position: Vec2;
  /** Degrees, clockwise in plan. At 0° the front faces +y (down the plan). */
  rotation: number;
  width: number;
  depth: number;
  height: number;
  elevation: number;
  material: string;
}

export class Furniture extends Entity<FurnitureData> {
  readonly type = 'furniture' as const;
  protected readonly fields = [
    'kind',
    'name',
    'position',
    'rotation',
    'width',
    'depth',
    'height',
    'elevation',
    'material',
  ] as const;
  kind: FurnitureKind;
  name: string;
  position: Vec2;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  elevation: number;
  material: string;

  constructor(data: FurnitureData) {
    super(data.id);
    this.kind = data.kind;
    this.name = data.name;
    this.position = { ...data.position };
    this.rotation = data.rotation;
    this.width = data.width;
    this.depth = data.depth;
    this.height = data.height;
    this.elevation = data.elevation;
    this.material = data.material;
  }

  static create(kind: FurnitureKind, position: Vec2): Furniture {
    const item = getCatalogItem(kind);
    return new Furniture({
      id: newId('furn'),
      kind,
      name: item.name,
      position: { ...position },
      rotation: 0,
      width: item.width,
      depth: item.depth,
      height: item.height,
      elevation: item.elevation,
      material: item.defaultMaterial,
    });
  }
}
