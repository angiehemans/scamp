import { useMemo, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useFontsStore } from '@store/fontsSlice';
import { parseGoogleFontsEmbed } from '@lib/googleFontsEmbed';
import { serializeThemeFile } from '@lib/parseTheme';
import styles from './FontsSection.module.css';

type Props = {
  projectPath: string;
};

type UrlRow = {
  url: string;
  families: string[];
};

/**
 * Fonts panel inside Project Settings. Users paste a Google Fonts
 * embed link and we persist the `@import` URL in `theme.css` — the
 * one project-level design-asset file. Removing an entry strips the
 * corresponding import.
 */
export const FontsSection = ({ projectPath }: Props): JSX.Element => {
  const projectFontUrls = useFontsStore((s) => s.projectFontUrls);
  const setProjectFonts = useFontsStore((s) => s.setProjectFonts);
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Decode each stored URL back to display family names. Invalid URLs
  // (e.g. a user hand-edited theme.css with a non-Google @import) show
  // with an empty family list so they're still removable via the UI.
  const rows: UrlRow[] = useMemo(() => {
    return projectFontUrls.map((url) => {
      const parsed = parseGoogleFontsEmbed(url);
      return {
        url,
        families: parsed.ok ? parsed.value.families : [],
      };
    });
  }, [projectFontUrls]);

  const writeTheme = async (urls: ReadonlyArray<string>): Promise<void> => {
    const content = serializeThemeFile({
      tokens: [...themeTokens],
      fontImportUrls: [...urls],
    });
    await window.scamp.writeTheme({ projectPath, content });
  };

  const handleAdd = async (): Promise<void> => {
    const parsed = parseGoogleFontsEmbed(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (projectFontUrls.includes(parsed.value.url)) {
      setError('That font is already added.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const nextUrls = [...projectFontUrls, parsed.value.url];
      // Optimistically update the store so the picker reflects the
      // new families before chokidar re-fires on the write.
      const allFamilies = nextUrls.flatMap((u) => {
        const r = parseGoogleFontsEmbed(u);
        return r.ok ? r.value.families : [];
      });
      setProjectFonts({ families: allFamilies, urls: nextUrls });
      await writeTheme(nextUrls);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (url: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const nextUrls = projectFontUrls.filter((u) => u !== url);
      const allFamilies = nextUrls.flatMap((u) => {
        const r = parseGoogleFontsEmbed(u);
        return r.ok ? r.value.families : [];
      });
      setProjectFonts({ families: allFamilies, urls: nextUrls });
      await writeTheme(nextUrls);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.pasteRow}>
        <input
          type="text"
          className={styles.pasteInput}
          placeholder='Paste a Google Fonts embed link or <link> snippet'
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) {
              e.preventDefault();
              void handleAdd();
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="button"
          className={styles.addButton}
          onClick={() => void handleAdd()}
          disabled={busy || draft.trim().length === 0}
        >
          Add
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.help}>
        Fonts you add here are saved in <code>theme.css</code> in your
        project folder. Import that file in your production build to use
        the fonts outside Scamp.
      </div>
      {rows.length === 0 ? (
        <div className={styles.empty}>No project fonts yet.</div>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => (
            <div key={row.url} className={styles.listItem}>
              <div className={styles.listItemBody}>
                <div className={styles.listItemFamilies}>
                  {row.families.length > 0
                    ? row.families.join(', ')
                    : '(unrecognized URL)'}
                </div>
                <div className={styles.listItemUrl}>{row.url}</div>
              </div>
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => void handleRemove(row.url)}
                disabled={busy}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
