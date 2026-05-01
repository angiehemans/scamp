import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_BREAKPOINTS } from '@shared/types';
/**
 * Direct-from-the-Claude-run regression suite. Each scenario is a
 * verbatim slice of CSS that the agent wrote and expected to keep:
 * Scamp must read the file, regenerate it, and produce something
 * containing the original declaration unchanged.
 *
 * The shared tsx skeleton declares a single rect element so the
 * parser has somewhere to attach the css declarations.
 */
const TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2}></div>
    </div>
  );
}
`;
const roundTripCss = (rectCss) => {
    const css = `.root {
}

.rect_a1b2 {
${rectCss}
}
`;
    const parsed = parseCode(TSX, css, { breakpoints: DEFAULT_BREAKPOINTS });
    const code = generateCode({
        elements: parsed.elements,
        rootId: parsed.rootId,
        pageName: 'home',
        breakpoints: DEFAULT_BREAKPOINTS,
        customMediaBlocks: parsed.customMediaBlocks,
    });
    return code.css;
};
describe('agent-friendly: var()-based shorthands round-trip verbatim', () => {
    it('padding: var(--space-3)', () => {
        const out = roundTripCss('  padding: var(--space-3);');
        expect(out).toContain('padding: var(--space-3);');
    });
    it('padding: var(--space-3) var(--space-5)', () => {
        const out = roundTripCss('  padding: var(--space-3) var(--space-5);');
        expect(out).toContain('padding: var(--space-3) var(--space-5);');
    });
    it('margin: var(--space-2)', () => {
        const out = roundTripCss('  margin: var(--space-2);');
        expect(out).toContain('margin: var(--space-2);');
    });
    it('gap: var(--space-3)', () => {
        const out = roundTripCss('  gap: var(--space-3);');
        expect(out).toContain('gap: var(--space-3);');
    });
});
describe('agent-friendly: percent / non-px values round-trip verbatim', () => {
    it('border-radius: 50%', () => {
        const out = roundTripCss('  border-radius: 50%;');
        expect(out).toContain('border-radius: 50%;');
    });
    it('border-radius: 999px keeps typed-field path (still parses)', () => {
        const out = roundTripCss('  border-radius: 999px;');
        expect(out).toMatch(/border-radius:\s*999px/);
    });
});
describe('agent-friendly: position is a typed field', () => {
    it('position: fixed round-trips with the agent-written top/left', () => {
        const out = roundTripCss('  position: fixed;\n  top: 0;\n  left: 0;');
        expect(out).toContain('position: fixed;');
        // The agent wrote `top: 0;` (no `px`). After round-trip the
        // declaration is preserved via customProperties.
        expect(out).toMatch(/top:\s*0;?/);
    });
    it('position: sticky round-trips', () => {
        const out = roundTripCss('  position: sticky;\n  top: 0;');
        expect(out).toContain('position: sticky;');
    });
    it('position: relative round-trips and replaces Scamp\'s auto absolute', () => {
        const out = roundTripCss('  position: relative;');
        expect(out).toContain('position: relative;');
        // Specifically: the auto path (which would emit `position: absolute`)
        // is suppressed when the user has set their own position.
        const block = out.match(/\.rect_a1b2\s*\{[^}]*\}/s)?.[0] ?? '';
        expect(block).not.toContain('position: absolute');
    });
});
describe('agent-friendly: unknown enum values fall through to customProperties', () => {
    it('align-items: baseline survives', () => {
        const out = roundTripCss('  align-items: baseline;');
        expect(out).toContain('align-items: baseline;');
    });
    it('justify-content: space-evenly survives', () => {
        const out = roundTripCss('  display: flex;\n  justify-content: space-evenly;');
        expect(out).toContain('justify-content: space-evenly;');
    });
});
describe('agent-friendly: loose text + unclassed JSX preserved in source order', () => {
    const TSX_TEMPLATE = (innerSource) => `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="meta_m001" className={styles.meta_m001}>
${innerSource}
      </div>
    </div>
  );
}
`;
    const SIMPLE_CSS = `.root { width: 100%; }
.meta_m001 {
}
`;
    it('loose text BEFORE a Scamp child is preserved', () => {
        const inner = `        Role:
        <span data-scamp-id="role_r1" className={styles.role_r1}>Designer</span>`;
        const tsx = TSX_TEMPLATE(inner);
        const parsed = parseCode(tsx, SIMPLE_CSS, { breakpoints: DEFAULT_BREAKPOINTS });
        const meta = parsed.elements['m001'];
        // The loose "Role:" appears as a text fragment BEFORE the role span.
        expect(meta?.inlineFragments.some((f) => f.kind === 'text' && /Role:/.test(f.value))).toBe(true);
        expect(meta?.inlineFragments.some((f) => f.kind === 'text' && f.afterChildIndex === -1)).toBe(true);
        const code = generateCode({
            elements: parsed.elements,
            rootId: parsed.rootId,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: parsed.customMediaBlocks,
        });
        // Round-trip: regenerated TSX still has "Role:" text BEFORE the
        // role span (i.e. earlier in the file).
        const roleIdx = code.tsx.indexOf('role_r1');
        const textIdx = code.tsx.indexOf('Role:');
        expect(textIdx).toBeGreaterThan(-1);
        expect(textIdx).toBeLessThan(roleIdx);
    });
    it('unclassed JSX subtree is captured verbatim and re-emitted byte-equivalent', () => {
        const inner = `        <strong>Founder, Designer, Developer</strong>`;
        const tsx = TSX_TEMPLATE(inner);
        const parsed = parseCode(tsx, SIMPLE_CSS, { breakpoints: DEFAULT_BREAKPOINTS });
        const meta = parsed.elements['m001'];
        const jsxFrag = meta?.inlineFragments.find((f) => f.kind === 'jsx');
        expect(jsxFrag).toBeDefined();
        if (jsxFrag && jsxFrag.kind === 'jsx') {
            expect(jsxFrag.source).toContain('<strong>');
            expect(jsxFrag.source).toContain('Founder, Designer, Developer');
            expect(jsxFrag.source).toContain('</strong>');
        }
        const code = generateCode({
            elements: parsed.elements,
            rootId: parsed.rootId,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: parsed.customMediaBlocks,
        });
        expect(code.tsx).toContain('<strong>Founder, Designer, Developer</strong>');
    });
    it('text + classed span order is preserved (the user-reported regression)', () => {
        const inner = `        Role: <span data-scamp-id="role_r2" className={styles.role_r2}>Designer</span>`;
        const css = `.root {}
.meta_m001 { display: flex; }
.role_r2 {}
`;
        const tsx = TSX_TEMPLATE(inner);
        const parsed = parseCode(tsx, css, { breakpoints: DEFAULT_BREAKPOINTS });
        const code = generateCode({
            elements: parsed.elements,
            rootId: parsed.rootId,
            pageName: 'home',
            breakpoints: DEFAULT_BREAKPOINTS,
            customMediaBlocks: parsed.customMediaBlocks,
        });
        // The "Role:" text comes BEFORE the role span in the regenerated
        // file — not after, which was the bug.
        const roleSpanIdx = code.tsx.indexOf('data-scamp-id="role_r2"');
        const textIdx = code.tsx.indexOf('Role:');
        expect(textIdx).toBeGreaterThan(-1);
        expect(textIdx).toBeLessThan(roleSpanIdx);
    });
});
