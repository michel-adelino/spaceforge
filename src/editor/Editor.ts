import { EventBus } from '../core/EventBus';
import { SceneModel } from '../core/SceneModel';
import { Vec2, add, distance, snapVec } from '../core/geometry';
import { AnyEntity } from '../domain/factory';
import { Furniture } from '../domain/Furniture';
import { FurnitureKind, getCatalogItem } from '../domain/catalog';
import { Opening, OpeningKind, clampOpeningOffset } from '../domain/Opening';
import { Room } from '../domain/Room';
import { Wall } from '../domain/Wall';
import { ProjectData } from '../domain/project';
import { newId } from '../core/ids';
import { AddEntitiesCommand, RemoveEntitiesCommand, UpdateEntitiesCommand, EntityChange } from './commands';
import { HistoryManager } from './HistoryManager';
import { SelectionManager } from './SelectionManager';
import { SnapResult, SnapTarget, snapFurniture } from './snapping';

export interface EditorSettings {
  snapGrid: boolean;
  snapWalls: boolean;
}

const asRecord = (v: unknown): Record<string, unknown> => v as Record<string, unknown>;

/**
 * Records the state of some entities when a drag starts and, on commit, pushes ONE undo step.
 * While dragging, views mutate the model directly (`updateLive`) so the 2D and 3D views stay in sync.
 */
export class Transaction {
  private readonly before = new Map<string, Record<string, unknown>>();
  constructor(
    private readonly editor: Editor,
    ids: string[],
  ) {
    for (const id of ids) {
      const e = editor.model.get(id);
      if (e) this.before.set(id, asRecord(e.toJSON()));
    }
  }
  commit(label: string): boolean {
    const changes: EntityChange[] = [];
    for (const [id, before] of this.before) {
      const e = this.editor.model.get(id);
      if (!e) continue;
      const after = asRecord(e.toJSON());
      if (JSON.stringify(after) !== JSON.stringify(before)) changes.push({ id, before, after });
    }
    if (changes.length === 0) return false;
    this.editor.history.record(new UpdateEntitiesCommand(this.editor.model, changes, label));
    return true;
  }
}

function describeEdit(name: string, keys: string): string {
  if (keys.includes('position')) return `Move ${name}`;
  if (keys.includes('rotation')) return `Rotate ${name}`;
  if (/width|depth|height|thickness|offset|sill/.test(keys)) return `Resize ${name}`;
  if (keys.includes('material')) return `Repaint ${name}`;
  return `Edit ${name}`;
}

export class Editor {
  readonly model = new SceneModel();
  readonly history = new HistoryManager();
  readonly selection = new SelectionManager(this.model);
  /** Commands from the UI to whichever views are mounted. */
  readonly viewBus = new EventBus<{ fit: undefined }>();

  constructor(
    private readonly getSettings: () => EditorSettings = () => ({ snapGrid: true, snapWalls: true }),
  ) {}

  labelOf(e: AnyEntity): string {
    switch (e.type) {
      case 'furniture':
        return e.name;
      case 'room':
        return e.name;
      case 'wall':
        return 'Wall';
      case 'opening':
        return e.kind === 'door' ? 'Door' : 'Window';
    }
  }

  // ---- snapping -----------------------------------------------------------------------------

  snapFurniture(target: SnapTarget, position: Vec2): SnapResult {
    const s = this.getSettings();
    return snapFurniture(position, target, this.model.walls, {
      grid: s.snapGrid ? 0.05 : null,
      walls: s.snapWalls,
      distance: 0.25,
    });
  }

  /** Point used while drawing walls: magnet to existing wall ends, then grid. */
  snapDrawPoint(p: Vec2, magnet: number, ignore?: ReadonlySet<string>): Vec2 {
    let best: Vec2 | null = null;
    let bestD = magnet;
    for (const w of this.model.walls) {
      if (ignore?.has(w.id)) continue;
      for (const q of [w.a, w.b]) {
        const d = distance(p, q);
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
    }
    if (best) return { ...best };
    return this.getSettings().snapGrid ? snapVec(p, 0.1) : { ...p };
  }

  // ---- mutations (each goes through the history) ----------------------------------------------

  beginTransaction(ids: string[]): Transaction {
    return new Transaction(this, ids);
  }

  /** Mutate without recording history — only for drags that end with `Transaction.commit`. */
  updateLive(id: string, patch: Record<string, unknown>): void {
    this.model.update(id, patch);
  }

  /** Discrete edit (property panel, keyboard). Rapid consecutive edits of the same field merge into one undo step. */
  edit(id: string, patch: Record<string, unknown>, label?: string): void {
    const e = this.model.get(id);
    if (!e) return;
    const current = asRecord(e.toJSON());
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(patch)) before[k] = structuredClone(current[k]);
    if (JSON.stringify(before) === JSON.stringify(patch)) return;
    const keys = Object.keys(patch).sort().join(',');
    this.history.execute(
      new UpdateEntitiesCommand(
        this.model,
        [{ id, before, after: structuredClone(patch) }],
        label ?? describeEdit(this.labelOf(e), keys),
        `${id}:${keys}`,
      ),
    );
  }

  addFurniture(kind: FurnitureKind, at: Vec2): Furniture {
    const item = getCatalogItem(kind);
    const f = Furniture.create(kind, at);
    const snap = this.snapFurniture(item, at);
    f.position = snap.position;
    if (snap.rotation !== undefined) f.rotation = snap.rotation;
    this.history.execute(new AddEntitiesCommand(this.model, [f], `Add ${item.name}`));
    this.selection.select(f.id);
    return this.model.get(f.id) as Furniture;
  }

  addWall(a: Vec2, b: Vec2): Wall | null {
    if (distance(a, b) < 0.1) return null;
    const w = Wall.create(a, b);
    this.history.execute(new AddEntitiesCommand(this.model, [w], 'Add wall'));
    return this.model.get(w.id) as Wall;
  }

  /** A rectangular room: four walls plus a floor polygon, as a single undo step. */
  addRoom(min: Vec2, max: Vec2): Room {
    const pts: Vec2[] = [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }];
    const walls = pts.map((p, i) => Wall.create(p, pts[(i + 1) % pts.length]));
    const room = Room.create(`Room ${this.model.rooms.length + 1}`, pts);
    this.history.execute(new AddEntitiesCommand(this.model, [room, ...walls], 'Add room'));
    this.selection.select(room.id);
    return this.model.get(room.id) as Room;
  }

  addOpening(kind: OpeningKind, wallId: string, offset: number): Opening | null {
    const wall = this.model.get(wallId);
    if (!wall || wall.type !== 'wall') return null;
    const o = Opening.create(kind, wallId, offset);
    const clamped = clampOpeningOffset(o, wall.length);
    if (clamped === null) return null;
    o.offset = clamped;
    this.history.execute(new AddEntitiesCommand(this.model, [o], `Add ${kind}`));
    this.selection.select(o.id);
    return this.model.get(o.id) as Opening;
  }

  deleteEntity(id: string): void {
    const e = this.model.get(id);
    if (!e) return;
    this.history.execute(new RemoveEntitiesCommand(this.model, [id], `Delete ${this.labelOf(e)}`));
  }

  deleteSelected(): void {
    if (this.selection.id) this.deleteEntity(this.selection.id);
  }

  duplicateSelected(): void {
    const e = this.selection.id ? this.model.get(this.selection.id) : undefined;
    if (!e || e.type !== 'furniture') return;
    const copy = new Furniture({
      ...e.toJSON(),
      id: newId('furn'),
      position: add(e.position, { x: 0.3, y: 0.3 }),
    });
    this.history.execute(new AddEntitiesCommand(this.model, [copy], `Duplicate ${e.name}`));
    this.selection.select(copy.id);
  }

  rotateSelected(deg: number): void {
    const e = this.selection.id ? this.model.get(this.selection.id) : undefined;
    if (e?.type === 'furniture') this.edit(e.id, { rotation: (((e.rotation + deg) % 360) + 360) % 360 });
  }

  nudgeSelected(dx: number, dy: number): void {
    const e = this.selection.id ? this.model.get(this.selection.id) : undefined;
    if (e?.type === 'furniture')
      this.edit(e.id, { position: { x: e.position.x + dx, y: e.position.y + dy } });
  }

  undo(): void {
    this.history.undo();
  }
  redo(): void {
    this.history.redo();
  }

  // ---- project ------------------------------------------------------------------------------

  loadProject(data: ProjectData): void {
    this.model.load(data);
    this.history.clear();
    this.selection.clear();
    this.viewBus.emit('fit', undefined);
  }

  renameProject(name: string): void {
    this.model.setName(name);
  }

  fitViews(): void {
    this.viewBus.emit('fit', undefined);
  }
}
