import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { pageNameToRoute, previewUrl } from './route';
import { PreviewToolbar, viewportCss, } from './PreviewToolbar';
import styles from './PreviewApp.module.css';
/**
 * Preview window's React shell. Subscribes to dev-server status
 * pushed from main; renders an install/start panel until the
 * server reaches `ready`, then mounts an Electron `<webview>` that
 * loads the live dev-server URL.
 */
export const PreviewApp = () => {
    const [status, setStatus] = useState({ kind: 'idle' });
    const [projectPath, setProjectPath] = useState('');
    const [pageName, setPageName] = useState('home');
    const [currentUrl, setCurrentUrl] = useState('');
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [viewportWidth, setViewportWidth] = useState({
        kind: 'fullscreen',
    });
    // The cast preserves React's WebViewHTMLAttributes typing while
    // letting us use the broader EventTarget API for `addEventListener`
    // / `goBack` / `reload`.
    const webviewRef = useRef(null);
    const previewApi = window.scampPreview;
    useEffect(() => {
        const hash = window.location.hash.replace(/^#/, '');
        if (hash.length > 0)
            setProjectPath(decodeURIComponent(hash));
    }, []);
    useEffect(() => {
        if (!previewApi)
            return;
        const off = previewApi.onStatusChanged((payload) => {
            setProjectPath(payload.projectPath);
            setStatus(payload.status);
        });
        return off;
    }, [previewApi]);
    // Pull the current status explicitly on mount. Push events from
    // main can be lost if they fire before the renderer attaches its
    // listener (race between window creation and first paint).
    // The hash-derived projectPath is the source of truth here since
    // it's set synchronously from the URL fragment.
    useEffect(() => {
        if (!previewApi)
            return;
        const hash = window.location.hash.replace(/^#/, '');
        const path = hash.length > 0 ? decodeURIComponent(hash) : '';
        if (path.length === 0)
            return;
        void previewApi.getStatus(path).then((s) => {
            setStatus(s);
        });
    }, [previewApi]);
    useEffect(() => {
        if (!previewApi)
            return;
        const off = previewApi.onNavigate((payload) => {
            setPageName(payload.pageName);
        });
        return off;
    }, [previewApi]);
    // Defensive fallback: if the preload didn't load (build / path
    // misconfiguration), render an explicit error so the user sees
    // something concrete instead of a blank window.
    if (!previewApi) {
        return (_jsx("div", { className: styles.app, children: _jsx("main", { className: styles.body, children: _jsxs("div", { className: styles.statusPanel, children: [_jsx("h2", { className: styles.crashed, children: "Preview preload failed to load." }), _jsxs("p", { className: styles.statusHint, children: [_jsx("code", { children: "window.scampPreview" }), " is undefined. The preview preload didn't load \u2014 check the BrowserWindow's", _jsx("code", { children: "preload" }), " path in main."] })] }) }) }));
    }
    // Narrow the dep set to the scalar bits the navigation actually
    // cares about. Depending on the whole `status` object would refire
    // this effect every time main pushes a new status push (each log
    // line during install/start), and the same-URL `setAttribute` call
    // would cancel the in-flight load with ERR_ABORTED.
    const port = status.kind === 'ready' ? status.port : null;
    useEffect(() => {
        if (port === null)
            return;
        const node = webviewRef.current;
        if (!node)
            return;
        const url = previewUrl(port, pageNameToRoute(pageName));
        // Guard against same-URL re-navigation. The webview is also
        // navigated by the user (in-app links) and we shouldn't yank
        // them back here — only initialise / page-switch updates the
        // URL via this effect.
        if (node.getAttribute('src') === url)
            return;
        node.setAttribute('src', url);
        setCurrentUrl(url);
    }, [port, pageName]);
    // Watch the webview for navigation events so the URL bar and
    // back/forward enabled state stay in sync.
    useEffect(() => {
        const node = webviewRef.current;
        if (!node)
            return;
        const refreshHistory = () => {
            // Both methods are exposed on the webview tag at runtime.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wv = node;
            try {
                setCanGoBack(wv.canGoBack());
                setCanGoForward(wv.canGoForward());
            }
            catch {
                // Webview not yet attached — ignore until the next event.
            }
        };
        const handleNavigate = (e) => {
            const ev = e;
            if (typeof ev.url === 'string')
                setCurrentUrl(ev.url);
            refreshHistory();
        };
        node.addEventListener('did-navigate', handleNavigate);
        node.addEventListener('did-navigate-in-page', handleNavigate);
        node.addEventListener('did-finish-load', refreshHistory);
        return () => {
            node.removeEventListener('did-navigate', handleNavigate);
            node.removeEventListener('did-navigate-in-page', handleNavigate);
            node.removeEventListener('did-finish-load', refreshHistory);
        };
    }, [status.kind]); // re-bind when the webview is (re)mounted
    const handleBack = () => {
        const node = webviewRef.current;
        if (!node)
            return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.goBack();
    };
    const handleForward = () => {
        const node = webviewRef.current;
        if (!node)
            return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.goForward();
    };
    const handleReload = () => {
        if (status.kind === 'crashed') {
            void window.scampPreview.restart(projectPath);
            return;
        }
        const node = webviewRef.current;
        if (!node)
            return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.reload();
    };
    const handleOpenDevTools = () => {
        const node = webviewRef.current;
        if (!node)
            return;
        // `openDevTools` is on the webview tag at runtime — opens
        // Chromium DevTools attached to the embedded page.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.openDevTools();
    };
    return (_jsxs("div", { className: styles.app, children: [_jsx(PreviewToolbar, { url: currentUrl, statusKind: status.kind, canGoBack: canGoBack, canGoForward: canGoForward, viewportWidth: viewportWidth, onBack: handleBack, onForward: handleForward, onReload: handleReload, onOpenDevTools: handleOpenDevTools, onViewportChange: setViewportWidth }), _jsx("main", { className: styles.body, children: status.kind === 'ready' ? (_jsx("div", { className: styles.viewportFrame, style: { width: viewportCss(viewportWidth) }, children: _jsx("webview", { 
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ref: webviewRef, className: styles.webview, partition: `persist:scamp-preview-${encodeURIComponent(projectPath)}`, ...{ allowpopups: '' } }) })) : (_jsx(StatusView, { status: status, projectPath: projectPath })) })] }));
};
const StatusView = ({ status, projectPath, }) => {
    if (status.kind === 'idle') {
        return _jsx("div", { className: styles.placeholder, children: "Waiting for the dev server\u2026" });
    }
    if (status.kind === 'installing') {
        return (_jsxs("div", { className: styles.statusPanel, children: [_jsx(Spinner, {}), _jsx("h2", { children: "Installing dependencies\u2026" }), _jsx("p", { className: styles.statusHint, children: "First-time setup \u2014 this only happens once per project. Subsequent previews start instantly." }), _jsx(LogTail, { logs: status.logs })] }));
    }
    if (status.kind === 'starting') {
        return (_jsxs("div", { className: styles.statusPanel, children: [_jsx(Spinner, {}), _jsx("h2", { children: "Starting dev server\u2026" }), _jsxs("p", { className: styles.statusHint, children: ["Listening on port ", status.port, "."] }), _jsx(LogTail, { logs: status.logs })] }));
    }
    if (status.kind === 'crashed') {
        return (_jsxs("div", { className: styles.statusPanel, children: [_jsxs("h2", { className: styles.crashed, children: ["Dev server crashed (exit ", status.exitCode, ")"] }), _jsx(LogTail, { logs: status.logs }), _jsx("button", { type: "button", className: styles.restartBtn, onClick: () => void window.scampPreview.restart(projectPath), children: "Restart server" })] }));
    }
    // ready handled by caller — defensive fallback
    return null;
};
const Spinner = () => _jsx("div", { className: styles.spinner });
const LogTail = ({ logs }) => {
    const tail = logs.slice(-50);
    if (tail.length === 0)
        return _jsx("div", { className: styles.logsEmpty, children: "No output yet." });
    return _jsx("pre", { className: styles.logs, children: tail.join('\n') });
};
