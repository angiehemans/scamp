import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Button } from './controls/Button';
import styles from './SentryOptInPrompt.module.css';
/**
 * First-launch crash-reporting opt-in prompt. Rendered by `App.tsx`
 * before `<StartScreen>` when `settings.sentryOptIn` is `null` (i.e.
 * the user has not been asked yet). Calling `onDecision(true)` or
 * `onDecision(false)` writes the pref via the IPC bridge and
 * re-renders the app normally.
 *
 * Intentionally NOT dismissible by clicking the backdrop — the user
 * has to make an explicit choice. Pressing Escape counts as "No
 * thanks" (the privacy-preserving default).
 */
export const SentryOptInPrompt = ({ onDecision }) => {
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onDecision(false);
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                onDecision(true);
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onDecision]);
    return (_jsx("div", { className: styles.backdrop, children: _jsxs("div", { className: styles.dialog, role: "dialog", "aria-modal": "true", "aria-labelledby": "sentry-opt-in-title", children: [_jsx("h2", { id: "sentry-opt-in-title", className: styles.title, children: "Help improve Scamp" }), _jsx("p", { className: styles.message, children: "Send anonymous crash reports when something goes wrong. No personal data, no project files, no file contents \u2014 only error details and your OS and app version." }), _jsx("p", { className: styles.messageSecondary, children: "You can change this at any time in Settings." }), _jsxs("div", { className: styles.actions, children: [_jsx(Button, { variant: "ghost", onClick: () => onDecision(false), children: "No thanks" }), _jsx(Button, { variant: "primary", onClick: () => onDecision(true), autoFocus: true, children: "Send crash reports" })] })] }) }));
};
