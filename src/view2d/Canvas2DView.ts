import {
  Vec2,
  add,
  distance,
  dot,
  equals,
  formatMeters,
  mul,
  normalizeAngle,
  obbCorners,
  perp,
  pointInObb,
  pointInPolygon,
  projectOnSegment,
  radToDeg,
  rotate,
  snapValue,
  sub,
  toLocal,
  boundsOf,
  lerp,
} from '../core/geometry';
import { getCatalogItem } from '../domain/catalog';
import { Furniture } from '../domain/Furniture';
import { AnyEntity } from '../domain/factory';
import { Opening, OpeningKind, clampOpeningOffset } from '../domain/Opening';
import { Wall } from '../domain/Wall';
import { getPreset } from '../domain/materials';
import { Editor, Transaction } from '../editor/Editor';
import { DND_MIME, View2DSettings } from '../editor/types';
import { drawFurnitureSymbol, roundedRect } from './symbols';

interface Theme {
  paper: string;
  grid: string;
  gridMajor: string;
  wall: string;
  text: string;
  stroke: string;
  mark: string;
  accent: string;
  chip: string;
}
interface EndRef {
  id: string;
  end: 'a' | 'b';
  orig: Vec2;
}
interface VertRef {
  id: string;
  index: number;
  orig: Vec2;
}
type Hit = { kind: 'furniture' | 'opening' | 'wall' | 'room'; id: string };

type Drag =
  | { kind: 'pan'; startScreen: Vec2; startCam: Vec2 }
  | { kind: 'move'; id: string; grab: Vec2; tx: Transaction; startScreen: Vec2; moved: boolean }
  | { kind: 'rotate'; id: string; tx: Transaction }
  | { kind: 'resize'; id: string; tx: Transaction }
  | { kind: 'opening'; id: string; tx: Transaction }
  | {
      kind: 'wall';
      tx: Transaction;
      ends: EndRef[];
      verts: VertRef[];
      ref: Vec2;
      ignore: Set<string>;
      mode: 'a' | 'b' | 'body';
      startWorld: Vec2;
    }
  | { kind: 'room'; start: Vec2; current: Vec2 };

export interface Canvas2DOptions {
  /** Read-only views (landing preview) draw the plan without selection, handles or input. */
  interactive: boolean;
}

const HANDLE_R = 6;

/**
 * Canvas renderer + pointer interaction for the plan. Like the 3D view it stores no scene data:
 * it reads the SceneModel on every redraw and mutates it only through the Editor.
 */
export class Canvas2DView {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private cam = { x: 4, y: 2.75, zoom: 70 };
  private size = { w: 0, h: 0, dpr: 1 };
  private raf = 0;
  private visible = true;
  private disposed = false;
  private settings: View2DSettings = { tool: 'select', snapGrid: true, showDimensions: true };
  private drag: Drag | null = null;
  private cursorSnap: Vec2 | null = null;
  private wallStart: Vec2 | null = null;
  private chainStart: Vec2 | null = null;
  private measure: { a: Vec2; b: Vec2 | null } | null = null;
  private ghost: { kind: OpeningKind; wallId: string; offset: number; width: number } | null = null;
  private snapWallId: string | null = null;
  private readonly unsubs: Array<() => void> = [];
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly container: HTMLElement,
    private readonly editor: Editor,
    private readonly opts: Canvas2DOptions,
  ) {
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    this.unsubs.push(editor.model.bus.on('change', () => this.requestRedraw()));
    this.unsubs.push(editor.viewBus.on('fit', () => this.fit()));
    if (opts.interactive) {
      this.unsubs.push(editor.selection.subscribe(() => this.requestRedraw()));
      const c = this.canvas;
      c.addEventListener('pointerdown', this.onPointerDown);
      c.addEventListener('pointermove', this.onPointerMove);
      c.addEventListener('pointerup', this.onPointerUp);
      c.addEventListener('pointerleave', this.onPointerLeave);
      c.addEventListener('dblclick', this.onDblClick);
      c.addEventListener('wheel', this.onWheel, { passive: false });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('dragover', this.onDragOver);
      c.addEventListener('drop', this.onDrop);
      window.addEventListener('keydown', this.onKeyDown);
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.fit();
  }

  // ---- public API -----------------------------------------------------------------------------

  setSettings(s: Partial<View2DSettings>): void {
    const toolChanged = s.tool !== undefined && s.tool !== this.settings.tool;
    this.settings = { ...this.settings, ...s };
    if (toolChanged) this.cancel();
    this.updateCursor();
    this.requestRedraw();
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (v) {
      this.resize();
      this.requestRedraw();
    }
  }

  zoomBy(factor: number): void {
    this.cam.zoom = Math.max(12, Math.min(260, this.cam.zoom * factor));
    this.requestRedraw();
  }

  fit(): void {
    const m = this.editor.model;
    const pts = [
      ...m.walls.flatMap((w) => [w.a, w.b]),
      ...m.rooms.flatMap((r) => r.points),
      ...m.furniture.map((f) => f.position),
    ];
    const b = boundsOf(pts) ?? { min: { x: 0, y: 0 }, max: { x: 8, y: 5 } };
    const bw = Math.max(b.max.x - b.min.x, 1);
    const bh = Math.max(b.max.y - b.min.y, 1);
    const { w, h } = this.size;
    const pad = Math.min(90, Math.min(w, h) * 0.14);
    this.cam.x = (b.min.x + b.max.x) / 2;
    this.cam.y = (b.min.y + b.max.y) / 2;
    if (w && h) this.cam.zoom = Math.max(15, Math.min(200, Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh)));
    this.requestRedraw();
  }

  /** Where a catalog item dropped at the view centre should land. */
  centerWorld(): Vec2 {
    return { x: this.cam.x, y: this.cam.y };
  }

  cancel(): void {
    this.wallStart = null;
    this.chainStart = null;
    this.measure = null;
    this.ghost = null;
    if (this.drag?.kind === 'room') this.drag = null;
    this.requestRedraw();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.unsubs.forEach((u) => u());
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.remove();
  }

  // ---- coordinates ----------------------------------------------------------------------------

  screenToWorld(sx: number, sy: number): Vec2 {
    const { w, h } = this.size;
    return { x: (sx - w / 2) / this.cam.zoom + this.cam.x, y: (sy - h / 2) / this.cam.zoom + this.cam.y };
  }
  worldToScreen(p: Vec2): Vec2 {
    const { w, h } = this.size;
    return { x: (p.x - this.cam.x) * this.cam.zoom + w / 2, y: (p.y - this.cam.y) * this.cam.zoom + h / 2 };
  }
  private eventScreen(e: MouseEvent): Vec2 {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const first = this.size.w === 0;
    this.size = { w, h, dpr };
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    if (first) this.fit();
    this.requestRedraw();
  }

  // ---- hit testing ----------------------------------------------------------------------------

  private furnitureHit(f: Furniture, w: Vec2): boolean {
    return pointInObb(w, f.position, f.width, Math.max(f.depth, 0.15), f.rotation);
  }

  private hitTest(w: Vec2): Hit | null {
    const z = this.cam.zoom;
    const m = this.editor.model;
    const fs = m.furniture;
    for (let i = fs.length - 1; i >= 0; i--) {
      if (fs[i].kind !== 'carpet' && this.furnitureHit(fs[i], w)) return { kind: 'furniture', id: fs[i].id };
    }
    for (const o of m.openings) {
      const wall = m.get(o.wallId);
      if (wall?.type !== 'wall') continue;
      const c = clampOpeningOffset(o, wall.length);
      if (c === null) continue;
      const rel = sub(w, wall.a);
      const along = dot(rel, wall.direction);
      const across = Math.abs(dot(rel, perp(wall.direction)));
      if (Math.abs(along - c) <= o.width / 2 && across <= wall.thickness / 2 + 6 / z)
        return { kind: 'opening', id: o.id };
    }
    for (const wl of m.walls) {
      if (projectOnSegment(w, wl.a, wl.b).distance <= Math.max(wl.thickness / 2, 6 / z))
        return { kind: 'wall', id: wl.id };
    }
    for (let i = fs.length - 1; i >= 0; i--) {
      if (fs[i].kind === 'carpet' && this.furnitureHit(fs[i], w)) return { kind: 'furniture', id: fs[i].id };
    }
    const rooms = m.rooms;
    for (let i = rooms.length - 1; i >= 0; i--)
      if (pointInPolygon(w, rooms[i].points)) return { kind: 'room', id: rooms[i].id };
    return null;
  }

  private furnitureHandles(f: Furniture): { rotate: Vec2; corners: Vec2[] } {
    const corners = obbCorners(f.position, f.width, f.depth, f.rotation).map((c) => this.worldToScreen(c));
    const top = this.worldToScreen(add(f.position, rotate({ x: 0, y: -f.depth / 2 }, f.rotation)));
    const dir = rotate({ x: 0, y: -1 }, f.rotation);
    return { rotate: add(top, mul(dir, 30)), corners };
  }

  private hitHandle(s: Vec2): Drag | null {
    const sel = this.editor.selection.id ? this.editor.model.get(this.editor.selection.id) : undefined;
    if (!sel) return null;
    const near = (p: Vec2) => distance(p, s) <= HANDLE_R + 5;
    if (sel.type === 'furniture') {
      const h = this.furnitureHandles(sel);
      if (near(h.rotate)) return { kind: 'rotate', id: sel.id, tx: this.editor.beginTransaction([sel.id]) };
      if (h.corners.some(near))
        return { kind: 'resize', id: sel.id, tx: this.editor.beginTransaction([sel.id]) };
    } else if (sel.type === 'wall') {
      const world = this.screenToWorld(s.x, s.y);
      if (near(this.worldToScreen(sel.a))) return this.beginWallDrag(sel, 'a', world);
      if (near(this.worldToScreen(sel.b))) return this.beginWallDrag(sel, 'b', world);
    }
    return null;
  }

  private beginWallDrag(wall: Wall, mode: 'a' | 'b' | 'body', world: Vec2): Drag {
    const pts = mode === 'body' ? [wall.a, wall.b] : [mode === 'a' ? wall.a : wall.b];
    const ends: EndRef[] = [];
    const verts: VertRef[] = [];
    const ids = new Set<string>();
    for (const w of this.editor.model.walls)
      for (const end of ['a', 'b'] as const)
        if (pts.some((q) => equals(w[end], q))) {
          ends.push({ id: w.id, end, orig: { ...w[end] } });
          ids.add(w.id);
        }
    for (const r of this.editor.model.rooms)
      r.points.forEach((p, index) => {
        if (pts.some((q) => equals(p, q))) {
          verts.push({ id: r.id, index, orig: { ...p } });
          ids.add(r.id);
        }
      });
    return {
      kind: 'wall',
      tx: this.editor.beginTransaction([...ids]),
      ends,
      verts,
      mode,
      startWorld: world,
      ref: { ...(mode === 'b' ? wall.b : wall.a) },
      ignore: new Set(ids),
    };
  }

  // ---- pointer input --------------------------------------------------------------------------

  private drawPoint(world: Vec2, e: { shiftKey: boolean }): Vec2 {
    let p = world;
    if (this.wallStart && e.shiftKey) {
      const d = sub(world, this.wallStart);
      p =
        Math.abs(d.x) > Math.abs(d.y)
          ? { x: world.x, y: this.wallStart.y }
          : { x: this.wallStart.x, y: world.y };
    }
    return this.editor.snapDrawPoint(p, 14 / this.cam.zoom);
  }

  private startPan(s: Vec2): void {
    this.drag = { kind: 'pan', startScreen: s, startCam: { x: this.cam.x, y: this.cam.y } };
    this.updateCursor();
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.canvas.focus();
    const s = this.eventScreen(e);
    if (e.button === 1 || e.button === 2) {
      this.canvas.setPointerCapture(e.pointerId);
      this.startPan(s);
      return;
    }
    if (e.button !== 0) return;
    this.canvas.setPointerCapture(e.pointerId);
    const world = this.screenToWorld(s.x, s.y);
    const m = this.editor.model;

    switch (this.settings.tool) {
      case 'select': {
        const handle = this.hitHandle(s);
        if (handle) {
          this.drag = handle;
          break;
        }
        const hit = this.hitTest(world);
        if (!hit) {
          this.editor.selection.clear();
          this.startPan(s);
          break;
        }
        this.editor.selection.select(hit.id);
        const ent = m.get(hit.id);
        if (hit.kind === 'furniture' && ent?.type === 'furniture') {
          this.drag = {
            kind: 'move',
            id: hit.id,
            grab: sub(ent.position, world),
            tx: this.editor.beginTransaction([hit.id]),
            startScreen: s,
            moved: false,
          };
        } else if (hit.kind === 'opening') {
          this.drag = { kind: 'opening', id: hit.id, tx: this.editor.beginTransaction([hit.id]) };
        } else if (hit.kind === 'wall' && ent?.type === 'wall') {
          this.drag = this.beginWallDrag(ent, 'body', world);
        }
        break;
      }
      case 'delete': {
        const hit = this.hitTest(world);
        if (hit) this.editor.deleteEntity(hit.id);
        break;
      }
      case 'wall': {
        const p = this.drawPoint(world, e);
        if (!this.wallStart) {
          this.wallStart = p;
          this.chainStart = p;
        } else if (distance(p, this.wallStart) >= 0.1) {
          this.editor.addWall(this.wallStart, p);
          const closed = this.chainStart && equals(p, this.chainStart);
          this.wallStart = closed ? null : p;
          if (closed) this.chainStart = null;
        }
        break;
      }
      case 'room': {
        const p = this.drawPoint(world, e);
        this.drag = { kind: 'room', start: p, current: p };
        break;
      }
      case 'door':
      case 'window': {
        this.updateGhost(world);
        if (this.ghost) this.editor.addOpening(this.ghost.kind, this.ghost.wallId, this.ghost.offset);
        break;
      }
      case 'measure': {
        const p = this.drawPoint(world, e);
        if (!this.measure || this.measure.b) this.measure = { a: p, b: null };
        else this.measure.b = p;
        break;
      }
    }
    this.requestRedraw();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const s = this.eventScreen(e);
    const world = this.screenToWorld(s.x, s.y);
    const tool = this.settings.tool;
    const drawing = tool === 'wall' || tool === 'room' || tool === 'measure';
    this.cursorSnap = drawing ? this.drawPoint(world, e) : null;
    const d = this.drag;

    if (d) this.handleDrag(d, s, world, e);
    else if (tool === 'door' || tool === 'window') this.updateGhost(world);
    else if (tool === 'select') this.updateCursor(this.hitTest(world));
    this.requestRedraw();
  };

  private handleDrag(d: Drag, s: Vec2, world: Vec2, e: PointerEvent): void {
    const model = this.editor.model;
    switch (d.kind) {
      case 'pan':
        this.cam.x = d.startCam.x - (s.x - d.startScreen.x) / this.cam.zoom;
        this.cam.y = d.startCam.y - (s.y - d.startScreen.y) / this.cam.zoom;
        break;
      case 'move': {
        if (!d.moved && distance(s, d.startScreen) < 3) return;
        d.moved = true;
        const f = model.get(d.id);
        if (f?.type !== 'furniture') return;
        const target = add(world, d.grab);
        if (e.altKey) {
          this.editor.updateLive(d.id, { position: target });
          this.snapWallId = null;
        } else {
          const snap = this.editor.snapFurniture(
            { width: f.width, depth: f.depth, wallSnap: getCatalogItem(f.kind).wallSnap },
            target,
          );
          this.snapWallId = snap.wallId ?? null;
          this.editor.updateLive(
            d.id,
            snap.rotation !== undefined
              ? { position: snap.position, rotation: snap.rotation }
              : { position: snap.position },
          );
        }
        break;
      }
      case 'rotate': {
        const f = model.get(d.id);
        if (f?.type !== 'furniture') return;
        const a = radToDeg(Math.atan2(world.y - f.position.y, world.x - f.position.x)) + 90;
        this.editor.updateLive(d.id, { rotation: normalizeAngle(e.altKey ? a : snapValue(a, 15)) });
        break;
      }
      case 'resize': {
        const f = model.get(d.id);
        if (f?.type !== 'furniture') return;
        const l = toLocal(world, f.position, f.rotation);
        this.editor.updateLive(d.id, {
          width: Math.max(0.1, snapValue(Math.abs(l.x) * 2, 0.05)),
          depth: Math.max(0.02, snapValue(Math.abs(l.y) * 2, 0.05)),
        });
        break;
      }
      case 'opening': {
        const o = model.get(d.id);
        const wall = o?.type === 'opening' ? model.get(o.wallId) : undefined;
        if (o?.type !== 'opening' || wall?.type !== 'wall') return;
        const c = clampOpeningOffset(
          { offset: dot(sub(world, wall.a), wall.direction), width: o.width },
          wall.length,
        );
        if (c !== null) this.editor.updateLive(d.id, { offset: Math.round(c * 20) / 20 });
        break;
      }
      case 'wall': {
        const target =
          d.mode === 'body'
            ? this.editor.snapDrawPoint(add(d.ref, sub(world, d.startWorld)), 14 / this.cam.zoom, d.ignore)
            : this.editor.snapDrawPoint(world, 14 / this.cam.zoom, d.ignore);
        const delta = sub(target, d.ref);
        for (const r of d.ends) this.editor.updateLive(r.id, { [r.end]: add(r.orig, delta) });
        const byRoom = new Map<string, Vec2[]>();
        for (const v of d.verts) {
          const room = model.get(v.id);
          if (room?.type !== 'room') continue;
          const pts = byRoom.get(v.id) ?? room.points.map((p) => ({ ...p }));
          pts[v.index] = add(v.orig, delta);
          byRoom.set(v.id, pts);
        }
        byRoom.forEach((points, id) => this.editor.updateLive(id, { points }));
        break;
      }
      case 'room':
        d.current = this.drawPoint(world, e);
        break;
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    const d = this.drag;
    this.drag = null;
    this.snapWallId = null;
    if (!d) return;
    switch (d.kind) {
      case 'move':
        d.tx.commit(`Move ${this.nameOf(d.id)}`);
        break;
      case 'rotate':
        d.tx.commit(`Rotate ${this.nameOf(d.id)}`);
        break;
      case 'resize':
        d.tx.commit(`Resize ${this.nameOf(d.id)}`);
        break;
      case 'opening':
        d.tx.commit(`Move ${this.nameOf(d.id)}`);
        break;
      case 'wall':
        d.tx.commit('Move wall');
        break;
      case 'room': {
        const min = { x: Math.min(d.start.x, d.current.x), y: Math.min(d.start.y, d.current.y) };
        const max = { x: Math.max(d.start.x, d.current.x), y: Math.max(d.start.y, d.current.y) };
        if (max.x - min.x >= 0.5 && max.y - min.y >= 0.5) this.editor.addRoom(min, max);
        break;
      }
      case 'pan':
        break;
    }
    this.updateCursor();
    this.requestRedraw();
  };

  private nameOf(id: string): string {
    const e = this.editor.model.get(id);
    return e ? this.editor.labelOf(e) : 'object';
  }

  private onPointerLeave = (): void => {
    this.cursorSnap = null;
    this.ghost = null;
    this.requestRedraw();
  };

  private onDblClick = (): void => {
    if (this.settings.tool === 'wall') {
      this.wallStart = null;
      this.chainStart = null;
      this.requestRedraw();
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const s = this.eventScreen(e);
    const before = this.screenToWorld(s.x, s.y);
    this.cam.zoom = Math.max(12, Math.min(260, this.cam.zoom * Math.exp(-e.deltaY * 0.0012)));
    const after = this.screenToWorld(s.x, s.y);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.requestRedraw();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.cancel();
  };

  private onDragOver = (e: DragEvent): void => {
    if (e.dataTransfer?.types.includes(DND_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  private onDrop = (e: DragEvent): void => {
    const kind = e.dataTransfer?.getData(DND_MIME);
    if (!kind) return;
    e.preventDefault();
    const s = this.eventScreen(e);
    this.editor.addFurniture(kind as never, this.screenToWorld(s.x, s.y));
  };

  private updateGhost(world: Vec2): void {
    const kind = this.settings.tool as OpeningKind;
    const width = kind === 'door' ? 0.9 : 1.2;
    let best: { wall: Wall; d: number; along: number } | null = null;
    for (const wall of this.editor.model.walls) {
      const p = projectOnSegment(world, wall.a, wall.b);
      if (p.distance > wall.thickness / 2 + 14 / this.cam.zoom) continue;
      if (!best || p.distance < best.d) best = { wall, d: p.distance, along: p.rawT * wall.length };
    }
    if (best) {
      const offset = clampOpeningOffset({ offset: best.along, width }, best.wall.length);
      this.ghost = offset === null ? null : { kind, wallId: best.wall.id, offset, width };
    } else this.ghost = null;
  }

  private updateCursor(hit?: Hit | null): void {
    const t = this.settings.tool;
    let c: string;
    if (this.drag?.kind === 'pan') c = 'grabbing';
    else if (t === 'select') c = hit ? (hit.kind === 'furniture' ? 'move' : 'pointer') : 'grab';
    else if (t === 'delete') c = 'not-allowed';
    else c = 'crosshair';
    this.canvas.style.cursor = c;
  }

  // ---- drawing --------------------------------------------------------------------------------

  requestRedraw(): void {
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.visible && !this.disposed) this.draw();
    });
  }

  private readTheme(): Theme {
    const cs = getComputedStyle(this.canvas);
    const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    return {
      paper: g('--plan-paper', '#f4f2ec'),
      grid: g('--plan-grid', '#e4e1d8'),
      gridMajor: g('--plan-grid-major', '#d3cfc3'),
      wall: g('--plan-wall', '#2b2f38'),
      text: g('--plan-text', '#5b6270'),
      stroke: g('--plan-stroke', 'rgba(15,23,42,0.8)'),
      mark: g('--mark', '#f5c518'),
      accent: g('--accent', '#1c4fd8'),
      chip: g('--plan-chip', 'rgba(255,255,255,0.92)'),
    };
  }

  private drawGrid(th: Theme): void {
    const { ctx } = this;
    const { w, h } = this.size;
    const z = this.cam.zoom;
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(w, h);
    const step = z >= 45 ? 0.5 : z >= 22 ? 1 : 5;
    ctx.lineWidth = 1;
    const line = (x0: number, y0: number, x1: number, y1: number) => {
      ctx.moveTo(Math.round(x0) + 0.5, Math.round(y0) + 0.5);
      ctx.lineTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    };
    for (const major of [false, true]) {
      ctx.beginPath();
      ctx.strokeStyle = major ? th.gridMajor : th.grid;
      for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) {
        const isMajor = Math.abs(x % 5) < 1e-6;
        if (isMajor !== major) continue;
        const sx = this.worldToScreen({ x, y: 0 }).x;
        line(sx, 0, sx, h);
      }
      for (let y = Math.floor(tl.y / step) * step; y <= br.y; y += step) {
        const isMajor = Math.abs(y % 5) < 1e-6;
        if (isMajor !== major) continue;
        const sy = this.worldToScreen({ x: 0, y }).y;
        line(0, sy, w, sy);
      }
      ctx.stroke();
    }
  }

  private draw(): void {
    const { ctx } = this;
    const { w, h, dpr } = this.size;
    if (!w || !h) return;
    const th = this.readTheme();
    const z = this.cam.zoom;
    const model = this.editor.model;
    const selId = this.opts.interactive ? this.editor.selection.id : null;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = th.paper;
    ctx.fillRect(0, 0, w, h);
    this.drawGrid(th);

    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - this.cam.x * z), dpr * (h / 2 - this.cam.y * z));
    ctx.lineJoin = 'round';

    for (const r of model.rooms) {
      ctx.beginPath();
      r.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = getPreset(r.material).color;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (r.id === selId) {
        ctx.setLineDash([8 / z, 5 / z]);
        ctx.strokeStyle = th.mark;
        ctx.lineWidth = 3 / z;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    for (const f of model.furniture) if (f.kind === 'carpet') this.drawFurniture(f, th);
    for (const wall of model.walls) this.drawWall(wall, th, wall.id === selId, wall.id === this.snapWallId);
    for (const o of model.openings) this.drawOpening(o, th, o.id === selId);
    for (const f of model.furniture) if (f.kind !== 'carpet') this.drawFurniture(f, th);

    const sel = selId ? model.get(selId) : undefined;
    if (sel?.type === 'furniture') {
      ctx.save();
      ctx.translate(sel.position.x, sel.position.y);
      ctx.rotate((sel.rotation * Math.PI) / 180);
      ctx.strokeStyle = th.mark;
      ctx.lineWidth = 3 / z;
      ctx.strokeRect(-sel.width / 2, -Math.max(sel.depth, 0.07) / 2, sel.width, Math.max(sel.depth, 0.07));
      ctx.restore();
    }

    this.drawDrafts(th);

    // ---- screen-space overlay ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawLabels(th, sel);
    if (this.opts.interactive) this.drawHandles(th, sel);
    if (this.cursorSnap && ['wall', 'room', 'measure'].includes(this.settings.tool)) {
      const p = this.worldToScreen(this.cursorSnap);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = th.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawFurniture(f: Furniture, th: Theme): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(f.position.x, f.position.y);
    ctx.rotate((f.rotation * Math.PI) / 180);
    drawFurnitureSymbol(
      ctx,
      f.kind,
      f.width,
      f.depth,
      getPreset(f.material).color,
      1.3 / this.cam.zoom,
      th.stroke,
    );
    ctx.restore();
  }

  private wallQuad(wall: Wall): Vec2[] {
    const dir = wall.direction;
    const n = mul(perp(dir), wall.thickness / 2);
    const a = sub(wall.a, mul(dir, wall.thickness / 2));
    const b = add(wall.b, mul(dir, wall.thickness / 2));
    return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
  }

  private drawWall(wall: Wall, th: Theme, selected: boolean, snapped: boolean): void {
    const { ctx } = this;
    const q = this.wallQuad(wall);
    ctx.beginPath();
    q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = selected ? th.mark : snapped ? th.accent : th.wall;
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = th.wall;
      ctx.lineWidth = 1.5 / this.cam.zoom;
      ctx.stroke();
    }
  }

  private drawOpening(o: Opening, th: Theme, selected: boolean): void {
    const wall = this.editor.model.get(o.wallId);
    if (wall?.type !== 'wall') return;
    const c = clampOpeningOffset(o, wall.length);
    if (c === null) return;
    this.paintOpening(wall, o.kind, c, o.width, th, selected, false);
  }

  private paintOpening(
    wall: Wall,
    kind: OpeningKind,
    c: number,
    width: number,
    th: Theme,
    selected: boolean,
    ghost: boolean,
  ): void {
    const { ctx } = this;
    const z = this.cam.zoom;
    const t = wall.thickness;
    const x0 = c - width / 2;
    ctx.save();
    ctx.translate(wall.a.x, wall.a.y);
    ctx.rotate(Math.atan2(wall.direction.y, wall.direction.x));
    if (ghost) ctx.globalAlpha = 0.6;
    ctx.fillStyle = th.paper;
    ctx.fillRect(x0, -t / 2 - 0.004, width, t + 0.008);
    ctx.strokeStyle = th.stroke;
    ctx.lineWidth = 1.2 / z;
    if (kind === 'door') {
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, width);
      ctx.stroke();
      ctx.beginPath();
      ctx.setLineDash([4 / z, 3 / z]);
      ctx.arc(x0, 0, width, 0, Math.PI / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = 'rgba(120,180,230,0.35)';
      ctx.fillRect(x0, -t * 0.3, width, t * 0.6);
      ctx.strokeRect(x0, -t * 0.3, width, t * 0.6);
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + width, 0);
      ctx.stroke();
    }
    if (selected) {
      ctx.strokeStyle = th.mark;
      ctx.lineWidth = 3 / z;
      ctx.strokeRect(x0, -t / 2 - 0.03, width, t + 0.06);
    }
    ctx.restore();
  }

  private drawDrafts(th: Theme): void {
    const { ctx } = this;
    const z = this.cam.zoom;
    ctx.lineWidth = 2 / z;
    ctx.strokeStyle = th.accent;
    if (this.wallStart && this.cursorSnap) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 0.15;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(this.wallStart.x, this.wallStart.y);
      ctx.lineTo(this.cursorSnap.x, this.cursorSnap.y);
      ctx.stroke();
      ctx.restore();
    }
    const d = this.drag;
    if (d?.kind === 'room') {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = th.accent;
      ctx.fillRect(d.start.x, d.start.y, d.current.x - d.start.x, d.current.y - d.start.y);
      ctx.globalAlpha = 1;
      ctx.setLineDash([8 / z, 5 / z]);
      ctx.strokeRect(d.start.x, d.start.y, d.current.x - d.start.x, d.current.y - d.start.y);
      ctx.restore();
    }
    if (this.measure) {
      const b = this.measure.b ?? this.cursorSnap;
      if (b) {
        ctx.beginPath();
        ctx.moveTo(this.measure.a.x, this.measure.a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    if (this.ghost) {
      const wall = this.editor.model.get(this.ghost.wallId);
      if (wall?.type === 'wall')
        this.paintOpening(wall, this.ghost.kind, this.ghost.offset, this.ghost.width, th, false, true);
    }
  }

  private chip(text: string, x: number, y: number, th: Theme, bold = false): void {
    const { ctx } = this;
    ctx.font = `${bold ? 600 : 500} 11px "IBM Plex Mono", ui-monospace, monospace`;
    const tw = ctx.measureText(text).width;
    roundedRect(ctx, x - tw / 2 - 6, y - 9, tw + 12, 18, 4);
    ctx.fillStyle = th.chip;
    ctx.fill();
    ctx.strokeStyle = th.gridMajor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = th.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
  }

  private drawLabels(th: Theme, sel: AnyEntity | undefined): void {
    const { ctx } = this;
    const z = this.cam.zoom;
    const model = this.editor.model;
    if (z >= 25) {
      for (const r of model.rooms) {
        const bb = boundsOf(r.points);
        if (!bb) continue;
        const c = this.worldToScreen(bb.min);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = th.text;
        ctx.strokeStyle = th.paper;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.font = '600 13px "IBM Plex Sans", system-ui, sans-serif';
        ctx.strokeText(r.name, c.x + 12, c.y + 24);
        ctx.fillText(r.name, c.x + 12, c.y + 24);
        ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
        ctx.strokeText(`${r.area.toFixed(1)} m²`, c.x + 12, c.y + 40);
        ctx.fillText(`${r.area.toFixed(1)} m²`, c.x + 12, c.y + 40);
      }
    }
    if (this.settings.showDimensions && z >= 30) {
      const b = boundsOf(model.walls.flatMap((w) => [w.a, w.b]));
      const centroid = b ? lerp(b.min, b.max, 0.5) : { x: 0, y: 0 };
      for (const wall of model.walls) {
        if (wall.length * z < 60) continue;
        let n = perp(wall.direction);
        if (dot(n, sub(wall.midpoint, centroid)) < 0) n = mul(n, -1);
        const p = this.worldToScreen(add(wall.midpoint, mul(n, wall.thickness / 2 + 0.28)));
        this.chip(wall.length.toFixed(2), p.x, p.y, th);
      }
    }
    if (sel?.type === 'furniture') {
      const p = this.worldToScreen(sel.position);
      this.chip(
        `${sel.width.toFixed(2)} × ${sel.depth.toFixed(2)}`,
        p.x,
        p.y + Math.max(sel.width, sel.depth) * z * 0.5 + 22,
        th,
        true,
      );
    }
    if (this.wallStart && this.cursorSnap) {
      const a = this.worldToScreen(this.wallStart);
      const bp = this.worldToScreen(this.cursorSnap);
      const deg = normalizeAngle(
        radToDeg(Math.atan2(this.cursorSnap.y - this.wallStart.y, this.cursorSnap.x - this.wallStart.x)),
      );
      this.chip(
        `${formatMeters(distance(this.wallStart, this.cursorSnap))}  ${deg.toFixed(0)}°`,
        (a.x + bp.x) / 2,
        (a.y + bp.y) / 2 - 18,
        th,
        true,
      );
    }
    const d = this.drag;
    if (d?.kind === 'room') {
      const c = this.worldToScreen({ x: (d.start.x + d.current.x) / 2, y: (d.start.y + d.current.y) / 2 });
      const rw = Math.abs(d.current.x - d.start.x);
      const rh = Math.abs(d.current.y - d.start.y);
      this.chip(`${rw.toFixed(2)} × ${rh.toFixed(2)} m  =  ${(rw * rh).toFixed(1)} m²`, c.x, c.y, th, true);
    }
    if (this.measure) {
      const b = this.measure.b ?? this.cursorSnap;
      if (b) {
        const a = this.worldToScreen(this.measure.a);
        const bp = this.worldToScreen(b);
        for (const p of [a, bp]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = th.accent;
          ctx.fill();
        }
        this.chip(
          formatMeters(distance(this.measure.a, b)),
          (a.x + bp.x) / 2,
          (a.y + bp.y) / 2 - 16,
          th,
          true,
        );
      }
    }
  }

  private drawHandles(th: Theme, sel: AnyEntity | undefined): void {
    const { ctx } = this;
    if (!sel || this.settings.tool !== 'select') return;
    const dot2 = (p: Vec2, square: boolean) => {
      ctx.beginPath();
      if (square) ctx.rect(p.x - HANDLE_R + 1, p.y - HANDLE_R + 1, (HANDLE_R - 1) * 2, (HANDLE_R - 1) * 2);
      else ctx.arc(p.x, p.y, HANDLE_R, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = th.wall;
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    if (sel.type === 'furniture') {
      const h = this.furnitureHandles(sel);
      const top = this.worldToScreen(add(sel.position, rotate({ x: 0, y: -sel.depth / 2 }, sel.rotation)));
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(h.rotate.x, h.rotate.y);
      ctx.strokeStyle = th.wall;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      h.corners.forEach((c) => dot2(c, true));
      dot2(h.rotate, false);
    } else if (sel.type === 'wall') {
      dot2(this.worldToScreen(sel.a), false);
      dot2(this.worldToScreen(sel.b), false);
    }
  }
}
