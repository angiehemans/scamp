/**
 * Text edits: the unit a save will eventually write, instead of a whole
 * file. An edit replaces one region of a base text, addressed by
 * character offsets so the representation survives being sent somewhere
 * else (an agent, another client) rather than only being applied here.
 *
 * Phase 1 of docs/plans/incremental-writes-plan.md uses these in shadow:
 * the save still writes both files whole, and the edits derived
 * alongside it are checked and measured. Nothing here performs IO, and
 * nothing here knows what TSX or CSS are — a hunk is a hunk.
 */

/** A replacement of `base.slice(start, end)`. */
export type TextEdit = {
  /** Offset into the base text, inclusive. */
  start: number;
  /** Offset into the base text, exclusive. `start === end` inserts. */
  end: number;
  /** Replaces the addressed region. Empty deletes it. */
  replacement: string;
};

export type EditStats = {
  /** Disjoint regions the change touches. One is the goal for one design change. */
  hunks: number;
  /** Lines of the base the edits cover. */
  linesRemoved: number;
  /** Lines the replacements introduce. */
  linesAdded: number;
  /** Lines in the base, for scale. */
  baseLines: number;
};

/**
 * Split keeping each line's terminator, so joining reproduces the input
 * byte for byte and offsets stay meaningful. `''` splits to `['']`.
 */
const splitLines = (text: string): string[] => text.split(/(?<=\n)/);

const countLines = (text: string): number =>
  text.length === 0 ? 0 : splitLines(text).length;

/**
 * Matched line pairs between two line arrays, longest common
 * subsequence. The arrays are the middles left after trimming a common
 * prefix and suffix, so this stays small for the usual case of one
 * changed line in a long file.
 */
const matchLines = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): Array<[number, number]> => {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return [];
  // table[i][j] = LCS length of a[i..] and b[j..].
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const row = table[i];
      const nextRow = table[i + 1];
      if (row === undefined || nextRow === undefined) continue;
      row[j] =
        a[i] === b[j]
          ? (nextRow[j + 1] ?? 0) + 1
          : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
      continue;
    }
    const down = table[i + 1]?.[j] ?? 0;
    const right = table[i]?.[j + 1] ?? 0;
    if (down >= right) i += 1;
    else j += 1;
  }
  return pairs;
};

/**
 * The edits that turn `base` into `next`, one per changed region, in
 * ascending order and never overlapping. Equal texts produce none.
 *
 * Line-granular on purpose: a line is the smallest unit both a
 * generated file and a person's diff agree on, and a sub-line edit
 * would claim a precision the generator doesn't have.
 */
export const diffText = (base: string, next: string): TextEdit[] => {
  if (base === next) return [];
  const a = splitLines(base);
  const b = splitLines(next);

  // Offsets of each line start in the base, plus a terminator entry so
  // `offsets[a.length]` is the end of the text.
  const offsets: number[] = new Array<number>(a.length + 1);
  let at = 0;
  for (let i = 0; i < a.length; i += 1) {
    offsets[i] = at;
    at += (a[i] ?? '').length;
  }
  offsets[a.length] = at;
  const offsetOf = (line: number): number => offsets[line] ?? at;

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const midA = a.slice(prefix, a.length - suffix);
  const midB = b.slice(prefix, b.length - suffix);
  const matches = matchLines(midA, midB);

  const edits: TextEdit[] = [];
  // Walk the matched pairs; everything between two consecutive matches
  // (and before the first, and after the last) is one hunk.
  let cursorA = 0;
  let cursorB = 0;
  const flush = (untilA: number, untilB: number): void => {
    if (untilA === cursorA && untilB === cursorB) return;
    edits.push({
      start: offsetOf(prefix + cursorA),
      end: offsetOf(prefix + untilA),
      replacement: midB.slice(cursorB, untilB).join(''),
    });
  };
  for (const [ia, ib] of matches) {
    flush(ia, ib);
    cursorA = ia + 1;
    cursorB = ib + 1;
  }
  flush(midA.length, midB.length);
  return edits;
};

/**
 * Apply edits to the text they were derived from. Strict: the edits
 * must be in ascending order, must not overlap, and must sit inside the
 * text. A violation is a bug in whatever produced them, and the merge
 * this becomes in a later phase has to be able to trust the shape.
 */
export const applyEdits = (base: string, edits: ReadonlyArray<TextEdit>): string => {
  let out = '';
  let cursor = 0;
  for (const edit of edits) {
    if (edit.start < cursor) {
      throw new Error(`Text edits overlap or are unsorted at offset ${edit.start}.`);
    }
    if (edit.end < edit.start || edit.end > base.length) {
      throw new Error(`Text edit [${edit.start}, ${edit.end}) is outside the text.`);
    }
    out += base.slice(cursor, edit.start) + edit.replacement;
    cursor = edit.end;
  }
  return out + base.slice(cursor);
};

/** How surgical a change is, for the shadow report. */
export const editStats = (base: string, edits: ReadonlyArray<TextEdit>): EditStats => ({
  hunks: edits.length,
  linesRemoved: edits.reduce((n, e) => n + countLines(base.slice(e.start, e.end)), 0),
  linesAdded: edits.reduce((n, e) => n + countLines(e.replacement), 0),
  baseLines: countLines(base),
});
