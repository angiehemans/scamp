import { type PatchEntry } from '@lib/patchLog';
/**
 * The session's patch stream: every save, as the edits it wrote.
 *
 * Phase 6 of docs/plans/incremental-writes-plan.md. The earlier phases
 * made a save produce edits instead of a file; this is where they go,
 * so something other than the file system can read them. An agent asks
 * through `scamp_get_recent_edits`, devtools asks through
 * `__scampPatches()`, and a transport that does not exist yet can
 * `patchLog.subscribe`.
 *
 * What is recorded is the net effect on disk — the difference between
 * what was there and what the save wrote — not whichever internal path
 * produced it. A reader should not have to know whether a change went
 * through the element, region, or whole-file route.
 */
export declare const patchLog: import("@lib/patchLog").PatchLog;
export type PatchedFile = {
    file: 'tsx' | 'css';
    /** Absolute; made project-relative before it is recorded. */
    path: string;
    /** What was on disk. Null before the first save of a target. */
    base: string | null;
    /** What the save wrote. */
    next: string;
};
/**
 * Record one save. Never throws: this runs on the save path, and a
 * flaw in the stream must not cost the user a write.
 */
export declare const recordPatch: (target: {
    name: string;
    kind: "page" | "component";
}, projectPath: string, files: ReadonlyArray<PatchedFile>) => PatchEntry | null;
