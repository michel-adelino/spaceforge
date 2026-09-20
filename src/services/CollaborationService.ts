import { EventBus } from '../core/EventBus';
import { SceneModel } from '../core/SceneModel';
import { AnyEntity, createEntity, EntityData } from '../domain/factory';
import { Furniture } from '../domain/Furniture';
import { EntityType } from '../domain/Entity';
import { newId } from '../core/ids';
import { Message, Op, PeerBasic, Transport } from './transports';

export interface Peer extends PeerBasic {
  status: 'editing' | 'viewing';
  lastSeen: number;
  simulated?: boolean;
}
export interface ActivityItem {
  id: number;
  time: number;
  user: string;
  color: string;
  text: string;
}

const COLORS = ['#e4572e', '#17bebb', '#f5c518', '#7b6cf6', '#3aa76d', '#e06fa7'];
const HEARTBEAT_MS = 2000;
const STALE_MS = 7000;
const EDITING_MS = 3500;

/**
 * Real-time collaboration on top of the scene model.
 *
 *  - Local model changes (origin "local") are coalesced and sent as `upsert` / `remove` ops.
 *  - Incoming ops are applied with origin "remote", so they update both views but are never re-broadcast
 *    and never touch the local undo stack. Conflict policy is last-write-wins per entity.
 *  - The transport is pluggable: BroadcastChannel (other tabs), WebSocket relay, or an in-memory hub in tests.
 */
export class CollaborationService {
  readonly bus = new EventBus<{ peers: undefined; activity: undefined; status: undefined }>();
  readonly me: PeerBasic = {
    id: newId('peer'),
    name: `Guest ${Math.floor(100 + Math.random() * 900)}`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  readonly peers = new Map<string, Peer>();
  activity: ActivityItem[] = [];
  connected = false;
  label = '';

  private transport: Transport | null = null;
  private joinedAt = 0;
  private lastLocalOp = 0;
  private pending = new Map<string, Op>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private simulator: SimulatedPeer | null = null;
  private activityId = 0;
  private readonly unsub: () => void;

  constructor(private readonly model: SceneModel) {
    this.unsub = model.bus.on('change', (c) => {
      if (c.origin !== 'local' || !this.transport) return;
      this.lastLocalOp = Date.now();
      switch (c.kind) {
        case 'added':
        case 'updated':
          this.pending.set(c.entity.id, { k: 'upsert', type: c.entity.type, data: c.entity.toJSON() });
          break;
        case 'removed':
          this.pending.set(c.entity.id, { k: 'remove', id: c.entity.id });
          break;
        case 'reset':
          this.pending.clear();
          this.pending.set('__reset', { k: 'reset', project: model.toJSON() });
          break;
        case 'meta':
          return;
      }
      this.scheduleFlush();
    });
  }

  get peerList(): Peer[] {
    return [...this.peers.values()];
  }
  get isEditing(): boolean {
    return Date.now() - this.lastLocalOp < EDITING_MS;
  }

  setName(name: string): void {
    this.me.name = name.trim() || this.me.name;
    this.bus.emit('peers', undefined);
  }

  connect(transport: Transport, label: string): void {
    this.disconnect(false);
    this.transport = transport;
    this.label = label;
    this.connected = true;
    this.joinedAt = Date.now();
    transport.onMessage((m) => this.handle(m));
    transport.send({ t: 'hello', from: this.me, joinedAt: this.joinedAt });
    this.heartbeat = setInterval(() => this.tick(), HEARTBEAT_MS);
    this.bus.emit('status', undefined);
  }

  disconnect(notify = true): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.transport) {
      this.transport.send({ t: 'bye', from: this.me });
      this.transport.close();
    }
    this.transport = null;
    this.connected = false;
    this.pending.clear();
    for (const [id, p] of this.peers) if (!p.simulated) this.peers.delete(id);
    if (notify) {
      this.bus.emit('peers', undefined);
      this.bus.emit('status', undefined);
    }
  }

  dispose(): void {
    this.unsub();
    this.setSimulated(false);
    this.disconnect(false);
  }

  /** Sends everything queued right now (also used by tests). */
  flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.transport || this.pending.size === 0) return;
    const ops = [...this.pending.values()];
    this.pending.clear();
    this.transport.send({ t: 'op', from: this.me, ops });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), 40);
  }

  private tick(): void {
    this.transport?.send({ t: 'presence', from: this.me, editing: this.isEditing });
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.peers) {
      if (!p.simulated && now - p.lastSeen > STALE_MS) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) this.bus.emit('peers', undefined);
  }

  // ---- incoming -------------------------------------------------------------------------------

  handle(msg: Message): void {
    if (msg.from.id === this.me.id) return;
    switch (msg.t) {
      case 'hello':
        this.touchPeer(msg.from, false);
        this.transport?.send({ t: 'presence', from: this.me, editing: this.isEditing });
        // The older session is the source of truth for a newcomer.
        if (this.joinedAt < msg.joinedAt)
          this.transport?.send({
            t: 'snapshot',
            from: this.me,
            to: msg.from.id,
            project: this.model.toJSON(),
          });
        break;
      case 'presence':
        this.touchPeer(msg.from, msg.editing);
        break;
      case 'op':
        this.touchPeer(msg.from, true);
        for (const op of msg.ops) this.applyOp(msg.from, op);
        break;
      case 'snapshot':
        if (msg.to === this.me.id) {
          this.model.load(msg.project, 'remote');
          this.log(msg.from, 'shared the current project with you');
        }
        break;
      case 'bye':
        this.peers.delete(msg.from.id);
        this.bus.emit('peers', undefined);
        break;
    }
  }

  private touchPeer(p: PeerBasic, editing: boolean): void {
    const prev = this.peers.get(p.id);
    const status: Peer['status'] = editing ? 'editing' : 'viewing';
    this.peers.set(p.id, { ...p, status, lastSeen: Date.now(), simulated: prev?.simulated });
    if (!prev || prev.status !== status || prev.name !== p.name) this.bus.emit('peers', undefined);
  }

  private applyOp(from: PeerBasic, op: Op): void {
    switch (op.k) {
      case 'reset':
        this.model.load(op.project, 'remote');
        this.log(from, 'opened another project');
        break;
      case 'remove': {
        const e = this.model.get(op.id);
        if (e) {
          this.model.remove(op.id, 'remote');
          this.log(from, `deleted ${this.describe(e)}`);
        }
        break;
      }
      case 'upsert': {
        const existing = this.model.get(op.data.id);
        if (existing) {
          const verb = this.verbFor(existing, op.data);
          this.model.update(op.data.id, op.data as unknown as Record<string, unknown>, 'remote');
          this.log(from, `${verb} ${this.describe(existing)}`);
        } else {
          const e = createEntity(op.type as EntityType, op.data);
          this.model.add(e, 'remote');
          this.log(from, `added ${this.describe(e)}`);
        }
        break;
      }
    }
  }

  private describe(e: AnyEntity): string {
    switch (e.type) {
      case 'furniture':
        return e.name;
      case 'room':
        return e.name;
      case 'wall':
        return 'a wall';
      case 'opening':
        return e.kind === 'door' ? 'a door' : 'a window';
    }
  }

  private verbFor(existing: AnyEntity, next: EntityData): string {
    const a = existing.toJSON() as unknown as Record<string, unknown>;
    const b = next as unknown as Record<string, unknown>;
    const changed = (k: string) => k in b && JSON.stringify(a[k]) !== JSON.stringify(b[k]);
    if (changed('position') || changed('a') || changed('b') || changed('offset')) return 'moved';
    if (changed('rotation')) return 'rotated';
    if (changed('material')) return 'repainted';
    if (changed('width') || changed('depth') || changed('height') || changed('thickness')) return 'resized';
    return 'edited';
  }

  private log(user: PeerBasic, text: string): void {
    const now = Date.now();
    const last = this.activity[0];
    if (last && last.user === user.name && last.text === text && now - last.time < 2500) {
      last.time = now;
      return;
    }
    this.activity = [
      { id: ++this.activityId, time: now, user: user.name, color: user.color, text },
      ...this.activity,
    ].slice(0, 30);
    this.bus.emit('activity', undefined);
  }

  // ---- simulated teammate ---------------------------------------------------------------------

  get simulating(): boolean {
    return this.simulator !== null;
  }

  /** A scripted teammate that moves furniture through the exact same code path as a real remote peer. */
  setSimulated(on: boolean): void {
    if (on && !this.simulator) {
      this.simulator = new SimulatedPeer(this.model, (m) => this.handle(m));
      this.simulator.start();
      this.peers.set(this.simulator.info.id, {
        ...this.simulator.info,
        status: 'viewing',
        lastSeen: Date.now(),
        simulated: true,
      });
    } else if (!on && this.simulator) {
      const id = this.simulator.info.id;
      this.simulator.stop();
      this.simulator = null;
      this.peers.delete(id);
    }
    this.bus.emit('peers', undefined);
    this.bus.emit('status', undefined);
  }
}

class SimulatedPeer {
  readonly info: PeerBasic = { id: 'sim-alex', name: 'Alex', color: '#17bebb' };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private anim: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly model: SceneModel,
    private readonly emit: (m: Message) => void,
  ) {}

  start(): void {
    this.timer = setTimeout(() => this.act(), 1800);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.anim) clearInterval(this.anim);
    this.timer = this.anim = null;
  }

  private send(f: Furniture, patch: Partial<ReturnType<Furniture['toJSON']>>): void {
    this.emit({
      t: 'op',
      from: this.info,
      ops: [{ k: 'upsert', type: 'furniture', data: { ...f.toJSON(), ...patch } }],
    });
  }

  private act(): void {
    const pool = this.model.furniture.filter((f) => f.kind !== 'picture');
    if (pool.length) {
      const f = pool[Math.floor(Math.random() * pool.length)];
      if (Math.random() < 0.3) {
        this.send(f, { rotation: (f.rotation + 90) % 360 });
      } else {
        const from = { ...f.position };
        const to = { x: from.x + (Math.random() - 0.5) * 1.2, y: from.y + (Math.random() - 0.5) * 1.2 };
        let step = 0;
        this.anim = setInterval(() => {
          step++;
          const t = step / 18;
          const cur = this.model.get(f.id);
          if (cur?.type !== 'furniture') return this.finish();
          this.send(cur, { position: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t } });
          if (step >= 18) this.finish();
        }, 35);
      }
    }
    this.timer = setTimeout(() => this.act(), 4000 + Math.random() * 3000);
  }

  private finish(): void {
    if (this.anim) clearInterval(this.anim);
    this.anim = null;
  }
}
