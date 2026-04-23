import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconColorSwatch } from '@tabler/icons-react';
import { useCanvasStore } from '@store/canvasSlice';
import { useFontsStore, selectAllFonts } from '@store/fontsSlice';
import { serializeThemeFile } from '@lib/parseTheme';
import { classifyToken, type TokenCategory } from '@lib/tokenClassify';
import type { ThemeToken } from '@shared/types';
import { useDialogBackdrop } from '../hooks/useDialogBackdrop';
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

type TabId = 'colors' | 'typography' | 'unknown';

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
  const [activeTab, setActiveTab] = useState<TabId>('colors');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  /** Which token's badge-picker menu is currently open (by index). */
  const [badgeMenuFor, setBadgeMenuFor] = useState<number | null>(null);

  // Sync from store when tokens change externally (e.g. file edit).
  useEffect(() => {
    setLocalTokens([...themeTokens]);
  }, [themeTokens]);

  // Classify once per render so the tab lists and badges agree.
  const categories = useMemo(
    () => localTokens.map((t) => classifyToken(t.value)),
    [localTokens]
  );

  const tabCounts = useMemo(() => {
    let colors = 0;
    let typography = 0;
    let unknown = 0;
    for (const c of categories) {
      if (c === 'color') colors += 1;
      else if (TYPOGRAPHY_CATEGORIES.has(c)) typography += 1;
      else unknown += 1;
    }
    return { colors, typography, unknown };
  }, [categories]);

  /**
   * Indices of tokens that belong to the active tab, in source order.
   * Edits pass the original index back to the handlers so the source
   * array position is preserved.
   */
  const visibleIndices = useMemo(() => {
    return categories
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => {
        if (activeTab === 'colors') return c === 'color';
        if (activeTab === 'typography') return TYPOGRAPHY_CATEGORIES.has(c);
        return c === 'unknown';
      })
      .map(({ i }) => i);
  }, [categories, activeTab]);

  const writeTokens = useCallback(
    async (tokens: ThemeToken[]): Promise<void> => {
      try {
        // Preserve the font imports that live alongside tokens in
        // theme.css — the fonts panel writes to the same file.
        const urls = useFontsStore.getState().projectFontUrls;
        await window.scamp.writeTheme({
          projectPath,
          content: serializeThemeFile({
            tokens,
            fontImportUrls: [...urls],
          }),
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
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

  const handleAddToken = (): void => {
    let newToken: ThemeToken;
    if (activeTab === 'colors') {
      newToken = { name: nextDefaultName('--color'), value: '#888888' };
    } else if (activeTab === 'typography') {
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

  useDialogBackdrop({ onClose });

  const renderColorRow = (index: number, token: ThemeToken): JSX.Element => (
    <div key={index} className={styles.tokenRow}>
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

  const renderTypographyRow = (
    index: number,
    token: ThemeToken,
    category: TokenCategory
  ): JSX.Element => {
    const isFontFamily = category === 'fontFamily';
    const badgeOpen = badgeMenuFor === index;
    return (
      <div key={index} className={styles.tokenRow}>

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
              onClick={() => setBadgeMenuFor(badgeOpen ? null : index)}
              aria-haspopup="menu"
              aria-expanded={badgeOpen}
            >
             {categoryBadge(category)} <span>▾</span>
            </button>
          </Tooltip>
          {badgeOpen && (
            <>
              <div
                className={styles.badgeMenuBackdrop}
                onMouseDown={() => setBadgeMenuFor(null)}
              />
              <div className={styles.badgeMenu} role="menu">
                {TYPOGRAPHY_CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitem"
                    className={`${styles.badgeMenuItem} ${
                      category === opt.value ? styles.badgeMenuItemActive : ''
                    }`}
                    onClick={() => handleChangeCategory(index, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
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
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 className={styles.title}>Theme Tokens</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'colors' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('colors')}
          >
            Colors<span className={styles.tabCount}>{tabCounts.colors}</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'typography' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('typography')}
          >
            Typography<span className={styles.tabCount}>{tabCounts.typography}</span>
          </button>
          {tabCounts.unknown > 0 && (
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'unknown' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('unknown')}
            >
              Unknown<span className={styles.tabCount}>{tabCounts.unknown}</span>
            </button>
          )}
        </div>

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

        <div className={styles.tokenList}>
          {visibleIndices.length === 0 && (
            <div className={styles.empty}>
              {activeTab === 'colors'
                ? 'No color tokens yet. Add one to get started.'
                : activeTab === 'typography'
                  ? 'No typography tokens yet. Add one to get started.'
                  : 'No unclassified tokens.'}
            </div>
          )}
          {visibleIndices.map((i) => {
            const token = localTokens[i];
            if (!token) return null;
            const category = categories[i] ?? 'unknown';
            if (category === 'color') return renderColorRow(i, token);
            return renderTypographyRow(i, token, category);
          })}
        </div>

        <button
          className={styles.addButton}
          onClick={handleAddToken}
          type="button"
        >
          + Add {activeTab === 'colors' ? 'Color' : activeTab === 'typography' ? 'Typography' : 'Token'}
        </button>
      </div>
    </div>
  );
};
