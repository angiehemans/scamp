/**
 * The page's own CSS, injected into the canvas.
 *
 * The canvas has always re-derived styles from the element model into
 * inline styles, which means every property is a chance to translate
 * wrongly — and some CSS has no inline form at all, so it never rendered:
 * `::before` / `::after`, `:nth-child`, and any hand-written selector.
 *
 * Rather than teach the translator more tricks, the canvas now also loads
 * the exact stylesheet the generator writes to disk. Inline styles still
 * win on the properties they set, so this is additive: it supplies only
 * what the translation could never express. Later phases move properties
 * out of the inline layer and let these rules take over.
 *
 * see docs/plans/canvas-preview-parity-plan.md
 */
/** Attribute marking the canvas frame, used as the `@scope` root. */
export const CANVAS_SCOPE_ATTR = 'data-scamp-canvas';
/** The selector the page's rules are scoped to. */
export const CANVAS_SCOPE_SELECTOR = `[${CANVAS_SCOPE_ATTR}]`;
/**
 * At-rules removed before the sheet is scoped into the canvas.
 *
 * `@keyframes` — the canvas injects these separately (`CanvasKeyframes`),
 * and a non-style at-rule inside `@scope` has no defined meaning; a
 * browser that rejects it could drop the whole scoped block and take
 * every page rule with it.
 *
 * `@media` — a media query is evaluated against the DOCUMENT viewport,
 * which here is the Electron window, not the canvas frame. Scamp's
 * breakpoints size the frame (390, 768, …) while the window stays wide,
 * so these rules would fire on the wrong condition entirely: mobile rules
 * on a desktop artboard because the app window happens to be narrow, and
 * no mobile rules on a mobile artboard in a maximised window.
 *
 * The breakpoint cascade is resolved against the frame width and applied
 * inline, which is the correct semantics, so dropping these loses nothing
 * that works. Rendering them properly needs the frame to actually BE a
 * viewport — an iframe — or `@container` queries.
 * see docs/notes/canvas-injected-stylesheet.md
 */
const STRIPPED_AT_RULE = /@(?:-[a-z]+-)?(?:keyframes|media)\b/iy;
export const stripStrippedAtRules = (css) => {
    let out = '';
    let i = 0;
    while (i < css.length) {
        const match = STRIPPED_AT_RULE;
        match.lastIndex = i;
        if (!match.test(css)) {
            out += css[i] ?? '';
            i += 1;
            continue;
        }
        // Skip to the block's opening brace, then past its matching close.
        let j = css.indexOf('{', i);
        if (j === -1)
            break;
        let depth = 0;
        for (; j < css.length; j += 1) {
            const c = css[j] ?? '';
            if (c === '{')
                depth += 1;
            else if (c === '}') {
                depth -= 1;
                if (depth === 0) {
                    j += 1;
                    break;
                }
            }
        }
        i = j;
    }
    return out;
};
/**
 * Wrap a page's CSS so it applies only inside the canvas frame.
 *
 * `@scope` rather than a descendant prefix (`#canvas .rect_a1b2`) because
 * a prefix changes specificity, and a rule that outranks its counterpart
 * in the preview is a new way to diverge. Note `@scope` is not entirely
 * cascade-neutral either — scope proximity is considered before source
 * order, so a scoped rule beats an unscoped one of equal specificity
 * regardless of position. That only matters for rules outside this sheet
 * targeting the same page classes, which nothing does.
 *
 * Returns an empty string when there's nothing to inject, so callers can
 * skip mounting a `<style>` at all.
 */
export const buildCanvasStylesheet = (css, scopeSelector = CANVAS_SCOPE_SELECTOR) => {
    const body = stripStrippedAtRules(css).trim();
    if (body.length === 0)
        return '';
    return `@scope (${scopeSelector}) {\n${body}\n}`;
};
