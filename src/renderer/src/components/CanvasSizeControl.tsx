import { useEffect, useRef, useState } from 'react';
import type { Breakpoint, ProjectConfig } from '@shared/types';
import {
  DEFAULT_COMPONENT_CANVAS_SIZE,
  DESKTOP_BREAKPOINT_ID,
  MAX_CANVAS_WIDTH,
  MAX_COMPONENT_CANVAS_DIM,
  MIN_CANVAS_WIDTH,
  MIN_COMPONENT_CANVAS_DIM,
} from '@shared/types';
import { clampCanvasWidth } from '@shared/projectConfig';
import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from './controls/NumberInput';
import { Tooltip } from './controls/Tooltip';
import styles from './CanvasSizeControl.module.css';

type Props = {
  config: ProjectConfig;
  onChange: (next: ProjectConfig) => void;
  /**
   * When set, the control edits the canvas size for the named
   * component (writing to `config.componentCanvas[name]`) rather
   * than the project-wide page canvas. Switches the popover into
   * component-mode: width + height numeric inputs, no breakpoint
   * presets (breakpoints don't apply to component editing in
   * Phase 3.5 — only pages have responsive cascades).
   */
  componentName?: string;
};

/**
 * Toolbar control for the canvas viewport size + active breakpoint.
 *
 * The button's label reflects the active breakpoint (or a custom-
 * width readout when no preset matches). Clicking opens a popover
 * with:
 *   - A segmented list of the project's breakpoints. Clicking one
 *     sets canvas width AND active breakpoint — so subsequent
 *     property-panel edits land inside that breakpoint's @media
 *     block.
 *   - A custom-width input. Typing a value that doesn't match any
 *     breakpoint drops the active breakpoint to `desktop` so edits
 *     apply to the base CSS.
 *   - An overflow-hidden toggle (a viewport-frame preview helper,
 *     never written to CSS).
 */
export const CanvasSizeControl = ({
  config,
  onChange,
  componentName,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
  const setActiveBreakpoint = useCanvasStore((s) => s.setActiveBreakpoint);

  useEffect(() => {
    if (!open) return;
    const handleDocClick = (e: MouseEvent): void => {
      const node = wrapRef.current;
      if (!node) return;
      if (!node.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  /** Pick a preset: updates canvas width AND active breakpoint. */
  const selectBreakpoint = (bp: Breakpoint): void => {
    onChange({ ...config, canvasWidth: clampCanvasWidth(bp.width) });
    setActiveBreakpoint(bp.id);
  };

  const setOverflow = (overflow: boolean): void => {
    onChange({ ...config, canvasOverflowHidden: overflow });
  };

  const handleCustomChange = (next: number | undefined): void => {
    if (next === undefined) return;
    const clamped = clampCanvasWidth(next);
    onChange({ ...config, canvasWidth: clamped });
    // A custom width means we're NOT editing a specific breakpoint —
    // drop back to desktop so panel edits target the base CSS.
    const match = config.breakpoints.find((b) => b.width === clamped);
    setActiveBreakpoint(match ? match.id : DESKTOP_BREAKPOINT_ID);
  };

  // Component-mode helpers. Component canvases store both
  // dimensions explicitly (vs. page canvases where height grows
  // with content), so we compute the current size with a
  // fallback to DEFAULT_COMPONENT_CANVAS_SIZE for components the
  // user hasn't resized yet.
  const componentSize = componentName
    ? config.componentCanvas?.[componentName] ?? DEFAULT_COMPONENT_CANVAS_SIZE
    : null;
  const clampComponentDim = (n: number): number =>
    Math.round(
      Math.max(MIN_COMPONENT_CANVAS_DIM, Math.min(MAX_COMPONENT_CANVAS_DIM, n))
    );
  const setComponentSize = (next: {
    width: number;
    height: number;
  }): void => {
    if (!componentName) return;
    const clamped = {
      width: clampComponentDim(next.width),
      height: clampComponentDim(next.height),
    };
    onChange({
      ...config,
      componentCanvas: {
        ...(config.componentCanvas ?? {}),
        [componentName]: clamped,
      },
    });
  };

  const activeBreakpoint = config.breakpoints.find(
    (b) => b.id === activeBreakpointId
  );
  const buttonLabel = componentSize
    ? `${componentSize.width} × ${componentSize.height}`
    : activeBreakpoint
      ? `${activeBreakpoint.label} · ${config.canvasWidth}`
      : `${config.canvasWidth}px`;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <Tooltip label="Canvas width · active breakpoint">
        <button
          className={styles.button}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid="canvas-size-button"
          data-active-breakpoint={activeBreakpointId}
        >
          {buttonLabel}
          <span className={styles.caret} aria-hidden="true">
            ▾
          </span>
        </button>
      </Tooltip>
      {open && (
        <div className={styles.popover} role="dialog" data-testid="canvas-size-popover">
          {componentSize ? (
            // Component-mode popover: width + height inputs only.
            // Breakpoint presets don't apply — components edit in
            // isolation at one breakpoint (the page on which the
            // instance lives is what carries the responsive
            // cascade).
            <>
              <div className={styles.sectionLabel}>Canvas size</div>
              <div className={styles.customRow}>
                <NumberInput
                  value={componentSize.width}
                  onChange={(next) => {
                    if (next === undefined) return;
                    setComponentSize({
                      width: next,
                      height: componentSize.height,
                    });
                  }}
                  min={MIN_COMPONENT_CANVAS_DIM}
                  max={MAX_COMPONENT_CANVAS_DIM}
                  suffix="W"
                />
                <NumberInput
                  value={componentSize.height}
                  onChange={(next) => {
                    if (next === undefined) return;
                    setComponentSize({
                      width: componentSize.width,
                      height: next,
                    });
                  }}
                  min={MIN_COMPONENT_CANVAS_DIM}
                  max={MAX_COMPONENT_CANVAS_DIM}
                  suffix="H"
                />
              </div>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={config.canvasOverflowHidden}
                  onChange={(e) => setOverflow(e.target.checked)}
                />
                <span>Overflow hidden</span>
              </label>
            </>
          ) : (
            <>
              <div className={styles.sectionLabel}>Breakpoint</div>
              <div className={styles.presetGrid}>
                {config.breakpoints.map((bp) => (
                  <button
                    key={bp.id}
                    className={`${styles.presetButton} ${
                      bp.id === activeBreakpointId ? styles.presetActive : ''
                    }`}
                    type="button"
                    onClick={() => selectBreakpoint(bp)}
                  >
                    <span className={styles.presetName}>{bp.label}</span>
                    <span className={styles.presetWidth}>{bp.width}</span>
                  </button>
                ))}
              </div>
              <div className={styles.sectionLabel}>Custom width</div>
              <div className={styles.customRow}>
                <NumberInput
                  value={config.canvasWidth}
                  onChange={handleCustomChange}
                  min={MIN_CANVAS_WIDTH}
                  max={MAX_CANVAS_WIDTH}
                  suffix="px"
                />
              </div>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={config.canvasOverflowHidden}
                  onChange={(e) => setOverflow(e.target.checked)}
                />
                <span>Overflow hidden</span>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
};
