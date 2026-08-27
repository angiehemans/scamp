/**
 * The parity corpus.
 *
 * Each fixture is the TSX + CSS a page would have on disk, plus the same
 * markup written out as plain HTML. The canvas parses the TSX/CSS and
 * renders; a browser renders the HTML against the identical CSS. Any
 * geometry difference between them is a canvas/preview divergence.
 *
 * Hand-written rather than produced by `generateCode`, deliberately —
 * these should look like what a person or an agent writes, which is where
 * the divergences have actually come from.
 *
 * see docs/plans/canvas-preview-parity-plan.md
 */
export type ParityFixture = {
    name: string;
    /** Why this shape is worth pinning. */
    why: string;
    tsx: string;
    css: string;
    /**
     * The same markup as plain HTML, for the browser side of the comparison.
     *
     * Hand-written rather than produced by Scamp's own HTML exporter, on
     * purpose: an oracle that shares code with the thing it checks can agree
     * with it while both are wrong. `parity.spec.ts` asserts the two carry
     * the same set of element names, so they can't drift apart silently.
     */
    html: string;
    /**
     * Set when the canvas is known NOT to match yet. The spec asserts these
     * fail, so the gap is recorded and we're told when it closes.
     */
    knownGap?: string;
};
export declare const PARITY_FIXTURES: ReadonlyArray<ParityFixture>;
