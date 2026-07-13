import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type RefObject,
} from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { wouldCreateComponentCycle } from '@lib/componentUsage';
import { nextZoomFromWheel } from '@lib/zoom';
import {
  DEFAULT_BODY_FONT_FAMILY,
} from '@shared/agentMd';
import {
  MAX_COMPONENT_CANVAS_DIM,
  MIN_COMPONENT_CANVAS_DIM,
} from '@shared/types';
import { overflowExtent } from '@lib/canvasOverflow';
import { ElementRenderer } from './ElementRenderer';
import { CanvasInteractionLayer } from './CanvasInteractionLayer';
import { CanvasBoundaryOverlay } from './CanvasBoundaryOverlay';
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
  /**
   * Optional explicit canvas height in logical pixels. In the component
   * editor it's a MIN (the frame grows past it with content). For the
   * page canvas with `heightIsFixed`, it's an EXACT height.
   */
  canvasHeight?: number;
  /**
   * When true, `canvasHeight` is an exact frame height (page fixed-height
   * mode) rather than a minimum. The component editor leaves this false so
   * its canvas still grows with content past the configured height.
   */
  heightIsFixed?: boolean;
  /** When true, the frame clips content that extends outside its bounds. */
  clipContent: boolean;
  /** The artboard scroll container, used for fit-to-width measurement. */
  scrollContainerRef: RefObject<HTMLElement | null>;
  /**
   * Resize callback for the bottom-right drag handle. When
   * provided, the handle renders at the frame's BR corner;
   * dragging emits running (width, height) updates. The caller
   * (ProjectShell, for the component editor) writes the result
   * back into `projectConfig.componentCanvas`. Page mode omits
   * the prop so no handle renders.
   */
  onResize?: (width: number, height: number) => void;
};

export const Viewport = ({
  canvasWidth,
  canvasHeight,
  heightIsFixed = false,
  clipContent,
  scrollContainerRef,
  onResize,
}: Props): JSX.Element => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Tracks the frame's natural (pre-scale) height so the frameShell
  // reserves the correct scrolled-space footprint after the frame's
  // own content grows.
  const [frameH, setFrameH] = useState(0);
  // Logical content extent (rightmost / bottommost rendered edge)
  // measured from element bounding boxes. Drives the boundary overlay
  // AND the frameShell expansion that keeps off-canvas content visible
  // and scrollable when clip is off. Measured from getBoundingClientRect
  // (not scrollWidth) because `overflow: visible` reports scrollWidth ===
  // clientWidth, so a scroll-box measure would miss overflow while clip
  // is off — exactly when we need it.
  const [content, setContent] = useState({ right: 0, bottom: 0 });

  const rootElementId = useCanvasStore((s) => s.rootElementId);
  // Subscribe to the element tree so overflow is re-measured after any
  // edit — a child overflowing horizontally doesn't change the frame's
  // own box, so a ResizeObserver on the frame alone wouldn't fire.
  const elements = useCanvasStore((s) => s.elements);
  // Canvas resize handles only show when the root is selected —
  // matches the per-element selection-handle pattern (handles
  // appear on the active selection, nothing else). Tracking the
  // boolean via a derived selector keeps re-renders to actual
  // root-selection changes rather than every selection mutation.
  const isRootSelected = useCanvasStore((s) =>
    s.selectedElementIds.includes(rootElementId)
  );
  const activeTool = useCanvasStore((s) => s.activeTool);
  const userZoom = useCanvasStore((s) => s.userZoom);
  const setFitScale = useCanvasStore((s) => s.setFitScale);
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  // Resolve the body-level default font from the project's theme.css
  // tokens. Mirrors what the preview / `next dev` would inherit from
  // the `body { font-family: var(--font-sans) }` rule in theme.css —
  // so the canvas and the deployed page render the same default font.
  // Falls back to the constant when the project hasn't defined a
  // `--font-sans` token (e.g. older projects pre-dating this default).
  const themeFontFamily =
    themeTokens.find((t) => t.name === '--font-sans')?.value ??
    DEFAULT_BODY_FONT_FAMILY;
  // Inject every project theme token as a CSS custom property on the
  // canvas frame so `var(--…)` references inside both typed style and
  // unmapped customProperties resolve natively (same scope rules as
  // the preview, where `theme.css` lives in the page's `<head>`).
  // Without this, only the typed-property path gets `resolveTokenColor`
  // / `resolveTokenValue` substitution; raw shorthand declarations
  // routed through `customProperties` (e.g. `border-bottom: 1px solid
  // var(--color-border)`) silently fall back to currentColor or
  // browser defaults because the Scamp app's `:root` doesn't carry
  // the project tokens.
  const themeCssVars = useMemo(() => {
    const vars: Record<string, string> = {};
    for (const token of themeTokens) {
      // Skip Scamp chrome variables — only project-declared tokens
      // (the parser only surfaces declarations from theme.css's
      // `:root` so this filter is mostly defensive).
      if (!token.name.startsWith('--')) continue;
      vars[token.name] = token.value;
    }
    return vars;
  }, [themeTokens]);

  const frameW = canvasWidth;

  // Auto-fit scale derived from the scroll container's client width.
  const [fitScale, setLocalFitScale] = useState(1);
  // Fit the CONTENT width (canvas + any overflow) when clip is off, so
  // overflowing elements AND the boundary line stay on screen — the user
  // needs to see what's spilling past the canvas to fix it. When clip is
  // on, fit the canvas width only (overflow is hidden anyway). `content`
  // is measured in logical (scale-invariant) px, so this doesn't loop.
  const fitWidth = clipContent ? frameW : Math.max(frameW, content.right);
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const measure = (): void => {
      const w = container.clientWidth - FRAME_FIT_INSET * 2;
      if (w <= 0) return;
      // Width-only fit — tall pages scroll vertically inside the
      // artboard instead of squashing. Never scale up past 1.0.
      const next = Math.min(w / fitWidth, 1);
      setLocalFitScale(next);
      // Mirror into the store so the zoom indicator can show the real
      // percentage in fit mode and the wheel handler can anchor on it.
      setFitScale(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitWidth, scrollContainerRef, setFitScale]);

  // Effective scale: explicit user zoom wins, otherwise auto-fit.
  useLayoutEffect(() => {
    setScale(userZoom ?? fitScale);
  }, [userZoom, fitScale]);

  // Continuous zoom via trackpad pinch / Cmd-Ctrl+wheel. The listener is
  // non-passive so it can preventDefault the browser's native page zoom.
  // Cursor anchoring is applied after commit in the layout effect below,
  // using the point stashed here. see docs/notes/canvas-wheel-zoom.md
  const zoomAnchorRef = useRef<{
    logicalX: number;
    logicalY: number;
    delta: number;
  } | null>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const state = useCanvasStore.getState();
      const old = state.userZoom ?? state.fitScale;
      const next = nextZoomFromWheel(old, e.deltaY);
      if (next === old) return;
      const frame = frameRef.current;
      if (frame) {
        const rect = frame.getBoundingClientRect();
        zoomAnchorRef.current = {
          logicalX: (e.clientX - rect.left) / old,
          logicalY: (e.clientY - rect.top) / old,
          delta: next - old,
        };
      }
      state.setZoom(next);
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [scrollContainerRef]);

  // Cursor anchoring: once the new scale is committed to the DOM (so the
  // frame's transform is live), shift the scroll so the logical point the
  // pointer was over stays under the pointer. see docs/notes/canvas-wheel-zoom.md
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    zoomAnchorRef.current = null;
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollLeft += anchor.logicalX * anchor.delta;
    container.scrollTop += anchor.logicalY * anchor.delta;
  }, [scale, scrollContainerRef]);

  // Measure the frame's natural (pre-scale) height AND its overflow past
  // the canvas bounds. `transform: scale` doesn't affect layout, so we
  // need frameH to reserve the right scrolled-space footprint; the scroll
  // box gives overflow (`scrollWidth`/`scrollHeight` include overflowing
  // descendants even under `overflow: hidden`).
  const measureFrame = useCallback((): void => {
    const frame = frameRef.current;
    if (!frame) return;
    setFrameH(frame.offsetHeight);
    // Content extent = the furthest right/bottom rendered element edge,
    // in the frame's LOGICAL (pre-scale) coordinates. The applied scale
    // is recovered from the frame's own client rect vs its layout width
    // so we don't depend on the `scale` state (avoids a stale closure).
    const frameRect = frame.getBoundingClientRect();
    const appliedScale =
      frame.offsetWidth > 0 ? frameRect.width / frame.offsetWidth : 1;
    let right = frame.clientWidth;
    let bottom = frame.clientHeight;
    for (const node of frame.querySelectorAll('[data-element-id]')) {
      const r = node.getBoundingClientRect();
      right = Math.max(right, (r.right - frameRect.left) / appliedScale);
      bottom = Math.max(bottom, (r.bottom - frameRect.top) / appliedScale);
    }
    setContent({ right: Math.round(right), bottom: Math.round(bottom) });
  }, []);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    measureFrame();
    const ro = new ResizeObserver(measureFrame);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [measureFrame]);
  // Horizontal overflow doesn't change the frame's own box, so the
  // ResizeObserver above won't fire on it — re-measure on tree / size
  // changes too.
  useLayoutEffect(() => {
    measureFrame();
  }, [elements, frameW, canvasHeight, heightIsFixed, clipContent, measureFrame]);

  // Drop target for the sidebar's component drag-and-drop. The
  // `onDragOver` preventDefault is the HTML5-DnD opt-in that
  // makes the element a valid drop target; we gate it on our
  // own mime so other drags (text selections, files, etc.)
  // aren't accidentally consumed.
  const handleDragOver = (e: ReactDragEvent<HTMLDivElement>): void => {
    if (e.dataTransfer.types.includes('application/x-scamp-component')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const handleDrop = (e: ReactDragEvent<HTMLDivElement>): void => {
    const componentName = e.dataTransfer.getData(
      'application/x-scamp-component'
    );
    if (!componentName) return;
    e.preventDefault();
    // Cycle guard. see docs/notes/components-multi-file-ops.md
    const store = useCanvasStore.getState();
    const activeTargetName = store.activeComponent?.name ?? null;
    if (
      wouldCreateComponentCycle(
        store.componentTrees,
        activeTargetName,
        componentName
      )
    ) {
      useAppLogStore
        .getState()
        .log(
          'warn',
          `Refused: placing ${componentName} inside ${activeTargetName} would create a cycle.`
        );
      return;
    }
    const frame = frameRef.current;
    if (!frame) return;
    // The frame is `transform: scale(scale)` from its top-left,
    // so converting client coords to canvas-local is (clientX -
    // rect.left) / scale on each axis. Phase 3 places every
    // instance at the page root regardless of what's beneath the
    // cursor — parent-resolution + drop-into-container land in
    // Phase 4+.
    const rect = frame.getBoundingClientRect();
    const x = Math.max(0, Math.round((e.clientX - rect.left) / scale));
    const y = Math.max(0, Math.round((e.clientY - rect.top) / scale));
    store.insertComponentInstance({
      parentId: rootElementId,
      componentName,
      x,
      y,
    });
  };

  // Per-corner sign map for the resize handles. Each corner's
  // drag delta translates to width/height delta via these
  // multipliers, so the canvas's top-left stays anchored at
  // (0,0) in the shell while the size scales by the signed
  // delta. (Figma-style "opposite corner anchors" would also
  // require translating the frame within the shell — out of
  // scope for this pass.)
  type Corner = 'tl' | 'tr' | 'bl' | 'br';
  const SIGN: Record<Corner, { w: 1 | -1; h: 1 | -1 }> = {
    br: { w: 1, h: 1 },
    bl: { w: -1, h: 1 },
    tr: { w: 1, h: -1 },
    tl: { w: -1, h: -1 },
  };

  // Pointer-based corner resize. `setPointerCapture` keeps the
  // drag attached to the handle even when the cursor leaves it.
  // Each move emits a (width, height) snapshot scaled by the
  // frame's transform so logical pixels match the stored canvas
  // size.
  const makeResizePointerDown =
    (corner: Corner) =>
    (e: import('react').PointerEvent<HTMLDivElement>): void => {
      if (!onResize) return;
      e.preventDefault();
      e.stopPropagation();
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const startWidth = canvasWidth;
      // `canvasHeight` is the user-set MIN height; the frame
      // grows past it when content overflows. Resizing should
      // start from the user-set value (not the measured value)
      // so dragging is predictable when content is taller than
      // the min.
      const startHeight = canvasHeight ?? frameH;
      const signs = SIGN[corner];
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent): void => {
        const dx = (ev.clientX - startClientX) / scale;
        const dy = (ev.clientY - startClientY) / scale;
        const nextWidth = Math.max(
          MIN_COMPONENT_CANVAS_DIM,
          Math.min(
            MAX_COMPONENT_CANVAS_DIM,
            Math.round(startWidth + dx * signs.w)
          )
        );
        const nextHeight = Math.max(
          MIN_COMPONENT_CANVAS_DIM,
          Math.min(
            MAX_COMPONENT_CANVAS_DIM,
            Math.round(startHeight + dy * signs.h)
          )
        );
        onResize(nextWidth, nextHeight);
      };
      const onUp = (ev: PointerEvent): void => {
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          // Pointer capture already released by the runtime — ignore.
        }
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
      };
      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
      target.addEventListener('pointercancel', onUp);
    };

  // Frame-shell reserved height:
  //   - page fixed-height → EXACTLY `canvasHeight` (content clips /
  //     overflows past it rather than growing the frame).
  //   - component mode → LARGER of the user-set min and measured content
  //     (grows as elements are added past the min).
  //   - page auto-height → `frameH` (grows with content).
  const reservedHeight =
    heightIsFixed && canvasHeight !== undefined
      ? canvasHeight
      : canvasHeight !== undefined
        ? Math.max(canvasHeight, frameH)
        : frameH;

  // Overflow past the canvas boundary (logical px). The vertical figure
  // is only surfaced in fixed-height mode; the overlay gates on that.
  const overflowX = overflowExtent(content.right, frameW);
  const overflowY = overflowExtent(content.bottom, reservedHeight);

  // When clip is OFF, the frameShell must reserve the overflowing content
  // so the artboard can scroll to it (otherwise it's visually clipped by
  // the scroll container). When clip is ON, the shell stays at the canvas
  // bounds and the frame's `overflow: hidden` does the clipping.
  const shellWidth =
    (clipContent ? frameW : Math.max(frameW, content.right)) * scale;
  const shellHeight =
    (clipContent ? reservedHeight : Math.max(reservedHeight, content.bottom)) *
    scale;

  return (
    <div
      className={styles.frameShell}
      style={{
        width: shellWidth,
        height: shellHeight,
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
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          // Project theme tokens live on the frame as real CSS custom
          // properties, so `var(--…)` references inside any descendant
          // (typed inline styles, customProperties, hand-written CSS
          // in CodeMirror) resolve natively. MUST spread first so the
          // explicit style properties below win on key collisions.
          ...themeCssVars,
          width: `${frameW}px`,
          // Page fixed-height mode pins an EXACT height. Otherwise
          // `canvasHeight` is a MIN (component mode grows past it), and
          // page mode falls back to the EMPTY_FRAME_MIN_HEIGHT floor so
          // blank pages have a visible canvas to draw on.
          ...(heightIsFixed && canvasHeight !== undefined
            ? { height: `${canvasHeight}px` }
            : { minHeight: `${canvasHeight ?? EMPTY_FRAME_MIN_HEIGHT}px` }),
          overflow: clipContent ? 'hidden' : undefined,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // Mirror the project's `body { font-family: var(--font-sans) }`
          // rule from theme.css so an unstyled element on the canvas
          // renders in the same font as in preview / `next dev` /
          // production. Without this, the canvas inherits Scamp's
          // chrome font (Ubuntu Mono on Linux, San Francisco on
          // macOS, etc.) and visually disagrees with the preview.
          fontFamily: themeFontFamily,
          position: 'relative',
        }}
      >
        <CanvasKeyframes />
        <ElementRenderer elementId={rootElementId} />
        <CanvasInteractionLayer frameRef={frameRef} scale={scale} />
        {onResize && isRootSelected && (
          <>
            <div
              className={`${styles.canvasResizeHandle} ${styles.canvasResizeHandleTL}`}
              onPointerDown={makeResizePointerDown('tl')}
              aria-label="Resize canvas (top-left)"
              title="Drag to resize"
            />
            <div
              className={`${styles.canvasResizeHandle} ${styles.canvasResizeHandleTR}`}
              onPointerDown={makeResizePointerDown('tr')}
              aria-label="Resize canvas (top-right)"
              title="Drag to resize"
            />
            <div
              className={`${styles.canvasResizeHandle} ${styles.canvasResizeHandleBL}`}
              onPointerDown={makeResizePointerDown('bl')}
              aria-label="Resize canvas (bottom-left)"
              title="Drag to resize"
            />
            <div
              className={`${styles.canvasResizeHandle} ${styles.canvasResizeHandleBR}`}
              onPointerDown={makeResizePointerDown('br')}
              aria-label="Resize canvas (bottom-right)"
              title="Drag to resize"
            />
          </>
        )}
      </div>
      <CanvasBoundaryOverlay
        scale={scale}
        boundaryWidth={frameW}
        boundaryHeight={reservedHeight}
        overflowX={overflowX}
        overflowY={overflowY}
        naturalHeight={content.bottom}
        clip={clipContent}
        fixedHeight={heightIsFixed}
      />
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
