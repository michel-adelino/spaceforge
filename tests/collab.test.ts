import { SceneModel } from '../src/core/SceneModel';
import { CollaborationService } from '../src/services/CollaborationService';
import { Message, Transport } from '../src/services/transports';
import { createDemoProject } from '../src/domain/demo';
import { Furniture } from '../src/domain/Furniture';

/** In-memory "network": every message goes to every other transport. */
class Hub {
  private members: MemoryTransport[] = [];
  join(): MemoryTransport {
    const t = new MemoryTransport(this);
    this.members.push(t);
    return t;
  }
  broadcast(from: MemoryTransport, msg: Message) {
    for (const m of this.members) if (m !== from) m.deliver(JSON.parse(JSON.stringify(msg)));
  }
}
class MemoryTransport implements Transport {
  private cb: (m: Message) => void = () => undefined;
  constructor(private hub: Hub) {}
  send(m: Message) {
    this.hub.broadcast(this, m);
  }
  onMessage(cb: (m: Message) => void) {
    this.cb = cb;
  }
  deliver(m: Message) {
    this.cb(m);
  }
  close() {
    /* noop */
  }
}

function pair() {
  jest.useFakeTimers();
  const hub = new Hub();
  const a = new SceneModel();
  a.load(createDemoProject());
  const b = new SceneModel();
  const ca = new CollaborationService(a);
  const cb = new CollaborationService(b);
  ca.connect(hub.join(), 'a');
  jest.advanceTimersByTime(5);
  cb.connect(hub.join(), 'b'); // joins later → receives a snapshot from a
  return { a, b, ca, cb };
}

afterEach(() => jest.useRealTimers());

describe('collaboration', () => {
  it('a late joiner receives the existing project', () => {
    const { a, b } = pair();
    expect(b.toJSON()).toEqual(a.toJSON());
  });

  it('propagates edits and logs activity without echoing', () => {
    const { a, b, ca, cb } = pair();
    const sofa = a.furniture.find((f) => f.kind === 'sofa')!;
    a.update(sofa.id, { position: { x: 4, y: 4 } });
    ca.flush();
    expect((b.get(sofa.id) as Furniture).position).toEqual({ x: 4, y: 4 });
    expect(cb.activity[0].text).toBe('moved Sofa');
    // the remote update must not be re-sent
    cb.flush();
    expect(ca.activity).toHaveLength(0);
  });

  it('propagates adds and deletes', () => {
    const { a, b, ca } = pair();
    const f = Furniture.create('plant', { x: 1, y: 1 });
    a.add(f);
    ca.flush();
    expect(b.get(f.id)).toBeDefined();
    a.remove(f.id);
    ca.flush();
    expect(b.get(f.id)).toBeUndefined();
  });

  it('tracks presence', () => {
    const { ca, cb } = pair();
    expect(ca.peerList.map((p) => p.id)).toContain(cb.me.id);
    cb.disconnect();
    expect(ca.peerList).toHaveLength(0);
  });

  it('simulated teammate goes through the same path', () => {
    const { b, cb } = pair();
    const before = JSON.stringify(b.toJSON());
    cb.setSimulated(true);
    jest.advanceTimersByTime(8000);
    expect(JSON.stringify(b.toJSON())).not.toBe(before);
    expect(cb.activity.some((x) => x.user === 'Alex')).toBe(true);
    cb.setSimulated(false);
  });
});
