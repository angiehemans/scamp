import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconPlayerPlay } from '@tabler/icons-react';
import { ZoomControls } from '../ZoomControls';
import { SaveStatusIndicator } from '../SaveStatusIndicator';
import { Tooltip } from '../controls/Tooltip';
import styles from '../ProjectShell.module.css';
/**
 * Top toolbar: back-to-projects, zoom, preview, save status, project name.
 *
 * The code and terminal toggles moved to the canvas toolbar (right-aligned,
 * icon-only) — they act on the canvas, so they belong with it.
 */
export const ProjectHeader = ({ projectName, canPreview, projectFormat, onClose, onOpenPreview, }) => {
    return (_jsxs("header", { className: styles.toolbar, children: [_jsx("button", { className: styles.backButton, onClick: onClose, type: "button", children: "\u2190 Projects" }), _jsx("span", { className: styles.spacer }), _jsx(ZoomControls, {}), _jsx(Tooltip, { label: canPreview
                    ? 'Open this project in a real browser preview window (⌘P)'
                    : projectFormat === 'legacy'
                        ? 'Preview is only available for Next.js-format projects. Migrate this project to enable preview.'
                        : 'Open a page to enable preview.', children: _jsxs("button", { className: styles.toggleButton, onClick: onOpenPreview, type: "button", disabled: !canPreview, "data-testid": "preview-button", children: [_jsx(IconPlayerPlay, { size: 14, className: styles.toggleButtonIcon }), "Preview"] }) }), _jsx(SaveStatusIndicator, {}), _jsx("span", { className: styles.projectName, children: projectName })] }));
};
