export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'measure' | 'delete';
export type ViewMode = '2d' | 'split' | '3d';
export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type Daylight = 'day' | 'night';
export type WallMode = 'auto' | 'up' | 'down';

export const DND_MIME = 'application/x-spaceforge-kind';

export interface View2DSettings {
  tool: Tool;
  snapGrid: boolean;
  showDimensions: boolean;
}
export interface View3DSettings {
  daylight: Daylight;
  wallMode: WallMode;
  shadows: boolean;
  gizmo: GizmoMode;
  snapGrid: boolean;
}
