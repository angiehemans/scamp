import { describe, it, expect, afterEach } from 'vitest';
import { startLoopbackServer } from '../src/main/auth/loopbackServer';
import { exchangeCodeForToken, } from '../src/main/auth/tokenExchange';
import { readCallback } from '../src/main/auth/desktopAuthFlow';
/**
 * The loopback listener is exercised against a real socket — it is thirty
 * lines of protocol handling where the failure modes (port taken, nothing
 * arrives, a stray request) matter more than the happy path, and a mock
 * would test the mock.
 *
 * A high port is used so the tests never collide with a real sign-in on
 * 8976, or with each other.
 */
/**
 * A fresh port per listener. Reusing one across tests was intermittently
 * flaky: `close` resolves before the OS has always released the socket,
 * so the next `listen` could hit EADDRINUSE and report port-unavailable —
 * a different test failing on each run.
 */
let nextPort = 45300;
const takePort = () => nextPort++;
let cleanup = [];
afterEach(async () => {
    await Promise.all(cleanup.map((c) => c()));
    cleanup = [];
});
const start = async (port = takePort(), timeoutMs) => {
    const result = await startLoopbackServer(timeoutMs === undefined ? { port } : { port, timeoutMs });
    if (result.status === 'listening')
        cleanup.push(result.close);
    return result;
};
describe('the loopback listener', () => {
    it('hands back the callback URL the browser hit', async () => {
        const port = takePort();
        const server = await start(port);
        if (server.status !== 'listening')
            throw new Error(server.status);
        const waiting = server.waitForCallback();
        await fetch(`http://127.0.0.1:${port}/callback?code=abc&state=xyz`);
        expect(await waiting).toEqual({
            status: 'callback',
            url: `http://localhost:${port}/callback?code=abc&state=xyz`,
        });
    });
    it('produces a URL that readCallback can parse', async () => {
        // The two halves have to agree about the shape, so check them together
        // rather than trusting a hand-written string.
        const port = takePort();
        const server = await start(port);
        if (server.status !== 'listening')
            throw new Error(server.status);
        const waiting = server.waitForCallback();
        await fetch(`http://127.0.0.1:${port}/callback?code=the-code&state=the-state`);
        const result = await waiting;
        if (result.status !== 'callback')
            throw new Error('no callback');
        expect(readCallback(result.url, 'the-state')).toEqual({
            ok: true,
            code: 'the-code',
        });
    });
    it('answers the browser so the tab does not hang', async () => {
        const port = takePort();
        const server = await start(port);
        if (server.status !== 'listening')
            throw new Error(server.status);
        const waiting = server.waitForCallback();
        const response = await fetch(`http://127.0.0.1:${port}/callback?code=a&state=b`);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('close this tab');
        await waiting;
    });
    it('ignores requests to any other path', async () => {
        const port = takePort();
        const server = await start(port);
        if (server.status !== 'listening')
            throw new Error(server.status);
        const waiting = server.waitForCallback();
        const stray = await fetch(`http://127.0.0.1:${port}/favicon.ico`);
        expect(stray.status).toBe(404);
        // Still waiting — a stray request must not resolve the sign-in.
        await server.close();
        expect(await waiting).toEqual({ status: 'cancelled' });
    });
    it('reports the port being unavailable, so the caller can fall back', async () => {
        // The allowlist is exact-match, so we cannot pick another port — this
        // is the signal to use the scamp:// scheme instead.
        const port = takePort();
        const first = await start(port);
        if (first.status !== 'listening')
            throw new Error(first.status);
        expect(await startLoopbackServer({ port })).toEqual({
            status: 'port-unavailable',
        });
    });
    it('times out when the browser never comes back', async () => {
        const server = await start(takePort(), 60);
        if (server.status !== 'listening')
            throw new Error(server.status);
        expect(await server.waitForCallback()).toEqual({ status: 'timeout' });
    });
    it('reports cancellation when closed while waiting', async () => {
        const server = await start(takePort());
        if (server.status !== 'listening')
            throw new Error(server.status);
        const waiting = server.waitForCallback();
        await server.close();
        expect(await waiting).toEqual({ status: 'cancelled' });
    });
    it('keeps the first callback when two arrive', async () => {
        const port = takePort();
        const server = await start(port);
        if (server.status !== 'listening')
            throw new Error(server.status);
        const waiting = server.waitForCallback();
        await fetch(`http://127.0.0.1:${port}/callback?code=first&state=s`);
        await fetch(`http://127.0.0.1:${port}/callback?code=second&state=s`);
        const result = await waiting;
        if (result.status !== 'callback')
            throw new Error('no callback');
        expect(result.url).toContain('code=first');
    });
});
describe('exchanging the code for a token', () => {
    const ok = (body) => async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
    });
    const args = {
        baseUrl: 'http://localhost:3000',
        code: 'the-code',
        codeVerifier: 'the-verifier',
    };
    const user = {
        id: 'u1',
        name: 'Angie',
        email: 'a@example.com',
        emailVerified: true,
    };
    it('returns the token and the user', async () => {
        expect(await exchangeCodeForToken({ ...args, fetchImpl: ok({ token: 't', user }) })).toEqual({ status: 'ok', token: 't', user });
    });
    it('posts the code and verifier to the right endpoint', async () => {
        const calls = [];
        const fetchImpl = async (url, init) => {
            calls.push({ url, body: init.body, headers: init.headers });
            return { ok: true, status: 200, text: async () => JSON.stringify({ token: 't', user }) };
        };
        await exchangeCodeForToken({ ...args, fetchImpl });
        expect(calls[0]?.url).toBe('http://localhost:3000/api/desktop/token');
        expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
            code: 'the-code',
            codeVerifier: 'the-verifier',
        });
    });
    it('sends an origin header, which the backend requires', async () => {
        // Node's fetch sends no Origin, unlike a browser, and Better Auth
        // checks it — the backend's own reference client sets it explicitly.
        // Found by reading that client rather than by a failing request.
        const calls = [];
        const fetchImpl = async (_url, init) => {
            calls.push(init.headers);
            return { ok: true, status: 200, text: async () => JSON.stringify({ token: 't', user }) };
        };
        await exchangeCodeForToken({ ...args, fetchImpl });
        expect(calls[0]?.['origin']).toBe('http://localhost:3000');
    });
    it('reports a rejection with the backend wording', async () => {
        // Expected, not alarming: the code is single-use and short-lived.
        const fetchImpl = async () => ({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ message: 'code already used' }),
        });
        expect(await exchangeCodeForToken({ ...args, fetchImpl })).toEqual({
            status: 'rejected',
            message: 'code already used',
        });
    });
    it('falls back to a status-based message when there is no wording', async () => {
        const fetchImpl = async () => ({
            ok: false,
            status: 400,
            text: async () => 'not json',
        });
        const result = await exchangeCodeForToken({ ...args, fetchImpl });
        expect(result.status).toBe('rejected');
    });
    it('reports unreachable when the request throws', async () => {
        const fetchImpl = async () => {
            throw new Error('ECONNREFUSED');
        };
        expect(await exchangeCodeForToken({ ...args, fetchImpl })).toEqual({
            status: 'unreachable',
            message: 'ECONNREFUSED',
        });
    });
    it('rejects a 200 that is not JSON', async () => {
        const fetchImpl = async () => ({
            ok: true,
            status: 200,
            text: async () => '<html>gateway</html>',
        });
        expect(await exchangeCodeForToken({ ...args, fetchImpl })).toEqual({
            status: 'malformed',
        });
    });
    it('rejects a response with no token', async () => {
        expect(await exchangeCodeForToken({ ...args, fetchImpl: ok({ user }) })).toEqual({ status: 'malformed' });
    });
    it('rejects a response with no usable user', async () => {
        expect(await exchangeCodeForToken({ ...args, fetchImpl: ok({ token: 't', user: {} }) })).toEqual({ status: 'malformed' });
    });
    it('tolerates a user with no name', async () => {
        const result = await exchangeCodeForToken({
            ...args,
            fetchImpl: ok({ token: 't', user: { ...user, name: undefined } }),
        });
        expect(result).toEqual({
            status: 'ok',
            token: 't',
            user: { ...user, name: '' },
        });
    });
    it('treats a missing emailVerified as not verified', async () => {
        const result = await exchangeCodeForToken({
            ...args,
            fetchImpl: ok({ token: 't', user: { id: 'u1', email: 'a@e.com' } }),
        });
        expect(result).toEqual({
            status: 'ok',
            token: 't',
            user: { id: 'u1', name: '', email: 'a@e.com', emailVerified: false },
        });
    });
});
