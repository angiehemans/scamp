import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { css as cssLang } from '@codemirror/lang-css';
import { EditorView } from '@codemirror/view';
import { useCanvasStore } from '@store/canvasSlice';
import { findCssBlocks, findTsxLines } from '@lib/codeHighlight';
import { classNameFor } from '@lib/generateCode';
import { editorThemeFor } from '../lib/editorTheme';
import { useAppTheme } from '../hooks/useAppTheme';
import { HighlightedCode } from './HighlightedCode';
import { Tooltip } from './controls/Tooltip';
import styles from './CodePanel.module.css';
const READ_ONLY = EditorView.editable.of(false);
const JS_LANG = javascript({ jsx: true, typescript: true });
const CSS_LANG = cssLang();
/**
 * Bottom code panel: read-only live view of the active page's TSX + CSS —
 * or the project's theme.css when the Design System panel is open.
 *
 * Page content is sourced from `pageSource`; theme content from
 * `themeCssRaw`. Both are kept fresh by the sync bridge on canvas-driven
 * writes and external file changes, so what's on disk is what's shown.
 *
 * The selected element's lines are highlighted in both panes and scrolled
 * into view — see `@lib/codeHighlight` for how they're located.
 */
export const CodePanel = ({ showTheme = false }) => {
    const activePage = useCanvasStore((s) => s.activePage);
    const pageSource = useCanvasStore((s) => s.pageSource);
    const themeCssRaw = useCanvasStore((s) => s.themeCssRaw);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    const setBottomPanel = useCanvasStore((s) => s.setBottomPanel);
    const editorTheme = editorThemeFor(useAppTheme());
    const tsx = pageSource?.tsx ?? '';
    const css = pageSource?.css ?? '';
    // The primary selection only. Highlighting a multi-select would light up
    // scattered regions with no way to tell which is which.
    const selectedClass = useCanvasStore((s) => {
        const id = s.selectedElementIds[0];
        const el = id === undefined ? undefined : s.elements[id];
        return el === undefined ? null : classNameFor(el);
    });
    const tsxRanges = useMemo(() => (selectedClass === null ? [] : findTsxLines(tsx, selectedClass)), [tsx, selectedClass]);
    const cssRanges = useMemo(() => (selectedClass === null ? [] : findCssBlocks(css, selectedClass)), [css, selectedClass]);
    if (showTheme) {
        const themePath = projectFormat === 'nextjs' ? 'app/theme.css' : 'theme.css';
        return (_jsxs("div", { className: styles.panel, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "Code" }), _jsx("span", { className: styles.spacer }), _jsx(Tooltip, { label: "Hide code panel", children: _jsx("button", { className: styles.closeButton, onClick: () => setBottomPanel('none'), type: "button", children: "\u00D7" }) })] }), _jsx("div", { className: styles.split, children: _jsxs("div", { className: styles.pane, children: [_jsx("div", { className: styles.paneHeader, children: _jsx("code", { children: themePath }) }), _jsx("div", { className: styles.editorWrap, children: _jsx(CodeMirror, { value: themeCssRaw, height: "100%", theme: editorTheme, extensions: [CSS_LANG, READ_ONLY], basicSetup: {
                                        lineNumbers: true,
                                        foldGutter: false,
                                        highlightActiveLine: false,
                                    } }) })] }) })] }));
    }
    return (_jsxs("div", { className: styles.panel, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "Code" }), _jsx("span", { className: styles.spacer }), _jsx(Tooltip, { label: "Hide code panel", children: _jsx("button", { className: styles.closeButton, onClick: () => setBottomPanel('none'), type: "button", children: "\u00D7" }) })] }), _jsxs("div", { className: styles.split, children: [_jsxs("div", { className: styles.pane, "data-pane": "tsx", children: [_jsx("div", { className: styles.paneHeader, children: _jsx("code", { children: activePage ? `${activePage.name}.tsx` : '— no page —' }) }), _jsx("div", { className: styles.editorWrap, children: _jsx(HighlightedCode, { value: tsx, language: JS_LANG, ranges: tsxRanges, theme: editorTheme }) })] }), _jsxs("div", { className: styles.pane, "data-pane": "css", children: [_jsx("div", { className: styles.paneHeader, children: _jsx("code", { children: activePage ? `${activePage.name}.module.css` : '— no page —' }) }), _jsx("div", { className: styles.editorWrap, children: _jsx(HighlightedCode, { value: css, language: CSS_LANG, ranges: cssRanges, theme: editorTheme }) })] })] })] }));
};
