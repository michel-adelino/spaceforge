import { Vec2 } from '../core/geometry';
import { WallData } from './Wall';
import { FurnitureData } from './Furniture';
import { OpeningData } from './Opening';
import { RoomData } from './Room';
import { FurnitureKind, getCatalogItem } from './catalog';

/** The persisted / exported shape of a project. */
export interface ProjectData {
  version: 1;
  name: string;
  rooms: RoomData[];
  walls: WallData[];
  furniture: FurnitureData[];
  doors: OpeningData[];
  windows: OpeningData[];
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.length > 0 ? v : fallback);
const vec = (v: unknown): Vec2 | null =>
  isObj(v) && typeof v.x === 'number' && typeof v.y === 'number' ? { x: v.x, y: v.y } : null;

function parseWall(r: unknown): WallData | null {
  if (!isObj(r)) return null;
  const a = vec(r.a);
  const b = vec(r.b);
  if (!a || !b) return null;
  return {
    id: str(r.id, ''),
    a,
    b,
    thickness: num(r.thickness, 0.15),
    height: num(r.height, 2.7),
    material: str(r.material, 'wall-white'),
  };
}

function parseFurniture(r: unknown): FurnitureData | null {
  if (!isObj(r)) return null;
  const position = vec(r.position);
  let item;
  try {
    item = getCatalogItem(r.kind as FurnitureKind);
  } catch {
    return null;
  }
  if (!position) return null;
  return {
    id: str(r.id, ''),
    kind: item.kind,
    name: str(r.name, item.name),
    position,
    rotation: num(r.rotation, 0),
    width: num(r.width, item.width),
    depth: num(r.depth, item.depth),
    height: num(r.height, item.height),
    elevation: num(r.elevation, item.elevation),
    material: str(r.material, item.defaultMaterial),
  };
}

function parseOpening(kind: 'door' | 'window') {
  return (r: unknown): OpeningData | null => {
    if (!isObj(r) || typeof r.wallId !== 'string') return null;
    const door = kind === 'door';
    return {
      id: str(r.id, ''),
      kind,
      wallId: r.wallId,
      offset: num(r.offset, 1),
      width: num(r.width, door ? 0.9 : 1.2),
      height: num(r.height, door ? 2.05 : 1.3),
      sill: num(r.sill, door ? 0 : 0.9),
    };
  };
}

function parseRoom(r: unknown): RoomData | null {
  if (!isObj(r) || !Array.isArray(r.points)) return null;
  const points = r.points.map(vec).filter((p): p is Vec2 => p !== null);
  if (points.length < 3) return null;
  return { id: str(r.id, ''), name: str(r.name, 'Room'), points, material: str(r.material, 'floor-oak') };
}

function list<T extends { id: string }>(raw: unknown, parse: (r: unknown) => T | null, prefix: string): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  raw.forEach((item, i) => {
    const p = parse(item);
    if (p) out.push({ ...p, id: p.id || `${prefix}_imp${i}` });
  });
  return out;
}

/** Validates untrusted JSON (import / localStorage) and fills in defaults. Throws on garbage. */
export function parseProject(raw: unknown): ProjectData {
  if (!isObj(raw)) throw new Error('This is not a SpaceForge project.');
  const walls = list(raw.walls, parseWall, 'wall');
  const rooms = list(raw.rooms, parseRoom, 'room');
  const furniture = list(raw.furniture, parseFurniture, 'furn');
  if (walls.length === 0 && rooms.length === 0 && furniture.length === 0 && !Array.isArray(raw.walls)) {
    throw new Error('No walls, rooms or furniture found in this file.');
  }
  return {
    version: 1,
    name: str(raw.name, 'Imported project'),
    rooms,
    walls,
    furniture,
    doors: list(raw.doors, parseOpening('door'), 'door'),
    windows: list(raw.windows, parseOpening('window'), 'win'),
  };
}
