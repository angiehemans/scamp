import { type ElementType, type SelectOption } from "../element";
export type RawElement = {
    id: string;
    type: ElementType;
    /** The HTML tag name as written in the source file. Captured so the
     *  generator can round-trip semantic tags like h1, section, header.
     *  For component instances, this is the PascalCase component name
     *  (recovered from the file's import pre-pass — htmlparser2
     *  lowercases by default). */
    tag: string;
    className: string;
    parentId: string | null;
    childIds: string[];
    text: string | null;
    /**
     * Loose text + unclassed JSX subtrees that appear between this
     * element's child elements (or before/after them). Captured in
     * source order so the generator can emit them verbatim. Pure-
     * whitespace text fragments are dropped to avoid double-spacing
     * generator-emitted indentation.
     */
    inlineFragments: Array<{
        kind: 'text';
        value: string;
        afterChildIndex: number;
    } | {
        kind: 'jsx';
        source: string;
        afterChildIndex: number;
    }>;
    /** Human-readable name from `data-scamp-name`, if present. */
    name: string | null;
    /** Image src attribute, if present. */
    src: string | null;
    /** Image alt attribute, if present. */
    alt: string | null;
    /** Every attribute other than the ones typed above, preserved
     *  verbatim so round-trips don't discard agent-written extras. */
    attributes: Record<string, string>;
    /** Verbatim inner source of an `<svg>` element — the substring
     *  between the opening tag's `>` and the closing `</svg>`. */
    svgSource: string | null;
    /** Options collected from `<select>` child `<option>` elements. */
    selectOptions: SelectOption[] | null;
    componentName: string | null;
    instanceId: string | null;
    propOverrides: Record<string, string> | null;
    missingComponent: boolean;
};
/**
 * Match a JSX-expression-only text body, ignoring surrounding
 * whitespace from generator indentation. Used to detect when a
 * parsed text element's content is a single `{propName}` ref so
 * we can hydrate it into the typed `prop` field.
 */
export declare const PROP_REF_TEXT_RE: RegExp;
/**
 * Parse the function-signature destructure into a `propName →
 * defaultText` map. Components with no text-props (and pages,
 * which never emit this form) return an empty map. The returned
 * map is the authoritative source for restoring a text element's
 * `text` field after its JSX-expression body resolves to a known
 * prop name.
 */
export declare const parsePropsDestructure: (tsx: string) => Map<string, string>;
/**
 * Walk the TSX with htmlparser2 and produce the element tree shape (no
 * styles yet — those come from the CSS pass). We rely on the strict format
 * generateCode emits, so we don't need a real JSX parser:
 *
 *   <div data-scamp-id="..." className={styles.X}>...</div>
 *   <p   data-scamp-id="..." className={styles.X}>text</p>
 *
 * Special cases:
 *   - `<svg>` inner source is captured verbatim via the parser's
 *     start/end indices; nested open/close events inside the svg are
 *     suppressed so children of the svg don't become canvas elements.
 *   - `<select>` children named `<option>` are consumed into a typed
 *     `selectOptions` list on the select rather than treated as canvas
 *     elements in their own right.
 */
export declare const parseTsxStructure: (tsx: string) => RawElement[];
