import type { WidthMode } from './element';
export type SizeType = 'px' | 'percent' | 'fill' | 'hug' | 'auto' | 'vh' | 'vw' | 'custom';
/** The types offered as menu choices (order = display order). The
 *  `label` is the menu's text; the trigger button shows an icon only. */
export declare const SIZE_TYPE_OPTIONS: ReadonlyArray<{
    type: SizeType;
    label: string;
}>;
/** Derive the current type from the stored mode + verbatim custom string. */
export declare const sizeTypeOf: (mode: WidthMode, custom: string | undefined) => SizeType;
/** Short label shown on the type button. */
export declare const sizeTypeLabel: (type: SizeType) => string;
/** True when the type carries an editable numeric value in the field. */
export declare const sizeTypeHasNumber: (type: SizeType) => boolean;
/**
 * The raw CSS-length string to commit when the user picks `type` from
 * the menu, seeding the numeric value from `num` for unit types.
 */
export declare const rawForType: (type: SizeType, num: number) => string;
/**
 * Combine what the user typed in the number field with the active type:
 * a bare number gets the active unit appended; a full CSS length or a
 * keyword the user typed is respected verbatim (so typing `auto`,
 * `50vh`, `calc(...)` still works and can change the type).
 */
export declare const combineTypedWithType: (typed: string, type: SizeType) => string;
