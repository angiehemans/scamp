import { useCallback, useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useFontsStore } from '@store/fontsSlice';
import { serializeThemeFile } from '@lib/parseTheme';
import type { ThemeToken } from '@shared/types';
import { ColorInput } from './controls/ColorInput';
import { Tooltip } from './controls/Tooltip';
import styles from './ThemePanel.module.css';

type Props = {
  projectPath: string;
  onClose: () => void;
};

type PendingDelete = {
  index: number;
  name: string;
  usageCount: number;
};

/** Validate a token name: must start with --, no spaces. */
const validateTokenName = (name: string): string | null => {
  if (!name.startsWith('--')) return 'Name must start with --';
  if (/\s/.test(name)) return 'Name cannot contain spaces';
  if (name.length < 3) return 'Name is too short';
  return null;
};

/** Count how many elements in the tree reference a token via var(). */
const countTokenUsage = (
  elements: Record<string, { backgroundColor: string; borderColor: string; color?: string }>,
  tokenName: string
): number => {
  const varRef = `var(${tokenName})`;
  let count = 0;
  for (const el of Object.values(elements)) {
    if (el.backgroundColor === varRef) count += 1;
    if (el.borderColor === varRef) count += 1;
    if (el.color === varRef) count += 1;
  }
  return count;
};

/**
 * Modal for managing project design tokens (CSS custom properties).
 * Each token has a name (--color-primary) and a color value (#3b82f6).
 * Changes write to theme.css on disk; chokidar hot-reloads them.
 */
export const ThemePanel = ({ projectPath, onClose }: Props): JSX.Element => {
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const elements = useCanvasStore((s) => s.elements);
  const [localTokens, setLocalTokens] = useState<ThemeToken[]>([...themeTokens]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  // Sync from store when tokens change externally (e.g. file edit).
  useEffect(() => {
    setLocalTokens([...themeTokens]);
  }, [themeTokens]);

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

  const handleAddToken = (): void => {
    // Find a unique default name.
    let idx = 1;
    const existingNames = new Set(localTokens.map((t) => t.name));
    while (existingNames.has(`--color-${idx}`)) idx += 1;
    const next = [...localTokens, { name: `--color-${idx}`, value: '#888888' }];
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
      // Revert to the stored version.
      setLocalTokens([...themeTokens]);
      return;
    }
    // Check for duplicates (excluding self).
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

  const handleColorChange = (index: number, newValue: string): void => {
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

  // Close on Escape.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

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

        {error && <div className={styles.error}>{error}</div>}

        {pendingDelete && (
          <div className={styles.warning}>
            <strong>{pendingDelete.name}</strong> is used by{' '}
            {pendingDelete.usageCount} element
            {pendingDelete.usageCount > 1 ? 's' : ''}. Delete anyway?
            <div className={styles.warningActions}>
              <button
                className={`${styles.warningButton} ${styles.warningCancel}`}
                onClick={() => setPendingDelete(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`${styles.warningButton} ${styles.warningConfirm}`}
                onClick={() => confirmDelete(pendingDelete.index)}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        <div className={styles.tokenList}>
          {localTokens.length === 0 && (
            <div className={styles.empty}>
              No tokens yet. Add one to get started.
            </div>
          )}
          {localTokens.map((token, i) => (
            <div key={i} className={styles.tokenRow}>
              <input
                type="text"
                className={styles.tokenName}
                value={token.name}
                onChange={(e) => handleNameChange(i, e.target.value)}
                onBlur={() => handleNameBlur(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
              <div className={styles.tokenColor}>
                <ColorInput
                  value={token.value}
                  onChange={(v) => handleColorChange(i, v)}
                />
              </div>
              <Tooltip label="Delete token">
                <button
                  className={styles.tokenDelete}
                  onClick={() => handleDeleteRequest(i)}
                  type="button"
                >
                  x
                </button>
              </Tooltip>
            </div>
          ))}
        </div>

        <button
          className={styles.addButton}
          onClick={handleAddToken}
          type="button"
        >
          + Add Token
        </button>
      </div>
    </div>
  );
};
