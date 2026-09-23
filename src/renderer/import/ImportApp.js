import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { captureFn, capturePolicy } from '@shared/captureScript';
import styles from './ImportApp.module.css';
/** `https://` in front of a bare host, so typing `stripe.com` works. */
const normalizeUrl = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0)
        return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed))
        return trimmed;
    return `https://${trimmed}`;
};
export const ImportApp = () => {
    const webviewRef = useRef(null);
    const [projectPath, setProjectPath] = useState('');
    const [draftUrl, setDraftUrl] = useState('');
    const [loadedUrl, setLoadedUrl] = useState('');
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [status, setStatus] = useState({ kind: 'idle' });
    /**
     * The `<webview>` tag's methods — `executeJavaScript` among them —
     * only exist once it has emitted `dom-ready`. Before that the element
     * is in the DOM and the calls are not there, which reads exactly like
     * a button that does nothing.
     */
    const [webviewReady, setWebviewReady] = useState(false);
    useEffect(() => {
        const offOpen = window.scampImport.onOpen((args) => {
            setProjectPath(args.projectPath);
            if (args.url) {
                setDraftUrl(args.url);
                setLoadedUrl(normalizeUrl(args.url));
            }
        });
        const offResult = window.scampImport.onResult((result) => {
            setStatus({ kind: 'done', result });
        });
        return () => {
            offOpen();
            offResult();
        };
    }, []);
    // Keep the URL bar and the history buttons in step with the page.
    useEffect(() => {
        const node = webviewRef.current;
        if (!node)
            return;
        const wv = node;
        const refresh = () => {
            try {
                setCanGoBack(wv.canGoBack());
                setCanGoForward(wv.canGoForward());
            }
            catch {
                // Not attached yet; the next event will do it.
            }
        };
        const onNavigate = (e) => {
            const url = e.url;
            if (typeof url === 'string')
                setDraftUrl(url);
            // A new page invalidates the last import's verdict.
            setStatus((s) => (s.kind === 'idle' ? s : { kind: 'idle' }));
            refresh();
        };
        const onDomReady = () => setWebviewReady(true);
        node.addEventListener('dom-ready', onDomReady);
        node.addEventListener('did-navigate', onNavigate);
        node.addEventListener('did-navigate-in-page', onNavigate);
        node.addEventListener('did-finish-load', refresh);
        return () => {
            node.removeEventListener('dom-ready', onDomReady);
            node.removeEventListener('did-navigate', onNavigate);
            node.removeEventListener('did-navigate-in-page', onNavigate);
            node.removeEventListener('did-finish-load', refresh);
        };
    }, [loadedUrl]);
    const handleGo = useCallback(() => {
        const next = normalizeUrl(draftUrl);
        if (next.length === 0)
            return;
        setWebviewReady(false);
        setLoadedUrl(next);
        const node = webviewRef.current;
        // Already mounted: navigate it. First load: the `src` does it.
        if (node?.loadURL)
            node.loadURL(next);
    }, [draftUrl]);
    const handleImport = useCallback(async () => {
        const node = webviewRef.current;
        if (!node?.executeJavaScript || projectPath.length === 0) {
            setStatus({
                kind: 'failed',
                message: 'The page is not ready to read yet — wait for it to finish loading.',
            });
            return;
        }
        setStatus({ kind: 'capturing' });
        try {
            // The capture function is serialized and evaluated in the page,
            // with the policy passed in as data — it cannot import anything
            // once it is over there.
            const source = `(${captureFn.toString()})(${JSON.stringify(capturePolicy())})`;
            const payload = await node.executeJavaScript(source);
            const sent = await window.scampImport.deliver(projectPath, payload);
            if (!sent.ok) {
                setStatus({ kind: 'failed', message: sent.error ?? 'Scamp could not take the page.' });
            }
            // On success the app window answers over `onResult`.
        }
        catch (err) {
            setStatus({
                kind: 'failed',
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }, [projectPath]);
    const nav = (method) => () => {
        const node = webviewRef.current;
        node?.[method]?.();
    };
    const busy = status.kind === 'capturing';
    return (_jsxs("div", { className: styles.shell, children: [_jsxs("div", { className: styles.toolbar, children: [_jsx("button", { className: styles.navBtn, onClick: nav('goBack'), disabled: !canGoBack, title: "Back", children: "\u2039" }), _jsx("button", { className: styles.navBtn, onClick: nav('goForward'), disabled: !canGoForward, title: "Forward", children: "\u203A" }), _jsx("button", { className: styles.navBtn, onClick: nav('reload'), disabled: !loadedUrl, title: "Reload", children: "\u27F3" }), _jsx("input", { className: styles.urlBar, value: draftUrl, onChange: (e) => setDraftUrl(e.target.value), onKeyDown: (e) => {
                            if (e.key === 'Enter')
                                handleGo();
                        }, placeholder: "Paste a URL, then navigate to the page you want", spellCheck: false, "aria-label": "Address" }), _jsx("button", { className: styles.importBtn, onClick: () => void handleImport(), disabled: !loadedUrl || !webviewReady || busy || projectPath.length === 0, children: busy ? 'Reading the page…' : 'Import' })] }), status.kind !== 'idle' && status.kind !== 'capturing' && (_jsx("div", { className: `${styles.banner} ${status.kind === 'failed' || !status.result?.ok ? styles.bannerBad : styles.bannerGood}`, children: status.kind === 'failed' ? (_jsx("span", { children: status.message })) : status.result.ok ? (_jsxs("span", { children: ["Imported ", _jsx("strong", { children: status.result.viewName }), " \u2014", ' ', status.result.elementCount, " elements", status.result.findings && status.result.findings.length > 0 && (_jsxs("span", { className: styles.findings, children: [' ', "\u00B7 ", status.result.findings.length, " things didn't come across:", ' ', status.result.findings.slice(0, 3).join('; '), status.result.findings.length > 3 ? ' …' : ''] }))] })) : (_jsx("span", { children: status.result.error ?? 'The import failed.' })) })), _jsx("div", { className: styles.viewport, children: loadedUrl ? (_jsx("webview", { 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ref: webviewRef, src: loadedUrl, className: styles.webview })) : (_jsxs("div", { className: styles.empty, children: [_jsx("p", { className: styles.emptyTitle, children: "Import a page" }), _jsxs("p", { className: styles.emptyBody, children: ["Paste a URL above and navigate to the page you want. Clicking", _jsx("strong", { children: " Import" }), " reads the page as it is on screen and makes a new view from it."] })] })) })] }));
};
