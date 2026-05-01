import { createServer } from 'net';
/**
 * Bind to an ephemeral local port to discover what's free, then
 * release. Caller spawns its process on the returned port. There's
 * a small race between release and re-bind; callers retry once if
 * spawn fails with EADDRINUSE.
 */
export const allocateFreePort = () => {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.on('error', (err) => {
            reject(err);
        });
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
                server.close();
                reject(new Error('Could not determine assigned port.'));
                return;
            }
            const port = address.port;
            server.close(() => resolve(port));
        });
    });
};
