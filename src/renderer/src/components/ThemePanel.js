import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@store/canvasSlice';
import { useFontsStore, selectAllFonts } from '@store/fontsSlice';
import { serializeThemeFile, themeDefFromClass, } from '@lib/parseTheme';
import { classifyToken } from '@lib/tokenClassify';
import { buildColorModel } from '@lib/colorModel';
import { generatePalette } from '@lib/palette';
import { resolveTokenChain } from '@lib/resolveToken';
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
const TYPOGRAPHY_SEED = {
    fontSize: '1rem',
    lineHeight: '1.5',
    fontFamily: "'Inter', sans-serif",
};
const TYPOGRAPHY_CATEGORY_OPTIONS = [
    { value: 'fontSize', label: 'Size' },
    { value: 'lineHeight', label: 'Line-height' },
    { value: 'fontFamily', label: 'Font' },
];
const TYPOGRAPHY_CATEGORIES = new Set([
    'fontSize',
    'lineHeight',
    'fontFamily',
]);
const categoryBadge = (category) => {
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
const isPaletteShade = (name, palette) => new RegExp(`^--color-${palette}-\\d+$`).test(name);
/** Validate a token name: must start with --, no spaces. */
const validateTokenName = (name) => {
    if (!name.startsWith('--'))
        return 'Name must start with --';
    if (/\s/.test(name))
        return 'Name cannot contain spaces';
    if (name.length < 3)
        return 'Name is too short';
    return null;
};
/**
 * Count how many elements in the tree reference a token via var().
 * Checks every field that can hold a var() ref today.
 */
const countTokenUsage = (elements, tokenName) => {
    const varRef = `var(${tokenName})`;
    let count = 0;
    for (const raw of Object.values(elements)) {
        const el = raw;
        if (el.backgroundColor === varRef)
            count += 1;
        if (el.borderColor === varRef)
            count += 1;
        if (el.color === varRef)
            count += 1;
        if (el.fontSize === varRef)
            count += 1;
        if (el.lineHeight === varRef)
            count += 1;
        if (el.letterSpacing === varRef)
            count += 1;
        if (el.fontFamily?.includes(varRef))
            count += 1;
    }
    return count;
};
/**
 * Modal for managing project design tokens (CSS custom properties).
 * Tabs split tokens by inferred category (colors / typography / unknown).
 * Changes write to theme.css on disk; chokidar hot-reloads them.
 */
export const ThemePanel = ({ projectPath, onClose }) => {
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
    const [localTokens, setLocalTokens] = useState([
        ...themeBaseTokens,
    ]);
    const [localOverrides, setLocalOverrides] = useState([
        ...storeOverrides,
    ]);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    const isLegacy = projectFormat === 'legacy';
    const [error, setError] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    /** Palette pending deletion — set only when a semantic token references it. */
    const [pendingPaletteDelete, setPendingPaletteDelete] = useState(null);
    /**
     * Which token's badge-picker menu is currently open. Carries the
     * trigger button's viewport rect so we can portal the menu out of
     * the (now-scrollable) token list — otherwise the dropdown would
     * be clipped at the list's overflow boundary.
     */
    const [badgeMenuFor, setBadgeMenuFor] = useState(null);
    const closeBadgeMenu = useCallback(() => setBadgeMenuFor(null), []);
    /**
     * Ref + signal pair for "scroll the token list to the bottom on the
     * next render". `handleAddToken` bumps `scrollToEndAfterAdd` and
     * the effect runs after React commits the new row so we read the
     * post-add `scrollHeight`.
     */
    const editorRef = useRef(null);
    const scrollTargetSection = useRef('colors');
    const [scrollToEndAfterAdd, setScrollToEndAfterAdd] = useState(0);
    useEffect(() => {
        if (scrollToEndAfterAdd === 0)
            return;
        const section = editorRef.current?.querySelector(`[data-theme-section="${scrollTargetSection.current}"]`);
        const rows = section?.querySelectorAll('[data-token-row]');
        const last = rows?.[rows.length - 1];
        if (last instanceof HTMLElement)
            last.scrollIntoView({ block: 'nearest' });
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
    const categories = useMemo(() => localTokens.map((t) => classifyToken(t.value)), [localTokens]);
    // Every `--color-*` token is owned by the Colors section (as a palette
    // shade or a semantic mapping). Its VALUE may classify as anything —
    // a semantic token's `var(--color-…)` reads as `unknown` — so we route
    // by NAME here, otherwise those tokens double-render in both Colors and
    // Typography/Unknown. see docs/plans/design-system-plan.md
    const isColorToken = (name) => name.startsWith('--color-');
    const inColors = (category, name) => isColorToken(name) || category === 'color';
    const tabCounts = useMemo(() => {
        let colors = 0;
        let typography = 0;
        let unknown = 0;
        categories.forEach((c, i) => {
            if (inColors(c, localTokens[i]?.name ?? ''))
                colors += 1;
            else if (TYPOGRAPHY_CATEGORIES.has(c))
                typography += 1;
            else
                unknown += 1;
        });
        return { colors, typography, unknown };
    }, [categories, localTokens]);
    // Token indices grouped by section, in source order. Handlers get the
    // original index so the source array position is preserved.
    const grouped = useMemo(() => {
        const colors = [];
        const typography = [];
        const unknown = [];
        categories.forEach((c, i) => {
            const name = localTokens[i]?.name ?? '';
            if (inColors(c, name))
                colors.push(i);
            else if (TYPOGRAPHY_CATEGORIES.has(c))
                typography.push(i);
            else
                unknown.push(i);
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
        const captured = new Set();
        for (const p of colorModel.palettes)
            for (const s of p.shades)
                captured.add(s.name);
        for (const s of colorModel.semantic)
            captured.add(s.name);
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
    const persist = async (base, overrides) => {
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
            const model = {
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
        }
        catch (e) {
            setError(errorMessage(e));
        }
    };
    /** Persist a base-token change, keeping the current theme overrides. */
    const writeTokens = (base) => {
        void persist(base, localOverrides);
    };
    const nextDefaultName = (prefix) => {
        const existing = new Set(localTokens.map((t) => t.name));
        let idx = 1;
        while (existing.has(`${prefix}-${idx}`))
            idx += 1;
        return `${prefix}-${idx}`;
    };
    // Colours have their own structured add flows (handleAddPalette /
    // handleAddSemantic); this drives the Typography section only.
    const handleAddToken = (section) => {
        let newToken;
        if (section === 'typography') {
            // Cycle through size / line / family so successive clicks create
            // a balanced set instead of ten `--text-*` tokens in a row.
            const sizes = tabCounts.typography;
            const pick = sizes % 3;
            if (pick === 0) {
                newToken = { name: nextDefaultName('--text'), value: '1rem' };
            }
            else if (pick === 1) {
                newToken = { name: nextDefaultName('--leading'), value: '1.5' };
            }
            else {
                newToken = {
                    name: nextDefaultName('--font'),
                    value: "'Inter', sans-serif",
                };
            }
        }
        else {
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
    const handleNameChange = (index, newName) => {
        const next = localTokens.map((t, i) => i === index ? { ...t, name: newName } : t);
        setLocalTokens(next);
    };
    const handleNameBlur = (index) => {
        const token = localTokens[index];
        if (!token)
            return;
        const nameError = validateTokenName(token.name);
        if (nameError) {
            setError(`${token.name}: ${nameError}`);
            setLocalTokens([...themeBaseTokens]);
            return;
        }
        const duplicate = localTokens.some((t, i) => i !== index && t.name === token.name);
        if (duplicate) {
            setError(`${token.name} already exists`);
            setLocalTokens([...themeBaseTokens]);
            return;
        }
        setError(null);
        void writeTokens(localTokens);
    };
    const handleValueChange = (index, newValue) => {
        const next = localTokens.map((t, i) => i === index ? { ...t, value: newValue } : t);
        setLocalTokens(next);
    };
    const commitValue = (index) => {
        void writeTokens(localTokens);
    };
    /** Color-tab shortcut: ColorInput commits immediately. */
    const handleColorChange = (index, newValue) => {
        const next = localTokens.map((t, i) => i === index ? { ...t, value: newValue } : t);
        setLocalTokens(next);
        void writeTokens(next);
    };
    const applyTokens = (next) => {
        setLocalTokens(next);
        void writeTokens(next);
    };
    /** Next free `palette`, `palette2`, … name (no numeric-shade suffix). */
    const nextPaletteName = () => {
        const names = new Set(colorModel.palettes.map((p) => p.name));
        if (!names.has('palette'))
            return 'palette';
        let i = 2;
        while (names.has(`palette${i}`))
            i += 1;
        return `palette${i}`;
    };
    /**
     * Next free semantic name. Deliberately avoids a `-<number>` suffix,
     * which buildColorModel would misread as a primitive palette shade.
     */
    const nextSemanticName = () => {
        const existing = new Set(localTokens.map((t) => t.name));
        if (!existing.has('--color-custom'))
            return '--color-custom';
        let i = 2;
        while (existing.has(`--color-custom${i}`))
            i += 1;
        return `--color-custom${i}`;
    };
    /** Add a fresh palette: a full generated ramp from the default seed. */
    const handleAddPalette = () => {
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
    const handleRegeneratePalette = (palette) => {
        const seedShade = palette.shades.find((s) => s.shade === 500) ??
            palette.shades[Math.floor(palette.shades.length / 2)];
        if (!seedShade)
            return;
        const shades = generatePalette(seedShade.value);
        if (shades.length === 0)
            return;
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
    const handleRenamePalette = (oldName, rawNew) => {
        const newName = rawNew.trim();
        if (newName === '' || newName === oldName)
            return;
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
    const paletteRefCount = (paletteName) => colorModel.semantic.filter((s) => {
        const m = s.value.match(SEMANTIC_REF_RE);
        return m?.[1] === paletteName;
    }).length;
    const handleDeletePaletteRequest = (palette) => {
        const refCount = paletteRefCount(palette.name);
        if (refCount > 0) {
            setPendingPaletteDelete({ palette, refCount });
            return;
        }
        confirmDeletePalette(palette);
    };
    const confirmDeletePalette = (palette) => {
        const next = localTokens.filter((t) => !isPaletteShade(t.name, palette.name));
        setPendingPaletteDelete(null);
        applyTokens(next);
    };
    /** Semantic override tokens for a theme class, keyed by token name. */
    const overrideMapFor = (cssClass) => {
        const block = localOverrides.find((b) => b.cssClass === cssClass);
        return new Map((block?.tokens ?? []).map((t) => [t.name, t.value]));
    };
    /** Upsert a semantic value into a specific theme's override block. */
    const setOverrideFor = (cssClass, name, value) => {
        const existing = localOverrides.find((b) => b.cssClass === cssClass);
        if (!existing) {
            return [...localOverrides, { cssClass, tokens: [{ name, value }] }];
        }
        const tokens = existing.tokens.some((t) => t.name === name)
            ? existing.tokens.map((t) => (t.name === name ? { name, value } : t))
            : [...existing.tokens, { name, value }];
        return localOverrides.map((b) => b.cssClass === cssClass ? { ...b, tokens } : b);
    };
    /**
     * Point a semantic token at a `<palette>/<shade>` primitive for a given
     * theme. The Light theme (cssClass `''`) edits the base `:root` value;
     * any other theme writes into its override block, leaving the base — and
     * thus every other theme — untouched.
     */
    const handleSemanticMap = (tokenName, paletteName, shade, cssClass) => {
        const value = `var(--color-${paletteName}-${shade})`;
        if (cssClass === '') {
            const nextBase = localTokens.map((t) => t.name === tokenName ? { ...t, value } : t);
            setLocalTokens(nextBase);
            void persist(nextBase, localOverrides);
            return;
        }
        const nextOverrides = setOverrideFor(cssClass, tokenName, value);
        setLocalOverrides(nextOverrides);
        void persist(localTokens, nextOverrides);
    };
    const handleAddSemantic = () => {
        const first = colorModel.palettes[0];
        const mid = first?.shades.find((s) => s.shade === 500) ??
            first?.shades[Math.floor((first?.shades.length ?? 0) / 2)];
        const value = first && mid ? `var(--color-${first.name}-${mid.shade})` : '#888888';
        applyTokens([...localTokens, { name: nextSemanticName(), value }]);
        scrollTargetSection.current = 'colors';
        setScrollToEndAfterAdd((n) => n + 1);
    };
    const slugify = (s) => s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    /** CSS class for a theme name: "Dark" → `dark`, else `theme-<slug>`. */
    const cssClassForName = (name) => {
        const slug = slugify(name);
        return slug === 'dark' ? 'dark' : `theme-${slug}`;
    };
    /**
     * Add a theme: a new override block seeded with a copy of every current
     * semantic value, so it starts identical to Light and the user tweaks
     * it in place. Auto-named ("Dark", then "Theme 2"…); rename inline via
     * the block header. see docs/plans/design-system-plan.md
     */
    const handleAddTheme = () => {
        const usedClasses = new Set(localOverrides.map((b) => b.cssClass));
        let name = 'Dark';
        if (usedClasses.has('dark')) {
            let n = 2;
            while (usedClasses.has(`theme-theme-${n}`))
                n += 1;
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
    const handleRenameTheme = (oldCssClass, rawName) => {
        const name = rawName.trim();
        if (name === '')
            return;
        const newCssClass = cssClassForName(name);
        if (newCssClass === oldCssClass)
            return;
        if (localOverrides.some((b) => b.cssClass === newCssClass)) {
            setError(`Theme "${name}" already exists`);
            return;
        }
        const nextOverrides = localOverrides.map((b) => b.cssClass === oldCssClass ? { ...b, cssClass: newCssClass } : b);
        setLocalOverrides(nextOverrides);
        setError(null);
        void persist(localTokens, nextOverrides);
    };
    const handleRemoveTheme = (cssClass) => {
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
    const handleChangeCategory = (index, newCategory) => {
        setBadgeMenuFor(null);
        const token = localTokens[index];
        if (!token)
            return;
        const currentCategory = classifyToken(token.value);
        if (currentCategory === newCategory)
            return;
        const next = localTokens.map((t, i) => i === index ? { ...t, value: TYPOGRAPHY_SEED[newCategory] } : t);
        setLocalTokens(next);
        void writeTokens(next);
    };
    /** FontPicker commits the full CSS expression — write immediately. */
    const handleFontFamilyChange = (index, newValue) => {
        if (newValue.trim().length === 0)
            return;
        const next = localTokens.map((t, i) => i === index ? { ...t, value: newValue } : t);
        setLocalTokens(next);
        void writeTokens(next);
    };
    const handleDeleteRequest = (index) => {
        const token = localTokens[index];
        if (!token)
            return;
        const usageCount = countTokenUsage(elements, token.name);
        if (usageCount > 0) {
            setPendingDelete({ index, name: token.name, usageCount });
            return;
        }
        confirmDelete(index);
    };
    const confirmDelete = (index) => {
        const next = localTokens.filter((_, i) => i !== index);
        setLocalTokens(next);
        setPendingDelete(null);
        void writeTokens(next);
    };
    const renderColorRow = (index, token) => (_jsxs("div", { className: styles.tokenRow, "data-token-row": true, children: [_jsx("input", { type: "text", className: styles.tokenName, value: token.name, onChange: (e) => handleNameChange(index, e.target.value), onBlur: () => handleNameBlur(index), onKeyDown: (e) => {
                    if (e.key === 'Enter')
                        e.currentTarget.blur();
                } }), _jsx("div", { className: styles.tokenColor, children: _jsx(ColorInput, { value: token.value, onChange: (v) => handleColorChange(index, v) }) }), _jsx(Tooltip, { label: "Delete token", children: _jsx("button", { className: styles.tokenDelete, onClick: () => handleDeleteRequest(index), type: "button", children: "x" }) })] }, index));
    const renderPaletteBlock = (palette) => (_jsxs("div", { className: styles.palette, "data-token-row": true, children: [_jsxs("div", { className: styles.paletteHeader, children: [_jsx("input", { type: "text", className: styles.paletteName, defaultValue: palette.name, "aria-label": `Palette name for ${palette.name}`, onBlur: (e) => handleRenamePalette(palette.name, e.target.value), onKeyDown: (e) => {
                            if (e.key === 'Enter')
                                e.currentTarget.blur();
                        } }), _jsx(Tooltip, { label: "Regenerate ramp from the 500 shade", children: _jsx("button", { type: "button", className: styles.generateButton, onClick: () => handleRegeneratePalette(palette), children: "Generate" }) }), _jsx(Tooltip, { label: "Delete palette", children: _jsx("button", { type: "button", className: styles.tokenDelete, onClick: () => handleDeletePaletteRequest(palette), children: "x" }) })] }), _jsx("div", { className: styles.shadeRow, children: palette.shades.map((shade) => {
                    const idx = localTokens.findIndex((t) => t.name === shade.name);
                    return (_jsxs("div", { className: styles.shade, children: [_jsx("div", { className: styles.shadeSwatch, children: _jsx(ColorInput, { value: shade.value, onChange: (v) => idx >= 0 && handleColorChange(idx, v) }) }), _jsx("span", { className: styles.shadeLabel, children: shade.shade })] }, shade.name));
                }) })] }, palette.name));
    /**
     * A semantic token row for a given theme. Light (`cssClass === ''`)
     * edits the base value and owns the token DEFINITION (name / delete);
     * other themes show a read-only name and only remap the value into
     * their own override block.
     */
    const renderSemanticRow = (sem, cssClass, overrideMap) => {
        const isLightRow = cssClass === '';
        const index = localTokens.findIndex((t) => t.name === sem.name);
        const effectiveValue = isLightRow
            ? sem.value
            : (overrideMap?.get(sem.name) ?? sem.value);
        const m = effectiveValue.match(SEMANTIC_REF_RE);
        const selectValue = m ? `${m[1]}:${m[2]}` : '';
        const resolved = resolveTokenChain(effectiveValue, localTokens);
        return (_jsxs("div", { className: styles.tokenRow, "data-token-row": true, children: [_jsx("input", { type: "text", className: styles.tokenName, value: sem.name, readOnly: !isLightRow, "aria-label": `Semantic token ${sem.name}`, onChange: isLightRow
                        ? (e) => handleNameChange(index, e.target.value)
                        : undefined, onBlur: isLightRow ? () => handleNameBlur(index) : undefined, onKeyDown: (e) => {
                        if (e.key === 'Enter')
                            e.currentTarget.blur();
                    } }), _jsxs("select", { className: styles.semanticSelect, value: selectValue, "aria-label": `Mapping for ${sem.name}`, onChange: (e) => {
                        const [palette, shade] = e.target.value.split(':');
                        if (palette && shade)
                            handleSemanticMap(sem.name, palette, Number(shade), cssClass);
                    }, children: [selectValue === '' && (_jsx("option", { value: "", disabled: true, children: effectiveValue || '— custom —' })), colorModel.palettes.map((p) => (_jsx("optgroup", { label: p.name, children: p.shades.map((s) => (_jsxs("option", { value: `${p.name}:${s.shade}`, children: [p.name, " / ", s.shade] }, s.shade))) }, p.name)))] }), _jsx("div", { className: styles.resolvedSwatch, style: { background: resolved ?? 'transparent' }, "data-broken": resolved === null, title: resolved ?? 'unresolved reference' }), isLightRow && (_jsx(Tooltip, { label: "Delete token", children: _jsx("button", { className: styles.tokenDelete, onClick: () => handleDeleteRequest(index), type: "button", children: "x" }) }))] }, `${cssClass}:${sem.name}`));
    };
    /** A stacked theme override block: header (rename + remove) + rows. */
    const renderThemeBlock = (block) => {
        const label = themeDefFromClass(block.cssClass).label;
        const overrideMap = overrideMapFor(block.cssClass);
        return (_jsxs("div", { className: styles.themeBlock, "data-theme-block": block.cssClass, "data-token-row": true, children: [_jsxs("div", { className: styles.themeBlockHeader, children: [_jsx("input", { type: "text", className: styles.themeBlockName, defaultValue: label, "aria-label": `Theme name for ${label}`, onBlur: (e) => handleRenameTheme(block.cssClass, e.target.value), onKeyDown: (e) => {
                                if (e.key === 'Enter')
                                    e.currentTarget.blur();
                            } }), _jsx(Tooltip, { label: "Remove theme", children: _jsx("button", { type: "button", className: styles.tokenDelete, "aria-label": `Remove ${label} theme`, onClick: () => handleRemoveTheme(block.cssClass), children: "x" }) })] }), colorModel.semantic.map((sem) => renderSemanticRow(sem, block.cssClass, overrideMap))] }, block.cssClass));
    };
    const renderTypographyRow = (index, token, category) => {
        const isFontFamily = category === 'fontFamily';
        const badgeOpen = badgeMenuFor?.index === index;
        const handleBadgeClick = (e) => {
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
        return (_jsxs("div", { className: styles.tokenRow, "data-token-row": true, children: [_jsx("input", { type: "text", className: styles.tokenName, value: token.name, onChange: (e) => handleNameChange(index, e.target.value), onBlur: () => handleNameBlur(index), onKeyDown: (e) => {
                        if (e.key === 'Enter')
                            e.currentTarget.blur();
                    } }), _jsx("div", { className: styles.tokenValueCell, children: isFontFamily ? (_jsx(FontPicker, { value: token.value, fonts: allFonts, onChange: (v) => handleFontFamilyChange(index, v), title: "Font family" })) : (_jsx("input", { type: "text", className: styles.tokenValue, value: token.value, onChange: (e) => handleValueChange(index, e.target.value), onBlur: () => commitValue(index), onKeyDown: (e) => {
                            if (e.key === 'Enter')
                                e.currentTarget.blur();
                        }, placeholder: "value" })) }), _jsx("div", { className: styles.badgeWrap, children: _jsx(Tooltip, { label: "Change token type", children: _jsxs("button", { type: "button", className: `${styles.tokenBadge} ${styles.tokenBadgeButton}`, onClick: handleBadgeClick, "aria-haspopup": "menu", "aria-expanded": badgeOpen, children: [categoryBadge(category), " ", _jsx("span", { children: "\u25BE" })] }) }) }), _jsx(Tooltip, { label: "Delete token", children: _jsx("button", { className: styles.tokenDelete, onClick: () => handleDeleteRequest(index), type: "button", children: "x" }) })] }, index));
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.editor, "data-testid": "theme-panel", children: [_jsxs("div", { className: styles.header, children: [_jsx("h2", { className: styles.title, children: "Theme" }), _jsx("button", { className: styles.closeButton, onClick: onClose, type: "button", "aria-label": "Close theme panel", children: "\u00D7" })] }), isLegacy ? (_jsx("div", { className: styles.legacyNotice, children: "Theme editing needs the Next.js project format. Migrate this project (using the banner above the canvas) to edit its design system." })) : (_jsxs("div", { ref: editorRef, className: styles.scroll, children: [error && _jsx("div", { className: styles.error, children: error }), pendingDelete && (_jsxs("div", { className: styles.warning, children: [_jsx("strong", { children: pendingDelete.name }), " is used by", ' ', pendingDelete.usageCount, " element", pendingDelete.usageCount > 1 ? 's' : '', ". Delete anyway?", _jsxs("div", { className: styles.warningActions, children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => setPendingDelete(null), children: "Cancel" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => confirmDelete(pendingDelete.index), children: "Delete" })] })] })), pendingPaletteDelete && (_jsxs("div", { className: styles.warning, children: [_jsx("strong", { children: pendingPaletteDelete.palette.name }), " is referenced by ", pendingPaletteDelete.refCount, " semantic token", pendingPaletteDelete.refCount > 1 ? 's' : '', ", which will break. Delete anyway?", _jsxs("div", { className: styles.warningActions, children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => setPendingPaletteDelete(null), children: "Cancel" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => confirmDeletePalette(pendingPaletteDelete.palette), children: "Delete" })] })] })), _jsxs("section", { className: styles.section, "data-theme-section": "colors", children: [_jsx("h3", { className: styles.sectionTitle, children: "Colors" }), _jsx("h4", { className: styles.subheading, children: "Primitives" }), colorModel.palettes.length === 0 && (_jsx("div", { className: styles.empty, children: "No palettes yet." })), colorModel.palettes.map(renderPaletteBlock), _jsx("button", { className: styles.addButton, onClick: handleAddPalette, type: "button", children: "+ Add palette" }), _jsx("h4", { className: styles.subheading, children: "Semantic" }), _jsx("div", { className: styles.themeHint, children: "Semantic tokens map to primitives per theme. Define the token set once on Light; add a theme to give each token a different value. Preview a theme from the canvas toolbar." }), _jsxs("div", { className: styles.themeBlock, "data-theme-block": "light", children: [_jsx("div", { className: styles.themeBlockHeader, children: _jsx("span", { className: styles.themeBlockName, children: "Light" }) }), colorModel.semantic.length === 0 && (_jsx("div", { className: styles.empty, children: "No semantic colors yet." })), colorModel.semantic.map((sem) => renderSemanticRow(sem, '', null)), _jsx("button", { className: styles.addButton, onClick: handleAddSemantic, type: "button", children: "+ Add semantic color" })] }), localOverrides.map(renderThemeBlock), _jsx("button", { className: styles.addButton, onClick: handleAddTheme, type: "button", "data-testid": "add-theme", children: "+ Add theme" }), otherColorIndices.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h4", { className: styles.subheading, children: "Other" }), otherColorIndices.map((i) => {
                                                const token = localTokens[i];
                                                return token ? renderColorRow(i, token) : null;
                                            })] }))] }), _jsxs("section", { className: styles.section, "data-theme-section": "typography", children: [_jsx("h3", { className: styles.sectionTitle, children: "Typography" }), grouped.typography.length === 0 && (_jsx("div", { className: styles.empty, children: "No typography tokens yet." })), grouped.typography.map((i) => {
                                        const token = localTokens[i];
                                        if (!token)
                                            return null;
                                        return renderTypographyRow(i, token, categories[i] ?? 'unknown');
                                    }), _jsx("button", { className: styles.addButton, onClick: () => handleAddToken('typography'), type: "button", children: "+ Add Typography" })] }), grouped.unknown.length > 0 && (_jsxs("section", { className: styles.section, "data-theme-section": "unknown", children: [_jsx("h3", { className: styles.sectionTitle, children: "Unknown" }), grouped.unknown.map((i) => {
                                        const token = localTokens[i];
                                        if (!token)
                                            return null;
                                        return renderTypographyRow(i, token, categories[i] ?? 'unknown');
                                    })] }))] }))] }), badgeMenuFor !== null &&
                createPortal(_jsxs(_Fragment, { children: [_jsx("div", { className: styles.badgeMenuBackdrop, onMouseDown: closeBadgeMenu }), _jsx("div", { className: styles.badgeMenu, role: "menu", style: {
                                top: badgeMenuFor.anchor.bottom + 4,
                                left: badgeMenuFor.anchor.right - 100,
                            }, children: TYPOGRAPHY_CATEGORY_OPTIONS.map((opt) => {
                                const targetCategory = classifyToken(localTokens[badgeMenuFor.index]?.value ?? '');
                                return (_jsx("button", { type: "button", role: "menuitem", className: `${styles.badgeMenuItem} ${targetCategory === opt.value ? styles.badgeMenuItemActive : ''}`, onClick: () => handleChangeCategory(badgeMenuFor.index, opt.value), children: opt.label }, opt.value));
                            }) })] }), document.body)] }));
};
