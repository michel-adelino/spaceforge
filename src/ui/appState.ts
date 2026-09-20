import { createContext, useContext, useSyncExternalStore } from 'react';
import { Editor } from '../editor/Editor';
import { createDemoProject } from '../domain/demo';
import { AnyEntity } from '../domain/factory';
import { CollaborationService } from '../services/CollaborationService';
import { ProjectStorage } from '../services/ProjectStorage';
import { Canvas2DView } from '../view2d/Canvas2DView';
import { ThreeView } from '../engine/ThreeView';
import { modelLibrary } from '../engine/ModelLibrary';
import { notify, useUI } from './store';

export interface App {
  editor: Editor;
  storage: ProjectStorage;
  collab: CollaborationService;
  /** Live view instances, registered by the viewport components (used for stats and zoom buttons). */
  views: { plan?: Canvas2DView; scene?: ThreeView };
}

export function createApp(): App {
  const editor = new Editor(() => {
    const s = useUI.getState();
    return { snapGrid: s.snapGrid, snapWalls: s.snapWalls };
  });
  const storage = new ProjectStorage();
  editor.model.load(storage.loadAutosave() ?? createDemoProject());
  const collab = new CollaborationService(editor.model);

  let timer: ReturnType<typeof setTimeout> | undefined;
  editor.model.bus.on('change', () => {
    clearTimeout(timer);
    timer = setTimeout(() => storage.autosave(editor.model.toJSON()), 600);
  });
  const app: App = { editor, storage, collab, views: {} };
  // Handy for poking around in the console and for end-to-end tests: open the page with ?debug.
  if (typeof location !== 'undefined' && location.search.includes('debug'))
    (window as unknown as { __sf: App & { models: typeof modelLibrary } }).__sf = Object.assign(app, {
      models: modelLibrary,
    });
  return app;
}

export function saveProject(app: App): void {
  const ok = app.storage.saveAs(app.editor.model.name, app.editor.model.toJSON());
  if (ok) {
    useUI.setState({ lastSaved: Date.now() });
    notify(`Saved “${app.editor.model.name}”`);
  } else notify('Could not save — browser storage is unavailable');
}

// ---- React bindings ----------------------------------------------------------------------------

export const AppContext = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) throw new Error('AppContext missing');
  return app;
}

/** Re-render whenever the scene changes. */
export function useModelVersion(): number {
  const { editor } = useApp();
  return useSyncExternalStore(editor.model.subscribe, editor.model.getVersion);
}
export function useSelectionId(): string | null {
  const { editor } = useApp();
  return useSyncExternalStore(editor.selection.subscribe, editor.selection.getId);
}
export function useHistoryVersion(): number {
  const { editor } = useApp();
  return useSyncExternalStore(editor.history.subscribe, editor.history.getVersion);
}
export function useSelectedEntity(): AnyEntity | null {
  const { editor } = useApp();
  useModelVersion();
  const id = useSelectionId();
  return id ? (editor.model.get(id) ?? null) : null;
}
