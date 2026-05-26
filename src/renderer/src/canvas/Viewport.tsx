import {
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
import {
  DEFAULT_BODY_FONT_FAMILY,
} from '@shared/agentMd';
import {
  MAX_COMPONENT_CANVAS_DIM,
  MIN_COMPONENT_CANVAS_DIM,
} from '@shared/types';
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
  /**
   * Optional explicit canvas height in logical pixels. When set,
   * the frame uses this as a fixed height instead of growing with
   * content (the page-canvas default). Used by the component
   * editor where the canvas is bounded by design intent rather
   * than content reach.
   */
  canvasHeight?: number;
  /** When true, the frame clips content that extends outside its width. */
  canvasOverflowHidden: boolean;
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
  canvasOverflowHidden,
  scrollContainerRef,
  onResize,
}: Props): JSX.Element => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Tracks the frame's natural (pre-scale) height so the frameShell
  // reserves the correct scrolled-space footprint after the frame's
  // own content grows.
  const [frameH, setFrameH] = useState(0);

  const rootElementId = useCanvasStore((s) => s.rootElementId);
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

  // Frame-shell reserved height follows the LARGER of the
  // user-set min and the measured content height — so a small
  // canvas grows as the user adds elements past it. For page
  // mode (no canvasHeight), `frameH` is the only signal.
  const reservedHeight =
    canvasHeight !== undefined ? Math.max(canvasHeight, frameH) : frameH;

  return (
    <div
      className={styles.frameShell}
      style={{
        width: frameW * scale,
        height: reservedHeight * scale,
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
          // Component mode: `canvasHeight` is a MIN — the canvas
          // grows past it as the user adds elements that overflow.
          // Page mode falls back to the EMPTY_FRAME_MIN_HEIGHT
          // floor so blank pages have a visible canvas to draw on.
          minHeight: `${canvasHeight ?? EMPTY_FRAME_MIN_HEIGHT}px`,
          overflow: canvasOverflowHidden ? 'hidden' : undefined,
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
