import { SceneModel } from '../core/SceneModel';

export class SelectionManager {
  private _id: string | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(model: SceneModel) {
    model.bus.on('change', (c) => {
      if (c.kind === 'reset') this.set(null);
      else if (c.kind === 'removed' && c.entity.id === this._id) this.set(null);
    });
  }

  readonly subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };
  readonly getId = (): string | null => this._id;

  get id(): string | null {
    return this._id;
  }
  select(id: string | null): void {
    this.set(id);
  }
  clear(): void {
    this.set(null);
  }

  private set(id: string | null): void {
    if (id === this._id) return;
    this._id = id;
    this.listeners.forEach((l) => l());
  }
}
