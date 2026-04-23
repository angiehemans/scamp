import { useCallback, useEffect, useState } from 'react';
import { SketchPicker, type ColorResult, type RGBColor } from 'react-color';
import type { ThemeToken } from '@shared/types';
import { usePopover } from '../../hooks/usePopover';
import { Tooltip } from './Tooltip';
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

const POPOVER_WIDTH = 231;
const POPOVER_HEIGHT = 400;

export const ColorInput = ({
  value,
  onChange,
  presetColors,
  tokens,
  onOpenTheme,
}: Props): JSX.Element => {
  const [draft, setDraft] = useState(value);
  const [tab, setTab] = useState<PopoverTab>('color');

  const popover = usePopover<HTMLButtonElement>({
    position: {
      width: POPOVER_WIDTH,
      desiredMaxHeight: POPOVER_HEIGHT,
      align: 'left',
      // Flip above whenever the SketchPicker wouldn't fit below — the
      // picker is fixed-height so we don't want it clipped by the
      // viewport edge.
      minFitBelow: POPOVER_HEIGHT,
    },
  });

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
      <Tooltip label="Pick color">
        <button
          ref={popover.triggerRef}
          type="button"
          className={styles.colorSwatch}
          onClick={popover.toggle}
        >
          <span
            className={styles.colorSwatchInner}
            style={{ background: resolved }}
          />
        </button>
      </Tooltip>
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
        {popover.open && popover.position && (
          <div
            ref={popover.popoverRef}
            className={`${styles.colorPopover} ${styles.sketchDark}`}
            style={{
              left: popover.position.left,
              top: popover.position.top,
              bottom: popover.position.bottom,
            }}
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
                        popover.setOpen(false);
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
                          popover.setOpen(false);
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
        )}
      </div>
    </div>
  );
};
