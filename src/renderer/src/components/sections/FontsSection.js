import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useFontsStore } from '@store/fontsSlice';
import { parseGoogleFontsEmbed } from '@lib/googleFontsEmbed';
import { serializeThemeFile } from '@lib/parseTheme';
import styles from './FontsSection.module.css';
/**
 * Fonts panel inside Project Settings. Users paste a Google Fonts
 * embed link and we persist the `@import` URL in `theme.css` — the
 * one project-level design-asset file. Removing an entry strips the
 * corresponding import.
 */
export const FontsSection = ({ projectPath }) => {
    const projectFontUrls = useFontsStore((s) => s.projectFontUrls);
    const setProjectFonts = useFontsStore((s) => s.setProjectFonts);
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    // Decode each stored URL back to display family names. Invalid URLs
    // (e.g. a user hand-edited theme.css with a non-Google @import) show
    // with an empty family list so they're still removable via the UI.
    const rows = useMemo(() => {
        return projectFontUrls.map((url) => {
            const parsed = parseGoogleFontsEmbed(url);
            return {
                url,
                families: parsed.ok ? parsed.value.families : [],
            };
        });
    }, [projectFontUrls]);
    const writeTheme = async (urls) => {
        const content = serializeThemeFile({
            tokens: [...themeTokens],
            fontImportUrls: [...urls],
        });
        await window.scamp.writeTheme({ projectPath, content });
    };
    const handleAdd = async () => {
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
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    };
    const handleRemove = async (url) => {
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
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: styles.wrap, children: [_jsxs("div", { className: styles.pasteRow, children: [_jsx("input", { type: "text", className: styles.pasteInput, placeholder: 'Paste a Google Fonts embed link or <link> snippet', value: draft, onChange: (e) => {
                            setDraft(e.target.value);
                            if (error)
                                setError(null);
                        }, onKeyDown: (e) => {
                            if (e.key === 'Enter' && !busy) {
                                e.preventDefault();
                                void handleAdd();
                            }
                        }, spellCheck: false, autoCapitalize: "off", autoCorrect: "off" }), _jsx("button", { type: "button", className: styles.addButton, onClick: () => void handleAdd(), disabled: busy || draft.trim().length === 0, children: "Add" })] }), error && _jsx("div", { className: styles.error, children: error }), _jsxs("div", { className: styles.help, children: ["Fonts you add here are saved in ", _jsx("code", { children: "theme.css" }), " in your project folder. Import that file in your production build to use the fonts outside Scamp."] }), rows.length === 0 ? (_jsx("div", { className: styles.empty, children: "No project fonts yet." })) : (_jsx("div", { className: styles.list, children: rows.map((row) => (_jsxs("div", { className: styles.listItem, children: [_jsxs("div", { className: styles.listItemBody, children: [_jsx("div", { className: styles.listItemFamilies, children: row.families.length > 0
                                        ? row.families.join(', ')
                                        : '(unrecognized URL)' }), _jsx("div", { className: styles.listItemUrl, children: row.url })] }), _jsx("button", { type: "button", className: styles.removeButton, onClick: () => void handleRemove(row.url), disabled: busy, children: "Remove" })] }, row.url))) }))] }));
};
