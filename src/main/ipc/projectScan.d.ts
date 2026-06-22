import type { ScannedProject } from '@shared/types';
/**
 * Does this folder look like a Scamp project? A folder qualifies if it
 * has any of:
 *   - `scamp.config.json` (written for every project Scamp opens/creates)
 *   - `app/page.tsx`       (nextjs layout)
 *   - any `*.tsx` at the root (legacy layout)
 *
 * This is stricter than `detectProjectFormat`, which defaults *any*
 * folder to `nextjs` — we must not list arbitrary subfolders as
 * projects. Case-sensitivity isn't a factor here: every check is for a
 * known lowercase filename, so the same string compares the same way on
 * APFS and Linux.
 */
export declare const isScampProjectDir: (folderPath: string) => Promise<boolean>;
/**
 * Scan a folder one level deep for Scamp projects. Each immediate
 * subdirectory that looks like a project is returned with its
 * freshly-detected format. Best-effort: an unreadable root yields `[]`
 * and an unreadable / non-project subdir is skipped.
 */
export declare const scanProjectsInFolder: (folder: string) => Promise<ScannedProject[]>;
