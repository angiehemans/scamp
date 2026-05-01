import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ElementRenderer } from './ElementRenderer';
import { CanvasInteractionLayer } from './CanvasInteractionLayer';
import styles from './Viewport.module.css';

// Padding subtracted from the scroll container's inner width when
// computing fit-to-width zoom. Mirrors the artboard's horizontal
// padding so the fitted frame doesn't sit flush against the
// scrollbar.
const FRAME_FIT_INSET = 40;

/**
 * Floor on the canvas frame's rendered height. Purely a design-tool
 * convenience — the frame grows past this as content is added, but
 * this keeps an empty project looking like a blank page rather than
 * a thin strip. Also used by `ElementRenderer` as the root element's
 * canvas-only min-height so flex-column centering has vertical space
 * to distribute within.
 */
export const EMPTY_FRAME_MIN_HEIGHT = 900;

/**
 * Renders the canvas page-root inside a scaled frame. Does NOT own a
 * scroll container — the enclosing artboard scrolls, so the frame can
 * overflow in any direction and the element toolbar can float above
 * the scrolling content without being clipped.
 *
 * The frame's WIDTH comes from per-project config (`canvasWidth`),
 * not from the root element — canvas size is a design-tool concept
 * and never touches the CSS file. Height grows with content.
 *
 * Fit-to-width zoom observes the scroll container (passed in via
 * `scrollContainerRef`) to keep the frame comfortably inside the
 * visible artboard when `userZoom` is null.
 */
type Props = {
  /** Viewport width in logical pixels, from scamp.config.json. */
  canvasWidth: number;
  /** When true, the frame clips content that extends outside its width. */
  canvasOverflowHidden: boolean;
  /** The artboard scroll container, used for fit-to-width measurement. */
  scrollContainerRef: RefObject<HTMLElement | null>;
};

export const Viewport = ({
  canvasWidth,
  canvasOverflowHidden,
  scrollContainerRef,
}: Props): JSX.Element => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Tracks the frame's natural (pre-scale) height so the frameShell
  // reserves the correct scrolled-space footprint after the frame's
  // own content grows.
  const [frameH, setFrameH] = useState(0);

  const rootElementId = useCanvasStore((s) => s.rootElementId);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const userZoom = useCanvasStore((s) => s.userZoom);

  const frameW = canvasWidth;

  // Auto-fit scale derived from the scroll container's client width.
  const [fitScale, setFitScale] = useState(1);
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const measure = (): void => {
      const w = container.clientWidth - FRAME_FIT_INSET * 2;
      if (w <= 0) return;
      // Width-only fit — tall pages scroll vertically inside the
      // artboard instead of squashing. Never scale up past 1.0.
      const next = Math.min(w / frameW, 1);
      setFitScale(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [frameW, scrollContainerRef]);

  // Effective scale: explicit user zoom wins, otherwise auto-fit.
  useLayoutEffect(() => {
    setScale(userZoom ?? fitScale);
  }, [userZoom, fitScale]);

  // Track the frame's natural (pre-scale) height. `transform: scale`
  // doesn't affect layout, so without this the wrapper would reserve
  // logical space only and scrolling would be wrong when the user
  // zooms in. Re-observe on frame remount for a live subscription.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = (): void => {
      setFrameH(frame.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={styles.frameShell}
      style={{
        width: frameW * scale,
        height: frameH * scale,
      }}
    >
      <div
        ref={frameRef}
        className={styles.frame}
        data-testid="canvas-frame"
        data-canvas-width={frameW}
        data-canvas-scale={scale}
        data-cursor={
          activeTool === 'rectangle' || activeTool === 'image'
            ? 'crosshair'
            : activeTool === 'text'
              ? 'text'
              : 'default'
        }
        style={{
          width: `${frameW}px`,
          minHeight: `${EMPTY_FRAME_MIN_HEIGHT}px`,
          overflow: canvasOverflowHidden ? 'hidden' : undefined,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <CanvasKeyframes />
        <ElementRenderer elementId={rootElementId} />
        <CanvasInteractionLayer frameRef={frameRef} scale={scale} />
      </div>
    </div>
  );
};

/**
 * Mounts a `<style>` element inside the canvas frame containing the
 * page's `@keyframes` blocks. Without this, the inline `animation`
 * declarations the renderer applies during preview can't resolve
 * their keyframe names — Scamp renders into the Electron renderer's
 * own document, not via the user's CSS module file.
 *
 * Re-renders only when `pageKeyframesBlocks` changes; otherwise the
 * `<style>` tag's textContent stays stable and doesn't churn.
 */
const CanvasKeyframes = (): JSX.Element | null => {
  const keyframes = useCanvasStore((s) => s.pageKeyframesBlocks);
  if (keyframes.length === 0) return null;
  const css = keyframes
    .map((block) => `@keyframes ${block.name} {\n${block.body}\n}`)
    .join('\n\n');
  return <style>{css}</style>;
};
