import { newId } from '../core/ids';
import { Entity } from './Entity';

export type OpeningKind = 'door' | 'window';

export interface OpeningData {
  id: string;
  kind: OpeningKind;
  wallId: string;
  /** Distance from the wall's start point to the opening's centre, in metres. */
  offset: number;
  width: number;
  height: number;
  /** Height of the bottom edge above the floor (0 for doors). */
  sill: number;
}

export class Opening extends Entity<OpeningData> {
  readonly type = 'opening' as const;
  protected readonly fields = ['kind', 'wallId', 'offset', 'width', 'height', 'sill'] as const;
  kind: OpeningKind;
  wallId: string;
  offset: number;
  width: number;
  height: number;
  sill: number;

  constructor(data: OpeningData) {
    super(data.id);
    this.kind = data.kind;
    this.wallId = data.wallId;
    this.offset = data.offset;
    this.width = data.width;
    this.height = data.height;
    this.sill = data.sill;
  }

  static create(
    kind: OpeningKind,
    wallId: string,
    offset: number,
    overrides: Partial<OpeningData> = {},
  ): Opening {
    const door = kind === 'door';
    return new Opening({
      id: newId(door ? 'door' : 'win'),
      kind,
      wallId,
      offset,
      width: door ? 0.9 : 1.2,
      height: door ? 2.05 : 1.3,
      sill: door ? 0 : 0.9,
      ...overrides,
    });
  }
}

/** Offset clamped so the opening fits inside a wall of the given length; null if it can't fit. */
export function clampOpeningOffset(
  o: Pick<OpeningData, 'offset' | 'width'>,
  wallLength: number,
): number | null {
  const margin = 0.06;
  const min = o.width / 2 + margin;
  const max = wallLength - o.width / 2 - margin;
  if (max < min) return null;
  return Math.max(min, Math.min(max, o.offset));
}
