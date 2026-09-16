import type { ProjectData } from '@shared/types';
type Props = {
    project: ProjectData;
    /** Converts every plain page to a view; the main process needs wrappers only. */
    convertPages: () => Promise<ProjectData>;
    onMigrated: (next: ProjectData) => void;
    onDismiss: () => void;
};
/**
 * A section of the properties panel on Next.js-format projects, offering
 * the one-click move to the Scamp framework structure: a snapshot, every
 * page converted to a view, then the main process turns wrappers into
 * routes and swaps the Next.js files for the framework's. Dismissal is
 * persisted per project by the parent.
 *
 * A section rather than a banner across the top: the offer is optional
 * and open-ended, and a persistent bar costs every project that hasn't
 * taken it a strip of canvas. see docs/notes/nextjs-sunset.md
 */
export declare const ScampMigrationNotice: ({ project, convertPages, onMigrated, onDismiss, }: Props) => JSX.Element;
export {};
