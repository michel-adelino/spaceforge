import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SceneChange } from '../core/SceneModel';
import { boundsOf, degToRad, dot, mul, normalizeAngle, perp, radToDeg, sub } from '../core/geometry';
import { getCatalogItem } from '../domain/catalog';
import { Furniture } from '../domain/Furniture';
import { AnyEntity } from '../domain/factory';
import { Editor, Transaction } from '../editor/Editor';
import { DND_MIME, View3DSettings } from '../editor/types';
import { applyMaterial, createFurnitureNode } from './FurnitureFactory';
import { buildRoomGroup, buildWallGroup, disposeGroup } from './builders';
import { lampShadeMaterial } from './materials';
import { modelLibrary } from './ModelLibrary';

export interface ThreeViewOptions {
  /** Interactive views can select and transform objects; the landing-page preview cannot. */
  interactive: boolean;
  autoRotate?: boolean;
}
export interface ViewStats {
  fps: number;
  vertices: number;
  triangles: number;
  drawCalls: number;
}

const LOWERED = 0.05;

/**
 * Pure Three.js renderer of the SceneModel. It owns the Scene / Camera / Renderer / Raycaster / lights,
 * keeps one node per entity and never stores authoritative data — every change flows model → view.
 */
export class ThreeView {
  static isSupported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);
  private readonly orbit: OrbitControls;
  private transform: TransformControls | null = null;
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0xb8b0a4, 0.5);
  private readonly sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  private readonly ground: THREE.Mesh;
  private readonly root = new THREE.Group();
  private readonly furniture = new Map<string, THREE.Group>();
  private readonly walls = new Map<string, THREE.Group>();
  private readonly rooms = new Map<string, THREE.Group>();
  private readonly wallScale = new Map<string, number>();
  private readonly dirtyWalls = new Set<string>();
  private readonly dirtyRooms = new Set<string>();
  private highlight: THREE.BoxHelper | null = null;
  private tx: Transaction | null = null;
  private txId: string | null = null;
  private downAt: { x: number; y: number } | null = null;
  private suppressPick = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubs: Array<() => void> = [];
  private settings: View3DSettings = {
    daylight: 'day',
    wallMode: 'auto',
    shadows: true,
    gizmo: 'translate',
    snapGrid: true,
  };
  private visible = true;
  private raf = 0;
  private disposed = false;
  private sized = false;
  private frames = 0;
  private lastFpsAt = performance.now();
  private fps = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly editor: Editor,
    private readonly opts: ThreeViewOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const dom = this.renderer.domElement;
    dom.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none';
    container.appendChild(dom);

    // Lighting + environment.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(this.hemi);
    this.sun.position.set(7, 12, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 12;
    Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 40 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(70, 64),
      new THREE.MeshStandardMaterial({ color: 0xd7dde4, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    this.ground.receiveShadow = true;
    this.ground.raycast = () => undefined;
    this.scene.add(this.ground, this.root);

    this.orbit = new OrbitControls(this.camera, dom);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.02;
    this.orbit.minDistance = 2;
    this.orbit.maxDistance = 60;
    if (opts.autoRotate) {
      this.orbit.autoRotate = true;
      this.orbit.autoRotateSpeed = 0.7;
    }
    if (!opts.interactive) {
      this.orbit.enableZoom = false;
      this.orbit.enablePan = false;
    }

    if (opts.interactive) this.setupInteraction(dom);

    this.applyDaylight();
    this.rebuildAll();
    this.resize();
    this.fit();

    this.unsubs.push(editor.model.bus.on('change', this.onChange));
    this.unsubs.push(editor.viewBus.on('fit', () => this.fit()));
    // Real models load asynchronously; swap them in as they arrive (or when one is rotated).
    this.unsubs.push(modelLibrary.subscribe(() => this.refreshFurniture()));
    void modelLibrary.ensureLoaded();
    if (opts.interactive) this.unsubs.push(editor.selection.subscribe(() => this.syncSelection()));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---- public API -----------------------------------------------------------------------------

  setSettings(patch: Partial<View3DSettings>): void {
    const prev = this.settings;
    this.settings = { ...prev, ...patch };
    if (patch.daylight && patch.daylight !== prev.daylight) this.applyDaylight();
    if (patch.shadows !== undefined) this.sun.castShadow = patch.shadows;
    if (patch.gizmo && patch.gizmo !== prev.gizmo) this.applyGizmoMode();
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (v) this.resize();
  }

  getStats(): ViewStats {
    let vertices = 0;
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh)
        vertices += (o.geometry as THREE.BufferGeometry).attributes.position?.count ?? 0;
    });
    const info = this.renderer.info.render;
    return { fps: this.fps, vertices, triangles: info.triangles, drawCalls: info.calls };
  }

  /** Frame the whole plan. */
  fit(): void {
    const pts = [
      ...this.editor.model.walls.flatMap((w) => [w.a, w.b]),
      ...this.editor.model.furniture.map((f) => f.position),
    ];
    const b = boundsOf(pts) ?? { min: { x: 0, y: 0 }, max: { x: 6, y: 5 } };
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.y + b.max.y) / 2;
    const w = b.max.x - b.min.x;
    const d = b.max.y - b.min.y;
    const radius = Math.max(Math.hypot(w, d) / 2, 2);
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    // Narrow panes (split layout, phones) need more breathing room than wide ones.
    const k = this.camera.aspect < 0.9 ? 1.05 : this.camera.aspect < 1.3 ? 0.9 : 0.8;
    const dist = (radius * k) / Math.tan(Math.min(vfov, hfov) / 2) + 1.5;
    this.orbit.target.set(cx, 0.6, cz);
    this.camera.position.set(cx + dist * 0.45, dist * 0.6, cz + dist * 0.66);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx + 7, 12, cz + 5);
    this.orbit.update();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.unsubs.forEach((u) => u());
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('dragover', this.onDragOver);
    dom.removeEventListener('drop', this.onDrop);
    this.transform?.dispose();
    this.orbit.dispose();
    this.walls.forEach(disposeGroup);
    this.rooms.forEach(disposeGroup);
    this.ground.geometry.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    dom.remove();
  }

  // ---- model → scene --------------------------------------------------------------------------

  private onChange = (c: SceneChange): void => {
    switch (c.kind) {
      case 'reset':
        this.rebuildAll();
        break;
      case 'added':
        this.addEntity(c.entity);
        break;
      case 'removed':
        this.removeEntity(c.entity);
        break;
      case 'updated':
        this.updateEntity(c.entity, c.keys);
        break;
    }
  };

  private rebuildAll(): void {
    for (const map of [this.furniture, this.walls, this.rooms]) {
      map.forEach((n) => {
        this.root.remove(n);
        disposeGroup(n);
      });
      map.clear();
    }
    this.dirtyWalls.clear();
    this.dirtyRooms.clear();
    this.wallScale.clear();
    const m = this.editor.model;
    m.walls.forEach((w) => this.dirtyWalls.add(w.id));
    m.rooms.forEach((r) => this.dirtyRooms.add(r.id));
    m.furniture.forEach((f) => this.addFurniture(f));
    this.flushDirty();
    if (this.opts.interactive) this.syncSelection();
  }

  private refreshFurniture(): void {
    this.furniture.forEach((n) => this.root.remove(n));
    this.furniture.clear();
    this.model.furniture.forEach((f) => this.addFurniture(f));
    if (this.opts.interactive) this.syncSelection();
  }

  private addEntity(e: AnyEntity): void {
    switch (e.type) {
      case 'furniture':
        this.addFurniture(e);
        break;
      case 'wall':
        this.dirtyWalls.add(e.id);
        break;
      case 'opening':
        this.dirtyWalls.add(e.wallId);
        break;
      case 'room':
        this.dirtyRooms.add(e.id);
        break;
    }
  }

  private removeEntity(e: AnyEntity): void {
    switch (e.type) {
      case 'furniture': {
        const n = this.furniture.get(e.id);
        if (n) this.root.remove(n);
        this.furniture.delete(e.id);
        break;
      }
      case 'wall':
        this.dirtyWalls.add(e.id);
        this.wallScale.delete(e.id);
        break;
      case 'opening':
        this.dirtyWalls.add(e.wallId);
        break;
      case 'room':
        this.dirtyRooms.add(e.id);
        break;
    }
  }

  private updateEntity(e: AnyEntity, keys: string[]): void {
    switch (e.type) {
      case 'furniture': {
        const n = this.furniture.get(e.id);
        if (!n) break;
        this.applyTransform(n, e);
        if (keys.includes('material')) applyMaterial(n, e.material);
        break;
      }
      case 'wall':
        this.dirtyWalls.add(e.id);
        if (keys.includes('height')) this.model.rooms.forEach((r) => this.dirtyRooms.add(r.id));
        break;
      case 'opening':
        this.dirtyWalls.add(e.wallId);
        break;
      case 'room':
        this.dirtyRooms.add(e.id);
        break;
    }
  }

  private get model() {
    return this.editor.model;
  }

  private addFurniture(f: Furniture): void {
    const node = createFurnitureNode(f.kind, f.material);
    node.userData.entityId = f.id;
    node.traverse((o) => (o.userData.entityId = f.id));
    this.applyTransform(node, f);
    this.applyLampState(node);
    this.furniture.set(f.id, node);
    this.root.add(node);
  }

  private applyTransform(node: THREE.Group, f: Furniture): void {
    const item = getCatalogItem(f.kind);
    node.position.set(f.position.x, f.elevation, f.position.y);
    node.rotation.set(0, -degToRad(f.rotation), 0);
    node.scale.set(f.width / item.width, f.height / item.height, f.depth / item.depth);
  }

  /** Walls and floors are rebuilt lazily, once per frame, however many edits arrived. */
  private flushDirty(): void {
    if (this.dirtyWalls.size === 0 && this.dirtyRooms.size === 0) return;
    const ceiling = Math.max(2.4, ...this.model.walls.map((w) => w.height));
    for (const id of this.dirtyWalls) {
      const old = this.walls.get(id);
      if (old) {
        this.root.remove(old);
        disposeGroup(old);
        this.walls.delete(id);
      }
      const wall = this.model.get(id);
      if (wall?.type === 'wall') {
        const g = buildWallGroup(wall, this.model.openingsOf(id));
        g.scale.y = this.wallScale.get(id) ?? 1;
        this.walls.set(id, g);
        this.root.add(g);
      }
    }
    for (const id of this.dirtyRooms) {
      const old = this.rooms.get(id);
      if (old) {
        this.root.remove(old);
        disposeGroup(old);
        this.rooms.delete(id);
      }
      const room = this.model.get(id);
      if (room?.type === 'room') {
        const g = buildRoomGroup(room, ceiling);
        this.rooms.set(id, g);
        this.root.add(g);
      }
    }
    this.dirtyWalls.clear();
    this.dirtyRooms.clear();
    if (this.opts.interactive) this.syncSelection();
  }

  // ---- lighting -------------------------------------------------------------------------------

  private applyDaylight(): void {
    const day = this.settings.daylight === 'day';
    this.scene.background = new THREE.Color(day ? 0xe6edf4 : 0x0b0f1a);
    this.hemi.intensity = day ? 0.5 : 0.05;
    this.sun.intensity = day ? 2.4 : 0.12;
    this.sun.color.set(day ? 0xfff1dc : 0x8fa8ff);
    this.scene.environmentIntensity = day ? 0.55 : 0.05;
    (this.ground.material as THREE.MeshStandardMaterial).color.set(day ? 0xd7dde4 : 0x151a26);
    this.renderer.toneMappingExposure = day ? 1 : 1.25;
    lampShadeMaterial.emissiveIntensity = day ? 0 : 1.3;
    this.furniture.forEach((n) => this.applyLampState(n));
  }

  private applyLampState(node: THREE.Object3D): void {
    const day = this.settings.daylight === 'day';
    node.traverse((o) => {
      if (o instanceof THREE.PointLight) o.intensity = day ? 0 : 9;
    });
  }

  // ---- interaction ----------------------------------------------------------------------------

  private setupInteraction(dom: HTMLCanvasElement): void {
    const tc = new TransformControls(this.camera, dom);
    tc.setSize(0.75);
    this.scene.add(tc.getHelper());
    tc.addEventListener('dragging-changed', (e) => {
      const dragging = (e as unknown as { value: boolean }).value;
      this.orbit.enabled = !dragging;
      const id = (tc.object as THREE.Object3D | undefined)?.userData.entityId as string | undefined;
      if (dragging && id) {
        this.tx = this.editor.beginTransaction([id]);
        this.txId = id;
        this.suppressPick = true;
      } else if (!dragging && this.tx) {
        const e2 = this.txId ? this.model.get(this.txId) : undefined;
        const name = e2 ? this.editor.labelOf(e2) : 'object';
        const verb = { translate: 'Move', rotate: 'Rotate', scale: 'Resize' }[this.settings.gizmo];
        this.tx.commit(`${verb} ${name}`);
        this.tx = null;
        this.txId = null;
      }
    });
    tc.addEventListener('objectChange', this.onObjectChange);
    this.transform = tc;
    this.applyGizmoMode();
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('dragover', this.onDragOver);
    dom.addEventListener('drop', this.onDrop);
  }

  private applyGizmoMode(): void {
    const tc = this.transform;
    if (!tc) return;
    const mode = this.settings.gizmo;
    tc.setMode(mode);
    tc.showX = mode !== 'rotate';
    tc.showY = mode !== 'translate';
    tc.showZ = mode !== 'rotate';
    tc.setSpace('local');
    if (mode === 'translate') tc.setSpace('world');
    tc.setRotationSnap(mode === 'rotate' ? degToRad(15) : null);
  }

  private onObjectChange = (): void => {
    const node = this.transform?.object as THREE.Object3D | undefined;
    const id = node?.userData.entityId as string | undefined;
    const f = id ? this.model.get(id) : undefined;
    if (!node || !id || f?.type !== 'furniture') return;
    const item = getCatalogItem(f.kind);
    const mode = this.settings.gizmo;
    if (mode === 'translate') {
      const snap = this.editor.snapFurniture(
        { width: f.width, depth: f.depth, wallSnap: item.wallSnap },
        { x: node.position.x, y: node.position.z },
      );
      const patch: Record<string, unknown> = { position: snap.position };
      if (snap.rotation !== undefined) patch.rotation = snap.rotation;
      this.editor.updateLive(id, patch);
    } else if (mode === 'rotate') {
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion);
      this.editor.updateLive(id, { rotation: normalizeAngle(-radToDeg(Math.atan2(dir.x, dir.z))) });
    } else {
      const clampSize = (v: number) => Math.max(0.05, Math.round(v * 100) / 100);
      this.editor.updateLive(id, {
        width: clampSize(item.width * node.scale.x),
        height: clampSize(item.height * node.scale.y),
        depth: clampSize(item.depth * node.scale.z),
      });
    }
    // Re-apply the (possibly snapped) model state to the node the gizmo is holding.
    const cur = this.model.get(id);
    if (cur?.type === 'furniture') this.applyTransform(node as THREE.Group, cur);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.downAt = { x: e.clientX, y: e.clientY };
    this.suppressPick = !!this.transform?.axis;
  };

  private onPointerUp = (e: PointerEvent): void => {
    const d = this.downAt;
    this.downAt = null;
    if (!d || e.button !== 0) return;
    if (this.suppressPick || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) {
      this.suppressPick = false;
      return;
    }
    this.editor.selection.select(this.pick(e));
  };

  private setRay(clientX: number, clientY: number): void {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  private pick(e: PointerEvent): string | null {
    this.setRay(e.clientX, e.clientY);
    const hits = this.raycaster.intersectObjects(
      [...this.furniture.values(), ...this.walls.values(), ...this.rooms.values()],
      true,
    );
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const id = o.userData.entityId as string | undefined;
        if (id) return id;
        o = o.parent;
      }
    }
    return null;
  }

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
    this.setRay(e.clientX, e.clientY);
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, p))
      this.editor.addFurniture(kind as never, { x: p.x, y: p.z });
  };

  private findNode(id: string): THREE.Object3D | null {
    const direct = this.furniture.get(id) ?? this.walls.get(id) ?? this.rooms.get(id);
    if (direct) return direct;
    let found: THREE.Object3D | null = null;
    this.walls.forEach((g) => {
      g.traverse((o) => {
        if (!found && o.userData.entityId === id && o.parent === g) found = o;
      });
    });
    return found;
  }

  private syncSelection(): void {
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.dispose();
      this.highlight = null;
    }
    this.transform?.detach();
    const id = this.editor.selection.id;
    const node = id ? this.findNode(id) : null;
    if (!id || !node) return;
    this.highlight = new THREE.BoxHelper(node, 0xffcb05);
    this.scene.add(this.highlight);
    if (this.model.get(id)?.type === 'furniture') {
      this.transform?.attach(node);
      this.applyGizmoMode();
    }
  }

  // ---- frame loop -----------------------------------------------------------------------------

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // A view created while hidden (e.g. the 3D pane in a 2D-only layout) frames the scene on its first real size.
    if (!this.sized) {
      this.sized = true;
      this.fit();
    }
  }

  /** "Dollhouse" behaviour: walls between the camera and the interior are lowered. */
  private updateWallHeights(): void {
    const mode = this.settings.wallMode;
    const walls = this.model.walls;
    if (walls.length === 0) return;
    const b = boundsOf(walls.flatMap((w) => [w.a, w.b]));
    const cam = { x: this.camera.position.x, y: this.camera.position.z };
    const outside =
      !!b &&
      (cam.x < b.min.x - 0.2 || cam.x > b.max.x + 0.2 || cam.y < b.min.y - 0.2 || cam.y > b.max.y + 0.2);
    const centroid = b ? { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 } : { x: 0, y: 0 };
    for (const w of walls) {
      const g = this.walls.get(w.id);
      if (!g) continue;
      let target = 1;
      if (mode === 'down') target = LOWERED;
      else if (mode === 'auto' && outside) {
        const mid = w.midpoint;
        let n = perp(w.direction);
        if (dot(n, sub(mid, centroid)) < 0) n = mul(n, -1);
        if (dot(sub(cam, mid), n) > 0.2) target = LOWERED;
      }
      const cur = g.scale.y;
      const next = Math.abs(cur - target) < 0.01 ? target : cur + (target - cur) * 0.22;
      g.scale.y = next;
      this.wallScale.set(w.id, next);
    }
  }

  private frame = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    if (!this.visible) return;
    this.flushDirty();
    this.updateWallHeights();
    this.orbit.update();
    this.highlight?.update();
    this.renderer.render(this.scene, this.camera);

    const now = performance.now();
    this.frames++;
    if (now - this.lastFpsAt >= 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFpsAt));
      this.frames = 0;
      this.lastFpsAt = now;
    }
  };
}
