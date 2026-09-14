import type { ProjectData } from '@shared/types';
type Props = {
    project: ProjectData;
    /** Converts every plain page to a view; the main process needs wrappers only. */
    convertPages: () => Promise<ProjectData>;
    onMigrated: (next: ProjectData) => void;
    onDismiss: () => void;
};
/**
 * Shown above the canvas on Next.js-format projects. Offers the
 * one-click move to the Scamp framework structure: a snapshot, every
 * page converted to a view, then the main process turns wrappers into
 * routes and swaps the Next.js files for the framework's. Dismissal is
 * persisted per project by the parent. see docs/notes/nextjs-sunset.md
 */
export declare const ScampMigrationBanner: ({ project, convertPages, onMigrated, onDismiss, }: Props) => JSX.Element;
export {};
