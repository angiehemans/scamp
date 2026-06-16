import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconCode, IconPlayerPlay, IconTerminal2, } from '@tabler/icons-react';
import { ZoomControls } from '../ZoomControls';
import { SaveStatusIndicator } from '../SaveStatusIndicator';
import { Tooltip } from '../controls/Tooltip';
import styles from '../ProjectShell.module.css';
/** Top toolbar: back-to-projects, zoom, code/terminal/preview toggles. */
export const ProjectHeader = ({ projectName, bottomPanel, canPreview, projectFormat, onClose, onToggleCode, onToggleTerminal, onOpenPreview, }) => {
    return (_jsxs("header", { className: styles.toolbar, children: [_jsx("button", { className: styles.backButton, onClick: onClose, type: "button", children: "\u2190 Projects" }), _jsx("span", { className: styles.spacer }), _jsx(ZoomControls, {}), _jsx(Tooltip, { label: "Toggle code panel", children: _jsxs("button", { className: `${styles.toggleButton} ${bottomPanel === 'code' ? styles.toggleActive : ''}`, onClick: onToggleCode, type: "button", children: [_jsx(IconCode, { size: 14, className: styles.toggleButtonIcon }), "Code"] }) }), _jsx(Tooltip, { label: "Toggle terminal (Ctrl+`)", children: _jsxs("button", { className: `${styles.toggleButton} ${bottomPanel === 'terminal' ? styles.toggleActive : ''}`, onClick: onToggleTerminal, type: "button", children: [_jsx(IconTerminal2, { size: 14, className: styles.toggleButtonIcon }), "Terminal"] }) }), _jsx(Tooltip, { label: canPreview
                    ? 'Open this project in a real browser preview window (⌘P)'
                    : projectFormat === 'legacy'
                        ? 'Preview is only available for Next.js-format projects. Migrate this project to enable preview.'
                        : 'Open a page to enable preview.', children: _jsxs("button", { className: styles.toggleButton, onClick: onOpenPreview, type: "button", disabled: !canPreview, "data-testid": "preview-button", children: [_jsx(IconPlayerPlay, { size: 14, className: styles.toggleButtonIcon }), "Preview"] }) }), _jsx(SaveStatusIndicator, {}), _jsx("span", { className: styles.projectName, children: projectName })] }));
};
