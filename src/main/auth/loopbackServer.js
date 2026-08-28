import { createServer } from 'http';
import { LOOPBACK_PORT } from './desktopAuthFlow';
/** What the browser tab shows once the code has been handed over. */
const DONE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Signed in</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center;
         min-height: 100vh; margin: 0; background: #101014; color: #e8e8ea; }
  p { font-size: 15px; }
</style></head>
<body><p>Signed in. You can close this tab and return to Scamp.</p></body></html>
`;
const NOT_FOUND_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Not found</title></head>
<body></body></html>
`;
// `connection: close` is load-bearing — this listener serves one request
// and shuts down. see docs/notes/loopback-close-hang.md
const HTML_HEADERS = {
    'content-type': 'text/html; charset=utf-8',
    connection: 'close',
};
/** Fifteen minutes: long enough to sign up, create a password, get a 2FA code. */
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
/**
 * Bind the loopback listener.
 *
 * Started BEFORE the browser is opened, so a fast redirect cannot arrive
 * at a socket that isn't listening yet.
 */
export const startLoopbackServer = async ({ port = LOOPBACK_PORT, timeoutMs = DEFAULT_TIMEOUT_MS, } = {}) => {
    // The outcome is recorded whether or not anyone is waiting yet. A fast
    // redirect can land before `waitForCallback` has been called — the test
    // browser does it every time, and a real one on localhost easily could —
    // and dropping the result there would hang the sign-in forever.
    let resolveResult = null;
    let settledResult = null;
    const settle = (result) => {
        if (settledResult !== null)
            return;
        settledResult = result;
        resolveResult?.(result);
    };
    const server = createServer((req, res) => {
        const path = (req.url ?? '').split('?')[0];
        if (path !== '/callback') {
            res.writeHead(404, HTML_HEADERS);
            res.end(NOT_FOUND_PAGE);
            return;
        }
        // Answer the browser first so the tab settles, then hand the URL on —
        // but only once the response has flushed, because the sign-in that
        // follows ends by destroying this very connection.
        // see docs/notes/loopback-close-hang.md
        res.writeHead(200, HTML_HEADERS);
        res.end(DONE_PAGE, () => {
            // Absolute URL so `readCallback` can parse it with `new URL`.
            settle({ status: 'callback', url: `http://localhost:${port}${req.url ?? ''}` });
        });
    });
    const listening = await new Promise((resolve) => {
        const onError = (err) => {
            server.removeListener('listening', onListening);
            resolve(err.code === 'EADDRINUSE'
                ? { status: 'port-unavailable' }
                : { status: 'failed', message: err.message });
        };
        const onListening = () => {
            server.removeListener('error', onError);
            resolve(null);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        // Loopback only — never expose this to the network.
        server.listen(port, '127.0.0.1');
    });
    if (listening !== null)
        return listening;
    // closeAllConnections first, or this never returns: a browser leaves a
    // preconnected socket that `server.close` waits on forever.
    // see docs/notes/loopback-close-hang.md
    const close = async () => {
        settle({ status: 'cancelled' });
        server.closeAllConnections();
        await new Promise((resolve) => server.close(() => resolve()));
    };
    const waitForCallback = () => new Promise((resolve) => {
        if (settledResult !== null) {
            resolve(settledResult);
            return;
        }
        resolveResult = resolve;
        const timer = setTimeout(() => settle({ status: 'timeout' }), timeoutMs);
        // Don't hold the process open on this timer.
        timer.unref?.();
    });
    return { status: 'listening', waitForCallback, close };
};
