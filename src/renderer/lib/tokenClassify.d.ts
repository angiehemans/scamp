/**
 * Classify a theme-token value so the UI can group tokens by intent
 * (colour vs size vs line-height vs font-family) without the user
 * having to declare a category up-front. Pure — feed it the value
 * the user typed into theme.css and get back the bucket.
 */
export type TokenCategory = 'color' | 'fontSize' | 'lineHeight' | 'fontFamily' | 'unknown';
export declare const classifyToken: (raw: string) => TokenCategory;
