/**
 * Character-level scanning helpers for the strict JSX the generator
 * emits. Shared by the named-slot and binding pre-passes in parseCode.
 * None of this is a JSX parser: it only balances braces, parens, and
 * string literals well enough to find where an expression or an opening
 * tag ends.
 */

/**
 * From `openIdx` (pointing at `{`), the index of the matching `}`,
 * balancing nested braces and ignoring braces inside string literals.
 * -1 when unbalanced.
 */
export const findMatchingBrace = (s: string, openIdx: number): number => {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx; i < s.length; i += 1) {
    const c = s[i];
    if (quote !== null) {
      if (c === quote && s[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

/**
 * From `tagOpen` (at `<`), the index of the `>` that closes the OPENING
 * tag, skipping braces/strings so JSX-valued props don't confuse it.
 * -1 when not found.
 */
export const findOpeningTagClose = (s: string, tagOpen: number): number => {
  let i = tagOpen + 1;
  let quote: string | null = null;
  let brace = 0;
  while (i < s.length) {
    const c = s[i];
    if (quote !== null) {
      if (c === quote && s[i - 1] !== '\\') quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') brace += 1;
    else if (c === '}') brace -= 1;
    else if (brace === 0 && c === '>') return i;
    i += 1;
  }
  return -1;
};

/**
 * Split `s` on top-level commas — commas not inside braces, brackets,
 * parens, or string literals. Empty trailing segments are dropped.
 */
export const splitTopLevel = (s: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quote !== null) {
      if (c === quote && s[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') depth += 1;
    else if (c === '}' || c === ']' || c === ')') depth -= 1;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  const tail = s.slice(start);
  if (tail.trim().length > 0) out.push(tail);
  return out;
};
