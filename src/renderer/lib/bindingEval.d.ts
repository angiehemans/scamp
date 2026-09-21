import type { SampleRow, SampleValue, ScampElement } from './element';
/**
 * Resolve bindings against sample data for the canvas. Prop names and
 * member paths only — no expressions, no user code. Text and attribute
 * samples already sit on their elements; what needs resolving is a row
 * path inside a repeat, a show flag, and a repeat's rows.
 * see docs/notes/view-bindings.md
 */
/** The row an element is being rendered for, inside a repeat. */
export type RowScope = {
    as: string;
    data: SampleRow;
    index: number;
};
export type BindingScope = {
    samples: Record<string, SampleValue>;
    row: RowScope | null;
};
export declare const EMPTY_SCOPE: BindingScope;
type Resolved = string | number | boolean | SampleRow[] | undefined;
/**
 * `code`, `player.label`, `players.length`, `!canStart`. A head that
 * matches the row variable reads the row; anything else reads the root
 * samples. Unknown names resolve to undefined.
 */
export declare const resolveRef: (ref: string, scope: BindingScope) => Resolved;
/** A row-bound text element's text; undefined when the element isn't one. */
export declare const resolveText: (el: ScampElement, scope: BindingScope) => string | undefined;
/**
 * A row-bound attribute's value for the current row; undefined when the
 * attribute isn't bound to a row path, in which case the sample on the
 * element is the value. `src` on a repeated `<img>` is the case that
 * made this necessary. see docs/notes/view-bindings.md
 */
export declare const resolveAttr: (el: ScampElement, attr: string, scope: BindingScope) => string | undefined;
/** False only when the element has a show flag that resolves falsy. A flag with no sample shows. */
export declare const isShown: (el: ScampElement, scope: BindingScope) => boolean;
/** The rows a repeated element renders for; empty when the sample is missing. */
export declare const rowsFor: (el: ScampElement, scope: BindingScope) => SampleRow[];
/**
 * An instance's props for the canvas: its literal overrides, with any
 * row-bound prop resolved from the current row.
 */
export declare const resolveInstanceOverrides: (el: ScampElement, scope: BindingScope) => Record<string, string>;
/**
 * Which children to render, and for which row: a hidden child is
 * dropped, a repeated child appears once per row with that row in
 * scope, and every other child inherits the caller's row.
 */
export declare const expandChildren: (elements: Record<string, ScampElement>, childIds: ReadonlyArray<string>, scope: BindingScope) => Array<{
    id: string;
    row: RowScope | null;
}>;
/**
 * A subscription key that changes when any child's show or repeat
 * binding changes, so a parent re-expands without subscribing to the
 * whole element map.
 */
export declare const childBindingKey: (elements: Record<string, ScampElement>, childIds: ReadonlyArray<string>) => string;
export {};
