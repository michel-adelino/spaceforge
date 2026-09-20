import { useEffect, useState, useSyncExternalStore } from 'react';
import { Furniture } from '../domain/Furniture';
import { Opening } from '../domain/Opening';
import { Room } from '../domain/Room';
import { Wall } from '../domain/Wall';
import { add, mul } from '../core/geometry';
import { CATALOG, getCatalogItem } from '../domain/catalog';
import { modelLibrary } from '../engine/ModelLibrary';
import { FLOOR_MATERIALS, FURNITURE_MATERIALS, WALL_MATERIALS } from '../domain/materials';
import { BroadcastTransport, WebSocketTransport } from '../services/transports';
import { useApp, useHistoryVersion, useModelVersion, useSelectedEntity } from './appState';
import { Icon } from './Icon';
import { MaterialPicker, NumberField, Section, Segmented, Toggle } from './fields';
import { notify, useUI } from './store';

// ---- Properties ----------------------------------------------------------------------------------

export function PropertiesPanel() {
  const entity = useSelectedEntity();
  if (!entity) return <EmptyProperties />;
  switch (entity.type) {
    case 'furniture':
      return <FurnitureProps f={entity} />;
    case 'wall':
      return <WallProps w={entity} />;
    case 'opening':
      return <OpeningProps o={entity} />;
    case 'room':
      return <RoomProps r={entity} />;
  }
}

function EmptyProperties() {
  const { editor } = useApp();
  useModelVersion();
  const m = editor.model;
  return (
    <Section title="Properties">
      <p className="muted">Select an object in the plan or in 3D to edit its position, size and material.</p>
      <dl className="stats">
        <div>
          <dt>Rooms</dt>
          <dd>{m.rooms.length}</dd>
        </div>
        <div>
          <dt>Walls</dt>
          <dd>{m.walls.length}</dd>
        </div>
        <div>
          <dt>Furniture</dt>
          <dd>{m.furniture.length}</dd>
        </div>
        <div>
          <dt>Doors and windows</dt>
          <dd>{m.openings.length}</dd>
        </div>
        <div>
          <dt>Floor area</dt>
          <dd>{m.rooms.reduce((s, r) => s + r.area, 0).toFixed(1)} m²</dd>
        </div>
      </dl>
    </Section>
  );
}

function Actions({ id, duplicate }: { id: string; duplicate?: boolean }) {
  const { editor } = useApp();
  return (
    <div className="actions">
      {duplicate && (
        <button className="btn" onClick={() => editor.duplicateSelected()}>
          <Icon name="copy" size={15} /> Duplicate
        </button>
      )}
      <button className="btn btn--danger" onClick={() => editor.deleteEntity(id)}>
        <Icon name="trash" size={15} /> Delete
      </button>
    </div>
  );
}

function FurnitureProps({ f }: { f: Furniture }) {
  const { editor } = useApp();
  const item = getCatalogItem(f.kind);
  useModelsVersion();
  const edit = (patch: Record<string, unknown>) => editor.edit(f.id, patch);
  return (
    <Section title={f.name} aside={<span className="tag">{item.category}</span>}>
      <h4>Position</h4>
      <div className="grid2">
        <NumberField
          label="X"
          unit="m"
          value={f.position.x}
          onChange={(x) => edit({ position: { x, y: f.position.y } })}
        />
        <NumberField
          label="Y"
          unit="m"
          value={f.position.y}
          onChange={(y) => edit({ position: { x: f.position.x, y } })}
        />
      </div>
      <h4>Rotation</h4>
      <div className="row">
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={Math.round(f.rotation)}
          onChange={(e) => edit({ rotation: Number(e.target.value) })}
          aria-label="Rotation"
        />
        <NumberField
          label=""
          unit="°"
          step={5}
          min={0}
          max={360}
          value={Math.round(f.rotation)}
          onChange={(rotation) => edit({ rotation: rotation % 360 })}
        />
      </div>
      <h4>Size</h4>
      <div className="grid3">
        <NumberField label="W" unit="m" min={0.05} value={f.width} onChange={(width) => edit({ width })} />
        <NumberField label="D" unit="m" min={0.02} value={f.depth} onChange={(depth) => edit({ depth })} />
        <NumberField label="H" unit="m" min={0.02} value={f.height} onChange={(height) => edit({ height })} />
      </div>
      {f.elevation > 0 && (
        <NumberField
          label="Height above floor"
          unit="m"
          min={0}
          value={f.elevation}
          onChange={(elevation) => edit({ elevation })}
        />
      )}
      {item.paintable && !modelLibrary.has(f.kind) && (
        <>
          <h4>Material</h4>
          <MaterialPicker
            ids={FURNITURE_MATERIALS}
            value={f.material}
            onPick={(material) => edit({ material })}
          />
        </>
      )}
      <Actions id={f.id} duplicate />
    </Section>
  );
}

function WallProps({ w }: { w: Wall }) {
  const { editor } = useApp();
  const edit = (patch: Record<string, unknown>) => editor.edit(w.id, patch);
  return (
    <Section title="Wall">
      <NumberField
        label="Length"
        unit="m"
        min={0.2}
        value={w.length}
        onChange={(len) => edit({ b: add(w.a, mul(w.direction, len)) })}
      />
      <div className="grid2">
        <NumberField
          label="Thickness"
          unit="m"
          min={0.05}
          max={0.6}
          value={w.thickness}
          onChange={(thickness) => edit({ thickness })}
        />
        <NumberField
          label="Height"
          unit="m"
          min={1}
          max={6}
          value={w.height}
          onChange={(height) => edit({ height })}
        />
      </div>
      <h4>Colour</h4>
      <MaterialPicker ids={WALL_MATERIALS} value={w.material} onPick={(material) => edit({ material })} />
      <Actions id={w.id} />
    </Section>
  );
}

function OpeningProps({ o }: { o: Opening }) {
  const { editor } = useApp();
  const edit = (patch: Record<string, unknown>) => editor.edit(o.id, patch);
  const wall = editor.model.get(o.wallId);
  const wallLength = wall?.type === 'wall' ? wall.length : 10;
  return (
    <Section title={o.kind === 'door' ? 'Door' : 'Window'}>
      <NumberField
        label="Position along wall"
        unit="m"
        min={0}
        max={wallLength}
        value={o.offset}
        onChange={(offset) => edit({ offset })}
      />
      <div className="grid2">
        <NumberField
          label="Width"
          unit="m"
          min={0.4}
          max={4}
          value={o.width}
          onChange={(width) => edit({ width })}
        />
        <NumberField
          label="Height"
          unit="m"
          min={0.4}
          max={3}
          value={o.height}
          onChange={(height) => edit({ height })}
        />
      </div>
      {o.kind === 'window' && (
        <NumberField
          label="Sill height"
          unit="m"
          min={0}
          max={2}
          value={o.sill}
          onChange={(sill) => edit({ sill })}
        />
      )}
      <Actions id={o.id} />
    </Section>
  );
}

function RoomProps({ r }: { r: Room }) {
  const { editor } = useApp();
  const edit = (patch: Record<string, unknown>) => editor.edit(r.id, patch);
  return (
    <Section title="Room" aside={<span className="tag">{r.area.toFixed(1)} m²</span>}>
      <label className="field field--text">
        <span>Name</span>
        <input type="text" value={r.name} onChange={(e) => edit({ name: e.target.value })} />
      </label>
      <h4>Floor</h4>
      <MaterialPicker ids={FLOOR_MATERIALS} value={r.material} onPick={(material) => edit({ material })} />
      <Actions id={r.id} />
    </Section>
  );
}

function useModelsVersion(): number {
  return useSyncExternalStore(modelLibrary.subscribe, modelLibrary.getVersion);
}

// ---- 3D models -------------------------------------------------------------------------------------

export function ModelsPanel() {
  useModelsVersion();
  const glbCount = CATALOG.filter((i) => modelLibrary.has(i.kind)).length;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(modelLibrary.exportOverrides());
      notify('models.json copied. Save it as public/models/models.json');
    } catch {
      notify('Could not access the clipboard');
    }
  };
  return (
    <Section
      title="3D models"
      open={false}
      aside={
        <span className="tag">
          {glbCount}/{CATALOG.length} GLB
        </span>
      }
    >
      <p className="muted">
        Put <code>.glb</code> files named after the item (for example <code>sofa.glb</code>) into{' '}
        <code>public/models/</code> and reload. Items without a file use the built-in procedural model.
      </p>
      <ul className="models">
        {CATALOG.map((item) => {
          const st = modelLibrary.getStatus(item.kind);
          return (
            <li key={item.kind}>
              <span
                className={`dot${st.state === 'glb' ? ' dot--on' : st.state === 'error' ? ' dot--err' : ''}`}
              />
              <span className="models__name">
                {item.name}
                <small>
                  {st.state === 'glb' && `${st.file}, ${st.triangles.toLocaleString()} triangles`}
                  {st.state === 'procedural' && `no ${item.kind}.glb, using procedural`}
                  {st.state === 'error' && st.message}
                  {st.state === 'loading' && 'loading'}
                </small>
              </span>
              {st.state === 'glb' && (
                <button
                  className="btn btn--sm"
                  title="Turn the model 90° if its front is facing the wrong way"
                  onClick={() => modelLibrary.rotate(item.kind, 90)}
                >
                  <Icon name="rotate" size={14} /> {modelLibrary.getRotation(item.kind)}°
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {glbCount > 0 && (
        <button className="btn" onClick={copy}>
          <Icon name="copy" size={15} /> Copy models.json
        </button>
      )}
    </Section>
  );
}

// ---- Scene settings --------------------------------------------------------------------------------

export function ScenePanel() {
  const s = useUI();
  return (
    <Section title="Scene">
      <Segmented
        label="Lighting"
        value={s.daylight}
        onChange={(daylight) => useUI.setState({ daylight })}
        options={[
          { value: 'day', label: 'Day', icon: 'sun' },
          { value: 'night', label: 'Night', icon: 'moon' },
        ]}
      />
      <Toggle label="Shadows" checked={s.shadows} onChange={(shadows) => useUI.setState({ shadows })} />
      <Toggle
        label="Snap to grid"
        checked={s.snapGrid}
        onChange={(snapGrid) => useUI.setState({ snapGrid })}
      />
      <Toggle
        label="Snap furniture to walls"
        checked={s.snapWalls}
        onChange={(snapWalls) => useUI.setState({ snapWalls })}
        hint="Hold Alt while dragging to override"
      />
      <Toggle
        label="Wall dimensions"
        checked={s.showDimensions}
        onChange={(showDimensions) => useUI.setState({ showDimensions })}
      />
    </Section>
  );
}

// ---- Collaboration ---------------------------------------------------------------------------------

export function useCollabTick(): void {
  const { collab } = useApp();
  const [, set] = useState(0);
  useEffect(() => {
    const bump = () => set((n) => n + 1);
    const offs = [
      collab.bus.on('peers', bump),
      collab.bus.on('activity', bump),
      collab.bus.on('status', bump),
    ];
    return () => offs.forEach((o) => o());
  }, [collab]);
}

export function CollabPanel() {
  const { collab } = useApp();
  useCollabTick();
  const [url, setUrl] = useState('ws://localhost:8080');
  const hasBC = typeof BroadcastChannel !== 'undefined';

  const connectTabs = () => {
    collab.connect(new BroadcastTransport(), 'Syncing with other tabs of this browser');
  };
  const connectWs = () => {
    try {
      const t = new WebSocketTransport(url, (st) => {
        if (st === 'error') notify('WebSocket connection failed. Is the server running?');
        if (st === 'closed' && collab.connected) collab.disconnect();
      });
      collab.connect(t, `Connected to ${url}`);
    } catch (e) {
      notify(`Cannot open WebSocket: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const peers = collab.peerList;

  return (
    <Section
      title="Collaboration"
      aside={<span className={`dot${collab.connected || collab.simulating ? ' dot--on' : ''}`} />}
    >
      <label className="field field--text">
        <span>Your name</span>
        <input
          type="text"
          defaultValue={collab.me.name}
          onBlur={(e) => collab.setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </label>
      <div className="actions">
        {collab.connected ? (
          <button className="btn" onClick={() => collab.disconnect()}>
            Disconnect
          </button>
        ) : (
          <button
            className="btn btn--primary"
            disabled={!hasBC}
            onClick={connectTabs}
            title="Open this page in a second tab to try it"
          >
            <Icon name="users" size={15} /> Sync tabs
          </button>
        )}
        <button
          className={`btn${collab.simulating ? ' btn--on' : ''}`}
          onClick={() => collab.setSimulated(!collab.simulating)}
        >
          {collab.simulating ? 'Stop Alex' : 'Simulate Alex'}
        </button>
      </div>
      {collab.connected && (
        <p className="muted">{collab.label}. Open another tab to see edits arrive live.</p>
      )}
      {!collab.connected && (
        <p className="muted">Sync edits between tabs, or connect to a WebSocket relay to work with others.</p>
      )}
      <div className="ws">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="WebSocket server URL"
          spellCheck={false}
        />
        <button className="btn" onClick={connectWs} disabled={collab.connected}>
          Connect
        </button>
      </div>

      <h4>Online</h4>
      <ul className="peers">
        <li>
          <span className="dot dot--me" style={{ background: collab.me.color }} />
          {collab.me.name} <em>you, {collab.isEditing ? 'editing' : 'viewing'}</em>
        </li>
        {peers.map((p) => (
          <li key={p.id}>
            <span className="dot" style={{ background: p.color }} />
            {p.name} <em>{p.status}</em>
          </li>
        ))}
        {peers.length === 0 && <li className="muted">Nobody else is here yet.</li>}
      </ul>
      {collab.activity.length > 0 && (
        <>
          <h4>Activity</h4>
          <ul className="activity">
            {collab.activity.slice(0, 6).map((a) => (
              <li key={a.id}>
                <span className="dot" style={{ background: a.color }} />
                <b>{a.user}</b> {a.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

// ---- History ---------------------------------------------------------------------------------------

export function HistoryPanel() {
  const { editor } = useApp();
  useHistoryVersion();
  const entries = editor.history.entries;
  const shown = entries.slice(-40);
  return (
    <Section
      title="History"
      open={false}
      aside={
        <span className="hist-btns" onClick={(e) => e.preventDefault()}>
          <button
            className="icon-btn icon-btn--sm"
            title="Undo (Ctrl+Z)"
            disabled={!editor.history.canUndo}
            onClick={() => editor.undo()}
          >
            <Icon name="undo" size={15} />
          </button>
          <button
            className="icon-btn icon-btn--sm"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!editor.history.canRedo}
            onClick={() => editor.redo()}
          >
            <Icon name="redo" size={15} />
          </button>
        </span>
      }
    >
      {shown.length === 0 ? (
        <p className="muted">Every change you make is listed here and can be undone.</p>
      ) : (
        <ol className="history">
          {shown.map((h, i) => (
            <li key={i} className={h.state === 'undone' ? 'is-undone' : ''}>
              {h.label}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
