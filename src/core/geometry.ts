/**
 * Plan-space geometry. Units are metres, +x is right, +y is DOWN (screen convention).
 * Rotation is in degrees, clockwise on screen.
 */
export interface Vec2 {
  x: number;
  y: number;
}
export interface Bounds {
  min: Vec2;
  max: Vec2;
}

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const equals = (a: Vec2, b: Vec2, eps = 1e-3): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

export function normalize(a: Vec2): Vec2 {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}
/** 90° rotation: (x, y) → (-y, x). */
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });

export const degToRad = (d: number): number => (d * Math.PI) / 180;
export const radToDeg = (r: number): number => (r * 180) / Math.PI;
export const normalizeAngle = (deg: number): number => ((deg % 360) + 360) % 360;

export function rotate(v: Vec2, deg: number): Vec2 {
  const r = degToRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

const clean = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;
export const snapValue = (v: number, step: number): number => clean(Math.round(v / step) * step);
export const snapVec = (v: Vec2, step: number): Vec2 => ({
  x: snapValue(v.x, step),
  y: snapValue(v.y, step),
});

export interface Projection {
  point: Vec2;
  /** Position along the segment, clamped to [0, 1]. */
  t: number;
  /** Position along the segment, unclamped. */
  rawT: number;
  distance: number;
}

export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2): Projection {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const rawT = l2 === 0 ? 0 : dot(sub(p, a), ab) / l2;
  const t = Math.max(0, Math.min(1, rawT));
  const point = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return { point, t, rawT, distance: distance(p, point) };
}

export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonCentroid(poly: readonly Vec2[]): Vec2 {
  if (poly.length === 0) return { x: 0, y: 0 };
  const s = poly.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return mul(s, 1 / poly.length);
}

/** Corners of a rotated rectangle, clockwise from its local top-left. */
export function obbCorners(center: Vec2, width: number, depth: number, rotationDeg: number): Vec2[] {
  const hw = width / 2;
  const hd = depth / 2;
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ].map((c) => add(center, rotate(c, rotationDeg)));
}

export const toLocal = (p: Vec2, center: Vec2, rotationDeg: number): Vec2 =>
  rotate(sub(p, center), -rotationDeg);

export function pointInObb(
  p: Vec2,
  center: Vec2,
  width: number,
  depth: number,
  rotationDeg: number,
): boolean {
  const l = toLocal(p, center, rotationDeg);
  return Math.abs(l.x) <= width / 2 && Math.abs(l.y) <= depth / 2;
}

export function boundsOf(points: readonly Vec2[]): Bounds | null {
  if (points.length === 0) return null;
  const min = { x: Infinity, y: Infinity };
  const max = { x: -Infinity, y: -Infinity };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
  }
  return { min, max };
}

export const formatMeters = (m: number): string => `${m.toFixed(2)} m`;
