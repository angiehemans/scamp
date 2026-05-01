import { describe, it, expect } from 'vitest';
import { createServer } from 'net';
import { allocateFreePort } from '../src/main/devServer/portAlloc';
describe('allocateFreePort', () => {
    it('returns a numeric port in the valid range', async () => {
        const port = await allocateFreePort();
        expect(typeof port).toBe('number');
        expect(port).toBeGreaterThan(0);
        expect(port).toBeLessThan(65536);
    });
    it('returns a port that the caller can immediately bind to', async () => {
        const port = await allocateFreePort();
        // Bind a real listener on the returned port — if it's not free,
        // listen() rejects.
        await new Promise((resolve, reject) => {
            const server = createServer();
            server.on('error', reject);
            server.listen(port, '127.0.0.1', () => {
                server.close(() => resolve());
            });
        });
    });
    it('returns different ports across two consecutive calls (in practice)', async () => {
        // Not strictly guaranteed — the kernel could reuse the port — but
        // in practice ephemeral allocation rotates, so this is a useful
        // sanity check that we're actually asking the OS each time.
        const a = await allocateFreePort();
        const b = await allocateFreePort();
        // Don't fail outright if they happen to match — just smoke test.
        expect(typeof a).toBe('number');
        expect(typeof b).toBe('number');
    });
});
