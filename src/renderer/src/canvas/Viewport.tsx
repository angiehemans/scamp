import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ElementRenderer } from './ElementRenderer';
import { CanvasInteractionLayer } from './CanvasInteractionLayer';
import styles from './Viewport.module.css';

// Padding around the frame inside the canvas container, in CSS pixels.
// The container uses CSS padding so the frame can scroll within the
// padded inset, and the JS scale calculation subtracts the same value
// from the available width.
const FRAME_PADDING = 48;

/**
 * The Scamp viewport. Renders the page-root element as a real-pixel-sized
 * frame and scales it to fit the available panel space.
 *
 * The frame's WIDTH always matches the root element's `widthValue` (a
 * fixed page width). The HEIGHT is `min-height: heightValue` so the page
 * grows vertically when its content needs more room — exactly like a
 * real web page. We observe the frame's actual rendered (pre-scale)
 * height with a ResizeObserver and recompute scale-to-fit whenever
 * either the container or the frame's content height changes.
 *
 * All canvas interactions (draw, select, move, resize) are mounted as
 * overlays on top of this frame.
 */
export const Viewport = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const rootElementId = useCanvasStore((s) => s.rootElementId);
  const rootElement = useCanvasStore((s) => s.elements[s.rootElementId]);
  const selectElement = useCanvasStore((s) => s.selectElement);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const userZoom = useCanvasStore((s) => s.userZoom);

  // Fall back to the documented page defaults if the root element is
  // momentarily missing (e.g. between project open and first parseCode).
  const frameW = rootElement?.widthValue ?? 1440;
  const frameMinH = rootElement?.heightValue ?? 900;

  // Track the auto-fit scale (computed from the container width) so the
  // viewport can fall back to it whenever `userZoom` is null.
  const [fitScale, setFitScale] = useState(1);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = (): void => {
      const w = container.clientWidth - FRAME_PADDING * 2;
      if (w <= 0) return;
      // Scale to fit the page WIDTH only. Tall pages scroll vertically
      // inside the container instead of being squashed down to fit on
      // screen — that matches how a real browser handles a long page
      // and keeps the visual fidelity at 1:1 horizontally when there's
      // enough room.
      const next = Math.min(w / frameW, 1);
      setFitScale(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
    // Re-measure whenever the canvas size changes so the fit scale
    // tracks edits to the root width.
  }, [frameW]);

  // Effective scale: explicit user zoom wins, otherwise auto-fit. Kept
  // in `scale` so the existing CanvasInteractionLayer (which already
  // takes a `scale` prop) doesn't need to know which mode we're in.
  useLayoutEffect(() => {
    setScale(userZoom ?? fitScale);
  }, [userZoom, fitScale]);

  // Background click on the container (outside the frame) deselects.
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (e.target === containerRef.current) {
        selectElement(null);
      }
    };
    const node = containerRef.current;
    node?.addEventListener('mousedown', handler);
    return () => node?.removeEventListener('mousedown', handler);
  }, [selectElement]);

  return (
    <div ref={containerRef} className={styles.container}>
      <div
        ref={frameRef}
        className={styles.frame}
        data-cursor={
          activeTool === 'rectangle' ? 'crosshair' : activeTool === 'text' ? 'text' : 'default'
        }
        style={{
          width: `${frameW}px`,
          minHeight: `${frameMinH}px`,
          zoom: scale,
        }}
      >
        <ElementRenderer elementId={rootElementId} />
        <CanvasInteractionLayer frameRef={frameRef} scale={scale} />
      </div>
    </div>
  );
};
