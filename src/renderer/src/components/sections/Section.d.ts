import { type ReactNode } from 'react';
import type { BreakpointOverride } from '@lib/element';
type Props = {
    title: string;
    children: ReactNode;
    /** When true, the heading acts as a disclosure toggle. */
    collapsible?: boolean;
    /** Initial open state when `collapsible` is true. Ignored otherwise. */
    defaultOpen?: boolean;
    /**
     * The element this section edits. Paired with `fields` to drive
     * the breakpoint-override indicator next to the section title.
     */
    elementId?: string;
    /**
     * Which BreakpointOverride fields this section as a whole manages.
     * When any of them is set in the active breakpoint's override, the
     * title shows a small dot. Hover the dot for a list of overridden
     * properties; right-click to reset them all.
     */
    fields?: ReadonlyArray<keyof BreakpointOverride>;
};
/**
 * Card-like wrapper for one panel section. Renders a small heading
 * (optionally collapsible) and the provided controls.
 *
 * When `elementId` + `fields` are provided, the title surfaces an
 * override indicator that aggregates all breakpoint overrides within
 * this section. Right-click the dot to reset every overridden field
 * in the section at the active breakpoint.
 */
export declare const Section: ({ title, children, collapsible, defaultOpen, elementId, fields, }: Props) => JSX.Element;
type RowProps = {
    label: string;
    children: ReactNode;
    /**
     * Optional hover tooltip for the whole row — used to explain
     * what a property does when the label alone isn't enough (e.g.
     * `Direction`, `Fill mode`, `Iteration` for animations). Shown
     * when the user hovers anywhere in the row, including over the
     * control, so they don't have to find the small label area.
     */
    tooltip?: string;
};
/** A labeled row inside a Section. Wraps the label and the control(s). */
export declare const Row: ({ label, children, tooltip }: RowProps) => JSX.Element;
type FieldConfig = {
    /** Visible label rendered above the control. */
    label: string;
    /** Hover tooltip body (label is used as the header). */
    tooltip?: string;
    /** The control(s) — usually a single input. */
    children: ReactNode;
};
type DualFieldProps = {
    left: FieldConfig;
    right: FieldConfig;
};
/**
 * Two label-on-top fields side by side. Used by sections that have
 * naturally-paired controls (Duration + Easing, Delay + Iteration,
 * Direction + Fill mode). Each field is wrapped in a Tooltip with its
 * own label as the header so hovering anywhere in that half surfaces
 * the right description.
 */
export declare const DualField: ({ left, right }: DualFieldProps) => JSX.Element;
export {};
