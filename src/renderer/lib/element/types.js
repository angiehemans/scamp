/**
 * Canonical canvas element type. Mirrors the Element shape from prd-scamp-poc.md
 * §"Zustand State Shape". Both `generateCode` and `parseCode` (added in M3)
 * operate on a flat `Record<string, ScampElement>` keyed by id.
 */
/**
 * Attribute that carries an imported inline SVG's source-file reference
 * (relative path under `public/assets`). Stored in the element's generic
 * `attributes` bag so it round-trips through the TSX verbatim, and read by
 * the file-watch reload to locate the on-disk source. see
 * docs/plans/svg-color-editing-plan.md
 */
export const SVG_SRC_ATTR = 'data-scamp-svg-src';
export const ELEMENT_STATES = [
    'hover',
    'active',
    'focus',
];
/**
 * The id used for the implicit page-root element. Stays constant across
 * all pages so other code can rely on a known anchor.
 */
export const ROOT_ELEMENT_ID = 'root';
