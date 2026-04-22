import type { BreakpointOverride, ScampElement } from './element';
import { DESKTOP_BREAKPOINT_ID, type Breakpoint } from '@shared/types';

/**
 * Return the element rendered at the active breakpoint — base styles
 * with every applicable breakpoint's overrides layered on top.
 *
 * Cascade rules match CSS `max-width` media queries:
 *   - `@media (max-width: Npx)` matches when the active breakpoint
 *     width is ≤ N. Tablet (768) matches mobile (390), mobile only
 *     matches itself.
 *   - When multiple breakpoints match, narrower wins (narrower is
 *     later in the generated source and overrides wider in CSS).
 *
 * Desktop is the base — no overrides apply when active. The returned
 * object always has `breakpointOverrides: undefined` stripped off so
 * downstream code doesn't accidentally re-apply overrides to itself.
 */
export const resolveElementAtBreakpoint = (
  element: ScampElement,
  activeBreakpointId: string,
  breakpoints: ReadonlyArray<Breakpoint>
): ScampElement => {
  if (
    activeBreakpointId === DESKTOP_BREAKPOINT_ID ||
    !element.breakpointOverrides
  ) {
    return element;
  }

  const active = breakpoints.find((b) => b.id === activeBreakpointId);
  if (!active) return element;

  // Every breakpoint whose max-width ≥ active.width matches, because
  // an element rendered at active.width is ≤ each of those max-widths.
  // Apply wider ones FIRST so narrower ones win — last spread wins
  // in object spread.
  const applicable = breakpoints
    .filter(
      (b) => b.id !== DESKTOP_BREAKPOINT_ID && b.width >= active.width
    )
    .sort((a, b) => b.width - a.width);

  let resolved: ScampElement = element;
  for (const bp of applicable) {
    const override: BreakpointOverride | undefined =
      element.breakpointOverrides[bp.id];
    if (!override || Object.keys(override).length === 0) continue;

    // customProperties merge object-wise, not replace, so a
    // breakpoint can add `box-shadow` without clobbering a desktop
    // `transform`.
    const mergedCustom = {
      ...resolved.customProperties,
      ...(override.customProperties ?? {}),
    };
    resolved = {
      ...resolved,
      ...override,
      customProperties: mergedCustom,
    };
  }

  return resolved;
};
