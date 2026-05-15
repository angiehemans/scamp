import type { PropertyGroup, ScampElement } from './element';
/**
 * Supporting tables for the `PropertyGroup` taxonomy declared in
 * `element.ts`. (`PropertyGroup` itself lives over there so
 * `ScampElement.toggledOffGroups` can reference it without a
 * circular import.)
 *
 * Deliberate deviation from the backlog spec (which listed
 * Sizing, Layout, and Visibility as togglable groups):
 *   - Sizing off collapses the element to zero / auto, which
 *     reads as "broken" rather than "previewing without these
 *     styles".
 *   - Layout off rearranges every descendant — too much
 *     side-effect for a section toggle.
 *   - Visibility already IS the user-facing surface for
 *     hide/show / opacity. Toggling its section would un-hide a
 *     previously-hidden element, inverting the eye-icon
 *     affordance.
 * Position, Element, and Export aren't togglable for unrelated
 * reasons — they're not CSS-property groups in this sense.
 */
export type { PropertyGroup };
/** Ordered for deterministic UI listings + canonical emit order. */
export declare const ALL_PROPERTY_GROUPS: ReadonlyArray<PropertyGroup>;
/** Type guard. */
export declare const isPropertyGroup: (s: string) => s is PropertyGroup;
/**
 * Which `ScampElement` fields belong to which panel-group. This
 * is the single source of truth used by:
 *   - the renderer (skip these styles when group is off)
 *   - the generator (emit these fields as commented decls when
 *     group is off)
 *   - the parser (when we see a comment block, route values back
 *     into these fields)
 *
 * Keep in sync with the panel sections. Field names that don't
 * appear here are unaffected by group toggles (e.g. `display`,
 * `widthMode` — those groups aren't togglable).
 */
export declare const GROUP_FIELDS: Record<PropertyGroup, ReadonlyArray<keyof ScampElement>>;
/**
 * Inverse lookup. Maps each `ScampElement` field key to the
 * group it belongs to (when any). O(1) check for the renderer's
 * "is this field's group off?" branches.
 */
export declare const FIELD_TO_GROUP: Partial<Record<keyof ScampElement, PropertyGroup>>;
/**
 * `customProperties` keys (raw CSS property names) owned by each
 * group. Used by the renderer to filter `customProperties` when a
 * group is off, and by the generator to route those keys into
 * the right group's comment block.
 *
 * Background's image / size / position / repeat live in
 * `customProperties` (rather than typed fields), so the group
 * toggle has to know about them to comment them out coherently
 * with `backgroundColor`.
 */
export declare const GROUP_CUSTOM_PROPS: Partial<Record<PropertyGroup, ReadonlyArray<string>>>;
/** Inverse of `GROUP_CUSTOM_PROPS`: CSS property name → group. */
export declare const CUSTOM_PROP_TO_GROUP: Record<string, PropertyGroup>;
/**
 * Sort + dedupe a list of group names. Called from the store
 * action that mutates `toggledOffGroups` so the on-disk
 * representation stays text-stable across saves and rounds-trips
 * cleanly through agent edits.
 */
export declare const canonicalizeGroupList: (groups: ReadonlyArray<PropertyGroup>) => ReadonlyArray<PropertyGroup>;
