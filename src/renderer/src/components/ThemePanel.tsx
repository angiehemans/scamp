import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { IconColorSwatch } from '@tabler/icons-react';
import { useCanvasStore } from '@store/canvasSlice';
import { useFontsStore, selectAllFonts } from '@store/fontsSlice';
import { serializeThemeFile } from '@lib/parseTheme';
import { classifyToken, type TokenCategory } from '@lib/tokenClassify';
import { buildColorModel, type PrimitivePalette } from '@lib/colorModel';
import { generatePalette } from '@lib/palette';
import type { ThemeToken } from '@shared/types';
import { errorMessage } from '@shared/errorMessage';
import { Button } from './controls/Button';
import { ColorInput } from './controls/ColorInput';
import { FontPicker } from './controls/FontPicker';
import { Tooltip } from './controls/Tooltip';
import styles from './ThemePanel.module.css';

/** Category → default seed value when the user changes a typography
 * token's type via the badge menu. The classifier picks up the
 * re-seeded value on the next render so the badge text, value input,
 * and row shape all line up. */
const TYPOGRAPHY_SEED: Record<
  'fontSize' | 'lineHeight' | 'fontFamily',
  string
> = {
  fontSize: '1rem',
  lineHeight: '1.5',
  fontFamily: "'Inter', sans-serif",
};

const TYPOGRAPHY_CATEGORY_OPTIONS: ReadonlyArray<{
  value: 'fontSize' | 'lineHeight' | 'fontFamily';
  label: string;
}> = [
  { value: 'fontSize', label: 'Size' },
  { value: 'lineHeight', label: 'Line-height' },
  { value: 'fontFamily', label: 'Font' },
];

type Props = {
  projectPath: string;
  onClose: () => void;
};

type PendingDelete = {
  index: number;
  name: string;
  usageCount: number;
};

// The editor renders every section stacked in the main area; the left sidebar
// nav (ThemeSectionNav) scroll-jumps to these via `data-theme-section`.
// see docs/plans/design-system-plan.md
export type ThemeSectionId = 'colors' | 'typography' | 'unknown';

const TYPOGRAPHY_CATEGORIES: ReadonlySet<TokenCategory> = new Set<TokenCategory>([
  'fontSize',
  'lineHeight',
  'fontFamily',
]);

const categoryBadge = (category: TokenCategory): string => {
  switch (category) {
    case 'fontSize':
      return 'Size';
    case 'lineHeight':
      return 'Line-H';
    case 'fontFamily':
      return 'Font';
    case 'color':
      return 'Color';
    default:
      return 'Unknown';
  }
};

/** Seed colour a freshly-added palette generates its ramp from. */
const DEFAULT_PALETTE_SEED = '#3b82f6';

/** A `var(--color-<palette>-<shade>)` reference the semantic dropdown targets. */
const SEMANTIC_REF_RE = /^var\(--color-(.+)-(\d+)\)$/;

/** True when `name` is a numeric-shade token of the given palette. */
const isPaletteShade = (name: string, palette: string): boolean =>
  new RegExp(`^--color-${palette}-\\d+$`).test(name);

/** Validate a token name: must start with --, no spaces. */
const validateTokenName = (name: string): string | null => {
  if (!name.startsWith('--')) return 'Name must start with --';
  if (/\s/.test(name)) return 'Name cannot contain spaces';
  if (name.length < 3) return 'Name is too short';
  return null;
};

/**
 * Count how many elements in the tree reference a token via var().
 * Checks every field that can hold a var() ref today.
 */
const countTokenUsage = (
  elements: Record<string, unknown>,
  tokenName: string
): number => {
  const varRef = `var(${tokenName})`;
  let count = 0;
  for (const raw of Object.values(elements)) {
    const el = raw as {
      backgroundColor?: string;
      borderColor?: string;
      color?: string;
      fontSize?: string;
      lineHeight?: string;
      letterSpacing?: string;
      fontFamily?: string;
    };
    if (el.backgroundColor === varRef) count += 1;
    if (el.borderColor === varRef) count += 1;
    if (el.color === varRef) count += 1;
    if (el.fontSize === varRef) count += 1;
    if (el.lineHeight === varRef) count += 1;
    if (el.letterSpacing === varRef) count += 1;
    if (el.fontFamily?.includes(varRef)) count += 1;
  }
  return count;
};

/**
 * Modal for managing project design tokens (CSS custom properties).
 * Tabs split tokens by inferred category (colors / typography / unknown).
 * Changes write to theme.css on disk; chokidar hot-reloads them.
 */
export const ThemePanel = ({ projectPath, onClose }: Props): JSX.Element => {
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const elements = useCanvasStore((s) => s.elements);
  const allFonts = useFontsStore(selectAllFonts);
  const [localTokens, setLocalTokens] = useState<ThemeToken[]>([...themeTokens]);
  const projectFormat = useCanvasStore((s) => s.projectFormat);
  const isLegacy = projectFormat === 'legacy';
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  /** Palette pending deletion — set only when a semantic token references it. */
  const [pendingPaletteDelete, setPendingPaletteDelete] = useState<{
    palette: PrimitivePalette;
    refCount: number;
  } | null>(null);
  /**
   * Which token's badge-picker menu is currently open. Carries the
   * trigger button's viewport rect so we can portal the menu out of
   * the (now-scrollable) token list — otherwise the dropdown would
   * be clipped at the list's overflow boundary.
   */
  const [badgeMenuFor, setBadgeMenuFor] = useState<{
    index: number;
    anchor: { left: number; top: number; right: number; bottom: number };
  } | null>(null);
  const closeBadgeMenu = useCallback(() => setBadgeMenuFor(null), []);

  /**
   * Ref + signal pair for "scroll the token list to the bottom on the
   * next render". `handleAddToken` bumps `scrollToEndAfterAdd` and
   * the effect runs after React commits the new row so we read the
   * post-add `scrollHeight`.
   */
  const editorRef = useRef<HTMLDivElement>(null);
  const scrollTargetSection = useRef<ThemeSectionId>('colors');
  const [scrollToEndAfterAdd, setScrollToEndAfterAdd] = useState(0);
  useEffect(() => {
    if (scrollToEndAfterAdd === 0) return;
    const section = editorRef.current?.querySelector(
      `[data-theme-section="${scrollTargetSection.current}"]`
    );
    const rows = section?.querySelectorAll('[data-token-row]');
    const last = rows?.[rows.length - 1];
    if (last instanceof HTMLElement) last.scrollIntoView({ block: 'nearest' });
  }, [scrollToEndAfterAdd]);

  // Sync from store when tokens change externally (e.g. file edit).
  useEffect(() => {
    setLocalTokens([...themeTokens]);
  }, [themeTokens]);

  // Classify once per render so the tab lists and badges agree.
  const categories = useMemo(
    () => localTokens.map((t) => classifyToken(t.value)),
    [localTokens]
  );

  // Every `--color-*` token is owned by the Colors section (as a palette
  // shade or a semantic mapping). Its VALUE may classify as anything —
  // a semantic token's `var(--color-…)` reads as `unknown` — so we route
  // by NAME here, otherwise those tokens double-render in both Colors and
  // Typography/Unknown. see docs/plans/design-system-plan.md
  const isColorToken = (name: string): boolean => name.startsWith('--color-');

  const inColors = (category: TokenCategory, name: string): boolean =>
    isColorToken(name) || category === 'color';

  const tabCounts = useMemo(() => {
    let colors = 0;
    let typography = 0;
    let unknown = 0;
    categories.forEach((c, i) => {
      if (inColors(c, localTokens[i]?.name ?? '')) colors += 1;
      else if (TYPOGRAPHY_CATEGORIES.has(c)) typography += 1;
      else unknown += 1;
    });
    return { colors, typography, unknown };
  }, [categories, localTokens]);

  // Token indices grouped by section, in source order. Handlers get the
  // original index so the source array position is preserved.
  const grouped = useMemo(() => {
    const colors: number[] = [];
    const typography: number[] = [];
    const unknown: number[] = [];
    categories.forEach((c, i) => {
      const name = localTokens[i]?.name ?? '';
      if (inColors(c, name)) colors.push(i);
      else if (TYPOGRAPHY_CATEGORIES.has(c)) typography.push(i);
      else unknown.push(i);
    });
    return { colors, typography, unknown };
  }, [categories, localTokens]);

  // Structured VIEW over the flat colour tokens: primitive palettes +
  // semantic tokens. The flat list stays authoritative; every edit below
  // mutates it and reserializes. see docs/plans/design-system-plan.md
  const colorModel = useMemo(() => buildColorModel(localTokens), [localTokens]);

  /**
   * Colour-classified tokens the structured model doesn't capture — i.e.
   * not prefixed `--color-` (arbitrary names in agent-seeded / legacy
   * projects). Rendered as a flat "Other" list so they stay editable
   * instead of silently vanishing from the panel.
   */
  const otherColorIndices = useMemo(() => {
    const captured = new Set<string>();
    for (const p of colorModel.palettes)
      for (const s of p.shades) captured.add(s.name);
    for (const s of colorModel.semantic) captured.add(s.name);
    return grouped.colors.filter((i) => {
      const t = localTokens[i];
      return t ? !captured.has(t.name) : false;
    });
  }, [colorModel, grouped.colors, localTokens]);

  const writeTokens = useCallback(
    async (tokens: ThemeToken[]): Promise<void> => {
      try {
        // Preserve the font imports that live alongside tokens in
        // theme.css — the fonts panel writes to the same file. Read the
        // current file so hand-written CSS (resets, body rules) survives
        // the token rewrite. see docs/plans/design-system-plan.md
        const urls = useFontsStore.getState().projectFontUrls;
        const existing = await window.scamp.readTheme({ projectPath });
        await window.scamp.writeTheme({
          projectPath,
          content: serializeThemeFile(
            { tokens, fontImportUrls: [...urls] },
            existing
          ),
        });
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [projectPath]
  );

  const nextDefaultName = (prefix: string): string => {
    const existing = new Set(localTokens.map((t) => t.name));
    let idx = 1;
    while (existing.has(`${prefix}-${idx}`)) idx += 1;
    return `${prefix}-${idx}`;
  };

  // Colours have their own structured add flows (handleAddPalette /
  // handleAddSemantic); this drives the Typography section only.
  const handleAddToken = (section: ThemeSectionId): void => {
    let newToken: ThemeToken;
    if (section === 'typography') {
      // Cycle through size / line / family so successive clicks create
      // a balanced set instead of ten `--text-*` tokens in a row.
      const sizes = tabCounts.typography;
      const pick = sizes % 3;
      if (pick === 0) {
        newToken = { name: nextDefaultName('--text'), value: '1rem' };
      } else if (pick === 1) {
        newToken = { name: nextDefaultName('--leading'), value: '1.5' };
      } else {
        newToken = {
          name: nextDefaultName('--font'),
          value: "'Inter', sans-serif",
        };
      }
    } else {
      newToken = { name: nextDefaultName('--token'), value: '' };
    }
    const next = [...localTokens, newToken];
    setLocalTokens(next);
    void writeTokens(next);
    // Make the new row visible — without this, adding a token to a
    // long list looks like a no-op because the new row sits below the
    // scroll viewport.
    scrollTargetSection.current = section;
    setScrollToEndAfterAdd((n) => n + 1);
  };

  const handleNameChange = (index: number, newName: string): void => {
    const next = localTokens.map((t, i) =>
      i === index ? { ...t, name: newName } : t
    );
    setLocalTokens(next);
  };

  const handleNameBlur = (index: number): void => {
    const token = localTokens[index];
    if (!token) return;
    const nameError = validateTokenName(token.name);
    if (nameError) {
      setError(`${token.name}: ${nameError}`);
      setLocalTokens([...themeTokens]);
      return;
    }
    const duplicate = localTokens.some(
      (t, i) => i !== index && t.name === token.name
    );
    if (duplicate) {
      setError(`${token.name} already exists`);
      setLocalTokens([...themeTokens]);
      return;
    }
    setError(null);
    void writeTokens(localTokens);
  };

  const handleValueChange = (index: number, newValue: string): void => {
    const next = localTokens.map((t, i) =>
      i === index ? { ...t, value: newValue } : t
    );
    setLocalTokens(next);
  };

  const commitValue = (index: number): void => {
    void writeTokens(localTokens);
  };

  /** Color-tab shortcut: ColorInput commits immediately. */
  const handleColorChange = (index: number, newValue: string): void => {
    const next = localTokens.map((t, i) =>
      i === index ? { ...t, value: newValue } : t
    );
    setLocalTokens(next);
    void writeTokens(next);
  };

  const applyTokens = (next: ThemeToken[]): void => {
    setLocalTokens(next);
    void writeTokens(next);
  };

  /** Next free `palette`, `palette2`, … name (no numeric-shade suffix). */
  const nextPaletteName = (): string => {
    const names = new Set(colorModel.palettes.map((p) => p.name));
    if (!names.has('palette')) return 'palette';
    let i = 2;
    while (names.has(`palette${i}`)) i += 1;
    return `palette${i}`;
  };

  /**
   * Next free semantic name. Deliberately avoids a `-<number>` suffix,
   * which buildColorModel would misread as a primitive palette shade.
   */
  const nextSemanticName = (): string => {
    const existing = new Set(localTokens.map((t) => t.name));
    if (!existing.has('--color-custom')) return '--color-custom';
    let i = 2;
    while (existing.has(`--color-custom${i}`)) i += 1;
    return `--color-custom${i}`;
  };

  /** Add a fresh palette: a full generated ramp from the default seed. */
  const handleAddPalette = (): void => {
    const name = nextPaletteName();
    const shades = generatePalette(DEFAULT_PALETTE_SEED);
    const tokens = shades.map((s) => ({
      name: `--color-${name}-${s.shade}`,
      value: s.value,
    }));
    applyTokens([...localTokens, ...tokens]);
    scrollTargetSection.current = 'colors';
    setScrollToEndAfterAdd((n) => n + 1);
  };

  /**
   * Regenerate a palette's whole ramp from its current 500 shade (or the
   * middle shade if 500 is absent). Existing shade tokens are replaced;
   * every other token — including semantic refs to this palette — is left
   * untouched, so the mappings survive.
   */
  const handleRegeneratePalette = (palette: PrimitivePalette): void => {
    const seedShade =
      palette.shades.find((s) => s.shade === 500) ??
      palette.shades[Math.floor(palette.shades.length / 2)];
    if (!seedShade) return;
    const shades = generatePalette(seedShade.value);
    if (shades.length === 0) return;
    const kept = localTokens.filter((t) => !isPaletteShade(t.name, palette.name));
    const regenerated = shades.map((s) => ({
      name: `--color-${palette.name}-${s.shade}`,
      value: s.value,
    }));
    applyTokens([...kept, ...regenerated]);
  };

  /**
   * Rename a palette: rewrite every `--color-<old>-<shade>` token name AND
   * every `var(--color-<old>-…)` reference in other token values, so
   * semantic mappings keep resolving.
   */
  const handleRenamePalette = (oldName: string, rawNew: string): void => {
    const newName = rawNew.trim();
    if (newName === '' || newName === oldName) return;
    if (/\s/.test(newName)) {
      setError('Palette name cannot contain spaces');
      return;
    }
    if (colorModel.palettes.some((p) => p.name === newName)) {
      setError(`Palette "${newName}" already exists`);
      return;
    }
    const namePrefix = `--color-${oldName}-`;
    const refPrefix = `var(--color-${oldName}-`;
    const next = localTokens.map((t) => {
      let { name, value } = t;
      if (isPaletteShade(name, oldName))
        name = `--color-${newName}-${name.slice(namePrefix.length)}`;
      if (value.startsWith(refPrefix))
        value = `var(--color-${newName}-${value.slice(refPrefix.length)}`;
      return { name, value };
    });
    setError(null);
    applyTokens(next);
  };

  /** Count semantic tokens whose resolved value flows through this palette. */
  const paletteRefCount = (paletteName: string): number =>
    colorModel.semantic.filter((s) => {
      const m = s.value.match(SEMANTIC_REF_RE);
      return m?.[1] === paletteName;
    }).length;

  const handleDeletePaletteRequest = (palette: PrimitivePalette): void => {
    const refCount = paletteRefCount(palette.name);
    if (refCount > 0) {
      setPendingPaletteDelete({ palette, refCount });
      return;
    }
    confirmDeletePalette(palette);
  };

  const confirmDeletePalette = (palette: PrimitivePalette): void => {
    const next = localTokens.filter(
      (t) => !isPaletteShade(t.name, palette.name)
    );
    setPendingPaletteDelete(null);
    applyTokens(next);
  };

  /** Point a semantic token at a `<palette>/<shade>` primitive. */
  const handleSemanticMap = (
    tokenName: string,
    paletteName: string,
    shade: number
  ): void => {
    const value = `var(--color-${paletteName}-${shade})`;
    applyTokens(
      localTokens.map((t) => (t.name === tokenName ? { ...t, value } : t))
    );
  };

  const handleAddSemantic = (): void => {
    const first = colorModel.palettes[0];
    const mid =
      first?.shades.find((s) => s.shade === 500) ??
      first?.shades[Math.floor((first?.shades.length ?? 0) / 2)];
    const value =
      first && mid ? `var(--color-${first.name}-${mid.shade})` : '#888888';
    applyTokens([...localTokens, { name: nextSemanticName(), value }]);
    scrollTargetSection.current = 'colors';
    setScrollToEndAfterAdd((n) => n + 1);
  };

  /**
   * Reassign a typography token to a different category. We swap the
   * value for a category-appropriate seed; the classifier re-runs on
   * every render so the badge, input shape, and tab placement all
   * update in lockstep. If the token already matches the requested
   * category we just close the menu — no destructive overwrite.
   */
  const handleChangeCategory = (
    index: number,
    newCategory: 'fontSize' | 'lineHeight' | 'fontFamily'
  ): void => {
    setBadgeMenuFor(null);
    const token = localTokens[index];
    if (!token) return;
    const currentCategory = classifyToken(token.value);
    if (currentCategory === newCategory) return;
    const next = localTokens.map((t, i) =>
      i === index ? { ...t, value: TYPOGRAPHY_SEED[newCategory] } : t
    );
    setLocalTokens(next);
    void writeTokens(next);
  };

  /** FontPicker commits the full CSS expression — write immediately. */
  const handleFontFamilyChange = (index: number, newValue: string): void => {
    if (newValue.trim().length === 0) return;
    const next = localTokens.map((t, i) =>
      i === index ? { ...t, value: newValue } : t
    );
    setLocalTokens(next);
    void writeTokens(next);
  };

  const handleDeleteRequest = (index: number): void => {
    const token = localTokens[index];
    if (!token) return;
    const usageCount = countTokenUsage(elements, token.name);
    if (usageCount > 0) {
      setPendingDelete({ index, name: token.name, usageCount });
      return;
    }
    confirmDelete(index);
  };

  const confirmDelete = (index: number): void => {
    const next = localTokens.filter((_, i) => i !== index);
    setLocalTokens(next);
    setPendingDelete(null);
    void writeTokens(next);
  };

  const renderColorRow = (index: number, token: ThemeToken): JSX.Element => (
    <div key={index} className={styles.tokenRow} data-token-row>
      <input
        type="text"
        className={styles.tokenName}
        value={token.name}
        onChange={(e) => handleNameChange(index, e.target.value)}
        onBlur={() => handleNameBlur(index)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <div className={styles.tokenColor}>
        <ColorInput
          value={token.value}
          onChange={(v) => handleColorChange(index, v)}
        />
      </div>
      <Tooltip label="Delete token">
        <button
          className={styles.tokenDelete}
          onClick={() => handleDeleteRequest(index)}
          type="button"
        >
          x
        </button>
      </Tooltip>
    </div>
  );

  const renderPaletteBlock = (palette: PrimitivePalette): JSX.Element => (
    <div key={palette.name} className={styles.palette} data-token-row>
      <div className={styles.paletteHeader}>
        <input
          type="text"
          className={styles.paletteName}
          defaultValue={palette.name}
          aria-label={`Palette name for ${palette.name}`}
          onBlur={(e) => handleRenamePalette(palette.name, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <Tooltip label="Regenerate ramp from the 500 shade">
          <button
            type="button"
            className={styles.generateButton}
            onClick={() => handleRegeneratePalette(palette)}
          >
            Generate
          </button>
        </Tooltip>
        <Tooltip label="Delete palette">
          <button
            type="button"
            className={styles.tokenDelete}
            onClick={() => handleDeletePaletteRequest(palette)}
          >
            x
          </button>
        </Tooltip>
      </div>
      <div className={styles.shadeRow}>
        {palette.shades.map((shade) => {
          const idx = localTokens.findIndex((t) => t.name === shade.name);
          return (
            <div key={shade.name} className={styles.shade}>
              <div className={styles.shadeSwatch}>
                <ColorInput
                  value={shade.value}
                  onChange={(v) => idx >= 0 && handleColorChange(idx, v)}
                />
              </div>
              <span className={styles.shadeLabel}>{shade.shade}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSemanticRow = (sem: {
    name: string;
    value: string;
    resolved: string | null;
  }): JSX.Element => {
    const index = localTokens.findIndex((t) => t.name === sem.name);
    const m = sem.value.match(SEMANTIC_REF_RE);
    const selectValue = m ? `${m[1]}:${m[2]}` : '';
    return (
      <div key={sem.name} className={styles.tokenRow} data-token-row>
        <input
          type="text"
          className={styles.tokenName}
          value={sem.name}
          onChange={(e) => handleNameChange(index, e.target.value)}
          onBlur={() => handleNameBlur(index)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <select
          className={styles.semanticSelect}
          value={selectValue}
          aria-label={`Mapping for ${sem.name}`}
          onChange={(e) => {
            const [palette, shade] = e.target.value.split(':');
            if (palette && shade)
              handleSemanticMap(sem.name, palette, Number(shade));
          }}
        >
          {selectValue === '' && (
            <option value="" disabled>
              {sem.value || '— custom —'}
            </option>
          )}
          {colorModel.palettes.map((p) => (
            <optgroup key={p.name} label={p.name}>
              {p.shades.map((s) => (
                <option key={s.shade} value={`${p.name}:${s.shade}`}>
                  {p.name} / {s.shade}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div
          className={styles.resolvedSwatch}
          style={{ background: sem.resolved ?? 'transparent' }}
          data-broken={sem.resolved === null}
          title={sem.resolved ?? 'unresolved reference'}
        />
        <Tooltip label="Delete token">
          <button
            className={styles.tokenDelete}
            onClick={() => handleDeleteRequest(index)}
            type="button"
          >
            x
          </button>
        </Tooltip>
      </div>
    );
  };

  const renderTypographyRow = (
    index: number,
    token: ThemeToken,
    category: TokenCategory
  ): JSX.Element => {
    const isFontFamily = category === 'fontFamily';
    const badgeOpen = badgeMenuFor?.index === index;
    const handleBadgeClick = (e: MouseEvent<HTMLButtonElement>): void => {
      if (badgeOpen) {
        setBadgeMenuFor(null);
        return;
      }
      const r = e.currentTarget.getBoundingClientRect();
      setBadgeMenuFor({
        index,
        anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      });
    };
    return (
      <div key={index} className={styles.tokenRow} data-token-row>
        <input
          type="text"
          className={styles.tokenName}
          value={token.name}
          onChange={(e) => handleNameChange(index, e.target.value)}
          onBlur={() => handleNameBlur(index)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <div className={styles.tokenValueCell}>
          {isFontFamily ? (
            <FontPicker
              value={token.value}
              fonts={allFonts}
              onChange={(v) => handleFontFamilyChange(index, v)}
              title="Font family"
            />
          ) : (
            <input
              type="text"
              className={styles.tokenValue}
              value={token.value}
              onChange={(e) => handleValueChange(index, e.target.value)}
              onBlur={() => commitValue(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              placeholder="value"
            />
          )}
        </div>
        <div className={styles.badgeWrap}>
          <Tooltip label="Change token type">
            <button
              type="button"
              className={`${styles.tokenBadge} ${styles.tokenBadgeButton}`}
              onClick={handleBadgeClick}
              aria-haspopup="menu"
              aria-expanded={badgeOpen}
            >
             {categoryBadge(category)} <span>▾</span>
            </button>
          </Tooltip>
        </div>
        <Tooltip label="Delete token">
          <button
            className={styles.tokenDelete}
            onClick={() => handleDeleteRequest(index)}
            type="button"
          >
            x
          </button>
        </Tooltip>
      </div>
    );
  };

  return (
    <>
      <div className={styles.editor} data-testid="theme-panel">
        <div className={styles.header}>
          <h2 className={styles.title}>Theme</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            aria-label="Close theme panel"
          >
            ×
          </button>
        </div>

        {isLegacy ? (
          <div className={styles.legacyNotice}>
            Theme editing needs the Next.js project format. Migrate this
            project (using the banner above the canvas) to edit its design
            system.
          </div>
        ) : (
          <div ref={editorRef} className={styles.scroll}>

        {error && <div className={styles.error}>{error}</div>}

        {pendingDelete && (
          <div className={styles.warning}>
            <strong>{pendingDelete.name}</strong> is used by{' '}
            {pendingDelete.usageCount} element
            {pendingDelete.usageCount > 1 ? 's' : ''}. Delete anyway?
            <div className={styles.warningActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => confirmDelete(pendingDelete.index)}
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        {pendingPaletteDelete && (
          <div className={styles.warning}>
            <strong>{pendingPaletteDelete.palette.name}</strong> is referenced
            by {pendingPaletteDelete.refCount} semantic token
            {pendingPaletteDelete.refCount > 1 ? 's' : ''}, which will break.
            Delete anyway?
            <div className={styles.warningActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPendingPaletteDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  confirmDeletePalette(pendingPaletteDelete.palette)
                }
              >
                Delete
              </Button>
            </div>
          </div>
        )}

            <section className={styles.section} data-theme-section="colors">
              <h3 className={styles.sectionTitle}>Colors</h3>

              <h4 className={styles.subheading}>Primitives</h4>
              {colorModel.palettes.length === 0 && (
                <div className={styles.empty}>No palettes yet.</div>
              )}
              {colorModel.palettes.map(renderPaletteBlock)}
              <button
                className={styles.addButton}
                onClick={handleAddPalette}
                type="button"
              >
                + Add palette
              </button>

              <h4 className={styles.subheading}>Semantic</h4>
              {colorModel.semantic.length === 0 && (
                <div className={styles.empty}>No semantic colors yet.</div>
              )}
              {colorModel.semantic.map(renderSemanticRow)}
              <button
                className={styles.addButton}
                onClick={handleAddSemantic}
                type="button"
              >
                + Add semantic color
              </button>

              {otherColorIndices.length > 0 && (
                <>
                  <h4 className={styles.subheading}>Other</h4>
                  {otherColorIndices.map((i) => {
                    const token = localTokens[i];
                    return token ? renderColorRow(i, token) : null;
                  })}
                </>
              )}
            </section>

            <section className={styles.section} data-theme-section="typography">
              <h3 className={styles.sectionTitle}>Typography</h3>
              {grouped.typography.length === 0 && (
                <div className={styles.empty}>No typography tokens yet.</div>
              )}
              {grouped.typography.map((i) => {
                const token = localTokens[i];
                if (!token) return null;
                return renderTypographyRow(i, token, categories[i] ?? 'unknown');
              })}
              <button
                className={styles.addButton}
                onClick={() => handleAddToken('typography')}
                type="button"
              >
                + Add Typography
              </button>
            </section>

            {grouped.unknown.length > 0 && (
              <section className={styles.section} data-theme-section="unknown">
                <h3 className={styles.sectionTitle}>Unknown</h3>
                {grouped.unknown.map((i) => {
                  const token = localTokens[i];
                  if (!token) return null;
                  return renderTypographyRow(i, token, categories[i] ?? 'unknown');
                })}
              </section>
            )}
          </div>
        )}
      </div>
      {/* Badge category-picker menu, portaled to escape the scrollable
          token list. Position is the trigger button's viewport rect
          captured at click time (see handleBadgeClick). */}
      {badgeMenuFor !== null &&
        createPortal(
          <>
            <div className={styles.badgeMenuBackdrop} onMouseDown={closeBadgeMenu} />
            <div
              className={styles.badgeMenu}
              role="menu"
              style={{
                top: badgeMenuFor.anchor.bottom + 4,
                left: badgeMenuFor.anchor.right - 100,
              }}
            >
              {TYPOGRAPHY_CATEGORY_OPTIONS.map((opt) => {
                const targetCategory = classifyToken(
                  localTokens[badgeMenuFor.index]?.value ?? ''
                );
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitem"
                    className={`${styles.badgeMenuItem} ${
                      targetCategory === opt.value ? styles.badgeMenuItemActive : ''
                    }`}
                    onClick={() => handleChangeCategory(badgeMenuFor.index, opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </>
  );
};
