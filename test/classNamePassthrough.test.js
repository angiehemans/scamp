import { describe, expect, it } from 'vitest';
import { normalizeRootClassNamePassthrough, rootClassNameAttribute, } from '@lib/classNamePassthrough';
describe('rootClassNameAttribute', () => {
    it('joins the element class with the forwarded prop in a template literal', () => {
        expect(rootClassNameAttribute('root')).toBe("className={`${styles.root} ${className ?? ''}`}");
    });
    it('uses whatever class name it is given, not a hardcoded root', () => {
        expect(rootClassNameAttribute('hero-card_a1b2')).toContain('styles.hero-card_a1b2');
    });
});
describe('normalizeRootClassNamePassthrough', () => {
    it('collapses the emitted attribute back to the plain styles reference', () => {
        const tsx = `<div data-scamp-id="root" ${rootClassNameAttribute('root')} />`;
        expect(normalizeRootClassNamePassthrough(tsx)).toBe('<div data-scamp-id="root" className={styles.root} />');
    });
    it('leaves a plain className={styles.x} untouched', () => {
        const tsx = '<div data-scamp-id="root" className={styles.root} />';
        expect(normalizeRootClassNamePassthrough(tsx)).toBe(tsx);
    });
    it('leaves a page with no passthrough completely unchanged', () => {
        const tsx = `import styles from './page.module.css';

export default function Profile() {
  return <div data-scamp-id="root" className={styles.root} />;
}
`;
        expect(normalizeRootClassNamePassthrough(tsx)).toBe(tsx);
    });
    it('normalizes every occurrence, not just the first', () => {
        const tsx = `${rootClassNameAttribute('a_1')} and ${rootClassNameAttribute('b_2')}`;
        expect(normalizeRootClassNamePassthrough(tsx)).toBe('className={styles.a_1} and className={styles.b_2}');
    });
    it('accepts double-quoted empty-string fallbacks written by hand', () => {
        const tsx = 'className={`${styles.root} ${className ?? ""}`}';
        expect(normalizeRootClassNamePassthrough(tsx)).toBe('className={styles.root}');
    });
    it('tolerates extra whitespace around the nullish coalescing', () => {
        const tsx = "className={`${styles.root} ${ className ?? '' }`}";
        expect(normalizeRootClassNamePassthrough(tsx)).toBe('className={styles.root}');
    });
    it('leaves an unrelated template-literal className alone', () => {
        const tsx = 'className={`${styles.root} ${isActive ? styles.on : \'\'}`}';
        expect(normalizeRootClassNamePassthrough(tsx)).toBe(tsx);
    });
    it('returns an empty string unchanged', () => {
        expect(normalizeRootClassNamePassthrough('')).toBe('');
    });
});
