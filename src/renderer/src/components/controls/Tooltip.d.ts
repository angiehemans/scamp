import { ReactElement } from 'react';
type Props = {
    /** Tooltip body text shown on hover. Supports `\n` line breaks. */
    label: string;
    /**
     * Optional header rendered above the body with a subtle
     * border-bottom separator. Used by richer tooltips (e.g. the
     * section override indicator's "Style Overrides" block).
     */
    header?: string;
    /**
     * The element to hover over. Must be a single React element that can
     * accept `onMouseEnter` / `onMouseLeave` / `onFocus` / `onBlur` handlers.
     */
    children: ReactElement;
    /** Hover delay in ms before showing. Default 400. */
    delay?: number;
};
/**
 * Small custom tooltip. Matches the project's in-app tooltip design (dark
 * background, mono font, subtle border + shadow). Portaled to `document.body`
 * so it escapes overflow clipping from parent panels.
 *
 * The wrapper clones the child and attaches hover/focus handlers — it
 * doesn't add an extra DOM node, so layout of the trigger is preserved.
 */
export declare const Tooltip: ({ label, header, children, delay, }: Props) => JSX.Element;
export {};
