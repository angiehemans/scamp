import { authBaseUrl, buildSignInUrl, challengeFor, generateState, generateVerifier, LOOPBACK_REDIRECT_URI, readCallback, } from './desktopAuthFlow';
import { startLoopbackServer } from './loopbackServer';
import { exchangeCodeForToken } from './tokenExchange';
import { clearToken, loadToken, saveToken } from './tokenStore';
/**
 * In-memory session. The token lives only here and, when the OS allows,
 * encrypted on disk — never in the renderer.
 */
let currentToken = null;
let currentUser = null;
/** Set for the duration of one sign-in, so a stray callback has nothing to match. */
let pendingState = null;
let inFlight = null;
/** Test seam: reset module state between cases. */
export const __resetAuthState = () => {
    currentToken = null;
    currentUser = null;
    pendingState = null;
    inFlight = null;
};
export const signIn = async (deps) => {
    if (pendingState !== null) {
        // A second click while the browser is already open. Reusing the first
        // attempt is better than racing two listeners for one port.
        return { status: 'failed', message: 'Sign-in is already in progress.' };
    }
    const server = await startLoopbackServer(deps.loopbackPort === undefined ? {} : { port: deps.loopbackPort });
    if (server.status === 'port-unavailable') {
        // The redirect allowlist is exact-match, so another port is not an
        // option. The scamp:// fallback is not built yet; say so plainly
        // rather than failing obscurely.
        return {
            status: 'failed',
            message: 'Port 8976 is in use, so Scamp cannot receive the sign-in response. Close whatever is using it and try again.',
        };
    }
    if (server.status === 'failed') {
        return { status: 'failed', message: server.message };
    }
    const verifier = generateVerifier();
    const state = generateState();
    pendingState = state;
    inFlight = server;
    try {
        await deps.openExternal(buildSignInUrl({
            baseUrl: authBaseUrl(deps.env, deps.isPackaged ?? true),
            redirectUri: LOOPBACK_REDIRECT_URI,
            state,
            challenge: challengeFor(verifier),
        }));
        const arrived = await server.waitForCallback();
        if (arrived.status === 'timeout')
            return { status: 'timeout' };
        if (arrived.status === 'cancelled')
            return { status: 'cancelled' };
        const callback = readCallback(arrived.url, pendingState);
        if (!callback.ok) {
            return { status: 'failed', message: describeCallbackFailure(callback.reason) };
        }
        const exchanged = await exchangeCodeForToken({
            baseUrl: authBaseUrl(deps.env, deps.isPackaged ?? true),
            code: callback.code,
            codeVerifier: verifier,
            fetchImpl: deps.fetchImpl,
        });
        if (exchanged.status !== 'ok') {
            return { status: 'failed', message: describeExchangeFailure(exchanged) };
        }
        currentToken = exchanged.token;
        currentUser = exchanged.user;
        const saved = await saveToken(exchanged.token, {
            safeStorage: deps.safeStorage,
            userDataDir: deps.userDataDir,
        });
        return {
            status: 'signed-in',
            user: exchanged.user,
            // False when the OS could not encrypt: signed in for this session
            // only, and the UI has to say so rather than silently forgetting.
            persisted: saved.status === 'saved',
        };
    }
    finally {
        // Single-use whatever happened: a callback arriving after this point
        // has no state to match and is refused.
        pendingState = null;
        inFlight = null;
        await server.close();
    }
};
/** Abandon a sign-in in progress — the user closed the dialog or gave up. */
export const cancelSignIn = async () => {
    const server = inFlight;
    pendingState = null;
    inFlight = null;
    if (server?.status === 'listening')
        await server.close();
};
/**
 * Current status, reading the stored token on first call.
 *
 * Deliberately does NOT validate against the server: a signed-out app
 * must cost nothing, and a network round-trip on launch would break that.
 * The first real API call is where an expired token surfaces, as a 401.
 */
export const getStatus = async (deps) => {
    if (currentToken !== null && currentUser !== null) {
        return { signedIn: true, user: currentUser };
    }
    const loaded = await loadToken({
        safeStorage: deps.safeStorage,
        userDataDir: deps.userDataDir,
    });
    if (loaded.status !== 'ok')
        return { signedIn: false };
    currentToken = loaded.token;
    // The user object is not persisted alongside the token — it is display
    // data that can go stale, and the next authenticated call returns it
    // fresh. Signed in, identity to be filled in.
    return { signedIn: true };
};
export const signOut = async (deps) => {
    currentToken = null;
    currentUser = null;
    await clearToken({ userDataDir: deps.userDataDir });
};
/** The bearer token for an authenticated request. Main process only. */
export const currentAuthToken = () => currentToken;
const describeCallbackFailure = (reason) => {
    switch (reason) {
        case 'state-mismatch':
        case 'unexpected':
            // Both mean "this did not come from the sign-in we started".
            return 'That sign-in response did not match this request. Try signing in again.';
        case 'provider-error':
            return 'Sign-in was cancelled or refused.';
        default:
            return 'The sign-in response was not understood. Try again.';
    }
};
const describeExchangeFailure = (result) => {
    if (result.status === 'rejected')
        return result.message;
    if (result.status === 'unreachable') {
        return 'Could not reach Scamp. Check your connection and try again.';
    }
    return 'Scamp returned an unexpected response. Try again.';
};
