import { type ElementAnimation } from "../element";
/**
 * Parse a single CSS `animation` shorthand value (one animation, no
 * commas) into an `ElementAnimation`. Returns null when no name can
 * be found (the picker can't represent a nameless animation; the
 * caller falls back to `customProperties`).
 *
 * Per the CSS spec, the first `<time>` is duration and the second
 * is delay; iteration is `<number> | infinite`; direction / fill
 * mode / play state are mutually disjoint enum sets so positional
 * disambiguation works. The leftover non-keyword token is the
 * custom-ident name.
 */
export declare const parseAnimationShorthand: (raw: string) => ElementAnimation | null;
/**
 * Format an `ElementAnimation` back into the CSS shorthand.
 *
 * Order: name duration easing delay iteration direction fill-mode
 * play-state. Default values are omitted — but only safely from the
 * tail, since position matters for time tokens (delay is the second
 * time, which means duration must precede it). Easing is positional
 * relative to delay too — emit easing whenever delay is non-default.
 */
export declare const formatAnimationShorthand: (animation: ElementAnimation) => string;
