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
export const customPropsToStyle = (
  custom: Record<string, string>
): CSSProperties => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(custom)) {
    if (key.startsWith('--')) {
      // CSS custom property — pass through unchanged.
      out[key] = value;
      continue;
    }
    if (key.startsWith('-')) {
      // Vendor prefix: strip the leading dash, camelCase the rest,
      // then PascalCase the first letter ("webkitTransform" →
      // "WebkitTransform").
      const stripped = key.slice(1);
      const camel = stripped.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      out[camel.charAt(0).toUpperCase() + camel.slice(1)] = value;
      continue;
    }
    // Standard property: kebab-case → camelCase.
    const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  return out as CSSProperties;
};
