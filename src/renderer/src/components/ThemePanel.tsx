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
import {
  serializeThemeFile,
  themeDefFromClass,
  type ParsedTheme,
  type ThemeBlock,
} from '@lib/parseTheme';
import { classifyToken, type TokenCategory } from '@lib/tokenClassify';
import { buildColorModel, type PrimitivePalette } from '@lib/colorModel';
import { generatePalette } from '@lib/palette';
import { resolveTokenChain } from '@lib/resolveToken';
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
  // `localTokens` mirrors the base (:root) tokens — primitives + light
  // semantic + typography, all GLOBAL across themes. `localOverrides`
  // holds the per-theme semantic overrides (.dark / .theme-*). The
  // Semantic area renders the Light block (base values) plus one block
  // per theme, each editable inline; preview lives in the canvas toolbar.
  // see docs/plans/design-system-plan.md
  const themeBaseTokens = useCanvasStore((s) => s.themeBaseTokens);
  const storeOverrides = useCanvasStore((s) => s.themeOverrides);
  const elements = useCanvasStore((s) => s.elements);
  const allFonts = useFontsStore(selectAllFonts);
  const [localTokens, setLocalTokens] = useState<ThemeToken[]>([
    ...themeBaseTokens,
  ]);
  const [localOverrides, setLocalOverrides] = useState<ThemeBlock[]>([
    ...storeOverrides,
  ]);
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

  // Sync from store when the theme data changes externally (file edit,
  // theme switch, optimistic write). Base tokens + overrides both mirror
  // the store so the panel always reflects on-disk truth.
  useEffect(() => {
    setLocalTokens([...themeBaseTokens]);
  }, [themeBaseTokens]);
  useEffect(() => {
    setLocalOverrides([...storeOverrides]);
  }, [storeOverrides]);

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

  /**
   * Persist the full design system — base (:root) tokens + per-theme
   * override blocks — to theme.css. Optimistically pushes the model to
   * the store first so the canvas + pickers reflect the edit immediately
   * for the active theme; the chokidar reparse confirms it later. Font
   * imports and hand-written CSS are preserved (see serializeThemeFile).
   * see docs/plans/design-system-plan.md
   */
  const persist = async (
    base: ThemeToken[],
    overrides: ThemeBlock[]
  ): Promise<void> => {
    try {
      const urls = useFontsStore.getState().projectFontUrls;
      // Prune override tokens whose base definition is gone (renamed or
      // deleted semantic) and drop blocks left empty — keeps theme blocks
      // consistent without per-handler override bookkeeping.
      const baseNames = new Set(base.map((t) => t.name));
      const prunedOverrides = overrides
        .map((b) => ({
          cssClass: b.cssClass,
          tokens: b.tokens.filter((t) => baseNames.has(t.name)),
        }))
        .filter((b) => b.tokens.length > 0);
      const model: ParsedTheme = {
        tokens: base,
        themes: prunedOverrides,
        fontImportUrls: [...urls],
      };
      useCanvasStore.getState().setThemeData(model);
      const existing = await window.scamp.readTheme({ projectPath });
      await window.scamp.writeTheme({
        projectPath,
        content: serializeThemeFile(model, existing),
      });
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  /** Persist a base-token change, keeping the current theme overrides. */
  const writeTokens = (base: ThemeToken[]): void => {
    void persist(base, localOverrides);
  };

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
      setLocalTokens([...themeBaseTokens]);
      return;
    }
    const duplicate = localTokens.some(
      (t, i) => i !== index && t.name === token.name
    );
    if (duplicate) {
      setError(`${token.name} already exists`);
      setLocalTokens([...themeBaseTokens]);
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

  /** Semantic override tokens for a theme class, keyed by token name. */
  const overrideMapFor = (cssClass: string): Map<string, string> => {
    const block = localOverrides.find((b) => b.cssClass === cssClass);
    return new Map((block?.tokens ?? []).map((t) => [t.name, t.value]));
  };

  /** Upsert a semantic value into a specific theme's override block. */
  const setOverrideFor = (
    cssClass: string,
    name: string,
    value: string
  ): ThemeBlock[] => {
    const existing = localOverrides.find((b) => b.cssClass === cssClass);
    if (!existing) {
      return [...localOverrides, { cssClass, tokens: [{ name, value }] }];
    }
    const tokens = existing.tokens.some((t) => t.name === name)
      ? existing.tokens.map((t) => (t.name === name ? { name, value } : t))
      : [...existing.tokens, { name, value }];
    return localOverrides.map((b) =>
      b.cssClass === cssClass ? { ...b, tokens } : b
    );
  };

  /**
   * Point a semantic token at a `<palette>/<shade>` primitive for a given
   * theme. The Light theme (cssClass `''`) edits the base `:root` value;
   * any other theme writes into its override block, leaving the base — and
   * thus every other theme — untouched.
   */
  const handleSemanticMap = (
    tokenName: string,
    paletteName: string,
    shade: number,
    cssClass: string
  ): void => {
    const value = `var(--color-${paletteName}-${shade})`;
    if (cssClass === '') {
      const nextBase = localTokens.map((t) =>
        t.name === tokenName ? { ...t, value } : t
      );
      setLocalTokens(nextBase);
      void persist(nextBase, localOverrides);
      return;
    }
    const nextOverrides = setOverrideFor(cssClass, tokenName, value);
    setLocalOverrides(nextOverrides);
    void persist(localTokens, nextOverrides);
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

  const slugify = (s: string): string =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  /** CSS class for a theme name: "Dark" → `dark`, else `theme-<slug>`. */
  const cssClassForName = (name: string): string => {
    const slug = slugify(name);
    return slug === 'dark' ? 'dark' : `theme-${slug}`;
  };

  /**
   * Add a theme: a new override block seeded with a copy of every current
   * semantic value, so it starts identical to Light and the user tweaks
   * it in place. Auto-named ("Dark", then "Theme 2"…); rename inline via
   * the block header. see docs/plans/design-system-plan.md
   */
  const handleAddTheme = (): void => {
    const usedClasses = new Set(localOverrides.map((b) => b.cssClass));
    let name = 'Dark';
    if (usedClasses.has('dark')) {
      let n = 2;
      while (usedClasses.has(`theme-theme-${n}`)) n += 1;
      name = `Theme ${n}`;
    }
    const cssClass = cssClassForName(name);
    const seed = colorModel.semantic.map((s) => ({
      name: s.name,
      value: s.value,
    }));
    const nextOverrides = [...localOverrides, { cssClass, tokens: seed }];
    setLocalOverrides(nextOverrides);
    setError(null);
    void persist(localTokens, nextOverrides);
    scrollTargetSection.current = 'colors';
    setScrollToEndAfterAdd((n) => n + 1);
  };

  /** Rename a theme block — changes its CSS class (and thus its label). */
  const handleRenameTheme = (oldCssClass: string, rawName: string): void => {
    const name = rawName.trim();
    if (name === '') return;
    const newCssClass = cssClassForName(name);
    if (newCssClass === oldCssClass) return;
    if (localOverrides.some((b) => b.cssClass === newCssClass)) {
      setError(`Theme "${name}" already exists`);
      return;
    }
    const nextOverrides = localOverrides.map((b) =>
      b.cssClass === oldCssClass ? { ...b, cssClass: newCssClass } : b
    );
    setLocalOverrides(nextOverrides);
    setError(null);
    void persist(localTokens, nextOverrides);
  };

  const handleRemoveTheme = (cssClass: string): void => {
    const nextOverrides = localOverrides.filter((b) => b.cssClass !== cssClass);
    setLocalOverrides(nextOverrides);
    void persist(localTokens, nextOverrides);
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

  /**
   * A semantic token row for a given theme. Light (`cssClass === ''`)
   * edits the base value and owns the token DEFINITION (name / delete);
   * other themes show a read-only name and only remap the value into
   * their own override block.
   */
  const renderSemanticRow = (
    sem: { name: string; value: string; resolved: string | null },
    cssClass: string,
    overrideMap: Map<string, string> | null
  ): JSX.Element => {
    const isLightRow = cssClass === '';
    const index = localTokens.findIndex((t) => t.name === sem.name);
    const effectiveValue = isLightRow
      ? sem.value
      : (overrideMap?.get(sem.name) ?? sem.value);
    const m = effectiveValue.match(SEMANTIC_REF_RE);
    const selectValue = m ? `${m[1]}:${m[2]}` : '';
    const resolved = resolveTokenChain(effectiveValue, localTokens);
    return (
      <div
        key={`${cssClass}:${sem.name}`}
        className={styles.tokenRow}
        data-token-row
      >
        <input
          type="text"
          className={styles.tokenName}
          value={sem.name}
          readOnly={!isLightRow}
          aria-label={`Semantic token ${sem.name}`}
          onChange={
            isLightRow
              ? (e) => handleNameChange(index, e.target.value)
              : undefined
          }
          onBlur={isLightRow ? () => handleNameBlur(index) : undefined}
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
              handleSemanticMap(sem.name, palette, Number(shade), cssClass);
          }}
        >
          {selectValue === '' && (
            <option value="" disabled>
              {effectiveValue || '— custom —'}
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
          style={{ background: resolved ?? 'transparent' }}
          data-broken={resolved === null}
          title={resolved ?? 'unresolved reference'}
        />
        {isLightRow && (
          <Tooltip label="Delete token">
            <button
              className={styles.tokenDelete}
              onClick={() => handleDeleteRequest(index)}
              type="button"
            >
              x
            </button>
          </Tooltip>
        )}
      </div>
    );
  };

  /** A stacked theme override block: header (rename + remove) + rows. */
  const renderThemeBlock = (block: ThemeBlock): JSX.Element => {
    const label = themeDefFromClass(block.cssClass).label;
    const overrideMap = overrideMapFor(block.cssClass);
    return (
      <div
        key={block.cssClass}
        className={styles.themeBlock}
        data-theme-block={block.cssClass}
        data-token-row
      >
        <div className={styles.themeBlockHeader}>
          <input
            type="text"
            className={styles.themeBlockName}
            defaultValue={label}
            aria-label={`Theme name for ${label}`}
            onBlur={(e) => handleRenameTheme(block.cssClass, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <Tooltip label="Remove theme">
            <button
              type="button"
              className={styles.tokenDelete}
              aria-label={`Remove ${label} theme`}
              onClick={() => handleRemoveTheme(block.cssClass)}
            >
              x
            </button>
          </Tooltip>
        </div>
        {colorModel.semantic.map((sem) =>
          renderSemanticRow(sem, block.cssClass, overrideMap)
        )}
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
              <div className={styles.themeHint}>
                Semantic tokens map to primitives per theme. Define the token
                set once on Light; add a theme to give each token a different
                value. Preview a theme from the canvas toolbar.
              </div>

              {/* Light theme — owns the token set (names, add, delete). */}
              <div className={styles.themeBlock} data-theme-block="light">
                <div className={styles.themeBlockHeader}>
                  <span className={styles.themeBlockName}>Light</span>
                </div>
                {colorModel.semantic.length === 0 && (
                  <div className={styles.empty}>No semantic colors yet.</div>
                )}
                {colorModel.semantic.map((sem) =>
                  renderSemanticRow(sem, '', null)
                )}
                <button
                  className={styles.addButton}
                  onClick={handleAddSemantic}
                  type="button"
                >
                  + Add semantic color
                </button>
              </div>

              {/* One stacked block per additional theme. */}
              {localOverrides.map(renderThemeBlock)}

              <button
                className={styles.addButton}
                onClick={handleAddTheme}
                type="button"
                data-testid="add-theme"
              >
                + Add theme
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
