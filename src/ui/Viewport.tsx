import { useEffect, useRef, useState } from 'react';
import { Canvas2DView } from '../view2d/Canvas2DView';
import { ThreeView } from '../engine/ThreeView';
import { Tool } from '../editor/types';
import { useApp, useSelectedEntity } from './appState';
import { Icon } from './Icon';
import { Segmented } from './fields';
import { UIState, useUI } from './store';

const HINTS: Record<Tool, string> = {
  select: 'Drag objects to move them, drag empty space to pan, scroll to zoom.',
  wall: 'Click to start a wall, click again to continue. Double-click or Esc to finish. Hold Shift for straight lines.',
  room: 'Drag a rectangle to create a room with four walls and a floor.',
  door: 'Hover a wall and click to place a door.',
  window: 'Hover a wall and click to place a window.',
  measure: 'Click two points to measure the distance between them.',
  delete: 'Click an object to delete it.',
};

export function Viewport() {
  const viewMode = useUI((s) => s.viewMode);
  return (
    <div className={`viewport viewport--${viewMode}`}>
      <PlanPane />
      <ScenePane />
    </div>
  );
}

function PlanPane() {
  const app = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const viewMode = useUI((s) => s.viewMode);
  const tool = useUI((s) => s.tool);

  useEffect(() => {
    const view = new Canvas2DView(ref.current as HTMLDivElement, app.editor, { interactive: true });
    app.views.plan = view;
    const sync = (s: UIState) =>
      view.setSettings({ tool: s.tool, snapGrid: s.snapGrid, showDimensions: s.showDimensions });
    sync(useUI.getState());
    const off = useUI.subscribe(sync);
    return () => {
      off();
      view.dispose();
      if (app.views.plan === view) app.views.plan = undefined;
    };
  }, [app]);

  useEffect(() => {
    app.views.plan?.setVisible(viewMode !== '3d');
  }, [viewMode, app]);

  return (
    <section className="pane" hidden={viewMode === '3d'} aria-label="2D plan">
      <div className="pane__canvas" ref={ref} />
      <div className="pane__tag">2D plan</div>
      <div className="pane__hint">{HINTS[tool]}</div>
      <div className="pane__tools pane__tools--br">
        <button className="icon-btn" title="Zoom in" onClick={() => app.views.plan?.zoomBy(1.25)}>
          <Icon name="plus" />
        </button>
        <button className="icon-btn" title="Zoom out" onClick={() => app.views.plan?.zoomBy(0.8)}>
          <Icon name="minus" />
        </button>
        <button className="icon-btn" title="Fit to content (F)" onClick={() => app.editor.fitViews()}>
          <Icon name="fit" />
        </button>
      </div>
    </section>
  );
}

function ScenePane() {
  const app = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const viewMode = useUI((s) => s.viewMode);
  const gizmo = useUI((s) => s.gizmo);
  const wallMode = useUI((s) => s.wallMode);
  const selected = useSelectedEntity();

  useEffect(() => {
    if (!ThreeView.isSupported()) {
      setError(
        'WebGL is not available in this browser, so the 3D view is disabled. The 2D editor still works.',
      );
      return;
    }
    let view: ThreeView;
    try {
      view = new ThreeView(ref.current as HTMLDivElement, app.editor, { interactive: true });
    } catch (e) {
      setError(`Could not start the 3D renderer: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    app.views.scene = view;
    const sync = (s: UIState) =>
      view.setSettings({
        daylight: s.daylight,
        wallMode: s.wallMode,
        shadows: s.shadows,
        gizmo: s.gizmo,
        snapGrid: s.snapGrid,
      });
    sync(useUI.getState());
    view.setVisible(useUI.getState().viewMode !== '2d');
    const off = useUI.subscribe(sync);
    return () => {
      off();
      view.dispose();
      if (app.views.scene === view) app.views.scene = undefined;
    };
  }, [app]);

  useEffect(() => {
    app.views.scene?.setVisible(viewMode !== '2d');
  }, [viewMode, app]);

  return (
    <section className="pane" hidden={viewMode === '2d'} aria-label="3D view">
      <div className="pane__canvas" ref={ref} />
      {error && <div className="pane__error">{error}</div>}
      <div className="pane__tag">3D</div>
      {!error && (
        <>
          <div className="pane__tools pane__tools--tr">
            {selected?.type === 'furniture' && (
              <Segmented
                label="Transform"
                value={gizmo}
                onChange={(v) => useUI.setState({ gizmo: v })}
                options={[
                  { value: 'translate', label: 'Move', icon: 'move' },
                  { value: 'rotate', label: 'Rotate', icon: 'rotate' },
                  { value: 'scale', label: 'Scale', icon: 'scale' },
                ]}
              />
            )}
            <Segmented
              label="Walls"
              value={wallMode}
              onChange={(v) => useUI.setState({ wallMode: v })}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'up', label: 'Up' },
                { value: 'down', label: 'Down' },
              ]}
            />
            <button className="icon-btn" title="Reset camera (F)" onClick={() => app.editor.fitViews()}>
              <Icon name="fit" />
            </button>
          </div>
          <div className="pane__hint">
            Drag to orbit, right-drag to pan, scroll to zoom. Click an object to select it.
          </div>
        </>
      )}
    </section>
  );
}
