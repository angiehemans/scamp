import { describe, it, expect } from 'vitest';
import { buildCanvasStylesheet, CANVAS_SCOPE_SELECTOR, isWidthOnlyQuery, mediaToContainer, stripStrippedAtRules, } from '@lib/canvasStylesheet';
/**
 * The canvas loads the page's own generated CSS so that rules with no
 * inline-style equivalent — `::before`, `:nth-child`, any hand-written
 * selector — render there as they do in the preview.
 *
 * see docs/plans/canvas-preview-parity-plan.md
 */
describe('stripStrippedAtRules', () => {
    it('removes a keyframes block', () => {
        // The canvas injects keyframes separately, and a non-style at-rule
        // inside `@scope` risks the browser dropping the whole scoped block.
        const out = stripStrippedAtRules('@keyframes fade { from { opacity: 0; } }');
        expect(out.trim()).toBe('');
    });
    it('keeps the rules around it', () => {
        const out = stripStrippedAtRules('.a { color: red; }\n@keyframes fade { from { opacity: 0; } }\n.b { color: blue; }');
        expect(out).toContain('.a { color: red; }');
        expect(out).toContain('.b { color: blue; }');
        expect(out).not.toContain('@keyframes');
    });
    it('removes a vendor-prefixed keyframes block', () => {
        expect(stripStrippedAtRules('@-webkit-keyframes fade { from { opacity: 0; } }').trim()).toBe('');
    });
    it('removes several blocks', () => {
        const out = stripStrippedAtRules('@keyframes a { to { opacity: 1; } }\n.x { color: red; }\n@keyframes b { to { opacity: 0; } }');
        expect(out).toContain('.x');
        expect(out).not.toContain('@keyframes');
    });
    it('leaves media queries alone — they are rewritten, not stripped', () => {
        const css = '@media (max-width: 700px) { .b { display: none; } }';
        expect(stripStrippedAtRules(css)).toBe(css);
    });
    it('handles css with no keyframes at all', () => {
        expect(stripStrippedAtRules('.a { color: red; }')).toBe('.a { color: red; }');
    });
    it('handles an empty stylesheet', () => {
        expect(stripStrippedAtRules('')).toBe('');
    });
});
describe('buildCanvasStylesheet', () => {
    it('scopes the rules to the canvas frame', () => {
        const out = buildCanvasStylesheet('.root { color: red; }');
        expect(out.startsWith(`@scope (${CANVAS_SCOPE_SELECTOR})`)).toBe(true);
        expect(out).toContain('.root { color: red; }');
        expect(out.trimEnd().endsWith('}')).toBe(true);
    });
    it('carries pseudo-element rules, which inline styles cannot express', () => {
        // The gap this exists to close.
        const out = buildCanvasStylesheet('.badge::before { content: "NEW"; }');
        expect(out).toContain('.badge::before');
        expect(out).toContain('content: "NEW";');
    });
    it('carries hand-written descendant selectors', () => {
        const out = buildCanvasStylesheet('.list > .item:nth-child(2) { color: red; }');
        expect(out).toContain('.list > .item:nth-child(2)');
    });
    it('rewrites a width media query to a container query', () => {
        // The frame declares `container-type: inline-size`, so the same
        // condition now resolves against the artboard instead of the app
        // window — which is what a breakpoint means to a designer.
        const out = buildCanvasStylesheet('.a { color: red; }\n@media (max-width: 700px) { .b { display: none; } }');
        expect(out).toContain('@container (max-width: 700px)');
        expect(out).toContain('.b { display: none; }');
        expect(out).not.toContain('@media');
    });
    it('drops keyframes, which the canvas injects separately', () => {
        const out = buildCanvasStylesheet('.a { color: red; }\n@keyframes fade { from { opacity: 0; } }');
        expect(out).toContain('.a');
        expect(out).not.toContain('@keyframes');
    });
    it('returns nothing for an empty stylesheet, so no <style> is mounted', () => {
        expect(buildCanvasStylesheet('')).toBe('');
        expect(buildCanvasStylesheet('   \n  ')).toBe('');
    });
    it('returns nothing when only keyframes remain after stripping', () => {
        expect(buildCanvasStylesheet('@keyframes fade { from { opacity: 0; } }')).toBe('');
    });
    it('accepts a custom scope selector', () => {
        expect(buildCanvasStylesheet('.a { color: red; }', '#frame')).toContain('@scope (#frame)');
    });
});
describe('isWidthOnlyQuery', () => {
    it('accepts a max-width query', () => {
        expect(isWidthOnlyQuery('(max-width: 700px)')).toBe(true);
    });
    it('accepts a compound width range', () => {
        expect(isWidthOnlyQuery('(min-width: 400px) and (max-width: 700px)')).toBe(true);
    });
    it('rejects a query about the real device', () => {
        // prefers-color-scheme describes the machine, not the artboard, so it
        // must keep following the window.
        expect(isWidthOnlyQuery('(prefers-color-scheme: dark)')).toBe(false);
    });
    it('rejects a mixed query rather than half-translating it', () => {
        expect(isWidthOnlyQuery('(max-width: 700px) and (prefers-color-scheme: dark)')).toBe(false);
    });
    it('rejects a bare media type with no features', () => {
        expect(isWidthOnlyQuery('print')).toBe(false);
        expect(isWidthOnlyQuery('screen')).toBe(false);
    });
});
describe('mediaToContainer', () => {
    it('rewrites the prelude and leaves the rules untouched', () => {
        const out = mediaToContainer('@media (max-width: 700px) { .a { width: 10px; } }');
        expect(out).toBe('@container (max-width: 700px) { .a { width: 10px; } }');
    });
    it('rewrites several blocks', () => {
        const out = mediaToContainer('@media (max-width: 700px) { .a {} }\n@media (max-width: 400px) { .b {} }');
        expect(out).not.toContain('@media');
        expect((out.match(/@container/g) ?? []).length).toBe(2);
    });
    it('leaves a device query as @media', () => {
        const css = '@media (prefers-color-scheme: dark) { .a { color: white; } }';
        expect(mediaToContainer(css)).toBe(css);
    });
    it('leaves print alone', () => {
        const css = '@media print { .a { display: none; } }';
        expect(mediaToContainer(css)).toBe(css);
    });
    it('does not touch a stylesheet with no media queries', () => {
        expect(mediaToContainer('.a { color: red; }')).toBe('.a { color: red; }');
    });
});
