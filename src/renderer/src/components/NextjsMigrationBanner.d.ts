import type { ProjectData } from '@shared/types';
type Props = {
    project: ProjectData;
    onMigrated: (next: ProjectData) => void;
    onDismiss: () => void;
};
/**
 * Shown above the canvas on legacy-format projects. Offers an opt-in
 * one-click migration to the Next.js App Router layout. Dismissal is
 * persisted per-project (in `scamp.config.json`) by the parent so the
 * banner stays out of the way for users who don't want to migrate.
 */
export declare const NextjsMigrationBanner: ({ project, onMigrated, onDismiss, }: Props) => JSX.Element;
export {};
