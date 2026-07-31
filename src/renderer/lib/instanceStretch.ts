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
export const instanceStretchStyle = (
  instanceWidthMode: WidthMode,
  instanceHeightMode: HeightMode,
  rootWidthMode: WidthMode | undefined,
  rootHeightMode: HeightMode | undefined,
  parentDisplay: 'flex' | 'grid' | 'none' | undefined,
  parentDirection: 'row' | 'column' | undefined
): CSSProperties => {
  const widthStretch = instanceWidthMode === 'auto' && rootWidthMode === 'stretch';
  const heightStretch =
    instanceHeightMode === 'auto' && rootHeightMode === 'stretch';
  if (!widthStretch && !heightStretch) return {};

  if (parentDisplay !== 'flex') {
    return {
      ...(widthStretch ? { width: '100%' } : {}),
      ...(heightStretch ? { height: '100%' } : {}),
    };
  }

  // Default flex-direction is row, so an absent direction means width is main.
  const widthIsMain = parentDirection !== 'column';
  const out: CSSProperties = {};
  if (widthStretch && widthIsMain) {
    out.flex = 1;
    out.minWidth = 0;
  } else if (heightStretch && !widthIsMain) {
    out.flex = 1;
    out.minHeight = 0;
  }
  // Cross-axis stretch is asymmetric: a row parent's cross axis is the block
  // axis, where `height: 100%` collapses against an indefinite container, so
  // fall back to `align-self`. A column parent's cross axis is inline, where
  // `width: 100%` resolves fine and must be kept so the parent's
  // `align-items` still applies. see docs/notes/canvas-cross-axis-stretch.md
  if (heightStretch && widthIsMain) {
    out.alignSelf = 'stretch';
  }
  if (widthStretch && !widthIsMain) {
    out.width = '100%';
  }
  return out;
};
