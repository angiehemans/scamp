/**
 * DESIGN.md lives in the project ROOT (next to agent.md / CLAUDE.md),
 * regardless of project format — it documents the whole project's design
 * system. The renderer generates the content (it holds the tokens); the
 * main process just does the file I/O. see docs/plans/design-system-plan.md
 */
export declare const designMdPathFor: (projectPath: string) => string;
/** Read DESIGN.md, or '' if it doesn't exist yet. */
export declare const readDesignMdFile: (projectPath: string) => Promise<string>;
/** Write DESIGN.md, replacing its entire content. */
export declare const writeDesignMdFile: (projectPath: string, content: string) => Promise<void>;
