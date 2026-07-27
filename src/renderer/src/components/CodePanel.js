import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { css as cssLang } from '@codemirror/lang-css';
import { EditorView } from '@codemirror/view';
import { useCanvasStore } from '@store/canvasSlice';
import { editorThemeFor } from '../lib/editorTheme';
import { useAppTheme } from '../hooks/useAppTheme';
import { Tooltip } from './controls/Tooltip';
import styles from './CodePanel.module.css';
const READ_ONLY = EditorView.editable.of(false);
/**
 * Bottom code panel: read-only live view of the active page's TSX + CSS —
 * or the project's theme.css when the Design System panel is open.
 *
 * Page content is sourced from `pageSource`; theme content from
 * `themeCssRaw`. Both are kept fresh by the sync bridge on canvas-driven
 * writes and external file changes, so what's on disk is what's shown.
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
    if (showTheme) {
        const themePath = projectFormat === 'nextjs' ? 'app/theme.css' : 'theme.css';
        return (_jsxs("div", { className: styles.panel, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "Code" }), _jsx("span", { className: styles.spacer }), _jsx(Tooltip, { label: "Hide code panel", children: _jsx("button", { className: styles.closeButton, onClick: () => setBottomPanel('none'), type: "button", children: "\u00D7" }) })] }), _jsx("div", { className: styles.split, children: _jsxs("div", { className: styles.pane, children: [_jsx("div", { className: styles.paneHeader, children: _jsx("code", { children: themePath }) }), _jsx("div", { className: styles.editorWrap, children: _jsx(CodeMirror, { value: themeCssRaw, height: "100%", theme: editorTheme, extensions: [cssLang(), READ_ONLY], basicSetup: {
                                        lineNumbers: true,
                                        foldGutter: false,
                                        highlightActiveLine: false,
                                    } }) })] }) })] }));
    }
    return (_jsxs("div", { className: styles.panel, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "Code" }), _jsx("span", { className: styles.spacer }), _jsx(Tooltip, { label: "Hide code panel", children: _jsx("button", { className: styles.closeButton, onClick: () => setBottomPanel('none'), type: "button", children: "\u00D7" }) })] }), _jsxs("div", { className: styles.split, children: [_jsxs("div", { className: styles.pane, children: [_jsx("div", { className: styles.paneHeader, children: _jsx("code", { children: activePage ? `${activePage.name}.tsx` : '— no page —' }) }), _jsx("div", { className: styles.editorWrap, children: _jsx(CodeMirror, { value: tsx, height: "100%", theme: editorTheme, extensions: [javascript({ jsx: true, typescript: true }), READ_ONLY], basicSetup: {
                                        lineNumbers: true,
                                        foldGutter: false,
                                        highlightActiveLine: false,
                                    } }) })] }), _jsxs("div", { className: styles.pane, children: [_jsx("div", { className: styles.paneHeader, children: _jsx("code", { children: activePage ? `${activePage.name}.module.css` : '— no page —' }) }), _jsx("div", { className: styles.editorWrap, children: _jsx(CodeMirror, { value: css, height: "100%", theme: editorTheme, extensions: [cssLang(), READ_ONLY], basicSetup: {
                                        lineNumbers: true,
                                        foldGutter: false,
                                        highlightActiveLine: false,
                                    } }) })] })] })] }));
};
