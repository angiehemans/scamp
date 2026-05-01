import type { ProjectFormat } from '@shared/types';
/**
 * Detect a project's on-disk format by inspecting its layout. Re-run
 * on every open so users who hand-convert a project are reflected
 * correctly without a forced cache invalidation.
 *
 *   1. `<root>/app/page.tsx` exists  → nextjs
 *   2. any `*.tsx` at project root   → legacy
 *   3. otherwise                     → nextjs (treat as new/empty)
 *
 * Lives in its own file (no electron imports) so the test suite can
 * exercise it without dragging the electron module into vitest's node
 * environment. Kept in `src/main/ipc/` because it is a main-process
 * concern — the renderer never calls it directly.
 */
export declare const detectProjectFormat: (folderPath: string) => Promise<ProjectFormat>;
