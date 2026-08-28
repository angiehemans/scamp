/**
 * Keeping animated elements from driving the canvas extent.
 *
 * The content extent decides the fit zoom and the overflow indicator. It is
 * measured from bounding boxes, and a bounding box includes the element's
 * current transform — so an element with a running animation reports a
 * different extent depending on when you happen to look at it.
 *
 * A real project made this obvious: a hero glow with
 * `animation: glow-drift 18s infinite` translating 60px and scaling 1.08.
 * Every edit re-measured, caught the glow somewhere new, and the canvas
 * flipped between two zoom levels — 802/1440 = 55.7% at rest, 802/1474 =
 * 54.4% mid-drift — with the overflow warning appearing and vanishing
 * along with it.
 *
 * The fix is not to skip these elements: one parked off the right edge is
 * genuinely overflowing and the user needs to see that. It is to measure
 * their LAYOUT box instead — `offsetLeft`/`offsetWidth`, which ignore
 * transforms entirely and so report where the element rests rather than
 * where this frame of the animation put it.
 *
 * see docs/notes/canvas-extent-oscillation.md
 */
/**
 * A predicate for "this element is animating, or sits inside something
 * that is". Built once per measurement from a single `getAnimations()`
 * call rather than per element, and memoised up the ancestor chain.
 *
 * Descendants count because a transform on an ancestor moves them too —
 * measuring a static child of a drifting parent reads the drift.
 */
export declare const animatedSubtreePredicate: (root: HTMLElement) => ((el: Element) => boolean);
/**
 * The element's right/bottom edge relative to `root`, in logical px, from
 * layout geometry only — no transforms, no dependence on the applied zoom.
 *
 * Returns null when the offset chain does not reach `root` (a fixed-position
 * element, or one detached mid-measure), which the caller treats as "cannot
 * attribute this one" and skips.
 */
export declare const layoutEdges: (el: HTMLElement, root: HTMLElement) => {
    right: number;
    bottom: number;
} | null;
