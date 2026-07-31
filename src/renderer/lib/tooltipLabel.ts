/**
 * Tooltip strings across the app follow a `Name — description`
 * convention ("Height — type a number, or any CSS length"). Splitting
 * on that separator lets the Tooltip render the name as its header and
 * the rest as subdued body text, without every call site having to
 * pass a separate `header` prop.
 */

/** The separator: a spaced em dash. A bare `-` is too common in prose. */
const SEPARATOR = ' — ';

/**
 * Longest a leading segment may be and still read as a field name.
 * Guards against splitting a long first clause that merely happens to
 * contain an em dash ("Sync paused — an agent is running…" splits;
 * a full sentence before the dash does not).
 */
const MAX_HEADER_LENGTH = 32;

export type TooltipParts = {
  /** The field name, or `null` when the label has no header segment. */
  header: string | null;
  /** The remaining text — the whole label when there is no header. */
  body: string;
};

/**
 * Splits a tooltip label into its header and body on the first spaced
 * em dash. Returns `header: null` (and the label unchanged as `body`)
 * when there is no separator, when the leading segment is too long to
 * be a field name, or when either side would be empty.
 */
export const splitTooltipLabel = (label: string): TooltipParts => {
  const index = label.indexOf(SEPARATOR);
  if (index === -1) return { header: null, body: label };

  const header = label.slice(0, index).trim();
  const body = label.slice(index + SEPARATOR.length).trim();
  if (header.length === 0 || body.length === 0) {
    return { header: null, body: label };
  }
  if (header.length > MAX_HEADER_LENGTH) return { header: null, body: label };

  return { header, body };
};
