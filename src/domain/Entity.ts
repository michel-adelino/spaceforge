export type EntityType = 'wall' | 'furniture' | 'opening' | 'room';

/**
 * Base class of everything that lives in the scene. Each entity knows how to
 * serialise itself and how to apply a partial patch — this is what lets commands,
 * persistence and the collaboration layer treat all entities uniformly.
 */
export abstract class Entity<D extends { id: string }> {
  abstract readonly type: EntityType;
  protected abstract readonly fields: ReadonlyArray<Exclude<keyof D, 'id'>>;

  constructor(readonly id: string) {}

  toJSON(): D {
    const self = this as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = { id: this.id };
    for (const f of this.fields) out[f as string] = structuredClone(self[f as string]);
    return out as unknown as D;
  }

  apply(patch: Partial<Omit<D, 'id'>>): void {
    const self = this as unknown as Record<string, unknown>;
    const p = patch as Record<string, unknown>;
    for (const f of this.fields) {
      const key = f as string;
      if (p[key] !== undefined) self[key] = structuredClone(p[key]);
    }
  }
}
