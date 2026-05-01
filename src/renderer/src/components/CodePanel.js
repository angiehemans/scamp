import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { css as cssLang } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useCanvasStore } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import styles from './CodePanel.module.css';
const READ_ONLY = EditorView.editable.of(false);
/**
 * Bottom code panel: read-only live view of the active page's TSX + CSS.
 *
 * The content is sourced from `pageSource` in the canvas store, which the
 * sync bridge keeps fresh on both canvas-driven writes and external
 * file changes. So whatever's on disk is whatever's in the panel.
 */
export const CodePanel = () => {
    const activePage = useCanvasStore((s) => s.activePage);
    const pageSource = useCanvasStore((s) => s.pageSource);
    const setBottomPanel = useCanvasStore((s) => s.setBottomPanel);
    const tsx = pageSource?.tsx ?? '';
    const css = pageSource?.css ?? '';
    return (_jsxs("div", { className: styles.panel, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "Code" }), _jsx("span", { className: styles.spacer }), _jsx(Tooltip, { label: "Hide code panel", children: _jsx("button", { className: styles.closeButton, onClick: () => setBottomPanel('none'), type: "button", children: "\u00D7" }) })] }), _jsxs("div", { className: styles.split, children: [_jsxs("div", { className: styles.pane, children: [_jsx("div", { className: styles.paneHeader, children: _jsx("code", { children: activePage ? `${activePage.name}.tsx` : '— no page —' }) }), _jsx("div", { className: styles.editorWrap, children: _jsx(CodeMirror, { value: tsx, height: "100%", theme: oneDark, extensions: [javascript({ jsx: true, typescript: true }), READ_ONLY], basicSetup: {
                                        lineNumbers: true,
                                        foldGutter: false,
                                        highlightActiveLine: false,
                                    } }) })] }), _jsxs("div", { className: styles.pane, children: [_jsx("div", { className: styles.paneHeader, children: _jsx("code", { children: activePage ? `${activePage.name}.module.css` : '— no page —' }) }), _jsx("div", { className: styles.editorWrap, children: _jsx(CodeMirror, { value: css, height: "100%", theme: oneDark, extensions: [cssLang(), READ_ONLY], basicSetup: {
                                        lineNumbers: true,
                                        foldGutter: false,
                                        highlightActiveLine: false,
                                    } }) })] })] })] }));
};
