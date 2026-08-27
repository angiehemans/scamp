import { describe, it, expect } from 'vitest';
import { buildCanvasStylesheet, CANVAS_SCOPE_SELECTOR, stripStrippedAtRules, } from '@lib/canvasStylesheet';
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
    it('removes a media query, which would follow the window not the frame', () => {
        // A media query is evaluated against the document viewport — the
        // Electron window — while Scamp's breakpoints size the canvas frame.
        // Keeping them would fire mobile rules on a desktop artboard whenever
        // the app window happened to be narrow.
        const out = stripStrippedAtRules('.a { color: red; }\n@media (max-width: 700px) { .b { display: none; } }');
        expect(out).toContain('.a { color: red; }');
        expect(out).not.toContain('@media');
        expect(out).not.toContain('.b');
    });
    it('removes a media query wrapping several rules', () => {
        const out = stripStrippedAtRules('@media (min-width: 40em) { .a { color: red; } .b { color: blue; } }\n.c { color: green; }');
        expect(out).toContain('.c');
        expect(out).not.toContain('@media');
        expect(out).not.toContain('.a');
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
    it('drops media queries, which the breakpoint cascade handles inline', () => {
        const out = buildCanvasStylesheet('.a { color: red; }\n@media (max-width: 700px) { .b { display: none; } }');
        expect(out).toContain('.a');
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
