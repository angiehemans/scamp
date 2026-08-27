import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconAlertTriangle, IconCheck, IconCode, IconLoader2, IconPlayerPlay, } from '@tabler/icons-react';
import { exportButtonLabel, exportButtonTooltip, } from '@lib/htmlExportStatus';
import { ZoomControls } from '../ZoomControls';
import { SaveStatusIndicator } from '../SaveStatusIndicator';
import { Tooltip } from '../controls/Tooltip';
import styles from '../ProjectShell.module.css';
const exportStatusClass = {
    idle: '',
    exporting: styles.toggleButtonBusy ?? '',
    done: styles.toggleButtonDone ?? '',
    error: styles.toggleButtonError ?? '',
};
/** Leading icon, which is the at-a-glance signal of what the button is doing. */
const ExportIcon = ({ status }) => {
    if (status === 'exporting') {
        return (_jsx(IconLoader2, { size: 14, className: `${styles.toggleButtonIcon} ${styles.spinning}` }));
    }
    if (status === 'done') {
        return _jsx(IconCheck, { size: 14, className: styles.toggleButtonIcon });
    }
    if (status === 'error') {
        return _jsx(IconAlertTriangle, { size: 14, className: styles.toggleButtonIcon });
    }
    return _jsx(IconCode, { size: 14, className: styles.toggleButtonIcon });
};
/**
 * Top toolbar: back-to-projects, zoom, preview, save status, project name.
 *
 * The code and terminal toggles moved to the canvas toolbar (right-aligned,
 * icon-only) — they act on the canvas, so they belong with it.
 */
export const ProjectHeader = ({ projectName, canPreview, projectFormat, onClose, onOpenPreview, onExportHtml, exportStatus, exportMessage, exportLocation, }) => {
    return (_jsxs("header", { className: styles.toolbar, children: [_jsx("button", { className: styles.backButton, onClick: onClose, type: "button", children: "\u2190 Projects" }), _jsx("span", { className: styles.spacer }), _jsx(ZoomControls, {}), _jsx(Tooltip, { label: canPreview
                    ? 'Open this project in a real browser preview window (⌘P)'
                    : projectFormat === 'legacy'
                        ? 'Preview is only available for Next.js-format projects. Migrate this project to enable preview.'
                        : 'Open a page to enable preview.', children: _jsxs("button", { className: styles.toggleButton, onClick: onOpenPreview, type: "button", disabled: !canPreview, "data-testid": "preview-button", children: [_jsx(IconPlayerPlay, { size: 14, className: styles.toggleButtonIcon }), "Preview"] }) }), _jsx(Tooltip, { label: exportButtonTooltip(exportStatus, exportMessage, exportLocation), children: _jsxs("button", { className: `${styles.toggleButton} ${exportStatusClass[exportStatus] ?? ''}`, onClick: onExportHtml, type: "button", disabled: exportStatus === 'exporting', "data-testid": "export-html-button", "data-export-status": exportStatus, children: [_jsx(ExportIcon, { status: exportStatus }), exportButtonLabel(exportStatus, exportMessage)] }) }), _jsx(SaveStatusIndicator, {}), _jsx("span", { className: styles.projectName, children: projectName })] }));
};
