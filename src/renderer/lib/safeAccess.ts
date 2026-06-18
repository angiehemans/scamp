/**
 * Helpers for reads the type system can't prove safe but the caller
 * already has. The project runs with `noUncheckedIndexedAccess`, so
 * indexed access into arrays and regex matches is typed `T | undefined`
 * even after a length check or a successful `.match()`. These replace
 * `arr[i]!` / `match[1]!` non-null assertions (forbidden by CLAUDE.md)
 * with an explicit guard that throws a clear message if the invariant
 * the caller relied on is ever violated.
 */

/**
 * Read a required capture group from a successful regex match. A
 * non-optional group is always present once the pattern matched, so a
 * missing one means the regex and its consumer drifted apart — a
 * programmer error, surfaced loudly rather than silently coerced.
 */
export const requireGroup = (match: RegExpMatchArray, index: number): string => {
  const value = match[index];
  if (value === undefined) {
    throw new Error(
      `Expected regex capture group ${index} in match "${match[0]}"`
    );
  }
  return value;
};

/**
 * Read an array element the caller has already proven in-bounds via a
 * length or bounds check the type system can't see. Throws if the index
 * is actually out of range. Not for arrays whose element type legitimately
 * includes `undefined` — there the throw can't distinguish a present
 * `undefined` from a missing slot.
 */
export const requireAt = <T>(array: readonly T[], index: number): T => {
  const value = array[index];
  if (value === undefined) {
    throw new Error(
      `Index ${index} out of bounds (length ${array.length})`
    );
  }
  return value;
};
