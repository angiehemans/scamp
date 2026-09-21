/**
 * The stream of edits a session has written.
 *
 * Phases 1 to 5 made a save produce edits rather than a file. That is
 * only worth the trouble if something can read them, which is what
 * this is: an ordered, bounded record of every patch Scamp wrote, each
 * with a revision, so a reader can ask "what has changed since I last
 * looked" and get an answer in the same units the save used.
 *
 * Two readers exist today — an agent, through `scamp_get_recent_edits`,
 * and anyone debugging a save — and the shape is chosen for a third
 * that does not: a multiplayer transport wants exactly this, a
 * monotonic revision plus the edits between two of them.
 *
 * see docs/plans/incremental-writes-plan.md, phase 6
 */
import { type TextEdit } from './textEdits';

/** One changed region, in lines, for a reader that thinks in lines. */
export type PatchHunk = {
  /** 1-based line in the file as it was before the patch. */
  line: number;
  /** Lines the patch removed there. */
  removed: number;
  /** Lines it put in their place. */
  added: number;
  /** The replacement text, so a reader needs nothing else. */
  text: string;
};

export type PatchFileChange = {
  file: 'tsx' | 'css';
  /** Project-relative: nothing here should carry a home directory. */
  path: string;
  hunks: PatchHunk[];
  /** The same change as offsets, for a consumer that applies it. */
  edits: TextEdit[];
};

export type PatchEntry = {
  /** Monotonic within a session, starting at 1. */
  revision: number;
  /** Epoch milliseconds. */
  at: number;
  /** The page, component, or view the save was for. */
  target: string;
  kind: 'page' | 'component';
  /** Only the files that actually changed. */
  files: PatchFileChange[];
};

export type PatchLog = {
  /** Records a patch and returns it with its revision. Ignores an empty one. */
  record: (entry: Omit<PatchEntry, 'revision'>) => PatchEntry | null;
  /** Everything after `revision`, oldest first. */
  since: (revision: number) => PatchEntry[];
  /** Everything still held, oldest first. */
  entries: () => PatchEntry[];
  /** The newest revision issued, or 0. */
  revision: () => number;
  /** Called with each patch as it is recorded. Returns an unsubscribe. */
  subscribe: (listener: (entry: PatchEntry) => void) => () => void;
  clear: () => void;
};

const lineOf = (text: string, offset: number): number => {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
};

const countLines = (text: string): number =>
  text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);

/** The line-numbered view of edits against the text they apply to. */
export const hunksFor = (base: string, edits: ReadonlyArray<TextEdit>): PatchHunk[] =>
  edits.map((edit) => ({
    line: lineOf(base, edit.start),
    removed: countLines(base.slice(edit.start, edit.end)),
    added: countLines(edit.replacement),
    text: edit.replacement,
  }));

export const createPatchLog = (limit: number = 100): PatchLog => {
  let entries: PatchEntry[] = [];
  let revision = 0;
  const listeners = new Set<(entry: PatchEntry) => void>();

  return {
    record: (entry) => {
      const files = entry.files.filter((f) => f.edits.length > 0);
      if (files.length === 0) return null;
      revision += 1;
      const recorded: PatchEntry = { ...entry, files, revision };
      entries.push(recorded);
      if (entries.length > limit) entries = entries.slice(entries.length - limit);
      for (const listener of listeners) {
        try {
          listener(recorded);
        } catch {
          // A subscriber that throws is not a reason to fail a save.
        }
      }
      return recorded;
    },
    since: (from) => entries.filter((e) => e.revision > from),
    entries: () => [...entries],
    revision: () => revision,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear: () => {
      entries = [];
    },
  };
};
