/**
 * Keeps a `<link rel="stylesheet">` per project font URL in
 * `document.head` so the canvas preview actually loads the referenced
 * Google Fonts stylesheet. Reconciles on delta — unchanged URLs keep
 * their tag (and the browser's cached stylesheet) across renders — and
 * strips every injected tag on unmount so a different project doesn't
 * inherit this one's fonts.
 */
export declare const useFontLinkReconciler: () => void;
/**
 * Loads theme tokens + font imports from `theme.css` on project open and
 * resets the font picker + sync intent on unmount so a stale project's
 * state doesn't bleed into the next.
 */
export declare const useProjectTheme: (projectPath: string) => void;
