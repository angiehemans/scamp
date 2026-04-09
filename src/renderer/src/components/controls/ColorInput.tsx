import { useCallback, useEffect, useRef, useState } from 'react';
import { SketchPicker, type ColorResult, type RGBColor } from 'react-color';
import styles from './Controls.module.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

// ---- Color format helpers ------------------------------------------------

const HEX6_RE = /^#[0-9a-fA-F]{6}$/;
const HEX3_RE = /^#[0-9a-fA-F]{3}$/;
const RGBA_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/;

/**
 * Convert the stored color string into something SketchPicker understands.
 * Returns a hex string or an {r,g,b,a} object.
 */
const parseColorForPicker = (value: string): string | RGBColor => {
  const trimmed = value.trim();
  if (HEX6_RE.test(trimmed) || HEX3_RE.test(trimmed)) return trimmed;
  const m = trimmed.match(RGBA_RE);
  if (m) {
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] !== undefined ? Number(m[4]) : 1,
    };
  }
  // Named colors, `transparent`, or anything exotic — pass as-is and let
  // the picker do its best.
  return trimmed;
};

/** Emit `#rrggbb` when alpha=1, `rgba(r,g,b,a)` when alpha<1. */
const colorResultToString = (color: ColorResult): string => {
  const { r, g, b, a } = color.rgb;
  if (a === undefined || a >= 1) return color.hex;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// ---- Dark-mode style overrides for SketchPicker -------------------------

const DARK_SKETCH_STYLES = {
  default: {
    picker: {
      background: '#1f1f1f',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      border: '1px solid #2c2c2c',
      borderRadius: '6px',
    },
  },
};

const PRESET_COLORS = [
  'transparent',
  '#ffffff',
  '#000000',
  '#666666',
  '#cccccc',
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
];

// ---- Component -----------------------------------------------------------

/**
 * A color swatch + popover SketchPicker that supports hex and rgba. Replaces
 * the old native `<input type="color">`. The external interface (`value` /
 * `onChange`) is unchanged so all consuming sections work without edits.
 */
/** Approximate height of the SketchPicker at our configured width. */
const PICKER_HEIGHT = 330;

export const ColorInput = ({ value, onChange }: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [openAbove, setOpenAbove] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === value) {
      setDraft(value);
      return;
    }
    onChange(trimmed);
  };

  const handlePickerChange = useCallback(
    (color: ColorResult) => {
      const next = colorResultToString(color);
      onChange(next);
    },
    [onChange]
  );

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const pickerColor = parseColorForPicker(value);

  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <div className={styles.colorPickerWrap}>
          <button
            ref={swatchRef}
            type="button"
            className={styles.colorSwatch}
            onClick={() => {
              if (!open && swatchRef.current) {
                const rect = swatchRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                setOpenAbove(spaceBelow < PICKER_HEIGHT);
              }
              setOpen((v) => !v);
            }}
            title="Pick color"
          >
            <span
              className={styles.colorSwatchInner}
              style={{ background: value }}
            />
          </button>
          {open && (
            <>
              <div
                className={styles.colorPopoverBackdrop}
                onClick={() => setOpen(false)}
              />
              <div
                ref={popoverRef}
                className={`${styles.colorPopover} ${styles.sketchDark} ${openAbove ? styles.colorPopoverAbove : ''}`}
              >
                <SketchPicker
                  color={pickerColor}
                  onChangeComplete={handlePickerChange}
                  presetColors={PRESET_COLORS}
                  styles={DARK_SKETCH_STYLES}
                  width="209px"
                />
              </div>
            </>
          )}
        </div>
        <input
          type="text"
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
};
