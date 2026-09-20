import { Wall, WallData } from './Wall';
import { Furniture, FurnitureData } from './Furniture';
import { Opening, OpeningData } from './Opening';
import { Room, RoomData } from './Room';
import { EntityType } from './Entity';

export type AnyEntity = Wall | Furniture | Opening | Room;
export type EntityData = WallData | FurnitureData | OpeningData | RoomData;

export function createEntity(type: EntityType, data: EntityData): AnyEntity {
  switch (type) {
    case 'wall':
      return new Wall(data as WallData);
    case 'furniture':
      return new Furniture(data as FurnitureData);
    case 'opening':
      return new Opening(data as OpeningData);
    case 'room':
      return new Room(data as RoomData);
  }
}

/** Plain-data copy of an entity; commands store these so they never hold live references. */
export interface EntitySnapshot {
  type: EntityType;
  data: EntityData;
}
export const snapshotOf = (e: AnyEntity): EntitySnapshot => ({
  type: e.type,
  data: e.toJSON() as EntityData,
});
export const restore = (s: EntitySnapshot): AnyEntity => createEntity(s.type, s.data);
