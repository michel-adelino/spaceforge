import { Editor } from '../src/editor/Editor';
import { createDemoProject } from '../src/domain/demo';
import { Furniture } from '../src/domain/Furniture';
import { snapFurniture } from '../src/editor/snapping';
import { Wall } from '../src/domain/Wall';

const fresh = () => {
  const e = new Editor(() => ({ snapGrid: true, snapWalls: true }));
  e.loadProject(createDemoProject());
  return e;
};

describe('undo / redo (Command pattern)', () => {
  it('add → undo → redo', () => {
    const e = fresh();
    const n = e.model.furniture.length;
    const f = e.addFurniture('chair', { x: 3, y: 3 });
    expect(e.model.furniture.length).toBe(n + 1);
    e.undo();
    expect(e.model.furniture.length).toBe(n);
    e.redo();
    expect(e.model.get(f.id)).toBeDefined();
  });

  it('move / rotate / repaint / delete unwind in reverse order', () => {
    const e = fresh();
    const f = e.addFurniture('sofa', { x: 2, y: 2 });
    const before = f.toJSON();
    e.edit(f.id, { position: { x: 3, y: 3 } });
    e.edit(f.id, { rotation: 45 });
    e.edit(f.id, { material: 'oak' });
    e.deleteEntity(f.id);
    expect(e.model.get(f.id)).toBeUndefined();
    e.undo(); // delete
    expect((e.model.get(f.id) as Furniture).material).toBe('oak');
    e.undo(); // repaint
    e.undo(); // rotate
    expect((e.model.get(f.id) as Furniture).rotation).toBe(before.rotation);
    e.undo(); // move
    expect((e.model.get(f.id) as Furniture).position).toEqual(before.position);
  });

  it('a new action clears the redo stack', () => {
    const e = fresh();
    e.addFurniture('lamp', { x: 1, y: 1 });
    e.undo();
    expect(e.history.canRedo).toBe(true);
    e.addFurniture('plant', { x: 1, y: 1 });
    expect(e.history.canRedo).toBe(false);
  });

  it('rapid edits of one field merge into a single step', () => {
    const e = fresh();
    const f = e.addFurniture('table', { x: 2, y: 2 });
    const steps = e.history.entries.length;
    for (let w = 1.0; w < 1.5; w += 0.1) e.edit(f.id, { width: w });
    expect(e.history.entries.length).toBe(steps + 1);
    e.undo();
    expect((e.model.get(f.id) as Furniture).width).toBe(1.6);
  });

  it('drag transactions produce exactly one step', () => {
    const e = fresh();
    const f = e.addFurniture('bed', { x: 7, y: 3 });
    const start = { ...f.position };
    const steps = e.history.entries.length;
    const tx = e.beginTransaction([f.id]);
    for (let i = 1; i <= 10; i++) e.updateLive(f.id, { position: { x: 7 + i * 0.1, y: 3 } });
    expect(tx.commit('Move Bed')).toBe(true);
    expect(e.history.entries.length).toBe(steps + 1);
    e.undo();
    expect((e.model.get(f.id) as Furniture).position).toEqual(start);
  });

  it('deleting a wall also removes (and restores) its doors and windows', () => {
    const e = fresh();
    const wall = e.model.walls[0];
    const n = e.model.openings.length;
    const attached = e.model.openingsOf(wall.id).length;
    expect(attached).toBeGreaterThan(0);
    e.deleteEntity(wall.id);
    expect(e.model.openings.length).toBe(n - attached);
    e.undo();
    expect(e.model.openings.length).toBe(n);
  });

  it('adding a room is one undo step (4 walls + floor)', () => {
    const e = fresh();
    const walls = e.model.walls.length;
    e.addRoom({ x: 10, y: 0 }, { x: 14, y: 3 });
    expect(e.model.walls.length).toBe(walls + 4);
    e.undo();
    expect(e.model.walls.length).toBe(walls);
  });
});

describe('snapping', () => {
  const wall = Wall.create({ x: 0, y: 0 }, { x: 5, y: 0 }); // wall along the top, room below (y > 0)
  const opts = { grid: 0.05, walls: true, distance: 0.25 };
  const sofa = { width: 2, depth: 1, wallSnap: true };

  it('pushes furniture flush against the wall and turns its back to it', () => {
    const r = snapFurniture({ x: 2.53, y: 0.7 }, sofa, [wall], opts);
    expect(r.wallId).toBe(wall.id);
    expect(r.position.y).toBeCloseTo(wall.thickness / 2 + 0.5);
    expect(r.rotation).toBe(0); // front faces +y, into the room
  });

  it('faces the other way on the opposite side of the wall', () => {
    const r = snapFurniture({ x: 2.5, y: -0.7 }, sofa, [wall], opts);
    expect(r.rotation).toBe(180);
    expect(r.position.y).toBeCloseTo(-(wall.thickness / 2 + 0.5));
  });

  it('falls back to the grid when far from walls', () => {
    const r = snapFurniture({ x: 2.53, y: 2.71 }, sofa, [wall], opts);
    expect(r.wallId).toBeUndefined();
    expect(r.position).toEqual({ x: 2.55, y: 2.7 });
  });

  it('ignores items that do not snap to walls', () => {
    expect(
      snapFurniture({ x: 2.5, y: 0.7 }, { ...sofa, wallSnap: false }, [wall], opts).wallId,
    ).toBeUndefined();
  });
});
