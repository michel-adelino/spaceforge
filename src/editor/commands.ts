import { SceneModel } from '../core/SceneModel';
import { AnyEntity, EntitySnapshot, restore, snapshotOf } from '../domain/factory';

/** Command pattern: every user-visible mutation is an object that knows how to apply and revert itself. */
export interface Command {
  readonly label: string;
  execute(): void;
  undo(): void;
  /** Absorb `next` (already applied) into this command, e.g. consecutive edits of one slider. */
  merge?(next: Command): boolean;
}

export class AddEntitiesCommand implements Command {
  private readonly snaps: EntitySnapshot[];
  constructor(
    private readonly model: SceneModel,
    entities: AnyEntity[],
    readonly label: string,
  ) {
    this.snaps = entities.map(snapshotOf);
  }
  execute(): void {
    for (const s of this.snaps) this.model.add(restore(s));
  }
  undo(): void {
    for (const s of [...this.snaps].reverse()) this.model.remove((s.data as { id: string }).id);
  }
}

export class RemoveEntitiesCommand implements Command {
  private readonly snaps: EntitySnapshot[];
  constructor(
    private readonly model: SceneModel,
    ids: string[],
    readonly label: string,
  ) {
    const all = new Set(ids);
    // Deleting a wall takes its doors and windows with it.
    for (const id of ids) {
      if (model.get(id)?.type === 'wall') for (const o of model.openingsOf(id)) all.add(o.id);
    }
    this.snaps = [...all]
      .map((id) => model.get(id))
      .filter((e): e is AnyEntity => !!e)
      .map(snapshotOf);
  }
  execute(): void {
    for (const s of this.snaps) this.model.remove((s.data as { id: string }).id);
  }
  undo(): void {
    for (const s of this.snaps) this.model.add(restore(s));
  }
}

export interface EntityChange {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export class UpdateEntitiesCommand implements Command {
  private timestamp = Date.now();
  constructor(
    private readonly model: SceneModel,
    private readonly changes: EntityChange[],
    readonly label: string,
    readonly mergeKey?: string,
  ) {}
  execute(): void {
    for (const c of this.changes) this.model.update(c.id, c.after);
  }
  undo(): void {
    for (const c of this.changes) this.model.update(c.id, c.before);
  }
  merge(next: Command): boolean {
    if (!(next instanceof UpdateEntitiesCommand) || !this.mergeKey || this.mergeKey !== next.mergeKey)
      return false;
    if (next.timestamp - this.timestamp > 900) return false;
    this.changes.forEach((c, i) => {
      c.after = next.changes[i]?.after ?? c.after;
    });
    this.timestamp = next.timestamp;
    return true;
  }
}

export class CompositeCommand implements Command {
  constructor(
    readonly label: string,
    private readonly commands: Command[],
  ) {}
  execute(): void {
    for (const c of this.commands) c.execute();
  }
  undo(): void {
    for (const c of [...this.commands].reverse()) c.undo();
  }
}
