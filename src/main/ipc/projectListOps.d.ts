import type { RecentProject, ScannedProject, StartScreenProject } from '@shared/types';
/**
 * Merge the recent-opens store with a scan of the default projects
 * folder into the deduped, sorted list shown on the Start Screen.
 *
 * Scanned projects seed the list (all exist, no open history). Recents
 * overlay their `lastOpened` timestamp onto matching scanned entries and
 * contribute any projects outside the default folder (or since deleted)
 * that the scan didn't surface. Deduped by path.
 *
 * Pure — no disk access; existence is resolved by the caller and passed
 * in via `recents`.
 */
export declare const mergeProjectsForDisplay: (recents: ReadonlyArray<RecentProject & {
    exists: boolean;
}>, scanned: ReadonlyArray<ScannedProject>) => StartScreenProject[];
