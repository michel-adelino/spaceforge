import { create } from 'zustand';
import { Daylight, GizmoMode, Tool, ViewMode, WallMode } from '../editor/types';
import type { Lang } from './landingText';

export interface UIState {
  lang: Lang;
  screen: 'landing' | 'editor';
  viewMode: ViewMode;
  tool: Tool;
  gizmo: GizmoMode;
  snapGrid: boolean;
  snapWalls: boolean;
  showDimensions: boolean;
  daylight: Daylight;
  wallMode: WallMode;
  shadows: boolean;
  dialog: null | 'project';
  drawer: null | 'left' | 'right';
  lastSaved: number | null;
  toast: { id: number; text: string } | null;
}

/**
 * View / interaction state only. The document itself lives in the OOP SceneModel — it is not in this store,
 * because it has its own history, serialisation and sync rules.
 */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('spaceforge:lang');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function setLang(lang: Lang): void {
  useUI.setState({ lang });
  try {
    localStorage.setItem('spaceforge:lang', lang);
  } catch {
    /* ignore */
  }
}

export const useUI = create<UIState>()(() => ({
  lang: initialLang(),
  screen: 'landing',
  viewMode: 'split',
  tool: 'select',
  gizmo: 'translate',
  snapGrid: true,
  snapWalls: true,
  showDimensions: true,
  daylight: 'day',
  wallMode: 'auto',
  shadows: true,
  dialog: null,
  drawer: null,
  lastSaved: null,
  toast: null,
}));

let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function notify(text: string): void {
  const id = ++toastId;
  useUI.setState({ toast: { id, text } });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (useUI.getState().toast?.id === id) useUI.setState({ toast: null });
  }, 2600);
}

/** Drawing tools only make sense on the plan, so picking one from a 3D-only layout switches to 2D. */
export function selectTool(tool: Tool): void {
  const { viewMode } = useUI.getState();
  useUI.setState({ tool, ...(tool !== 'select' && viewMode === '3d' ? { viewMode: '2d' as ViewMode } : {}) });
}
