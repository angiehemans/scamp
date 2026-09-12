import type { RepeatBinding, SampleValue } from '../element';
/** Prefix on a quoted attribute value that was `{expr}` in the source. */
export declare const BIND_MARK = "__scamp_bind__:";
export declare const REPEAT_TAG = "scamp-repeat";
export declare const SHOW_TAG = "scamp-show";
/** Both rewrites; run after `hoistNamedSlots`. */
export declare const hoistBindings: (tsx: string) => string;
export type DecodedBinding = {
    kind: 'bind';
    expr: string;
} | {
    kind: 'event';
    handler: string;
    rowKey: string | null;
} | {
    kind: 'verbatim';
    expr: string;
};
/**
 * Read a marked attribute value back. Returns null when the value
 * wasn't marked (an ordinary string attribute).
 */
export declare const decodeBinding: (attr: string, value: string) => DecodedBinding | null;
/** Decode `over="…" as="…"` from the repeat pseudo-tag's attributes. */
export declare const repeatFromAttribs: (attribs: Record<string, string>) => RepeatBinding | null;
/**
 * Every `name = default` pair in the default export's destructure —
 * strings, booleans, and arrays of rows — plus bare names (events,
 * slots, `className`) mapped to `undefined`. Empty for a page.
 */
export declare const parsePropsDefaults: (tsx: string) => Map<string, SampleValue | undefined>;
