import type { CSSProperties } from 'react';
import type { HeightMode, WidthMode } from './element';
/**
 * Styles the canvas wrapper of a component instance needs in order to
 * inherit a `stretch` component ROOT.
 *
 * The wrapper is a canvas-only box the generated page doesn't have — there,
 * the component root is the page's direct child. So the wrapper, not the
 * root, is what the page's layout sizes, and a stretch root has to be
 * reproduced on it or the root resolves `100%` against a content-sized box
 * and collapses.
 *
 * Per axis, this only fills in for an instance that hasn't been sized: once
 * the page sets a width or height on the instance, that's the page's answer
 * and `elementToStyle` has already emitted it. Mirrors the flex branch of
 * `elementToStyle` so an instance and a plain stretch rectangle in the same
 * slot lay out identically. see docs/notes/components-data-model.md
 */
export declare const instanceStretchStyle: (instanceWidthMode: WidthMode, instanceHeightMode: HeightMode, rootWidthMode: WidthMode | undefined, rootHeightMode: HeightMode | undefined, parentDisplay: "flex" | "grid" | "none" | undefined, parentDirection: "row" | "column" | undefined) => CSSProperties;
