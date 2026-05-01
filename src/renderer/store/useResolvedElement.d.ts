import type { BreakpointOverride, ScampElement, StateOverride } from '@lib/element';
/**
 * React hook returning the element AS IT WILL RENDER at the active
 * breakpoint and active state — the raw element overlaid with every
 * applicable breakpoint override (widest first, narrower wins) and
 * then the active state's override on top.
 *
 * UiPanel sections use this so the displayed values track the active
 * axes without each section re-implementing the cascade.
 *
 * Returns `undefined` when the element doesn't exist (selection
 * stale, etc.). At desktop + default state with no overrides this is
 * an identity return — no extra work.
 */
export declare const useResolvedElement: (elementId: string | null) => ScampElement | undefined;
/**
 * Hook returning the fields the active breakpoint is currently
 * overriding for a given element — a set of BreakpointOverride keys.
 *
 * Sections use this to render a "has-override" indicator on fields
 * whose value differs from the desktop base.
 *
 * Always an empty set when the active breakpoint is desktop or the
 * element has no overrides at that breakpoint.
 */
export declare const useBreakpointOverrideFields: (elementId: string | null) => ReadonlySet<keyof BreakpointOverride>;
/**
 * Hook returning the fields the active state is currently overriding
 * for a given element — a set of StateOverride keys. Sections use
 * this to render the "has-override" indicator on fields that differ
 * from the rest state, and to decide whether the per-field "Reset to
 * default" affordance applies.
 *
 * Empty set when the active state is null (default) or the element
 * has no override registered at that state.
 */
export declare const useStateOverrideFields: (elementId: string | null) => ReadonlySet<keyof StateOverride>;
