/**
 * Locates the selected element inside the code panel's TSX and CSS, so
 * selecting a rectangle on canvas shows you the code that produces it.
 *
 * Works on TEXT, not on a parsed tree, because the panel shows what is on
 * disk — which an agent or editor may have reformatted since Scamp wrote it.
 * Anchoring on the `data-scamp-id` attribute and on brace matching survives
 * reformatting; anchoring on generated indentation would not.
 * see docs/notes/code-highlight.md
 */

/** Inclusive, 1-BASED line numbers — CodeMirror numbers lines from 1. */
export type LineRange = { from: number; to: number };

const escapeForRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lines whose opening tag identifies this element.
 *
 * Both attributes are checked: ordinary elements carry `data-scamp-id`,
 * component instances carry `data-scamp-instance-id` (they own no CSS class,
 * so the CSS side will correctly find nothing for them).
 *
 * The value is matched in full, between the quotes — a substring match would
 * make `rect_a1` highlight `rect_a1b2`.
 */
export const findTsxLines = (tsx: string, className: string): LineRange[] => {
  if (className.length === 0 || tsx.length === 0) return [];
  const attr = new RegExp(
    `data-scamp(?:-instance)?-id\\s*=\\s*"${escapeForRegex(className)}"`
  );
  const ranges: LineRange[] = [];
  const lines = tsx.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (attr.test(lines[i] ?? '')) ranges.push({ from: i + 1, to: i + 1 });
  }
  return ranges;
};

/**
 * Does this selector target the class?
 *
 * `.rect_a1b2`, `.rect_a1b2:hover`, and `.wrap .rect_a1b2` all count — every
 * rule that styles the element is worth showing. `.rect_a1b2x` does not: the
 * class name must not run on into another identifier character.
 */
const selectorTargets = (selector: string, className: string): boolean =>
  new RegExp(`\\.${escapeForRegex(className)}(?![\\w-])`).test(selector);

/** Strip comments and quoted strings so their braces can't be miscounted. */
const maskNonCode = (css: string): string => {
  let out = '';
  let quote: string | null = null;
  let inComment = false;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i] ?? '';
    const next = css[i + 1] ?? '';
    if (inComment) {
      // Preserve newlines so line numbers stay aligned with the original.
      out += ch === '\n' ? '\n' : ' ';
      if (ch === '*' && next === '/') {
        out += ' ';
        i += 1;
        inComment = false;
      }
      continue;
    }
    if (quote !== null) {
      out += ch === '\n' ? '\n' : ' ';
      if (ch === '\\') {
        out += ' ';
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 1;
      inComment = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
};

/**
 * Rule blocks whose selector targets the class — the base rule, any state
 * variants, and the copies nested inside `@media` blocks.
 *
 * Only the inner rule is returned for a media query, never the whole `@media`
 * wrapper: highlighting the wrapper would light up every unrelated element
 * that happens to share the breakpoint.
 */
export const findCssBlocks = (css: string, className: string): LineRange[] => {
  if (className.length === 0 || css.length === 0) return [];

  const masked = maskNonCode(css);

  const lineStarts = [0];
  for (let i = 0; i < masked.length; i += 1) {
    if (masked[i] === '\n') lineStarts.push(i + 1);
  }
  /** 1-based line containing `offset`. */
  const lineOf = (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((lineStarts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const ranges: LineRange[] = [];
  let depth = 0;
  // Where the current selector text begins: just past the last `{`, `}`,
  // or `;`. Tracking it by offset rather than per line is what makes a
  // multi-line selector list (`.a,\n.b {`) work.
  let selectorStart = 0;
  // Depth we were at when the matching block opened; null when not inside
  // one. Recording the depth is what stops a nested rule inside our own
  // block from closing it early.
  let openDepth: number | null = null;
  let startLine = 0;

  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === '{') {
      const selector = masked.slice(selectorStart, i);
      if (
        openDepth === null &&
        !selector.trim().startsWith('@') &&
        selectorTargets(selector, className)
      ) {
        const offsetInSelector = selector.search(/\S/);
        startLine = lineOf(selectorStart + Math.max(0, offsetInSelector));
        openDepth = depth;
      }
      depth += 1;
      selectorStart = i + 1;
    } else if (ch === '}') {
      depth -= 1;
      if (openDepth !== null && depth === openDepth) {
        ranges.push({ from: startLine, to: lineOf(i) });
        openDepth = null;
      }
      selectorStart = i + 1;
    } else if (ch === ';') {
      selectorStart = i + 1;
    }
  }

  return ranges;
};

/** First line to reveal, or null when the element isn't in this source. */
export const firstLine = (ranges: ReadonlyArray<LineRange>): number | null =>
  ranges.length === 0 ? null : (ranges[0]?.from ?? null);
