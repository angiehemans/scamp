import type { CSSProperties } from 'react';
/**
 * Convert an element's `customProperties` bag (CSS-style kebab-case
 * property names → raw string values) into a React-compatible style
 * object (camelCase keys, suitable for `<div style={...}>`).
 *
 * This is what makes scamp's "any property scamp doesn't have a typed
 * field for still gets rendered on the canvas" promise work. The
 * parser routes mapped properties (background, gap, padding, …) into
 * typed element fields, and everything else into `customProperties`.
 * Both buckets ultimately become inline CSS at render time; this
 * function is the bridge for the unmapped bucket.
 *
 * Conversion rules:
 *   - CSS custom properties keep their `--name` form (React supports
 *     them verbatim in style objects).
 *   - Vendor prefixes (`-webkit-…`) become PascalCase
 *     (`WebkitUserSelect`), per the React docs.
 *   - Everything else is kebab-case → camelCase
 *     (`box-shadow` → `boxShadow`).
 */
export declare const customPropsToStyle: (custom: Record<string, string>) => CSSProperties;
