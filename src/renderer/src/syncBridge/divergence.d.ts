import type { SaveContext } from './saveContext';
/**
 * Apply the pending diverged attempt to disk, force-overwriting whatever
 * the external editor wrote. Re-generates from current state so the save
 * reflects every edit the user has made since the window expired.
 */
export declare const makeSaveDivergedCanvas: (ctx: SaveContext) => () => void;
/**
 * Abandon canvas state and reload from disk. Uses the renderer-side
 * `pageSource` (kept current by the chokidar handler) as the disk content
 * to re-parse — the same "external edit won" outcome as a write conflict.
 */
export declare const makeDiscardDivergedCanvas: (ctx: SaveContext) => () => void;
