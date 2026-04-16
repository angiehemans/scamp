import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { IconColorSwatch } from '@tabler/icons-react';
import type { ThemeToken } from '@shared/types';
import {
  computePopoverPosition,
  type PopoverPosition,
} from '@lib/popoverPosition';
import { Tooltip } from './Tooltip';
import styles from './TokenOrNumberInput.module.css';

type Props = {
  /**
   * Current stored CSS value — e.g. `"16px"`, `"1rem"`, `"1.5"`, or
   * `"var(--text-lg)"`. Undefined for empty.
   */
  value: string | undefined;
  /** Tokens eligible for this field (pre-filtered by category). */
  tokens: ReadonlyArray<ThemeToken>;
  /**
   * Unit appended when the user types a bare number (Figma-style
   * fallback). Pass `''` when unitless is the preferred form
   * (line-height).
   */
  defaultUnit: 'px' | '';
  onChange: (value: string | undefined) => void;
  /** Called when the user clicks "Add token" from the empty popover. */
  onOpenTheme?: () => void;
  /** Inline prefix label (e.g. "Sz", "LH"). */
  prefix?: string;
  placeholder?: string;
  /** Tooltip on the whole row. */
  title?: string;
};

const VAR_RE = /^var\(\s*(--[\w-]+)\s*\)$/;
const UNIT_RE = /(px|rem|em|%|pt|vw|vh|vmin|vmax|ch|ex)$/i;
const UNITLESS_NUMBER_RE = /^-?\d*\.?\d+$/;
const POPOVER_WIDTH = 180;
const POPOVER_MAX_HEIGHT = 320;

const isVarRef = (value: string | undefined): boolean =>
  value !== undefined && VAR_RE.test(value.trim());

const tokenNameFromValue = (value: string): string => {
  const m = value.match(VAR_RE);
  return m ? (m[1] ?? '') : '';
};

/**
 * Commit-time formatter. Applies Figma-style px fallback when the user
 * typed a bare number and the field expects a unit. Returns `null`
 * when the input can't be interpreted (caller reverts).
 */
const formatCommit = (
  draft: string,
  defaultUnit: 'px' | ''
): string | null => {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return '';
  // Token refs pass through.
  if (VAR_RE.test(trimmed)) return trimmed;
  // Bare number: maybe append the default unit.
  if (UNITLESS_NUMBER_RE.test(trimmed)) {
    if (defaultUnit === '') return trimmed;
    return `${trimmed}${defaultUnit}`;
  }
  // Number with unit → accept.
  if (UNIT_RE.test(trimmed) && /\d/.test(trimmed)) return trimmed;
  // Anything else we don't know how to format.
  return null;
};

export const TokenOrNumberInput = ({
  value,
  tokens,
  defaultUnit,
  onChange,
  onOpenTheme,
  prefix,
  placeholder,
  title,
}: Props): JSX.Element => {
  const [draft, setDraft] = useState<string>(value ?? '');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);

  /**
   * Ref on the token-picker icon button itself. We measure its client
   * rect inside the click handler (same pattern ColorInput uses) so
   * the popover positions synchronously relative to the actual on-
   * screen button, with no `useLayoutEffect` timing concerns.
   */
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = (): void => {
    const formatted = formatCommit(draft, defaultUnit);
    if (formatted === null) {
      // Revert on invalid.
      setDraft(value ?? '');
      return;
    }
    if (formatted === '') {
      if (value !== undefined) onChange(undefined);
      return;
    }
    if (formatted !== value) onChange(formatted);
    setDraft(formatted);
  };

  // Arrow-key stepping: only meaningful for numeric values. Parse the
  // draft, step by 1 (or 10 with shift), preserve the unit suffix.
  const step = (delta: number): void => {
    const match = draft.trim().match(/^(-?\d*\.?\d+)(\D*)$/);
    if (!match) return;
    const n = Number(match[1]);
    if (!Number.isFinite(n)) return;
    const unit = match[2] ?? '';
    const next = `${n + delta}${unit}`;
    setDraft(next);
    onChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(e.shiftKey ? 10 : 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(e.shiftKey ? -10 : -1);
      return;
    }
  };

  /**
   * Measure the icon button and set the popover position, all
   * synchronously inside the click. The shared `computePopoverPosition`
   * handles the math so every token-picker menu in the app behaves the
   * same (below by default, only flips above when genuinely out of
   * room, max-height clamped to available space).
   */
  const openPopover = (): void => {
    const btn = buttonRef.current;
    if (!btn) return;
    const pos = computePopoverPosition(btn.getBoundingClientRect(), {
      width: POPOVER_WIDTH,
      desiredMaxHeight: POPOVER_MAX_HEIGHT,
      align: 'right',
    });
    setPopoverPos(pos);
    setPopoverOpen(true);
  };

  const showingToken = isVarRef(value);
  const tokenName = showingToken && value ? tokenNameFromValue(value) : '';

  const clearToken = (): void => {
    onChange(undefined);
  };

  const selectToken = (token: ThemeToken): void => {
    onChange(`var(${token.name})`);
    setPopoverOpen(false);
  };

  const rowEl = (
    <div className={styles.row}>
      {prefix && <span className={styles.prefix}>{prefix}</span>}
      {showingToken ? (
        <div className={styles.pill}>
          <span className={styles.pillLabel}>{tokenName}</span>
          <button
            type="button"
            className={styles.pillClear}
            onClick={clearToken}
            aria-label="Clear token"
          >
            ×
          </button>
        </div>
      ) : (
        <input
          type="text"
          inputMode="decimal"
          className={styles.input}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      )}
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.tokenButton} ${
          showingToken ? styles.tokenButtonActive : ''
        }`}
        onClick={() => {
          if (popoverOpen) setPopoverOpen(false);
          else openPopover();
        }}
        aria-label="Pick token"
      >
        <IconColorSwatch size={14} stroke={1.75} />
      </button>
    </div>
  );

  // Render the popover into `document.body` via a portal so it can't
  // be affected by any `transform`, `filter`, or `overflow` on parent
  // components — it positions purely against the viewport.
  const popoverEl = popoverOpen && popoverPos ? (
    <>
      <div
        className={styles.popoverBackdrop}
        onMouseDown={() => setPopoverOpen(false)}
      />
      <div
        className={styles.popover}
        style={{
          left: popoverPos.left,
          top: popoverPos.top,
          bottom: popoverPos.bottom,
          width: popoverPos.width,
          maxHeight: popoverPos.maxHeight,
        }}
        role="listbox"
      >
        {tokens.length === 0 ? (
          <div className={styles.empty}>
            <div>No matching tokens yet.</div>
            {onOpenTheme && (
              <button
                type="button"
                className={styles.addTokenButton}
                onClick={() => {
                  setPopoverOpen(false);
                  onOpenTheme();
                }}
              >
                + Add token
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tokenList}>
            {tokens.map((token) => (
              <button
                key={token.name}
                type="button"
                role="option"
                className={styles.tokenRow}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectToken(token)}
              >
                <span className={styles.tokenRowIcon} aria-hidden="true">
                  <IconColorSwatch size={14} stroke={1.75} />
                </span>
                <span className={styles.tokenRowName}>{token.name}</span>
                <span className={styles.tokenRowValue}>{token.value}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  ) : null;

  return (
    <>
      {title ? <Tooltip label={title}>{rowEl}</Tooltip> : rowEl}
      {popoverEl && createPortal(popoverEl, document.body)}
    </>
  );
};
