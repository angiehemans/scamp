import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import styles from './AccountPanel.module.css';
/** First initial for the avatar, falling back to the email. */
const initialFor = (user) => {
    const source = user?.name?.trim() || user?.email?.trim() || '';
    return source.charAt(0).toUpperCase() || '·';
};
export const AccountPanel = () => {
    const [state, setState] = useState({ kind: 'loading' });
    const applyStatus = useCallback((status) => {
        setState(status.signedIn
            ? { kind: 'signed-in', user: status.user, sessionOnly: false }
            : { kind: 'signed-out' });
    }, []);
    useEffect(() => {
        let cancelled = false;
        void window.scamp.authStatus().then((status) => {
            if (!cancelled)
                applyStatus(status);
        });
        // Another window signing in or out should update this one too.
        const off = window.scamp.onAuthChanged(applyStatus);
        return () => {
            cancelled = true;
            off();
        };
    }, [applyStatus]);
    const handleSignIn = async () => {
        setState({ kind: 'signing-in' });
        const result = await window.scamp.authSignIn();
        if (result.status === 'signed-in') {
            setState({
                kind: 'signed-in',
                user: result.user,
                // The OS could not encrypt, so this session will not survive a
                // restart. Said plainly rather than silently forgotten.
                sessionOnly: !result.persisted,
            });
            return;
        }
        if (result.status === 'cancelled') {
            setState({ kind: 'signed-out' });
            return;
        }
        setState({
            kind: 'signed-out',
            message: result.status === 'timeout'
                ? 'Sign-in timed out. Try again when you are ready.'
                : result.message,
        });
    };
    /**
     * Abandon a sign-in in flight. Without this the only way out of
     * "waiting for browser" is the 15-minute timeout — which is what
     * happened when a dev build opened the live site, where the desktop
     * endpoints do not exist and no callback was ever coming.
     */
    const handleCancel = async () => {
        await window.scamp.authCancelSignIn();
        setState({ kind: 'signed-out' });
    };
    const handleSignOut = async () => {
        await window.scamp.authSignOut();
        setState({ kind: 'signed-out' });
    };
    if (state.kind === 'loading')
        return _jsx("div", { className: styles.panel });
    if (state.kind === 'signed-in') {
        return (_jsxs("div", { className: styles.panel, "data-testid": "account-panel", children: [_jsxs("div", { className: styles.identity, children: [_jsx("span", { className: styles.avatar, "aria-hidden": "true", children: initialFor(state.user) }), _jsxs("span", { className: styles.details, children: [_jsx("span", { className: styles.name, children: state.user?.name || 'Signed in' }), state.user?.email !== undefined && (_jsx("span", { className: styles.email, children: state.user.email }))] })] }), state.sessionOnly && (_jsx("p", { className: styles.note, children: "This device can\u2019t store your sign-in securely, so you\u2019ll need to sign in again next time you open Scamp." })), _jsx("button", { className: styles.link, onClick: handleSignOut, type: "button", "data-testid": "sign-out-button", children: "Sign out" })] }));
    }
    return (_jsxs("div", { className: styles.panel, "data-testid": "account-panel", children: [_jsx("button", { className: styles.signIn, onClick: handleSignIn, type: "button", disabled: state.kind === 'signing-in', "data-testid": "sign-in-button", children: state.kind === 'signing-in' ? 'Waiting for browser…' : 'Sign in' }), state.kind === 'signing-in' && (_jsxs(_Fragment, { children: [_jsx("p", { className: styles.note, children: "Finish signing in in your browser." }), _jsx("button", { className: styles.link, onClick: handleCancel, type: "button", children: "Cancel" })] })), state.kind === 'signed-out' && state.message !== undefined && (_jsx("p", { className: styles.error, role: "status", children: state.message }))] }));
};
