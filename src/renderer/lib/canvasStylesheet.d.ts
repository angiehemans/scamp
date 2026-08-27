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
export declare const CANVAS_SCOPE_ATTR = "data-scamp-canvas";
/** The selector the page's rules are scoped to. */
export declare const CANVAS_SCOPE_SELECTOR = "[data-scamp-canvas]";
export declare const stripStrippedAtRules: (css: string) => string;
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
export declare const buildCanvasStylesheet: (css: string, scopeSelector?: string) => string;
