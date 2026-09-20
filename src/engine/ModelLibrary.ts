import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CATALOG, CatalogItem, FurnitureKind } from '../domain/catalog';

export interface ModelOptions {
  /** File inside public/models/. Defaults to `<kind>.glb`. */
  file?: string;
  /** Extra rotation (degrees) so the model's front faces +z, the way the procedural furniture does. */
  rotateY?: number;
  /** `stretch` fits the model exactly into the catalog box; `contain` keeps its proportions. */
  fit?: 'stretch' | 'contain';
}

export type ModelState =
  | { state: 'loading' }
  | { state: 'procedural' }
  | { state: 'glb'; file: string; triangles: number; originalSize: [number, number, number] }
  | { state: 'error'; message: string };

const LOCAL_KEY = 'spaceforge:models';
const isGlb = (buf: ArrayBuffer): boolean =>
  buf.byteLength > 12 && new DataView(buf).getUint32(0, true) === 0x46546c67; // "glTF"

function readLocal(): Record<string, ModelOptions> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Record<string, ModelOptions>;
  } catch {
    return {};
  }
}

/**
 * Optional real 3D models. Drop `sofa.glb`, `bed.glb` … into `public/models/` and they replace the procedural
 * furniture automatically; missing files silently fall back to the procedural version.
 *
 * Every model is normalised once: centred on x/z, standing on y = 0 and scaled to the catalog dimensions,
 * so an instance is resized with a plain scale exactly like a procedural one.
 */
class ModelLibrary {
  private readonly templates = new Map<FurnitureKind, THREE.Group>();
  private readonly raw = new Map<FurnitureKind, THREE.Object3D>();
  private readonly options = new Map<FurnitureKind, ModelOptions>();
  private readonly status = new Map<FurnitureKind, ModelState>();
  private readonly listeners = new Set<() => void>();
  private _version = 0;
  private started: Promise<void> | null = null;

  readonly subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };
  readonly getVersion = (): number => this._version;

  get(kind: FurnitureKind): THREE.Group | undefined {
    return this.templates.get(kind);
  }
  has(kind: FurnitureKind): boolean {
    return this.templates.has(kind);
  }
  getStatus(kind: FurnitureKind): ModelState {
    return this.status.get(kind) ?? { state: 'procedural' };
  }
  getRotation(kind: FurnitureKind): number {
    return this.options.get(kind)?.rotateY ?? 0;
  }

  private notify(): void {
    this._version++;
    this.listeners.forEach((l) => l());
  }

  ensureLoaded(): Promise<void> {
    this.started ??= this.loadAll();
    return this.started;
  }

  private async loadAll(): Promise<void> {
    const base = `${import.meta.env.BASE_URL}models/`;
    let fileOverrides: Record<string, ModelOptions> = {};
    try {
      const res = await fetch(`${base}models.json`);
      if (res.ok) fileOverrides = JSON.parse(await res.text()) as Record<string, ModelOptions>;
    } catch {
      /* models.json is optional (and a dev server may answer with index.html) */
    }
    const local = readLocal();

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);

    await Promise.all(
      CATALOG.map(async (item) => {
        const opts: ModelOptions = { ...fileOverrides[item.kind], ...local[item.kind] };
        this.options.set(item.kind, opts);
        const file = opts.file ?? `${item.kind}.glb`;
        try {
          const res = await fetch(base + file);
          if (!res.ok) return this.status.set(item.kind, { state: 'procedural' });
          const buf = await res.arrayBuffer();
          if (!isGlb(buf)) return this.status.set(item.kind, { state: 'procedural' }); // e.g. SPA fallback page
          const gltf = await loader.parseAsync(buf, base);
          this.raw.set(item.kind, gltf.scene);
          this.build(item, file);
        } catch (e) {
          this.status.set(item.kind, { state: 'error', message: e instanceof Error ? e.message : String(e) });
          console.warn(`[models] could not load ${file}:`, e);
        }
      }),
    );
    draco.dispose();
    this.notify();
  }

  private build(item: CatalogItem, file: string): void {
    const raw = this.raw.get(item.kind);
    if (!raw) return;
    const { group, triangles, size } = normalise(raw, item, this.options.get(item.kind) ?? {});
    this.templates.set(item.kind, group);
    this.status.set(item.kind, { state: 'glb', file, triangles, originalSize: size });
  }

  /** Turn a loaded model by `deg` (used by the "Rotate" button; saved in localStorage). */
  rotate(kind: FurnitureKind, deg: number): void {
    const item = CATALOG.find((c) => c.kind === kind);
    const st = this.getStatus(kind);
    if (!item || st.state !== 'glb') return;
    const opts = { ...this.options.get(kind), rotateY: (((this.getRotation(kind) + deg) % 360) + 360) % 360 };
    this.options.set(kind, opts);
    const local = readLocal();
    local[kind] = { ...local[kind], rotateY: opts.rotateY };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
    } catch {
      /* ignore */
    }
    this.build(item, st.file);
    this.notify();
  }

  /** The current tweaks as a `models.json` you can save into public/models/. */
  exportOverrides(): string {
    const out: Record<string, ModelOptions> = {};
    for (const [kind, o] of this.options)
      if (this.has(kind))
        out[kind] = {
          rotateY: o.rotateY ?? 0,
          ...(o.fit ? { fit: o.fit } : {}),
          ...(o.file ? { file: o.file } : {}),
        };
    return JSON.stringify(out, null, 2);
  }
}

function normalise(raw: THREE.Object3D, item: CatalogItem, opts: ModelOptions) {
  const outer = new THREE.Group();
  const scaler = new THREE.Group();
  const turn = new THREE.Group();
  outer.add(scaler);
  scaler.add(turn);
  turn.add(raw);
  turn.rotation.y = THREE.MathUtils.degToRad(opts.rotateY ?? 0);
  outer.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(turn);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const safe = (v: number) => (v > 1e-6 ? v : 1);
  let sx = item.width / safe(size.x);
  let sy = item.height / safe(size.y);
  let sz = item.depth / safe(size.z);
  if (opts.fit === 'contain') sx = sy = sz = Math.min(sx, sy, sz);
  scaler.scale.set(sx, sy, sz);
  scaler.position.set(-center.x * sx, -box.min.y * sy, -center.z * sz);

  let triangles = 0;
  raw.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const g = o.geometry as THREE.BufferGeometry;
      triangles += (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3;
    }
  });

  if (item.kind === 'lamp') {
    const light = new THREE.PointLight(0xffc880, 0, 8, 2);
    light.position.set(0, item.height * 0.88, 0);
    outer.add(light);
  }
  outer.userData.glb = true;
  return {
    group: outer,
    triangles: Math.round(triangles),
    size: [size.x, size.y, size.z] as [number, number, number],
  };
}

export const modelLibrary = new ModelLibrary();
