import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './PreviewToolbar.module.css';
const STATUS_LABEL = {
    idle: 'Idle',
    installing: 'Installing…',
    starting: 'Starting…',
    ready: 'Ready',
    crashed: 'Crashed',
};
const PRESET_BUTTONS = [
    { label: 'Mobile', width: { kind: 'mobile' }, px: 390 },
    { label: 'Tablet', width: { kind: 'tablet' }, px: 768 },
    { label: 'Desktop', width: { kind: 'desktop' }, px: 1440 },
    { label: 'Fullscreen', width: { kind: 'fullscreen' }, px: null },
];
const isSamePreset = (a, b) => a.kind === b.kind;
export const PreviewToolbar = ({ url, statusKind, canGoBack, canGoForward, viewportWidth, onBack, onForward, onReload, onOpenDevTools, onViewportChange, }) => {
    const [copied, setCopied] = useState(false);
    const [customDraft, setCustomDraft] = useState('');
    const handleCopy = async () => {
        if (!url)
            return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        }
        catch {
            // Clipboard API blocked — fall through silently.
        }
    };
    const handleCustomCommit = () => {
        const px = parseInt(customDraft, 10);
        if (!Number.isFinite(px) || px <= 0)
            return;
        onViewportChange({ kind: 'custom', px });
    };
    return (_jsxs("header", { className: styles.toolbar, children: [_jsxs("div", { className: styles.navGroup, children: [_jsx("button", { type: "button", className: styles.navBtn, onClick: onBack, disabled: !canGoBack, title: "Back", "aria-label": "Back", children: "\u2190" }), _jsx("button", { type: "button", className: styles.navBtn, onClick: onForward, disabled: !canGoForward, title: "Forward", "aria-label": "Forward", children: "\u2192" }), _jsx("button", { type: "button", className: styles.navBtn, onClick: onReload, title: "Reload", "aria-label": "Reload", children: "\u21BA" })] }), _jsxs("div", { className: styles.urlGroup, children: [_jsx("span", { className: styles.urlBar, title: url, children: url || '—' }), _jsx("button", { type: "button", className: styles.copyBtn, onClick: () => void handleCopy(), title: "Copy URL", "aria-label": "Copy URL", disabled: !url, children: copied ? '✓' : '⧉' })] }), _jsx("span", { className: `${styles.statusChip} ${styles[`statusChip_${statusKind}`] ?? ''}`, title: `Dev server status: ${STATUS_LABEL[statusKind]}`, children: STATUS_LABEL[statusKind] }), _jsx("button", { type: "button", className: styles.navBtn, onClick: onOpenDevTools, disabled: statusKind !== 'ready', title: "Open browser DevTools for the preview", "aria-label": "Open DevTools", children: "\u2699" }), _jsxs("div", { className: styles.viewportGroup, role: "radiogroup", "aria-label": "Viewport width", children: [PRESET_BUTTONS.map(({ label, width, px }) => {
                        const active = isSamePreset(viewportWidth, width);
                        return (_jsx("button", { type: "button", role: "radio", "aria-checked": active, className: `${styles.viewportBtn} ${active ? styles.viewportBtnActive : ''}`, onClick: () => onViewportChange(width), title: px === null ? 'Fill the window' : `${px}px wide`, children: label }, width.kind));
                    }), _jsx("input", { type: "text", inputMode: "numeric", className: `${styles.viewportInput} ${viewportWidth.kind === 'custom' ? styles.viewportInputActive : ''}`, placeholder: "Custom", value: viewportWidth.kind === 'custom'
                            ? String(viewportWidth.px)
                            : customDraft, onChange: (e) => setCustomDraft(e.target.value), onBlur: handleCustomCommit, onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                e.currentTarget.blur();
                            }
                        }, title: "Custom width in pixels" })] })] }));
};
/** Resolve a `ViewportWidth` to the wrapper width in CSS units.
 *  Fullscreen uses `100%`; everything else is fixed pixels. */
export const viewportCss = (vp) => {
    if (vp.kind === 'fullscreen')
        return '100%';
    if (vp.kind === 'mobile')
        return '390px';
    if (vp.kind === 'tablet')
        return '768px';
    if (vp.kind === 'desktop')
        return '1440px';
    return `${vp.px}px`;
};
