import { promises as fs } from 'fs';

/**
 * Pure optimistic-concurrency check for `file:write`. Returns
 * `null` when the write should proceed; a `{actualTsxContent,
 * actualCssContent}` payload when disk has drifted from
 * `expected*`. The handler in `file.ts` wraps this with pending-
 * write registration + the atomic write itself.
 *
 * Both `expected*` must be defined to engage the check. Callers
 * that don't care (export, scaffolds, migrate) pass them as
 * undefined; this short-circuits to `null` immediately.
 *
 * see docs/notes/agent-coexistence.md — concurrent-write race.
 */

/** Read a path that may not exist; missing → empty string. */
const readIfExists = async (path: string): Promise<string> => {
  try {
    return await fs.readFile(path, 'utf-8');
  } catch {
    return '';
  }
};

export const checkWriteConflict = async (args: {
  tsxPath: string;
  cssPath: string;
  expectedTsxContent?: string;
  expectedCssContent?: string;
}): Promise<{ actualTsxContent: string; actualCssContent: string } | null> => {
  if (
    args.expectedTsxContent === undefined ||
    args.expectedCssContent === undefined
  ) {
    return null;
  }
  const [actualTsxContent, actualCssContent] = await Promise.all([
    readIfExists(args.tsxPath),
    readIfExists(args.cssPath),
  ]);
  if (
    actualTsxContent === args.expectedTsxContent &&
    actualCssContent === args.expectedCssContent
  ) {
    return null;
  }
  return { actualTsxContent, actualCssContent };
};
