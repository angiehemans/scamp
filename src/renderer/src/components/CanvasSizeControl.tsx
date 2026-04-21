import { useEffect, useRef, useState } from 'react';
import type { ProjectConfig } from '@shared/types';
import { MAX_CANVAS_WIDTH, MIN_CANVAS_WIDTH } from '@shared/types';
import { clampCanvasWidth } from '@shared/projectConfig';
import { Tooltip } from './controls/Tooltip';
import styles from './CanvasSizeControl.module.css';

type Preset = {
  label: string;
  width: number;
};

const PRESETS: ReadonlyArray<Preset> = [
  { label: 'Mobile', width: 390 },
  { label: 'Tablet', width: 768 },
  { label: 'Desktop', width: 1440 },
  { label: 'Wide', width: 1920 },
];

type Props = {
  config: ProjectConfig;
  onChange: (next: ProjectConfig) => void;
};

/**
 * Toolbar control for the canvas viewport size. Displays the current
 * width; opens a popover with preset buttons, a custom-width input,
 * and the overflow-hidden toggle. All changes commit immediately via
 * `onChange`, which writes through `scamp.config.json`.
 */
export const CanvasSizeControl = ({ config, onChange }: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<string>(String(config.canvasWidth));
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCustom(String(config.canvasWidth));
  }, [config.canvasWidth]);

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

  const setWidth = (width: number): void => {
    onChange({ ...config, canvasWidth: clampCanvasWidth(width) });
  };

  const setOverflow = (overflow: boolean): void => {
    onChange({ ...config, canvasOverflowHidden: overflow });
  };

  const handleCustomCommit = (): void => {
    const parsed = Number(custom);
    if (!Number.isFinite(parsed)) {
      setCustom(String(config.canvasWidth));
      return;
    }
    const clamped = clampCanvasWidth(parsed);
    setCustom(String(clamped));
    setWidth(clamped);
  };

  const currentPreset = PRESETS.find((p) => p.width === config.canvasWidth);
  const buttonLabel = currentPreset
    ? `${currentPreset.label} · ${config.canvasWidth}`
    : `${config.canvasWidth}px`;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <Tooltip label="Canvas width">
        <button
          className={styles.button}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {buttonLabel}
          <span className={styles.caret} aria-hidden="true">
            ▾
          </span>
        </button>
      </Tooltip>
      {open && (
        <div className={styles.popover} role="dialog">
          <div className={styles.sectionLabel}>Preset</div>
          <div className={styles.presetGrid}>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                className={`${styles.presetButton} ${
                  preset.width === config.canvasWidth ? styles.presetActive : ''
                }`}
                type="button"
                onClick={() => setWidth(preset.width)}
              >
                <span className={styles.presetName}>{preset.label}</span>
                <span className={styles.presetWidth}>{preset.width}</span>
              </button>
            ))}
          </div>
          <div className={styles.sectionLabel}>Custom width</div>
          <div className={styles.customRow}>
            <input
              type="number"
              min={MIN_CANVAS_WIDTH}
              max={MAX_CANVAS_WIDTH}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onBlur={handleCustomCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className={styles.input}
            />
            <span className={styles.unit}>px</span>
          </div>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={config.canvasOverflowHidden}
              onChange={(e) => setOverflow(e.target.checked)}
            />
            <span>Overflow hidden</span>
          </label>
        </div>
      )}
    </div>
  );
};
