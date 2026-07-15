import type { RefObject } from 'react';
import type { GameController } from '../../game/controller';
import { centerOn } from '../../input/camera';
import { MAP_PX } from '../../game/map';

const SIZE = 208;

export function MinimapPanel({
  controller: c,
  canvasRef
}: {
  controller: GameController;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const toWorld = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * MAP_PX,
      y: ((e.clientY - rect.top) / rect.height) * MAP_PX
    };
  };

  return (
    <div className="minimap panel">
      <canvas
        ref={(el) => {
          if (canvasRef && 'current' in canvasRef) {
            (canvasRef as { current: HTMLCanvasElement | null }).current = el;
          }
        }}
        width={SIZE}
        height={SIZE}
        onMouseDown={(e) => {
          const w = toWorld(e);
          if (e.button === 0) {
            if (c.pendingAction) c.confirmPendingAt(w.x, w.y, e.shiftKey);
            else centerOn(c.camera, w.x, w.y, c.viewport.w, c.viewport.h);
          } else if (e.button === 2) {
            if (c.pendingAction) c.cancelPending();
            else c.rightClickAt(w.x, w.y, e.shiftKey);
          }
        }}
        onMouseMove={(e) => {
          if (e.buttons === 1 && !c.pendingAction) {
            const w = toWorld(e);
            centerOn(c.camera, w.x, w.y, c.viewport.w, c.viewport.h);
          }
        }}
      />
    </div>
  );
}
