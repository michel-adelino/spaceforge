import { SceneModel, SceneChange } from '../src/core/SceneModel';
import { createDemoProject } from '../src/domain/demo';
import { parseProject } from '../src/domain/project';
import { Wall } from '../src/domain/Wall';
import { Furniture } from '../src/domain/Furniture';
import { Opening } from '../src/domain/Opening';

describe('SceneModel', () => {
  it('round-trips through JSON', () => {
    const a = new SceneModel();
    a.load(createDemoProject());
    const b = new SceneModel();
    b.load(parseProject(JSON.parse(JSON.stringify(a.toJSON()))));
    expect(b.toJSON()).toEqual(a.toJSON());
    expect(b.furniture.length).toBeGreaterThan(10);
    expect(b.openings.length).toBe(6);
  });

  it('emits typed change events', () => {
    const m = new SceneModel();
    const events: SceneChange[] = [];
    m.bus.on('change', (c) => events.push(c));
    const f = Furniture.create('sofa', { x: 1, y: 1 });
    m.add(f);
    m.update(f.id, { position: { x: 2, y: 2 } });
    m.remove(f.id);
    expect(events.map((e) => e.kind)).toEqual(['added', 'updated', 'removed']);
    expect(events[1]).toMatchObject({ keys: ['position'], origin: 'local' });
  });

  it('keeps the version and typed getters fresh', () => {
    const m = new SceneModel();
    const v0 = m.version;
    m.add(Wall.create({ x: 0, y: 0 }, { x: 3, y: 0 }));
    expect(m.version).toBeGreaterThan(v0);
    expect(m.walls).toHaveLength(1);
  });

  it('rejects garbage imports and sanitises partial data', () => {
    expect(() => parseProject(42)).toThrow();
    const p = parseProject({
      name: 'x',
      walls: [{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }, { nope: true }],
      furniture: [{ kind: 'ufo', position: { x: 0, y: 0 } }],
    });
    expect(p.walls).toHaveLength(1);
    expect(p.walls[0].thickness).toBe(0.15);
    expect(p.furniture).toHaveLength(0);
  });

  it('applies patches without sharing references', () => {
    const f = Furniture.create('table', { x: 0, y: 0 });
    const pos = { x: 5, y: 6 };
    f.apply({ position: pos });
    pos.x = 99;
    expect(f.position.x).toBe(5);
    expect(f.toJSON().position).not.toBe(f.position);
  });

  it('opening keeps to its wall', () => {
    const w = Wall.create({ x: 0, y: 0 }, { x: 4, y: 0 });
    expect(Opening.create('door', w.id, 1).wallId).toBe(w.id);
  });
});
