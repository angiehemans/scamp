import { describe, it, expect } from 'vitest';
import { DEFAULT_TSCONFIG_JSON, ensureTsconfigAlias } from '@shared/tsconfigAlias';
describe('DEFAULT_TSCONFIG_JSON', () => {
    it('declares the @/* path alias mapping to the project root', () => {
        const parsed = JSON.parse(DEFAULT_TSCONFIG_JSON);
        expect(parsed.compilerOptions.baseUrl).toBe('.');
        expect(parsed.compilerOptions.paths['@/*']).toEqual(['./*']);
    });
    it('is valid JSON ending with a trailing newline', () => {
        expect(() => JSON.parse(DEFAULT_TSCONFIG_JSON)).not.toThrow();
        expect(DEFAULT_TSCONFIG_JSON.endsWith('}\n')).toBe(true);
    });
    it('registers the Next.js TypeScript plugin', () => {
        const parsed = JSON.parse(DEFAULT_TSCONFIG_JSON);
        expect(parsed.compilerOptions.plugins).toContainEqual({ name: 'next' });
    });
});
describe('ensureTsconfigAlias', () => {
    it('returns the full default template when the file is absent', () => {
        expect(ensureTsconfigAlias(null)).toBe(DEFAULT_TSCONFIG_JSON);
    });
    it('returns the full default template when the file is empty', () => {
        expect(ensureTsconfigAlias('')).toBe(DEFAULT_TSCONFIG_JSON);
        expect(ensureTsconfigAlias('   \n  ')).toBe(DEFAULT_TSCONFIG_JSON);
    });
    it('injects the alias into a bare tsconfig that next dev auto-created', () => {
        const bare = JSON.stringify({
            compilerOptions: {
                target: 'ES2017',
                strict: true,
                moduleResolution: 'bundler',
                plugins: [{ name: 'next' }],
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
            exclude: ['node_modules'],
        }, null, 2);
        const result = ensureTsconfigAlias(bare);
        expect(result).not.toBeNull();
        const parsed = JSON.parse(result);
        expect(parsed.compilerOptions.baseUrl).toBe('.');
        expect(parsed.compilerOptions.paths['@/*']).toEqual(['./*']);
        // Existing options are preserved untouched.
        expect(parsed.compilerOptions.strict).toBe(true);
        expect(parsed.compilerOptions.moduleResolution).toBe('bundler');
        expect(parsed.include).toEqual(['next-env.d.ts', '**/*.ts', '**/*.tsx']);
    });
    it('adds the alias into an existing non-empty paths map without dropping siblings', () => {
        const existing = JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '~/*': ['./src/*'] } } }, null, 2);
        const result = ensureTsconfigAlias(existing);
        expect(result).not.toBeNull();
        const parsed = JSON.parse(result);
        expect(parsed.compilerOptions.paths['@/*']).toEqual(['./*']);
        expect(parsed.compilerOptions.paths['~/*']).toEqual(['./src/*']);
    });
    it('preserves an existing baseUrl rather than overwriting it', () => {
        const existing = JSON.stringify({ compilerOptions: { baseUrl: './src' } }, null, 2);
        const parsed = JSON.parse(ensureTsconfigAlias(existing));
        expect(parsed.compilerOptions.baseUrl).toBe('./src');
        expect(parsed.compilerOptions.paths['@/*']).toEqual(['./*']);
    });
    it('returns null when the alias is already configured (no rewrite)', () => {
        expect(ensureTsconfigAlias(DEFAULT_TSCONFIG_JSON)).toBeNull();
    });
    it('never clobbers a user-defined @/* mapping pointing elsewhere', () => {
        const custom = JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }, null, 2);
        expect(ensureTsconfigAlias(custom)).toBeNull();
    });
    it('returns null for unparseable JSONC rather than risking a lossy rewrite', () => {
        const jsonc = '{\n  // next.js config\n  "compilerOptions": {}\n}';
        expect(ensureTsconfigAlias(jsonc)).toBeNull();
    });
    it('returns null when the root is valid JSON but not an object', () => {
        expect(ensureTsconfigAlias('[]')).toBeNull();
        expect(ensureTsconfigAlias('"hello"')).toBeNull();
        expect(ensureTsconfigAlias('42')).toBeNull();
    });
    it('treats a non-object compilerOptions as empty and writes a fresh one', () => {
        const result = ensureTsconfigAlias('{"compilerOptions": 5}');
        expect(result).not.toBeNull();
        const parsed = JSON.parse(result);
        expect(parsed.compilerOptions.paths['@/*']).toEqual(['./*']);
    });
});
