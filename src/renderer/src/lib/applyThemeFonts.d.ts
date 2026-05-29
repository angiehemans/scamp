/**
 * Pump a freshly-parsed `theme.css` font-import list into the
 * fonts store, then kick off async Adobe-kit resolution for any
 * URLs whose families aren't derivable from the URL itself.
 *
 * Google URLs: families come back synchronously from the URL parser
 * and land in the picker immediately.
 *
 * Adobe URLs: only the URL is in `theme.css`; we fetch the kit's CSS
 * to discover the family names, then update the store with the
 * resolved set (which unions with any Google families already
 * present). On fetch failure we log a warning and leave the kit
 * unresolved — the URL stays in `projectFontUrls` so the user can
 * see and remove it via the Fonts panel.
 *
 * The fetch is fire-and-forget; the caller doesn't need to await it.
 * Subsequent calls for already-cached Adobe URLs short-circuit so
 * navigation / file-watcher events don't refetch on every change.
 */
export declare const applyThemeFonts: (urls: ReadonlyArray<string>) => void;
/**
 * Recompute the picker's family list from the current URL list plus
 * the kit-families cache. Exported so callers that mutate URLs (the
 * Fonts panel's add / remove handlers) can stay consistent.
 */
export declare const unionFamiliesFromUrls: (urls: ReadonlyArray<string>, kitFamilies: Record<string, ReadonlyArray<string>>) => string[];
