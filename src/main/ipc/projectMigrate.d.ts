/**
 * Rewrite asset references from the legacy `./assets/...` form to the
 * Next.js absolute server-root form `/assets/...`. Limited to the two
 * contexts where asset paths actually live so we don't accidentally
 * mangle a string literal that happens to contain `./assets/`:
 *
 *   - CSS `url(...)` declarations
 *   - JSX `src="..."` / `srcSet="..."` attribute values
 */
export declare const rewriteAssetReferences: (text: string) => string;
export type MigrateResult = {
    backupPath: string;
    unmovedFiles: string[];
};
/**
 * Atomic-ish legacy → nextjs migration.
 *
 * Strategy:
 *   1. Read all legacy pages into memory.
 *   2. Stage the nextjs tree in a sibling `.scamp-stage-<id>/` dir.
 *      Any failure here is recoverable: we delete the stage and the
 *      original project is untouched.
 *   3. Move all known legacy artefacts into a sibling
 *      `.scamp-backup-<timestamp>/` dir. We keep this around so the
 *      user has a recovery path.
 *   4. Move the stage's contents into the project root.
 *
 * Step 4 is the only window where the project is in a partial state
 * on disk. Each individual `fs.rename` is atomic on a single
 * filesystem; the multi-step swap isn't, but the backup directory is
 * the recovery path. We surface its location to the user.
 */
export declare const migrateLegacyToNextjs: (projectPath: string) => Promise<MigrateResult>;
