import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useSaveStatusStore } from '@store/saveStatusSlice';
import { Button } from './controls/Button';
import styles from './UpdateBanner.module.css';
export const UpdateBanner = () => {
    const [status, setStatus] = useState({ kind: 'idle' });
    const [dismissed, setDismissed] = useState(false);
    // Don't interrupt an in-flight save with the install prompt — wait for
    // the save-status indicator to settle back to "Saved".
    const saving = useSaveStatusStore((s) => s.state.kind === 'saving');
    useEffect(() => {
        const offAvailable = window.scamp.onUpdaterAvailable(() => {
            setDismissed(false);
            setStatus({ kind: 'downloading', percent: 0 });
        });
        const offProgress = window.scamp.onUpdaterProgress((progress) => {
            setStatus({ kind: 'downloading', percent: Math.round(progress.percent) });
        });
        const offDownloaded = window.scamp.onUpdaterDownloaded((info) => {
            setDismissed(false);
            setStatus({ kind: 'ready', version: info.version });
        });
        const offError = window.scamp.onUpdaterError(() => {
            setDismissed(false);
            setStatus({ kind: 'error' });
        });
        return () => {
            offAvailable();
            offProgress();
            offDownloaded();
            offError();
        };
    }, []);
    if (status.kind === 'idle' || dismissed)
        return null;
    if (status.kind === 'ready' && saving)
        return null;
    const handleInstall = () => {
        void window.scamp.installUpdateNow();
    };
    const handleDismiss = () => setDismissed(true);
    return (_jsxs("div", { className: styles.banner, role: "status", "aria-live": "polite", "data-testid": "update-banner", children: [status.kind === 'downloading' && (_jsxs("span", { className: styles.message, children: ["Downloading update\u2026 ", status.percent, "%"] })), status.kind === 'ready' && (_jsxs(_Fragment, { children: [_jsxs("span", { className: styles.message, children: ["Scamp ", status.version, " is ready to install"] }), _jsxs("div", { className: styles.actions, children: [_jsx(Button, { variant: "primary", size: "sm", onClick: handleInstall, children: "Restart and install" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleDismiss, children: "Later" })] })] })), status.kind === 'error' && (_jsxs(_Fragment, { children: [_jsx("span", { className: styles.message, children: "Update failed \u2014 check your connection" }), _jsx("div", { className: styles.actions, children: _jsx(Button, { variant: "ghost", size: "sm", onClick: handleDismiss, children: "Dismiss" }) })] }))] }));
};
