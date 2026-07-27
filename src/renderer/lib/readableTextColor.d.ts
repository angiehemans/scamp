/** Near-white text for dark backgrounds. */
export declare const LIGHT_TEXT = "#f4f4f5";
/** Near-black text for light backgrounds. */
export declare const DARK_TEXT = "#18181b";
/**
 * A legible text color for a card whose background is `background`.
 * Light backgrounds get dark text; everything else (dark colors, and any
 * value we can't parse — the app's dark theme) gets light text.
 */
export declare const readableTextColor: (background: string | undefined) => string;
