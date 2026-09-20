import {
  distance,
  normalizeAngle,
  obbCorners,
  pointInObb,
  pointInPolygon,
  polygonArea,
  projectOnSegment,
  rotate,
  snapValue,
} from '../src/core/geometry';

describe('geometry', () => {
  it('measures distance', () => expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5));

  it('rotates clockwise on screen (y down)', () => {
    const r = rotate({ x: 1, y: 0 }, 90);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });

  it('normalizes angles', () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(720)).toBe(0);
  });

  it('snaps to a grid without float noise', () => expect(snapValue(1.234, 0.1)).toBe(1.2));

  it('projects a point onto a segment', () => {
    const p = projectOnSegment({ x: 2, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(p.point).toEqual({ x: 2, y: 0 });
    expect(p.distance).toBe(3);
    expect(p.t).toBe(0.5);
    expect(projectOnSegment({ x: 9, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }).t).toBe(1);
  });

  it('point in polygon / area', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(pointInPolygon({ x: 1, y: 1 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 1 }, sq)).toBe(false);
    expect(polygonArea(sq)).toBe(12);
  });

  it('rotated rectangle hit-testing', () => {
    // 2 x 1 rectangle rotated 90° becomes 1 wide, 2 tall
    expect(pointInObb({ x: 0, y: 0.9 }, { x: 0, y: 0 }, 2, 1, 90)).toBe(true);
    expect(pointInObb({ x: 0.9, y: 0 }, { x: 0, y: 0 }, 2, 1, 90)).toBe(false);
    expect(obbCorners({ x: 0, y: 0 }, 2, 1, 0)[0]).toEqual({ x: -1, y: -0.5 });
  });
});
