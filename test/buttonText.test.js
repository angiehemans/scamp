import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
/**
 * `<button>` is dual-natured, exactly like `<a>` and `<li>`: a button
 * that holds only a text label parses as a TEXT element (so its label is
 * readable / editable on the canvas), while a button that holds element
 * children is auto-upgraded to a rectangle CONTAINER so those children
 * render. These tests lock that behaviour and its round-trip.
 */
const wrap = (inner) => `<div data-scamp-id="root" className={styles.root}>\n${inner}\n</div>`;
describe('parseCode — <button> text', () => {
    it('parses a plain <button> label as a text element with tag button', () => {
        const tsx = wrap(`<button data-scamp-id="cta1" className={styles.cta_cta1}>Sign up</button>`);
        const { elements } = parseCode(tsx, `.cta_cta1 {}`);
        const btn = elements['cta1'];
        expect(btn?.type).toBe('text');
        expect(btn?.tag).toBe('button');
        expect(btn?.text).toBe('Sign up');
        expect(btn?.inlineFragments).toEqual([]);
    });
    it('honours a text_ prefix on a button label', () => {
        const tsx = wrap(`<button data-scamp-id="cta1" className={styles.text_cta1}>Save</button>`);
        const { elements } = parseCode(tsx, `.text_cta1 {}`);
        expect(elements['cta1']?.type).toBe('text');
        expect(elements['cta1']?.text).toBe('Save');
    });
    it('upgrades a button with element children to a rectangle container', () => {
        const tsx = wrap(`<button data-scamp-id="cta1" className={styles.cta_cta1}>` +
            `<span data-scamp-id="ico1" className={styles.text_ico1}>★</span>` +
            `<span data-scamp-id="lbl1" className={styles.text_lbl1}>Go</span>` +
            `</button>`);
        const { elements } = parseCode(tsx, `.cta_cta1 {}`);
        const btn = elements['cta1'];
        expect(btn?.type).toBe('rectangle');
        expect(btn?.tag).toBe('button');
        expect(btn?.childIds).toEqual(['ico1', 'lbl1']);
        // A rectangle never renders `.text`, so it must not have captured one.
        expect(btn?.text ?? '').toBe('');
    });
    it('keeps a rect_-prefixed button as a container (explicit prefix wins)', () => {
        const tsx = wrap(`<button data-scamp-id="b1" className={styles.rect_b1}>Sign up</button>`);
        const { elements } = parseCode(tsx, `.rect_b1 {}`);
        const btn = elements['b1'];
        expect(btn?.type).toBe('rectangle');
        // The loose label is preserved as an inline "Raw" fragment.
        expect(btn?.inlineFragments).toEqual([
            { kind: 'text', value: 'Sign up', afterChildIndex: -1 },
        ]);
    });
});
describe('generateCode — <button> text', () => {
    it('emits a text button as <button …>label</button>', () => {
        const tsx = wrap(`<button data-scamp-id="cta1" className={styles.text_cta1}>Sign up</button>`);
        const parsed = parseCode(tsx, `.text_cta1 {}`);
        const { tsx: out } = generateCode({
            elements: parsed.elements,
            rootId: parsed.rootId,
            pageName: 'home',
        });
        expect(out).toContain('<button');
        expect(out).toContain('>Sign up</button>');
    });
    it('round-trips a text button back to a text button (generate → parse)', () => {
        const tsx = wrap(`<button data-scamp-id="cta1" className={styles.text_cta1}>Sign up</button>`);
        const first = parseCode(tsx, `.text_cta1 {}`);
        const regen = generateCode({
            elements: first.elements,
            rootId: first.rootId,
            pageName: 'home',
        });
        const second = parseCode(regen.tsx, regen.css);
        const btn = Object.values(second.elements).find((e) => e.tag === 'button');
        expect(btn?.type).toBe('text');
        expect(btn?.text).toBe('Sign up');
    });
});
