import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { filterFonts } from '@lib/fontFilter';
import { formatFontValue, quoteFamilyName } from '@lib/fontFallback';
import type { AvailableFont } from '@store/fontsSlice';
import { Tooltip } from './Tooltip';
import styles from './FontPicker.module.css';

type Props = {
  /**
   * Current stored CSS `font-family` value, e.g. `"Inter", sans-serif`.
   * An empty string means "system font" (no override).
   */
  value: string;
  /** Available fonts with their source (system vs project). */
  fonts: ReadonlyArray<AvailableFont>;
  /**
   * Called with the full formatted CSS expression — `formatFontValue()`
   * output — so the caller writes it straight to `element.fontFamily`.
   * An empty string clears the override.
   */
  onChange: (value: string) => void;
  /** Tooltip shown on hover of the closed trigger. */
  title?: string;
};

const ROW_HEIGHT = 28;
const VIEWPORT_HEIGHT = 280;
const POPOVER_WIDTH = 260;
/** search input (30) + viewport (280) + borders (~2) */
const POPOVER_HEIGHT = 312;
/** Minimum gap between the popover and the window edge. */
const EDGE_MARGIN = 8;
/**
 * How many extra rows to render above and below the visible window so
 * fast scrolling doesn't flash blank rows at the edges.
 */
const OVERSCAN = 4;
const SYSTEM_OPTION = { value: '', label: 'System font' } as const;

type Option = {
  /** Full CSS expression — what we write to `element.fontFamily`. */
  value: string;
  /** Human-readable label shown in the row. */
  label: string;
  /** Family name to apply as `style.fontFamily` for the preview. */
  previewFamily: string | null;
  /** True when the row doesn't correspond to an enumerated system font. */
  unknown?: boolean;
  /** Badge text shown at the right of the row (e.g. "Project"). */
  badge?: string;
};

/**
 * Extract the primary family name from a stored CSS `font-family`
 * value. Handles quoted and unquoted forms, strips a trailing generic
 * fallback. Returns the trimmed original if parsing fails so the
 * picker never throws on agent-written values.
 */
const primaryFamily = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  const firstComma = trimmed.indexOf(',');
  const head = firstComma === -1 ? trimmed : trimmed.slice(0, firstComma);
  const cleaned = head.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    return cleaned.slice(1, -1);
  }
  return cleaned;
};

export const FontPicker = ({
  value,
  fonts,
  onChange,
  title,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(
    null
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Label shown on the closed trigger.
  const triggerLabel = useMemo(() => {
    if (value.trim().length === 0) return null;
    return primaryFamily(value);
  }, [value]);

  // Options visible in the dropdown for the current query. The system
  // default and (when applicable) a "Custom" row for a stored value we
  // don't know about sit above the enumerated fonts.
  const options = useMemo<Option[]>(() => {
    const familyNames = fonts.map((f) => f.family);
    const filtered = filterFonts(familyNames, query);
    const sourceByFamily = new Map<string, AvailableFont['source']>();
    for (const f of fonts) sourceByFamily.set(f.family, f.source);

    const currentFamily = primaryFamily(value);
    const currentIsKnown =
      currentFamily.length > 0 &&
      fonts.some((f) => f.family.toLowerCase() === currentFamily.toLowerCase());

    const result: Option[] = [];
    // "System font" stays at the top unless the user is actively
    // searching; hide when a non-empty query wouldn't match it.
    const q = query.trim().toLowerCase();
    if (q.length === 0 || 'system font'.includes(q)) {
      result.push({
        value: SYSTEM_OPTION.value,
        label: SYSTEM_OPTION.label,
        previewFamily: null,
      });
    }
    // Preserve the stored value as a first-class row if it's not in the
    // enumerated font list — otherwise it'd vanish from the dropdown.
    if (value.length > 0 && !currentIsKnown && q.length === 0) {
      result.push({
        value,
        label: currentFamily || value,
        previewFamily: currentFamily || null,
        unknown: true,
      });
    }
    for (const family of filtered) {
      const source = sourceByFamily.get(family);
      result.push({
        value: formatFontValue(family),
        label: family,
        previewFamily: family,
        badge: source === 'project' ? 'Project' : undefined,
      });
    }
    return result;
  }, [fonts, query, value]);

  // Reset active row when the filtered list changes under us.
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, options.length - 1)));
  }, [options.length]);

  const handleScroll = useCallback((): void => {
    const vp = viewportRef.current;
    if (vp) setScrollTop(vp.scrollTop);
  }, []);

  // Position the popover relative to the trigger once open. Uses fixed
  // positioning so it escapes any clipping parents (the properties
  // panel has `overflow: auto`). Flips above the trigger when below
  // would overflow the window, and clamps horizontally so the popover
  // always fits the viewport.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const position = (): void => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const gap = 4;
      const spaceBelow = vh - rect.bottom - EDGE_MARGIN;
      const spaceAbove = rect.top - EDGE_MARGIN;
      const fitsBelow = spaceBelow >= POPOVER_HEIGHT + gap;
      const fitsAbove = spaceAbove >= POPOVER_HEIGHT + gap;

      // Prefer below; flip up when below doesn't fit AND above has more
      // room. If neither side fits the full popover we still pick the
      // larger side — the internal viewport scrolls so a shorter-than-
      // ideal popover still works.
      const placeAbove = !fitsBelow && (fitsAbove || spaceAbove > spaceBelow);

      let top: number;
      if (placeAbove) {
        top = rect.top - POPOVER_HEIGHT - gap;
        if (top < EDGE_MARGIN) top = EDGE_MARGIN;
      } else {
        top = rect.bottom + gap;
        const maxTop = vh - POPOVER_HEIGHT - EDGE_MARGIN;
        if (top > maxTop) top = Math.max(EDGE_MARGIN, maxTop);
      }

      let left = rect.left;
      const maxLeft = vw - POPOVER_WIDTH - EDGE_MARGIN;
      if (left > maxLeft) left = Math.max(EDGE_MARGIN, maxLeft);
      if (left < EDGE_MARGIN) left = EDGE_MARGIN;

      setPopoverPos({ left, top });
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [open]);

  // Focus the search input on open. Seed the query with the current
  // family so the user can immediately refine rather than retype.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setScrollTop(0);
    const raf = requestAnimationFrame(() => {
      searchRef.current?.focus();
      // Position the active row on the currently selected font so Enter
      // without typing confirms the existing selection.
      const currentIdx = options.findIndex((o) => o.value === value);
      if (currentIdx >= 0) setActiveIndex(currentIdx);
      else setActiveIndex(0);
    });
    return () => cancelAnimationFrame(raf);
    // We intentionally don't re-run when `options` or `value` change —
    // this effect is a one-shot open handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll the active row into view on arrow-key navigation.
  useEffect(() => {
    if (!open) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const rowTop = activeIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    if (rowTop < vp.scrollTop) {
      vp.scrollTop = rowTop;
    } else if (rowBottom > vp.scrollTop + VIEWPORT_HEIGHT) {
      vp.scrollTop = rowBottom - VIEWPORT_HEIGHT;
    }
  }, [activeIndex, open]);

  const close = (): void => {
    setOpen(false);
    setQuery('');
    // Return focus to the trigger so keyboard navigation in the
    // properties panel resumes.
    triggerRef.current?.focus();
  };

  const commit = (option: Option): void => {
    onChange(option.value);
    close();
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = options[activeIndex];
      if (selected) commit(selected);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    // Stop shortcut keys (V, T, I, etc.) from firing while the user
    // types into the search field.
    e.stopPropagation();
  };

  // Windowed render: compute which rows are on-screen.
  const totalHeight = options.length * ROW_HEIGHT;
  const firstVisible = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN
  );
  const lastVisible = Math.min(
    options.length,
    Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN
  );
  const visibleRows = options.slice(firstVisible, lastVisible);

  const triggerEl = (
    <button
      ref={triggerRef}
      type="button"
      className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
      onClick={() => setOpen((v) => !v)}
      // Render the trigger itself in the selected font so it doubles as
      // a preview.
      style={
        triggerLabel
          ? { fontFamily: quoteFamilyName(triggerLabel) }
          : undefined
      }
    >
      <span
        className={`${styles.triggerLabel} ${
          triggerLabel ? '' : styles.triggerPlaceholder
        }`}
      >
        {triggerLabel ?? 'System font'}
      </span>
      <span className={styles.triggerCaret}>▾</span>
    </button>
  );

  return (
    <>
      {title ? <Tooltip label={title}>{triggerEl}</Tooltip> : triggerEl}
      {open && popoverPos && (
        <>
          <div className={styles.backdrop} onMouseDown={close} />
          <div
            className={styles.popover}
            style={{ left: popoverPos.left, top: popoverPos.top }}
            role="listbox"
          >
            <input
              ref={searchRef}
              className={styles.search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
                setScrollTop(0);
                if (viewportRef.current) viewportRef.current.scrollTop = 0;
              }}
              onKeyDown={handleKey}
              placeholder="Search fonts…"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <div
              ref={viewportRef}
              className={styles.listViewport}
              onScroll={handleScroll}
            >
              {options.length === 0 ? (
                <div className={styles.rowEmpty}>No matching fonts</div>
              ) : (
                <div
                  className={styles.listSpacer}
                  style={{ height: totalHeight }}
                >
                  {visibleRows.map((option, i) => {
                    const idx = firstVisible + i;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={`${option.value}::${option.label}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={`${styles.row} ${isActive ? styles.rowActive : ''} ${
                          option.unknown ? styles.rowUnknown : ''
                        }`}
                        style={{
                          top: idx * ROW_HEIGHT,
                          height: ROW_HEIGHT,
                          fontFamily: option.previewFamily
                            ? quoteFamilyName(option.previewFamily)
                            : undefined,
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseDown={(e) => {
                          // Prevent blur of the search input (which would
                          // close the popover) before onClick fires.
                          e.preventDefault();
                        }}
                        onClick={() => commit(option)}
                      >
                        <span className={styles.rowLabel}>
                          {option.unknown
                            ? `Custom: ${option.label}`
                            : option.label}
                        </span>
                        {option.badge && (
                          <span className={styles.rowBadge}>{option.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
