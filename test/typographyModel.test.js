import { describe, it, expect } from 'vitest';
import { buildTextStyles, defaultTextStyleTokens, isTextStyleToken, textStyleLabel, textStyleTokenName, DEFAULT_TEXT_STYLE_TEMPLATES, } from '@lib/typographyModel';
const tokens = (map) => Object.entries(map).map(([name, value]) => ({ name, value }));
describe('isTextStyleToken', () => {
    it('matches --text-<name>-<prop> tokens', () => {
        expect(isTextStyleToken('--text-h1-size')).toBe(true);
        expect(isTextStyleToken('--text-body-large-weight')).toBe(true);
    });
    it('does not match bare scale tokens or unrelated names', () => {
        expect(isTextStyleToken('--text-xs')).toBe(false);
        expect(isTextStyleToken('--text-2xl')).toBe(false);
        expect(isTextStyleToken('--font-sans')).toBe(false);
        expect(isTextStyleToken('--color-primary')).toBe(false);
    });
});
describe('textStyleLabel / textStyleTokenName', () => {
    it('title-cases single and multi-word slugs', () => {
        expect(textStyleLabel('h1')).toBe('H1');
        expect(textStyleLabel('body-large')).toBe('Body Large');
        expect(textStyleLabel('display')).toBe('Display');
    });
    it('builds a token name for a prop', () => {
        expect(textStyleTokenName('h1', 'size')).toBe('--text-h1-size');
        expect(textStyleTokenName('body-large', 'leading')).toBe('--text-body-large-leading');
    });
});
describe('buildTextStyles', () => {
    it('groups tokens into styles in first-seen order with per-prop values', () => {
        const styles = buildTextStyles(tokens({
            '--text-h1-family': 'var(--font-sans)',
            '--text-h1-size': '2.5rem',
            '--text-h1-weight': '700',
            '--text-h1-leading': '1.2',
            '--text-body-size': '1rem',
            '--text-body-weight': '400',
        }));
        expect(styles.map((s) => s.name)).toEqual(['h1', 'body']);
        expect(styles[0]).toEqual({
            name: 'h1',
            label: 'H1',
            family: 'var(--font-sans)',
            size: '2.5rem',
            weight: '700',
            leading: '1.2',
            tracking: null,
        });
        // A style that only defines some props leaves the rest null.
        expect(styles[1]?.leading).toBeNull();
        expect(styles[1]?.size).toBe('1rem');
    });
    it('ignores bare scale tokens and non-text tokens', () => {
        const styles = buildTextStyles(tokens({
            '--text-xs': '0.75rem',
            '--font-sans': 'system-ui',
            '--color-primary': '#000',
        }));
        expect(styles).toEqual([]);
    });
    it('handles a multi-word style slug', () => {
        const styles = buildTextStyles(tokens({ '--text-body-large-size': '1.125rem' }));
        expect(styles[0]?.name).toBe('body-large');
        expect(styles[0]?.label).toBe('Body Large');
        expect(styles[0]?.size).toBe('1.125rem');
    });
});
describe('defaultTextStyleTokens', () => {
    it('emits four tokens (family/size/weight/leading) per template', () => {
        const toks = defaultTextStyleTokens();
        expect(toks).toHaveLength(DEFAULT_TEXT_STYLE_TEMPLATES.length * 4);
    });
    it('round-trips into buildTextStyles with the PRD defaults', () => {
        const styles = buildTextStyles(defaultTextStyleTokens());
        expect(styles.map((s) => s.name)).toEqual(DEFAULT_TEXT_STYLE_TEMPLATES.map((t) => t.name));
        const h1 = styles.find((s) => s.name === 'h1');
        expect(h1).toEqual({
            name: 'h1',
            label: 'H1',
            family: 'var(--font-sans)',
            size: '2.5rem',
            weight: '700',
            leading: '1.2',
            tracking: null,
        });
        // Code style overrides the family to the mono stack.
        expect(styles.find((s) => s.name === 'code')?.family).toBe('var(--font-mono)');
    });
});
