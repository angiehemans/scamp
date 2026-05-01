import type { ElementType } from './element';
/**
 * One option in the tag dropdown. The `value` is the literal HTML tag
 * name; `label` is what the user sees.
 */
export type TagOption = {
    value: string;
    label: string;
};
/**
 * A tag-specific attribute field the Element section renders.
 *
 * - `text`    — free-form string input
 * - `select`  — dropdown with a fixed option set
 * - `boolean` — checkbox; stored as `""` when checked, absent when not
 */
export type AttributeSpec = {
    name: string;
    label: string;
    kind: 'text';
    placeholder?: string;
} | {
    name: string;
    label: string;
    kind: 'select';
    options: ReadonlyArray<TagOption>;
} | {
    name: string;
    label: string;
    kind: 'boolean';
};
/**
 * Tag options offered in the Element section's tag dropdown, keyed by
 * the element's `type` discriminator.
 *
 * Class-prefix defaults (rect_/text_/img_/input_) stay tied to the
 * element's `type`, not its tag, so a `nav` rectangle still gets a
 * `rect_` prefix.
 */
export declare const TAG_OPTIONS: Record<ElementType, ReadonlyArray<TagOption>>;
/** Default tag for a given element type, used when `tag` is undefined. */
export declare const DEFAULT_TAG: Record<ElementType, string>;
/**
 * Per-tag attribute specs shown in the Element section below the tag
 * dropdown. A tag with no entry here shows just the dropdown.
 *
 * `<select>` (option list) and `<svg>` (raw source) aren't in this map
 * because they have dedicated editors rendered separately.
 */
export declare const TAG_ATTRIBUTES: Record<string, ReadonlyArray<AttributeSpec>>;
/** True when the tag has a dedicated non-dropdown editor (select, svg). */
export declare const hasSpecialEditor: (tag: string) => boolean;
