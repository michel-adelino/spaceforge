import { EventBus } from './EventBus';
import { Wall } from '../domain/Wall';
import { Furniture } from '../domain/Furniture';
import { Opening } from '../domain/Opening';
import { Room } from '../domain/Room';
import { AnyEntity, createEntity, EntityData } from '../domain/factory';
import { ProjectData, parseProject } from '../domain/project';

/** Who caused a change. Remote changes are never re-broadcast and never enter the undo stack. */
export type Origin = 'local' | 'remote';

export type SceneChange =
  | { kind: 'added'; entity: AnyEntity; origin: Origin }
  | { kind: 'removed'; entity: AnyEntity; origin: Origin }
  | { kind: 'updated'; entity: AnyEntity; keys: string[]; origin: Origin }
  | { kind: 'reset'; origin: Origin }
  | { kind: 'meta'; origin: Origin };

interface Cache {
  version: number;
  walls: Wall[];
  furniture: Furniture[];
  openings: Opening[];
  rooms: Room[];
}

/**
 * The single source of truth. Both the 2D and the 3D view are pure projections of this model:
 * they subscribe to `bus` and never hold authoritative state of their own.
 */
export class SceneModel {
  readonly bus = new EventBus<{ change: SceneChange }>();
  name = 'My Apartment';
  private _version = 0;
  private readonly entities = new Map<string, AnyEntity>();
  private cache: Cache | null = null;

  /** Stable references so React's useSyncExternalStore can consume them directly. */
  readonly subscribe = (cb: () => void): (() => void) => this.bus.on('change', () => cb());
  readonly getVersion = (): number => this._version;

  get version(): number {
    return this._version;
  }

  private touch(): void {
    this._version++;
  }

  private ensureCache(): Cache {
    if (this.cache && this.cache.version === this._version) return this.cache;
    const c: Cache = { version: this._version, walls: [], furniture: [], openings: [], rooms: [] };
    for (const e of this.entities.values()) {
      switch (e.type) {
        case 'wall':
          c.walls.push(e);
          break;
        case 'furniture':
          c.furniture.push(e);
          break;
        case 'opening':
          c.openings.push(e);
          break;
        case 'room':
          c.rooms.push(e);
          break;
      }
    }
    this.cache = c;
    return c;
  }

  get walls(): readonly Wall[] {
    return this.ensureCache().walls;
  }
  get furniture(): readonly Furniture[] {
    return this.ensureCache().furniture;
  }
  get openings(): readonly Opening[] {
    return this.ensureCache().openings;
  }
  get rooms(): readonly Room[] {
    return this.ensureCache().rooms;
  }
  get size(): number {
    return this.entities.size;
  }

  all(): AnyEntity[] {
    return [...this.entities.values()];
  }
  get(id: string): AnyEntity | undefined {
    return this.entities.get(id);
  }
  openingsOf(wallId: string): Opening[] {
    return this.openings.filter((o) => o.wallId === wallId);
  }

  add(entity: AnyEntity, origin: Origin = 'local'): void {
    if (this.entities.has(entity.id)) this.remove(entity.id, origin);
    this.entities.set(entity.id, entity);
    this.touch();
    this.bus.emit('change', { kind: 'added', entity, origin });
  }

  remove(id: string, origin: Origin = 'local'): AnyEntity | undefined {
    const entity = this.entities.get(id);
    if (!entity) return undefined;
    this.entities.delete(id);
    this.touch();
    this.bus.emit('change', { kind: 'removed', entity, origin });
    return entity;
  }

  update(id: string, patch: Record<string, unknown>, origin: Origin = 'local'): void {
    const entity = this.entities.get(id);
    if (!entity) return;
    entity.apply(patch as never);
    this.touch();
    this.bus.emit('change', { kind: 'updated', entity, keys: Object.keys(patch), origin });
  }

  setName(name: string, origin: Origin = 'local'): void {
    this.name = name;
    this.touch();
    this.bus.emit('change', { kind: 'meta', origin });
  }

  /** Replace the whole scene (open / new / import). */
  load(data: ProjectData, origin: Origin = 'local'): void {
    const project = parseProject(data);
    this.entities.clear();
    this.name = project.name;
    const put = (type: AnyEntity['type'], list: EntityData[]) => {
      for (const d of list) {
        const e = createEntity(type, d);
        this.entities.set(e.id, e);
      }
    };
    put('room', project.rooms);
    put('wall', project.walls);
    put('opening', [...project.doors, ...project.windows]);
    put('furniture', project.furniture);
    this.touch();
    this.bus.emit('change', { kind: 'reset', origin });
  }

  toJSON(): ProjectData {
    return {
      version: 1,
      name: this.name,
      rooms: this.rooms.map((r) => r.toJSON()),
      walls: this.walls.map((w) => w.toJSON()),
      furniture: this.furniture.map((f) => f.toJSON()),
      doors: this.openings.filter((o) => o.kind === 'door').map((o) => o.toJSON()),
      windows: this.openings.filter((o) => o.kind === 'window').map((o) => o.toJSON()),
    };
  }
}
