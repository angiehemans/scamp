import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, basename, join } from 'path';
/**
 * Atomic write: write to a sibling .tmp file then rename. Prevents readers
 * (chokidar / external editors) from seeing a half-written file.
 *
 * Each write uses a unique tmp filename so concurrent writes to the same
 * target don't collide (one rename consuming the other's tmp → ENOENT).
 *
 * Pure with respect to app state (no watcher / active-project coupling) so
 * it can be unit-tested against a temp dir; the handler owns the
 * containment checks and pending-write bookkeeping around it.
 */
export const atomicWrite = async (path, content) => {
    const suffix = randomBytes(4).toString('hex');
    const tmp = join(dirname(path), `.${basename(path)}.${suffix}.tmp`);
    await fs.writeFile(tmp, content, 'utf-8');
    await fs.rename(tmp, path);
};
