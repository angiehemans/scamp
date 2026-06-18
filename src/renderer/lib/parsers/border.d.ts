import { type BorderStyle } from "../element";
export type ParsedBorder = {
    borderWidth: number;
    borderStyle: BorderStyle;
    borderColor: string;
};
/**
 * Parse a CSS `border` shorthand into the three scamp fields.
 *
 * Tokenization is space-separated, with one wrinkle: rgb()/rgba() and similar
 * function-call colors contain spaces inside parens that are NOT separators.
 * We collapse anything inside `()` first.
 *
 * Empty input returns the documented defaults so the parser can use this
 * as a single source of truth without needing to track absence separately.
 */
export declare const parseBorderShorthand: (raw: string) => ParsedBorder;
