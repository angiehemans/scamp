export type PatchMediaScope = {
    /** Max-width in pixels. Targets the `@media (max-width: Npx)` block. */
    maxWidth: number;
};
/**
 * Replace just one class block in a CSS module file.
 *
 * Used by `file:patch` from the renderer's properties panel: the user
 * commits a new declaration body for one class, and the rest of the
 * file (other classes, comments, blank lines) must stay byte-identical
 * wherever postcss can preserve it.
 *
 * If the class doesn't exist yet, append a new block at the end. This
 * lets the renderer "create" a class via the same patch path it uses
 * to update one.
 *
 * When `media` is provided, the patch targets a class rule INSIDE the
 * matching `@media (max-width: Npx)` block rather than the base
 * class. The at-rule and the class rule inside it are both created
 * if missing. This is how the properties panel writes
 * breakpoint-specific declarations.
 *
 * The function is pure — no IO, so it tests cleanly in isolation.
 */
export declare const patchClassBlock: (source: string, className: string, newDeclarations: string, media?: PatchMediaScope) => string;
