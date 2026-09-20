import { useEffect, useRef, useState } from 'react';
import { CATALOG, CatalogItem } from '../domain/catalog';
import { getPreset } from '../domain/materials';
import { createDemoProject } from '../domain/demo';
import { parseProject } from '../domain/project';
import { DND_MIME, Tool } from '../editor/types';
import { drawFurnitureSymbol } from '../view2d/symbols';
import { App, saveProject, useApp, useHistoryVersion, useModelVersion } from './appState';
import { Icon, IconName } from './Icon';
import { Segmented } from './fields';
import { CollabPanel, HistoryPanel, ModelsPanel, PropertiesPanel, ScenePanel, useCollabTick } from './panels';
import { notify, selectTool, useUI } from './store';
import { Viewport } from './Viewport';

export function EditorScreen() {
  const drawer = useUI((s) => s.drawer);
  useHotkeys();
  return (
    <div className="editor">
      <TopBar />
      <div className={`editor__body${drawer ? ` has-drawer drawer-${drawer}` : ''}`}>
        <aside className="side side--left" aria-label="Tools and catalog">
          <Toolbar />
          <Catalog />
        </aside>
        <main className="editor__main">
          <Viewport />
        </main>
        <aside className="side side--right" aria-label="Properties and settings">
          <PropertiesPanel />
          <ScenePanel />
          <ModelsPanel />
          <CollabPanel />
          <HistoryPanel />
        </aside>
        {drawer && <div className="scrim" onClick={() => useUI.setState({ drawer: null })} />}
      </div>
      <StatusBar />
      <ProjectDialog />
      <Toast />
    </div>
  );
}

// ---- hotkeys ---------------------------------------------------------------------------------------

const TOOL_KEYS: Record<string, Tool> = {
  '1': 'select',
  '2': 'wall',
  '3': 'room',
  '4': 'door',
  '5': 'window',
  '6': 'measure',
  '7': 'delete',
};

function useHotkeys(): void {
  const app = useApp();
  useEffect(() => {
    const { editor } = app;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === 'TEXTAREA' ||
          el.isContentEditable ||
          (el.tagName === 'INPUT' &&
            !['range', 'checkbox', 'button'].includes((el as HTMLInputElement).type)));
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && k === 'y' && !typing) {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (mod && k === 's') {
        e.preventDefault();
        saveProject(app);
        return;
      }
      if (mod && k === 'd' && !typing) {
        e.preventDefault();
        editor.duplicateSelected();
        return;
      }
      if (mod || typing) return;
      if (TOOL_KEYS[k]) return selectTool(TOOL_KEYS[k]);
      const step = e.shiftKey ? 0.5 : 0.05;
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          editor.deleteSelected();
          break;
        case 'Escape':
          selectTool('select');
          editor.selection.clear();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          editor.nudgeSelected(-step, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          editor.nudgeSelected(step, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          editor.nudgeSelected(0, -step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          editor.nudgeSelected(0, step);
          break;
        default:
          if (k === 'r') editor.rotateSelected(90);
          if (k === 'f') editor.fitViews();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);
}

// ---- top bar ---------------------------------------------------------------------------------------

function TopBar() {
  const app = useApp();
  const { editor, collab } = app;
  useModelVersion();
  useCollabTick();
  const hv = useHistoryVersion();
  const viewMode = useUI((s) => s.viewMode);
  const lastSaved = useUI((s) => s.lastSaved);
  void hv;
  const time = lastSaved
    ? new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const peers = collab.peerList;

  return (
    <header className="topbar">
      <button
        className="topbar__drawer"
        aria-label="Tools and catalog"
        onClick={() => useUI.setState((s) => ({ drawer: s.drawer === 'left' ? null : 'left' }))}
      >
        <Icon name="panelL" />
      </button>
      <button
        className="brand"
        onClick={() => useUI.setState({ screen: 'landing' })}
        title="Back to the overview"
      >
        <Icon name="logo" size={20} />
        <span>SpaceForge</span>
      </button>
      <label className="project-name">
        <span className="sr-only">Project name</span>
        <input
          value={editor.model.name}
          onChange={(e) => editor.renameProject(e.target.value)}
          spellCheck={false}
        />
        <small>{time ? `Saved ${time}` : 'Autosaves in this browser'}</small>
      </label>
      <div className="topbar__group">
        <button
          className="icon-btn"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          disabled={!editor.history.canUndo}
          onClick={() => editor.undo()}
        >
          <Icon name="undo" />
        </button>
        <button
          className="icon-btn"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          disabled={!editor.history.canRedo}
          onClick={() => editor.redo()}
        >
          <Icon name="redo" />
        </button>
      </div>
      <Segmented
        label="View"
        value={viewMode}
        onChange={(v) => useUI.setState({ viewMode: v })}
        options={[
          { value: '2d', label: '2D' },
          { value: 'split', label: 'Split' },
          { value: '3d', label: '3D' },
        ]}
      />
      <div className="topbar__spacer" />
      {(peers.length > 0 || collab.connected) && (
        <div className="avatars" title={`${peers.length + 1} online`}>
          {[collab.me, ...peers].slice(0, 4).map((p) => (
            <span key={p.id} className="avatar" style={{ background: p.color }}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
      )}
      <button className="btn" onClick={() => saveProject(app)} title="Save (Ctrl+S)">
        <Icon name="save" size={16} /> Save
      </button>
      <button className="btn" onClick={() => useUI.setState({ dialog: 'project' })}>
        <Icon name="folder" size={16} /> Project
      </button>
      <button
        className="topbar__drawer"
        aria-label="Properties and settings"
        onClick={() => useUI.setState((s) => ({ drawer: s.drawer === 'right' ? null : 'right' }))}
      >
        <Icon name="panelR" />
      </button>
    </header>
  );
}

// ---- tools + catalog -------------------------------------------------------------------------------

const TOOLS: { tool: Tool; label: string; icon: IconName; key: string }[] = [
  { tool: 'select', label: 'Select', icon: 'select', key: '1' },
  { tool: 'wall', label: 'Wall', icon: 'wall', key: '2' },
  { tool: 'room', label: 'Room', icon: 'room', key: '3' },
  { tool: 'door', label: 'Door', icon: 'door', key: '4' },
  { tool: 'window', label: 'Window', icon: 'window', key: '5' },
  { tool: 'measure', label: 'Measure', icon: 'measure', key: '6' },
  { tool: 'delete', label: 'Delete', icon: 'trash', key: '7' },
];

function Toolbar() {
  const tool = useUI((s) => s.tool);
  return (
    <div className="tools" role="toolbar" aria-label="Tools">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`tool${tool === t.tool ? ' is-on' : ''}`}
          aria-pressed={tool === t.tool}
          title={`${t.label} (${t.key})`}
          onClick={() => selectTool(t.tool)}
        >
          <Icon name={t.icon} size={20} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function CatalogIcon({ item }: { item: CatalogItem }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const size = 56;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const d = item.depth < 0.1 ? item.width * 0.5 : item.depth;
    const k = 42 / Math.max(item.width, d);
    ctx.translate(size / 2, size / 2);
    ctx.scale(k, k);
    drawFurnitureSymbol(
      ctx,
      item.kind,
      item.width,
      d,
      getPreset(item.defaultMaterial).color,
      1.4 / k,
      'rgba(30,34,41,0.75)',
    );
  }, [item]);
  return <canvas ref={ref} width={56} height={56} style={{ width: 56, height: 56 }} aria-hidden="true" />;
}

function Catalog() {
  const app = useApp();
  const [q, setQ] = useState('');
  const groups = (['Furniture', 'Decor'] as const).map((cat) => ({
    cat,
    items: CATALOG.filter((i) => i.category === cat && i.name.toLowerCase().includes(q.trim().toLowerCase())),
  }));

  const place = (item: CatalogItem) => {
    const at = app.views.plan?.centerWorld() ?? { x: 4, y: 3 };
    // Stagger repeated clicks so items don't stack exactly.
    const n = app.editor.model.furniture.filter((f) => f.kind === item.kind).length;
    app.editor.addFurniture(item.kind, { x: at.x + (n % 4) * 0.4, y: at.y + (n % 4) * 0.4 });
    useUI.setState({ tool: 'select', drawer: null });
    notify(`${item.name} added. Drag it to place it.`);
  };

  return (
    <div className="catalog">
      <div className="catalog__head">
        <h3>Catalog</h3>
        <input
          type="search"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search catalog"
        />
      </div>
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.cat}>
              <h4>{g.cat}</h4>
              <div className="catalog__grid">
                {g.items.map((item) => (
                  <button
                    key={item.kind}
                    className="cat-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_MIME, item.kind);
                      e.dataTransfer.setData('text/plain', item.kind);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => place(item)}
                    title={`${item.name}: drag onto the plan or the 3D view, or click to add`}
                  >
                    <CatalogIcon item={item} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ),
      )}
      {groups.every((g) => g.items.length === 0) && <p className="muted">Nothing matches “{q}”.</p>}
    </div>
  );
}

// ---- status bar ------------------------------------------------------------------------------------

const kfmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function StatusBar() {
  const { editor, views } = useApp();
  useModelVersion();
  const viewMode = useUI((s) => s.viewMode);
  const [stats, setStats] = useState({ fps: 0, vertices: 0, triangles: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const s = views.scene?.getStats();
      if (s) setStats({ fps: s.fps, vertices: s.vertices, triangles: s.triangles });
    }, 500);
    return () => clearInterval(id);
  }, [views]);
  const live = viewMode !== '2d' && !!views.scene;
  return (
    <footer className="statusbar">
      <span>
        Objects <b>{editor.model.size}</b>
      </span>
      <span>
        Vertices <b>{live || stats.vertices ? kfmt(stats.vertices) : '—'}</b>
      </span>
      <span>
        Triangles <b>{live || stats.triangles ? kfmt(stats.triangles) : '—'}</b>
      </span>
      <span>
        FPS <b>{live && stats.fps ? stats.fps : '—'}</b>
      </span>
      <span className="statusbar__spacer" />
      <span className="statusbar__hint">Ctrl+Z undo · Ctrl+S save · R rotate · F fit view · Del delete</span>
    </footer>
  );
}

// ---- project dialog --------------------------------------------------------------------------------

function ProjectDialog() {
  const app = useApp();
  const open = useUI((s) => s.dialog === 'project');
  if (!open) return null;
  return <ProjectDialogBody app={app} />;
}

function ProjectDialogBody({ app }: { app: App }) {
  const { editor, storage } = app;
  const close = () => useUI.setState({ dialog: null });
  const [saved, setSaved] = useState(storage.list());
  const [text, setText] = useState(() => JSON.stringify(editor.model.toJSON(), null, 2));
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const importText = () => {
    try {
      editor.loadProject(parseProject(JSON.parse(text)));
      notify('Project imported');
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this JSON');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify('JSON copied to the clipboard');
    } catch {
      area.current?.select();
      notify('Press Ctrl+C to copy the selected JSON');
    }
  };
  const download = () => {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${editor.model.name.replace(/\W+/g, '-').toLowerCase() || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Project"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="modal__card">
        <header>
          <h2>Project</h2>
          <button className="icon-btn" aria-label="Close" onClick={close}>
            <Icon name="close" />
          </button>
        </header>
        <div className="modal__cols">
          <section>
            <h3>Saved in this browser</h3>
            {saved.length === 0 && (
              <p className="muted">Nothing saved yet. Press Save to keep this project.</p>
            )}
            <ul className="saved">
              {saved.map((p) => (
                <li key={p.name}>
                  <div>
                    <b>{p.name}</b>
                    <small>{new Date(p.savedAt).toLocaleString()}</small>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      const d = storage.load(p.name);
                      if (d) {
                        editor.loadProject(d);
                        notify(`Opened “${p.name}”`);
                        close();
                      } else notify('That save is damaged');
                    }}
                  >
                    Open
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => {
                      storage.remove(p.name);
                      setSaved(storage.list());
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button
                className="btn"
                onClick={() => {
                  editor.loadProject(createDemoProject());
                  close();
                }}
              >
                Load the demo apartment
              </button>
              <button
                className="btn"
                onClick={() => {
                  editor.loadProject({
                    version: 1,
                    name: 'Untitled',
                    rooms: [],
                    walls: [],
                    furniture: [],
                    doors: [],
                    windows: [],
                  });
                  close();
                }}
              >
                New empty project
              </button>
            </div>
          </section>
          <section>
            <h3>JSON</h3>
            <textarea
              ref={area}
              value={text}
              spellCheck={false}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              aria-label="Project JSON"
            />
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button className="btn" onClick={copy}>
                <Icon name="copy" size={15} /> Copy
              </button>
              <button className="btn" onClick={download}>
                Download .json
              </button>
              <button className="btn btn--primary" onClick={importText}>
                Import this JSON
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Toast() {
  const toast = useUI((s) => s.toast);
  return (
    <div className="toast-region" aria-live="polite">
      {toast && (
        <div key={toast.id} className="toast">
          {toast.text}
        </div>
      )}
    </div>
  );
}
