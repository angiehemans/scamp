import { describe, it, expect } from 'vitest';
import { DEFAULT_RADIUS_TOKENS, DEFAULT_SPACING_TOKENS, TOKEN_ROLES, defaultTokensForRole, isDesignRoleToken, isRoleToken, prioritizeByPrefix, roleTokenLabel, roleTokenName, tokensForRole, } from '@lib/tokenRoles';
const tokens = (map) => Object.entries(map).map(([name, value]) => ({ name, value }));
describe('isRoleToken / isDesignRoleToken', () => {
    it('routes each role by its name prefix', () => {
        expect(isRoleToken('spacing', '--space-4')).toBe(true);
        expect(isRoleToken('radius', '--radius-md')).toBe(true);
        expect(isRoleToken('border', '--border-thin')).toBe(true);
        expect(isRoleToken('shadow', '--shadow-lg')).toBe(true);
    });
    it('does not confuse a semantic --color-border with a border-width token', () => {
        expect(isRoleToken('border', '--color-border')).toBe(false);
        expect(isDesignRoleToken('--color-border')).toBe(false);
    });
    it('excludes typography and color tokens from the design roles', () => {
        expect(isDesignRoleToken('--text-base')).toBe(false);
        expect(isDesignRoleToken('--font-sans')).toBe(false);
        expect(isDesignRoleToken('--color-primary')).toBe(false);
        expect(isDesignRoleToken('--space-2')).toBe(true);
    });
});
describe('roleTokenLabel / roleTokenName', () => {
    it('extracts the step label after the prefix', () => {
        expect(roleTokenLabel('spacing', '--space-4')).toBe('4');
        expect(roleTokenLabel('radius', '--radius-2xl')).toBe('2xl');
        expect(roleTokenLabel('border', '--border-thin')).toBe('thin');
    });
    it('builds a token name from a role + label', () => {
        expect(roleTokenName('spacing', '5')).toBe('--space-5');
        expect(roleTokenName('shadow', 'xl')).toBe('--shadow-xl');
    });
});
describe('tokensForRole', () => {
    it('filters and labels the tokens belonging to a role', () => {
        const all = tokens({
            '--space-2': '8px',
            '--space-4': '16px',
            '--radius-md': '8px',
            '--color-primary': '#000',
            '--text-base': '1rem',
        });
        expect(tokensForRole('spacing', all)).toEqual([
            { name: '--space-2', label: '2', value: '8px' },
            { name: '--space-4', label: '4', value: '16px' },
        ]);
        expect(tokensForRole('radius', all)).toEqual([
            { name: '--radius-md', label: 'md', value: '8px' },
        ]);
    });
});
describe('prioritizeByPrefix', () => {
    it('floats matching-prefix tokens to the top, preserving relative order', () => {
        const all = tokens({
            '--space-4': '16px',
            '--radius-sm': '4px',
            '--border-thin': '1px',
            '--radius-md': '8px',
        });
        expect(prioritizeByPrefix(all, '--radius-').map((t) => t.name)).toEqual([
            '--radius-sm',
            '--radius-md',
            '--space-4',
            '--border-thin',
        ]);
    });
    it('returns the same order when nothing matches', () => {
        const all = tokens({ '--space-2': '8px', '--space-4': '16px' });
        expect(prioritizeByPrefix(all, '--radius-').map((t) => t.name)).toEqual([
            '--space-2',
            '--space-4',
        ]);
    });
});
describe('defaults', () => {
    it('provides a default set for every role', () => {
        for (const role of TOKEN_ROLES) {
            expect(defaultTokensForRole(role).length).toBeGreaterThan(0);
        }
    });
    it('matches the PRD spacing + radius scales', () => {
        expect(DEFAULT_SPACING_TOKENS).toContainEqual({
            name: '--space-4',
            value: '16px',
        });
        expect(DEFAULT_RADIUS_TOKENS).toContainEqual({
            name: '--radius-full',
            value: '9999px',
        });
    });
});
