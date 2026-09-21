import { createPatchLog, hunksFor, type PatchEntry } from '@lib/patchLog';
import { diffText } from '@lib/textEdits';

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

export const patchLog = createPatchLog();

export type PatchedFile = {
  file: 'tsx' | 'css';
  /** Absolute; made project-relative before it is recorded. */
  path: string;
  /** What was on disk. Null before the first save of a target. */
  base: string | null;
  /** What the save wrote. */
  next: string;
};

const relativeTo = (projectPath: string, absolute: string): string => {
  const root = projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const path = absolute.replace(/\\/g, '/');
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
};

/**
 * Record one save. Never throws: this runs on the save path, and a
 * flaw in the stream must not cost the user a write.
 */
export const recordPatch = (
  target: { name: string; kind: 'page' | 'component' },
  projectPath: string,
  files: ReadonlyArray<PatchedFile>
): PatchEntry | null => {
  try {
    const changed = files.flatMap((file) => {
      if (file.base === null) return [];
      const edits = diffText(file.base, file.next);
      if (edits.length === 0) return [];
      return [
        {
          file: file.file,
          path: relativeTo(projectPath, file.path),
          hunks: hunksFor(file.base, edits),
          edits,
        },
      ];
    });
    if (changed.length === 0) return null;
    return patchLog.record({
      at: Date.now(),
      target: target.name,
      kind: target.kind,
      files: changed,
    });
  } catch (err) {
    console.error('[patchStream] recording the patch failed:', err);
    return null;
  }
};

// Read-only devtools hook, in the shape `__scampShadowEdits` established.
try {
  (
    globalThis as { __scampPatches?: (since?: number) => PatchEntry[] }
  ).__scampPatches = (since = 0) => patchLog.since(since);
} catch {
  // A frozen global is not worth failing a save over.
}
