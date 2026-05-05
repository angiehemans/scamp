import { type RefObject } from 'react';
type Props = {
    frameRef: RefObject<HTMLDivElement>;
};
/**
 * Floating chain icon overlay rendered inside the canvas frame on the
 * currently-selected element when that element has a non-empty
 * `attributes.href`. Click navigates the canvas to the linked page
 * (internal) or opens the system browser (external). Broken links —
 * `/<slug>` references whose page isn't in the project — render with
 * a strikethrough variant so the user notices.
 *
 * Scoped to the active selection so the canvas isn't visually
 * polluted by chain icons on every linked element. The Properties
 * panel's Link section is the canonical place to see / edit any
 * element's link state; the indicator is a quick visual confirmation
 * + jump-to-page affordance for the element you're already on.
 *
 * Positions are recomputed on every elements / pageNames / selection
 * change AND via a ResizeObserver on the canvas frame so the
 * indicator tracks elements that move via flex/grid layout shifts.
 */
export declare const LinkIndicators: ({ frameRef }: Props) => JSX.Element | null;
export {};
