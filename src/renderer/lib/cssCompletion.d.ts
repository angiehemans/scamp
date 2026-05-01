import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { ThemeToken } from '@shared/types';
/**
 * Create a CSS declarations completion source that includes theme token
 * suggestions. The `getTokens` callback is called on every completion
 * request so it always reflects the latest tokens in the store.
 */
export declare const createCssCompletion: (getTokens: () => ReadonlyArray<ThemeToken>) => (context: CompletionContext) => CompletionResult | null;
/**
 * Legacy non-token-aware completion source. Used as a fallback when
 * tokens aren't available (e.g. settings page).
 */
export declare const cssDeclarationsCompletion: (context: CompletionContext) => CompletionResult | null;
