import { type CapturePayload } from './importCapture';
/**
 * The capture script — the one piece that has to run inside the page.
 *
 * `captureFn` is serialized with `toString()` and evaluated in the
 * target document, so it MUST be self-contained: no imports, no
 * closures over module scope, no TypeScript that doesn't survive being
 * read back as plain JS. Everything it needs arrives as its argument,
 * which is why the policy is data rather than a set of imports — a
 * `Set` doesn't survive `JSON.stringify`, so the policy carries arrays
 * and the function rebuilds them.
 *
 * Keeping it a real exported function rather than a template string
 * means it typechecks and the fixture generator can call it directly
 * through Playwright's `page.evaluate`.
 * see docs/plans/website-import-plan.md
 */
export type CapturePolicy = {
    properties: ReadonlyArray<string>;
    initial: Readonly<Record<string, string | ReadonlyArray<string>>>;
    inherited: ReadonlyArray<string>;
    conditional: Readonly<Record<string, string | null>>;
    inlineTags: ReadonlyArray<string>;
    inlineAttrs: Readonly<Record<string, ReadonlyArray<string>>>;
    /** Tags whose content is running text, so inline children stay inline. */
    textTags: ReadonlyArray<string>;
    keptAttrs: ReadonlyArray<string>;
    skippedTags: ReadonlyArray<string>;
    limits: {
        maxDepth: number;
        maxNodes: number;
        maxTextLength: number;
    };
    version: number;
    /**
     * Record each node's box, relative to the page root.
     *
     * On by default. It began as harness-only weight, then turned out to
     * be the only way to tell a width the author chose from a width the
     * element got for free — which is the difference between an import
     * that reflows and a pixel snapshot. Four numbers a node.
     * see docs/plans/website-import-plan.md
     */
    includeRects?: boolean;
};
/** The policy as the page receives it: plain arrays, JSON-safe. */
export declare const capturePolicy: () => CapturePolicy;
/**
 * Walk the rendered document into a `CapturePayload`.
 *
 * Runs in the page. Reads nothing but the DOM and its computed styles,
 * and mutates nothing — an import must never change the page it is
 * reading, not least because the user is still looking at it.
 */
export declare const captureFn: (policy: CapturePolicy) => CapturePayload;
