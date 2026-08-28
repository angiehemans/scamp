import { promises as fs } from 'fs';
import path from 'path';
const FILE_NAME = 'auth-token.bin';
const tokenPath = (dir) => path.join(dir, FILE_NAME);
/**
 * Persist the token, or refuse to.
 *
 * Refusing is a success path, not an error: sign-in still worked, it just
 * will not survive a restart. Writing the token in the clear instead would
 * turn a minor inconvenience into a credential sitting readable on disk.
 */
export const saveToken = async (token, { safeStorage, userDataDir }) => {
    if (!safeStorage.isEncryptionAvailable())
        return { status: 'memory-only' };
    const encrypted = safeStorage.encryptString(token);
    await fs.mkdir(userDataDir, { recursive: true });
    await fs.writeFile(tokenPath(userDataDir), encrypted);
    return { status: 'saved' };
};
/**
 * Read a stored token.
 *
 * `unreadable` is its own outcome rather than an error because it has a
 * mundane cause: the OS keychain identity changed — a re-signed or
 * differently-signed build — so the blob is intact and undecryptable. The
 * caller should clear it and ask the user to sign in again.
 */
export const loadToken = async ({ safeStorage, userDataDir, }) => {
    if (!safeStorage.isEncryptionAvailable())
        return { status: 'unavailable' };
    let blob;
    try {
        blob = await fs.readFile(tokenPath(userDataDir));
    }
    catch {
        return { status: 'none' };
    }
    try {
        const token = safeStorage.decryptString(blob);
        if (token.length === 0)
            return { status: 'unreadable' };
        return { status: 'ok', token };
    }
    catch {
        return { status: 'unreadable' };
    }
};
/** Remove the stored token. Safe to call when there isn't one. */
export const clearToken = async ({ userDataDir, }) => {
    await fs.rm(tokenPath(userDataDir), { force: true });
};
