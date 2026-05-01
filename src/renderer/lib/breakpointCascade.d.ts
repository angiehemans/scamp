import type { ScampElement } from './element';
import { type Breakpoint } from '@shared/types';
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
export declare const resolveElementAtBreakpoint: (element: ScampElement, activeBreakpointId: string, breakpoints: ReadonlyArray<Breakpoint>) => ScampElement;
