/**
 * The `@/` import alias used in Scamp-generated pages/components
 * (`@/components/Namecard/Namecard`) is resolved by Next.js via
 * `compilerOptions.paths` in the project's `tsconfig.json`. Scamp
 * scaffolds that file; this module owns its content and the heal
 * logic that repairs older projects (including the bare tsconfig
 * `next dev` auto-creates, which lacks the alias).
 * See docs/notes/tsconfig-alias.md.
 */
/** Full default `tsconfig.json` for a Scamp Next.js project. */
export declare const DEFAULT_TSCONFIG_JSON: string;
/**
 * Given the current `tsconfig.json` contents (or `null` when the file
 * is absent), return the contents to write so the `@/*` alias
 * resolves — or `null` when no change is needed or it can't be made
 * safely.
 *
 * - Missing/empty file → the full default template.
 * - Valid JSON without an `@/*` path → inject `baseUrl` + the alias,
 *   preserving every other field.
 * - Already has an `@/*` path → left alone (assume intentional, never
 *   clobber a user's mapping).
 * - Unparseable (e.g. JSONC with comments) → `null`; we don't risk a
 *   lossy rewrite. Caller logs so the user can add the alias by hand.
 */
export declare const ensureTsconfigAlias: (current: string | null) => string | null;
