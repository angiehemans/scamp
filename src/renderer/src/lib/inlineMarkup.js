// Inline-markup safety helper. DOM-dependent (DOMPurify), so it lives
// under src/renderer/src/lib alongside the svg helpers rather than in
// the env-agnostic src/renderer/lib core.
// see docs/notes/import-inline-spans.md
import DOMPurify from 'dompurify';
/**
 * Tags an inline fragment is allowed to contain.
 *
 * A fragment is a run of markup the parser could not turn into
 * elements — a `<strong>` inside a sentence, a link, a `<br>`. It is
 * stored verbatim and emitted verbatim, so the canvas has to inject it
 * as markup to show it at all. That is the same position the svg
 * renderer is in, and it takes the same precaution.
 *
 * The list is what `INLINE_MARKUP_TAGS` captures plus nothing: no
 * `<script>`, no `<style>`, no `<iframe>`, no media. A fragment can
 * come from a hand-written project file as well as from an import, so
 * it is not trusted input.
 */
const ALLOWED_TAGS = [
    'strong', 'em', 'b', 'i', 'u', 's', 'small', 'code', 'kbd', 'mark',
    'sub', 'sup', 'abbr', 'cite', 'q', 'span', 'a', 'br', 'time', 'del',
    'ins', 'samp', 'var', 'wbr', 'bdi', 'bdo', 'ruby', 'rt', 'rp',
];
/** Attributes worth keeping. `href` is filtered to safe schemes below. */
const ALLOWED_ATTR = ['href', 'target', 'rel', 'title', 'datetime', 'cite', 'dir', 'lang'];
/**
 * Sanitize one inline fragment for injection into the canvas DOM.
 *
 * Returns `''` for anything that sanitizes away to nothing, so the
 * caller can skip rendering an empty wrapper.
 */
export const sanitizeInlineMarkup = (source) => {
    if (source.trim().length === 0)
        return '';
    return DOMPurify.sanitize(source, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        // A fragment is a run inside a line; it never brings a document.
        KEEP_CONTENT: true,
    });
};
