import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@store/canvasSlice';
import { useFontsStore, selectAllFonts } from '@store/fontsSlice';
import { serializeThemeFile } from '@lib/parseTheme';
import { classifyToken } from '@lib/tokenClassify';
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
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    const elements = useCanvasStore((s) => s.elements);
    const allFonts = useFontsStore(selectAllFonts);
    const [localTokens, setLocalTokens] = useState([...themeTokens]);
    const [activeTab, setActiveTab] = useState('colors');
    const [error, setError] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
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
    const tokenListRef = useRef(null);
    const [scrollToEndAfterAdd, setScrollToEndAfterAdd] = useState(0);
    useEffect(() => {
        if (scrollToEndAfterAdd === 0)
            return;
        const list = tokenListRef.current;
        if (list)
            list.scrollTop = list.scrollHeight;
    }, [scrollToEndAfterAdd]);
    // Sync from store when tokens change externally (e.g. file edit).
    useEffect(() => {
        setLocalTokens([...themeTokens]);
    }, [themeTokens]);
    // Classify once per render so the tab lists and badges agree.
    const categories = useMemo(() => localTokens.map((t) => classifyToken(t.value)), [localTokens]);
    const tabCounts = useMemo(() => {
        let colors = 0;
        let typography = 0;
        let unknown = 0;
        for (const c of categories) {
            if (c === 'color')
                colors += 1;
            else if (TYPOGRAPHY_CATEGORIES.has(c))
                typography += 1;
            else
                unknown += 1;
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
            if (activeTab === 'colors')
                return c === 'color';
            if (activeTab === 'typography')
                return TYPOGRAPHY_CATEGORIES.has(c);
            return c === 'unknown';
        })
            .map(({ i }) => i);
    }, [categories, activeTab]);
    const writeTokens = useCallback(async (tokens) => {
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
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [projectPath]);
    const nextDefaultName = (prefix) => {
        const existing = new Set(localTokens.map((t) => t.name));
        let idx = 1;
        while (existing.has(`${prefix}-${idx}`))
            idx += 1;
        return `${prefix}-${idx}`;
    };
    const handleAddToken = () => {
        let newToken;
        if (activeTab === 'colors') {
            newToken = { name: nextDefaultName('--color'), value: '#888888' };
        }
        else if (activeTab === 'typography') {
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
            setLocalTokens([...themeTokens]);
            return;
        }
        const duplicate = localTokens.some((t, i) => i !== index && t.name === token.name);
        if (duplicate) {
            setError(`${token.name} already exists`);
            setLocalTokens([...themeTokens]);
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
    useDialogBackdrop({ onClose });
    const renderColorRow = (index, token) => (_jsxs("div", { className: styles.tokenRow, children: [_jsx("input", { type: "text", className: styles.tokenName, value: token.name, onChange: (e) => handleNameChange(index, e.target.value), onBlur: () => handleNameBlur(index), onKeyDown: (e) => {
                    if (e.key === 'Enter')
                        e.currentTarget.blur();
                } }), _jsx("div", { className: styles.tokenColor, children: _jsx(ColorInput, { value: token.value, onChange: (v) => handleColorChange(index, v) }) }), _jsx(Tooltip, { label: "Delete token", children: _jsx("button", { className: styles.tokenDelete, onClick: () => handleDeleteRequest(index), type: "button", children: "x" }) })] }, index));
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
        return (_jsxs("div", { className: styles.tokenRow, children: [_jsx("input", { type: "text", className: styles.tokenName, value: token.name, onChange: (e) => handleNameChange(index, e.target.value), onBlur: () => handleNameBlur(index), onKeyDown: (e) => {
                        if (e.key === 'Enter')
                            e.currentTarget.blur();
                    } }), _jsx("div", { className: styles.tokenValueCell, children: isFontFamily ? (_jsx(FontPicker, { value: token.value, fonts: allFonts, onChange: (v) => handleFontFamilyChange(index, v), title: "Font family" })) : (_jsx("input", { type: "text", className: styles.tokenValue, value: token.value, onChange: (e) => handleValueChange(index, e.target.value), onBlur: () => commitValue(index), onKeyDown: (e) => {
                            if (e.key === 'Enter')
                                e.currentTarget.blur();
                        }, placeholder: "value" })) }), _jsx("div", { className: styles.badgeWrap, children: _jsx(Tooltip, { label: "Change token type", children: _jsxs("button", { type: "button", className: `${styles.tokenBadge} ${styles.tokenBadgeButton}`, onClick: handleBadgeClick, "aria-haspopup": "menu", "aria-expanded": badgeOpen, children: [categoryBadge(category), " ", _jsx("span", { children: "\u25BE" })] }) }) }), _jsx(Tooltip, { label: "Delete token", children: _jsx("button", { className: styles.tokenDelete, onClick: () => handleDeleteRequest(index), type: "button", children: "x" }) })] }, index));
    };
    return (_jsxs("div", { className: styles.backdrop, onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: [_jsxs("div", { className: styles.dialog, "data-testid": "theme-panel", children: [_jsxs("div", { className: styles.header, children: [_jsx("h2", { className: styles.title, children: "Theme Tokens" }), _jsx("button", { className: styles.closeButton, onClick: onClose, type: "button", children: "x" })] }), _jsxs("div", { className: styles.tabs, children: [_jsxs("button", { type: "button", className: `${styles.tab} ${activeTab === 'colors' ? styles.tabActive : ''}`, onClick: () => setActiveTab('colors'), children: ["Colors", _jsx("span", { className: styles.tabCount, children: tabCounts.colors })] }), _jsxs("button", { type: "button", className: `${styles.tab} ${activeTab === 'typography' ? styles.tabActive : ''}`, onClick: () => setActiveTab('typography'), children: ["Typography", _jsx("span", { className: styles.tabCount, children: tabCounts.typography })] }), tabCounts.unknown > 0 && (_jsxs("button", { type: "button", className: `${styles.tab} ${activeTab === 'unknown' ? styles.tabActive : ''}`, onClick: () => setActiveTab('unknown'), children: ["Unknown", _jsx("span", { className: styles.tabCount, children: tabCounts.unknown })] }))] }), error && _jsx("div", { className: styles.error, children: error }), pendingDelete && (_jsxs("div", { className: styles.warning, children: [_jsx("strong", { children: pendingDelete.name }), " is used by", ' ', pendingDelete.usageCount, " element", pendingDelete.usageCount > 1 ? 's' : '', ". Delete anyway?", _jsxs("div", { className: styles.warningActions, children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => setPendingDelete(null), children: "Cancel" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => confirmDelete(pendingDelete.index), children: "Delete" })] })] })), _jsxs("div", { ref: tokenListRef, className: styles.tokenList, children: [visibleIndices.length === 0 && (_jsx("div", { className: styles.empty, children: activeTab === 'colors'
                                    ? 'No color tokens yet. Add one to get started.'
                                    : activeTab === 'typography'
                                        ? 'No typography tokens yet. Add one to get started.'
                                        : 'No unclassified tokens.' })), visibleIndices.map((i) => {
                                const token = localTokens[i];
                                if (!token)
                                    return null;
                                const category = categories[i] ?? 'unknown';
                                if (category === 'color')
                                    return renderColorRow(i, token);
                                return renderTypographyRow(i, token, category);
                            })] }), _jsxs("button", { className: styles.addButton, onClick: handleAddToken, type: "button", children: ["+ Add ", activeTab === 'colors' ? 'Color' : activeTab === 'typography' ? 'Typography' : 'Token'] })] }), badgeMenuFor !== null &&
                createPortal(_jsxs(_Fragment, { children: [_jsx("div", { className: styles.badgeMenuBackdrop, onMouseDown: closeBadgeMenu }), _jsx("div", { className: styles.badgeMenu, role: "menu", style: {
                                top: badgeMenuFor.anchor.bottom + 4,
                                left: badgeMenuFor.anchor.right - 100,
                            }, children: TYPOGRAPHY_CATEGORY_OPTIONS.map((opt) => {
                                const targetCategory = classifyToken(localTokens[badgeMenuFor.index]?.value ?? '');
                                return (_jsx("button", { type: "button", role: "menuitem", className: `${styles.badgeMenuItem} ${targetCategory === opt.value ? styles.badgeMenuItemActive : ''}`, onClick: () => handleChangeCategory(badgeMenuFor.index, opt.value), children: opt.label }, opt.value));
                            }) })] }), document.body)] }));
};
