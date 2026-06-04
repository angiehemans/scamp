/**
 * The `@/` import alias used in Scamp-generated pages/components
 * (`@/components/Namecard/Namecard`) is resolved by Next.js via
 * `compilerOptions.paths` in the project's `tsconfig.json`. Scamp
 * scaffolds that file; this module owns its content and the heal
 * logic that repairs older projects (including the bare tsconfig
 * `next dev` auto-creates, which lacks the alias).
 * See docs/notes/tsconfig-alias.md.
 */
const DEFAULT_TSCONFIG = {
    compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        baseUrl: '.',
        paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
};
/** Full default `tsconfig.json` for a Scamp Next.js project. */
export const DEFAULT_TSCONFIG_JSON = `${JSON.stringify(DEFAULT_TSCONFIG, null, 2)}\n`;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
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
export const ensureTsconfigAlias = (current) => {
    if (current === null || current.trim() === '')
        return DEFAULT_TSCONFIG_JSON;
    let parsed;
    try {
        parsed = JSON.parse(current);
    }
    catch {
        return null;
    }
    if (!isRecord(parsed))
        return null;
    const compilerOptions = isRecord(parsed['compilerOptions'])
        ? parsed['compilerOptions']
        : {};
    const paths = isRecord(compilerOptions['paths']) ? compilerOptions['paths'] : {};
    // Already mapped — don't touch it.
    if (paths['@/*'] !== undefined)
        return null;
    paths['@/*'] = ['./*'];
    if (compilerOptions['baseUrl'] === undefined)
        compilerOptions['baseUrl'] = '.';
    compilerOptions['paths'] = paths;
    parsed['compilerOptions'] = compilerOptions;
    return `${JSON.stringify(parsed, null, 2)}\n`;
};
