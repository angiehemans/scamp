import { useCanvasStore } from './canvasSlice';
import { resolveElementAtBreakpoint } from '@lib/breakpointCascade';
import type { BreakpointOverride, ScampElement } from '@lib/element';

/**
 * React hook returning the element AS IT WILL RENDER at the active
 * breakpoint — the raw element overlaid with every applicable
 * breakpoint override (widest first, narrower wins).
 *
 * UiPanel sections use this so the displayed values track the active
 * breakpoint without each section re-implementing the cascade.
 *
 * Returns `undefined` when the element doesn't exist (selection
 * stale, etc.). At desktop or when the element has no overrides this
 * is an identity return — no extra work.
 */
export const useResolvedElement = (
  elementId: string | null
): ScampElement | undefined => {
  const element = useCanvasStore((s) =>
    elementId ? s.elements[elementId] : undefined
  );
  const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
  const breakpoints = useCanvasStore((s) => s.breakpoints);
  if (!element) return undefined;
  return resolveElementAtBreakpoint(element, activeBreakpointId, breakpoints);
};

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
export const useBreakpointOverrideFields = (
  elementId: string | null
): ReadonlySet<keyof BreakpointOverride> => {
  const keys = useCanvasStore((s) => {
    if (s.activeBreakpointId === 'desktop') return EMPTY_KEYS;
    if (!elementId) return EMPTY_KEYS;
    const el = s.elements[elementId];
    const override = el?.breakpointOverrides?.[s.activeBreakpointId];
    if (!override) return EMPTY_KEYS;
    return Object.keys(override) as Array<keyof BreakpointOverride>;
  });
  // Memoize the set only by identity of `keys`; React's referential
  // equality on the result means consumers only re-render when the
  // set of overridden fields actually changes.
  if (keys.length === 0) return EMPTY_SET;
  return new Set(keys);
};

const EMPTY_KEYS: Array<keyof BreakpointOverride> = [];
const EMPTY_SET: ReadonlySet<keyof BreakpointOverride> = new Set();
