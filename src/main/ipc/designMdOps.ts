import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * DESIGN.md lives in the project ROOT (next to agent.md / CLAUDE.md),
 * regardless of project format — it documents the whole project's design
 * system. The renderer generates the content (it holds the tokens); the
 * main process just does the file I/O. see docs/plans/design-system-plan.md
 */
export const designMdPathFor = (projectPath: string): string =>
  join(projectPath, 'DESIGN.md');

/** Read DESIGN.md, or '' if it doesn't exist yet. */
export const readDesignMdFile = async (projectPath: string): Promise<string> => {
  try {
    return await fs.readFile(designMdPathFor(projectPath), 'utf-8');
  } catch {
    return '';
  }
};

/** Write DESIGN.md, replacing its entire content. */
export const writeDesignMdFile = async (
  projectPath: string,
  content: string
): Promise<void> => {
  await fs.writeFile(designMdPathFor(projectPath), content, 'utf-8');
};
