import { useCallback, useEffect, useRef, useState } from 'react';
import { SketchPicker, type ColorResult, type RGBColor } from 'react-color';
import type { ThemeToken } from '@shared/types';
import styles from './Controls.module.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Override preset color swatches (e.g. with project-derived colors). */
  presetColors?: ReadonlyArray<string>;
  /** Theme tokens — shown in the Tokens tab of the popover. */
  tokens?: ReadonlyArray<ThemeToken>;
  /** Called when the user clicks "Add Token" from the empty tokens tab. */
  onOpenTheme?: () => void;
};

// ---- Color format helpers ------------------------------------------------

const HEX6_RE = /^#[0-9a-fA-F]{6}$/;
const HEX3_RE = /^#[0-9a-fA-F]{3}$/;
const RGBA_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/;
const VAR_RE = /^var\(\s*(--[\w-]+)\s*\)$/;

const resolveVar = (
  value: string,
  tokens: ReadonlyArray<ThemeToken> | undefined
): string => {
  if (!tokens || tokens.length === 0) return value;
  const m = value.match(VAR_RE);
  if (!m) return value;
  const found = tokens.find((t) => t.name === m[1]);
  return found ? found.value : value;
};

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
  return trimmed;
};

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
      boxShadow: 'none',
      border: '1px solid #2c2c2c',
      borderTop: 'none',
      borderRadius: '0 0 6px 6px',
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

type PopoverTab = 'color' | 'tokens';

const PICKER_HEIGHT = 400;

export const ColorInput = ({
  value,
  onChange,
  presetColors,
  tokens,
  onOpenTheme,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; above: boolean }>({
    top: 0, left: 0, above: false,
  });
  const [tab, setTab] = useState<PopoverTab>('color');
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

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const resolved = resolveVar(value, tokens);
  const pickerColor = parseColorForPicker(resolved);
  const isVarRef = VAR_RE.test(value);
  const varName = isVarRef ? value.match(VAR_RE)?.[1] : null;

  const colorTokens = tokens?.filter((t) => {
    const v = t.value.trim();
    return (
      HEX6_RE.test(v) ||
      HEX3_RE.test(v) ||
      RGBA_RE.test(v) ||
      /^[a-z]+$/i.test(v)
    );
  });

  // Show the token name in the text input when a var() is applied.
  const displayValue = isVarRef && varName ? varName : draft;

  return (
    <div className={`${styles.colorInputRow} ${styles.colorInputRowSwatch}`}>
        <button
          ref={swatchRef}
          type="button"
          className={styles.colorSwatch}
          onClick={() => {
            if (!open && swatchRef.current) {
              const rect = swatchRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const above = spaceBelow < PICKER_HEIGHT;
              setPopoverPos({
                top: above ? rect.top : rect.bottom + 4,
                left: rect.left,
                above,
              });
            }
            setOpen((v) => !v);
          }}
          title="Pick color"
        >
          <span
            className={styles.colorSwatchInner}
            style={{ background: resolved }}
          />
        </button>
        <input
          type="text"
          className={styles.colorText}
          value={displayValue}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <div className={styles.colorPickerWrap}>
          {open && (
            <>
              <div
                className={styles.colorPopoverBackdrop}
                onClick={() => setOpen(false)}
              />
              <div
                ref={popoverRef}
                className={`${styles.colorPopover} ${styles.sketchDark}`}
                style={popoverPos.above
                  ? { bottom: window.innerHeight - popoverPos.top + 4, left: popoverPos.left }
                  : { top: popoverPos.top, left: popoverPos.left }
                }
              >
                <div className={styles.pickerTabs}>
                  <button
                    type="button"
                    className={`${styles.pickerTab} ${tab === 'color' ? styles.pickerTabActive : ''}`}
                    onClick={() => setTab('color')}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    className={`${styles.pickerTab} ${tab === 'tokens' ? styles.pickerTabActive : ''}`}
                    onClick={() => setTab('tokens')}
                  >
                    Tokens
                  </button>
                </div>
                {tab === 'color' ? (
                  <SketchPicker
                    color={pickerColor}
                    onChangeComplete={handlePickerChange}
                    presetColors={[...(presetColors ?? PRESET_COLORS)]}
                    styles={DARK_SKETCH_STYLES}
                    width="209px"
                  />
                ) : (
                  <div className={styles.tokenList}>
                    {colorTokens && colorTokens.length > 0 ? (
                      colorTokens.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          className={`${styles.tokenListItem} ${value === `var(${t.name})` ? styles.tokenListItemActive : ''}`}
                          onClick={() => {
                            onChange(`var(${t.name})`);
                            setOpen(false);
                          }}
                        >
                          <span
                            className={styles.tokenListSwatch}
                            style={{ background: t.value }}
                          />
                          <span className={styles.tokenListName}>{t.name}</span>
                          <span className={styles.tokenListValue}>{t.value}</span>
                        </button>
                      ))
                    ) : (
                      <div className={styles.tokenListEmpty}>
                        <span>No tokens defined yet.</span>
                        {onOpenTheme && (
                          <button
                            type="button"
                            className={styles.tokenListAddButton}
                            onClick={() => {
                              setOpen(false);
                              onOpenTheme();
                            }}
                          >
                            + Add Tokens
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
  );
};
