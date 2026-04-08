/**
 * Lightweight basename helper for the renderer. Avoids importing Node's
 * `path` module from the renderer, which has no business reading the
 * filesystem (CLAUDE.md rule).
 */
export const basename = (p: string): string => {
  const parts = p.split(/[/\\]/).filter((segment) => segment.length > 0);
  return parts[parts.length - 1] ?? p;
};
