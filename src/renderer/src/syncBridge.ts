import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { parseThemeFile } from '@lib/parseTheme';
import { applyThemeFonts } from './lib/applyThemeFonts';
import { externalEditTracker } from './lib/externalEditTracker';
import { createQuietWindow } from './lib/quietWindow';
import {
  selectAnyAgentActive,
  selectPauseReason,
  useTerminalActivityStore,
} from '@store/terminalActivitySlice';
import { captureAndPersistComponentThumbnail } from './lib/componentThumbnail';
import {
  useCanvasStore,
  type ActiveComponent,
  type ActivePage,
} from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import type { ProjectFormat } from '@shared/types';
import {
  useSaveStatusStore,
  type LastWriteAttempt,
} from '@store/saveStatusSlice';
import { useAppLogStore } from '@store/appLogSlice';
import type { KeyframesBlock, ScampElement } from '@lib/element';

const WRITE_DEBOUNCE_MS = 200;

/**
 * The CSS-module file basename `generateCode` should put in the TSX
 * import line for the given project format. Nextjs projects always
 * import `./page.module.css` (each page lives in its own folder); the
 * legacy flat layout imports `./<pageName>.module.css`.
 */
const cssModuleImportNameFor = (
  format: ProjectFormat,
  pageName: string
): string => (format === 'nextjs' ? 'page' : pageName);

/**
 * Unified shape for "the thing the canvas is currently editing".
 * Wraps either an active page or an active component so the
 * save / load / route-by-path code paths don't have to special-case
 * by kind every place. Each Phase 1+ feature that pivots on the
 * kind reads `target.kind` for branching.
 */
type EditTarget = {
  kind: 'page' | 'component';
  name: string;
  tsxPath: string;
  cssPath: string;
};

const toEditTarget = (
  page: ActivePage | null,
  component: ActiveComponent | null
): EditTarget | null => {
  // activeComponent takes precedence — `loadComponent` clears
  // `activePage` and vice versa, so this defensive ordering only
  // matters during the in-flight setState batch where both may
  // briefly be readable.
  if (component) {
    return {
      kind: 'component',
      name: component.name,
      tsxPath: component.tsxPath,
      cssPath: component.cssPath,
    };
  }
  if (page) {
    return {
      kind: 'page',
      name: page.name,
      tsxPath: page.tsxPath,
      cssPath: page.cssPath,
    };
  }
  return null;
};

/**
 * CSS-module import name for the active target. Pages route
 * through `cssModuleImportNameFor` (which depends on project
 * format); components always import their own
 * `./<ComponentName>.module.css` regardless of project format.
 */
const importNameForTarget = (
  target: EditTarget,
  format: ProjectFormat
): string => {
  if (target.kind === 'component') return target.name;
  return cssModuleImportNameFor(format, target.name);
};

/**
 * Safety net for the "save is confirmed" transition. The main-process
 * watcher already emits an ack on its own 400 ms expiry, so the bridge
 * should receive one event per write even on filesystems that skip
 * the chokidar stability event. This larger window only catches the
 * case where IPC itself fails to deliver the ack.
 */
const ACK_WATCHDOG_MS = 2000;

/**
 * Module-scoped handle to the active bridge's debounced-write flusher.
 * Populated by `initSyncBridge` on mount and cleared on teardown. Used
 * by operations that change the active page's on-disk identity
 * (e.g. page rename) and need to force pending edits to land on the
 * OLD paths before the swap, so the debounced timer can't fire against
 * files that have just been deleted.
 */
let pendingFlush: (() => void) | null = null;

export const flushPendingPageWrite = (): void => {
  pendingFlush?.();
};

/**
 * Phase 3 quiet window. Set on every chokidar event for a project
 * file; rolls forward on each subsequent event. While open,
 * `writeIfDirty` skips IPC dispatch and the bridge sits in a
 * `paused` save-status. The bridge schedules a single timer to fire
 * when the window expires, at which point it reconciles canvas
 * state against disk (resume → `saved` or `diverged`).
 */
const quietWindow = createQuietWindow();
let quietResumeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Module-scoped handle to the bridge's "resume from pause" action.
 * Populated by `initSyncBridge`. The save-status indicator's
 * `Resume now` button calls this; we expose it as a free function so
 * the indicator component doesn't have to import the whole bridge.
 */
let resumeFromPauseImpl: (() => void) | null = null;
let saveDivergedCanvasImpl: (() => void) | null = null;
let discardDivergedCanvasImpl: (() => void) | null = null;

export const resumeFromPause = (): void => {
  resumeFromPauseImpl?.();
};

/**
 * Phase 5.2 — force-write the canvas's current state to disk,
 * overwriting whatever the external editor wrote. Called from the
 * diverged-state popover's `Save canvas` button.
 */
export const saveDivergedCanvas = (): void => {
  saveDivergedCanvasImpl?.();
};

/**
 * Phase 5.2 — abandon the canvas's in-memory state and reload from
 * disk. Called from the diverged-state popover's `Discard canvas`
 * button.
 */
export const discardDivergedCanvas = (): void => {
  discardDivergedCanvasImpl?.();
};

// see docs/notes/components-sync.md — target-swap suppression
let suppressNextTargetSwapWrite = false;
let suppressTargetSwapTimer: ReturnType<typeof setTimeout> | null = null;
const SUPPRESS_TARGET_SWAP_TTL_MS = 5000;

export const armTargetSwapSuppression = (): void => {
  suppressNextTargetSwapWrite = true;
  if (suppressTargetSwapTimer !== null) clearTimeout(suppressTargetSwapTimer);
  suppressTargetSwapTimer = setTimeout(() => {
    suppressNextTargetSwapWrite = false;
    suppressTargetSwapTimer = null;
  }, SUPPRESS_TARGET_SWAP_TTL_MS);
};

export const disarmTargetSwapSuppression = (): void => {
  suppressNextTargetSwapWrite = false;
  if (suppressTargetSwapTimer !== null) {
    clearTimeout(suppressTargetSwapTimer);
    suppressTargetSwapTimer = null;
  }
};

/**
 * A write that has been dispatched but not yet fully confirmed. We
 * consider a write confirmed only when (a) the IPC promise resolves
 * AND (b) chokidar's stability event fires for every expected sibling
 * path. Tracking both prevents the indicator flashing green before the
 * OS actually settles on disk.
 */
type PendingSave = {
  attempt: LastWriteAttempt;
  ipcDone: boolean;
  acked: Set<string>;
  expected: Set<string>;
  watchdog: ReturnType<typeof setTimeout>;
};

const pendingSaves = new Map<string, PendingSave>();

/**
 * Acks that arrived before their `pendingSaves` entry could be
 * registered — chokidar's stability event can fire faster than the
 * IPC round-trip returns. Drained by the IPC `.then` callback when
 * the matching writeId finally registers.
 *
 * Each entry carries a self-expiry timer so background writes that
 * bypass the save-status pipeline (e.g. format-migration writes on
 * project open) don't leak their acks forever.
 */
type EarlyAck = {
  paths: Set<string>;
  timer: ReturnType<typeof setTimeout>;
};
const earlyAcks = new Map<string, EarlyAck>();
const EARLY_ACK_TTL_MS = 1000;

/**
 * The most recent dispatched attempt, regardless of current status.
 * `retryLastSave` uses this to re-issue after an error.
 */
let lastDispatchedAttempt: LastWriteAttempt | null = null;

/**
 * Throttle for the aborted-write toast. A burst of canvas events
 * (e.g. a drag in progress) can fire writeIfDirty many times in
 * rapid succession; we only want ONE toast per external-edit
 * window. After the throttle interval the next abort can show
 * another toast.
 */
let lastAbortToastAt = 0;
const ABORT_TOAST_THROTTLE_MS = 4000;

const notifyWriteAborted = (fileName: string): void => {
  const now = Date.now();
  if (now - lastAbortToastAt < ABORT_TOAST_THROTTLE_MS) return;
  lastAbortToastAt = now;
  useSaveStatusStore
    .getState()
    .showToast(
      `Your canvas change wasn't saved — ${fileName} was just edited externally.`
    );
};

const clearPending = (writeId: string): void => {
  const entry = pendingSaves.get(writeId);
  if (!entry) return;
  clearTimeout(entry.watchdog);
  pendingSaves.delete(writeId);
};

const maybeConfirm = (writeId: string): void => {
  const entry = pendingSaves.get(writeId);
  if (!entry) return;
  if (!entry.ipcDone) return;
  for (const path of entry.expected) {
    if (!entry.acked.has(path)) return;
  }
  clearPending(writeId);
  useSaveStatusStore.getState().markConfirmed();
};

const handleAck = (writeId: string, path: string): void => {
  const entry = pendingSaves.get(writeId);
  if (entry) {
    entry.acked.add(path);
    maybeConfirm(writeId);
    return;
  }
  // Ack arrived before dispatch's `.then` registered the pending save
  // (fast filesystems can race chokidar ahead of IPC resolution), OR
  // the write was never tracked at all (e.g. format-migration writes
  // on project open bypass the indicator). Buffer with a short TTL
  // so dispatches can drain, but stray acks don't leak.
  const existing = earlyAcks.get(writeId);
  if (existing) {
    existing.paths.add(path);
    return;
  }
  const timer = setTimeout(() => {
    earlyAcks.delete(writeId);
  }, EARLY_ACK_TTL_MS);
  earlyAcks.set(writeId, { paths: new Set<string>([path]), timer });
};

const reportError = (message: string, attempt: LastWriteAttempt): void => {
  useSaveStatusStore.getState().markError(message, attempt);
  useAppLogStore.getState().log('error', `Save failed: ${message}`);
};

/**
 * Record a just-dispatched write in the pending-saves map and check
 * whether it's already confirmable (acks that arrived before IPC
 * resolved land in `earlyAcks`).
 */
const registerPendingSave = (
  writeId: string,
  attempt: LastWriteAttempt,
  expected: Set<string>
): void => {
  const entry: PendingSave = {
    attempt,
    ipcDone: true,
    acked: new Set<string>(),
    expected,
    watchdog: setTimeout(() => {
      if (!pendingSaves.has(writeId)) return;
      clearPending(writeId);
      reportError('No confirmation from disk watcher', attempt);
    }, ACK_WATCHDOG_MS),
  };
  const buffered = earlyAcks.get(writeId);
  if (buffered) {
    clearTimeout(buffered.timer);
    for (const p of buffered.paths) entry.acked.add(p);
    earlyAcks.delete(writeId);
  }
  pendingSaves.set(writeId, entry);
  maybeConfirm(writeId);
};

/**
 * Dispatch a page write and wire its IPC result + ack correlation
 * into the save-status state machine. Both writeIfDirty (debounced)
 * and retryLastSave go through here so the tracking is consistent.
 */
/**
 * Conflict callback signature for `dispatchPageWrite`. Fires when
 * main's optimistic-concurrency check rejects the write because
 * disk has drifted since the renderer last synced. The argument
 * is the on-disk content at the moment of rejection — the caller
 * adopts it as the new "synced" state (parse + reloadElements
 * inside initSyncBridge's scope) so the canvas reflects the
 * external editor's view.
 */
type WriteConflictHandler = (conflict: {
  actualTsxContent: string;
  actualCssContent: string;
}) => void;

const dispatchPageWrite = (
  attempt: Extract<LastWriteAttempt, { kind: 'write' }>,
  onConflict?: WriteConflictHandler
): void => {
  useSaveStatusStore.getState().markSaving(attempt);
  lastDispatchedAttempt = attempt;

  const expected = new Set<string>([attempt.tsxPath, attempt.cssPath]);

  void window.scamp
    .writeFile({
      tsxPath: attempt.tsxPath,
      cssPath: attempt.cssPath,
      tsxContent: attempt.tsxContent,
      cssContent: attempt.cssContent,
      ...(attempt.expectedTsxContent !== undefined
        ? { expectedTsxContent: attempt.expectedTsxContent }
        : {}),
      ...(attempt.expectedCssContent !== undefined
        ? { expectedCssContent: attempt.expectedCssContent }
        : {}),
    })
    .then((result) => {
      if (result.ok) {
        registerPendingSave(result.writeId, attempt, expected);
        return;
      }
      // Conflict: an external editor wrote between our last sync
      // and this dispatch. Drop the pending save state and hand
      // the actual content off to the caller's resync handler.
      useSaveStatusStore.getState().markClean();
      onConflict?.(result.conflict);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      reportError(message, attempt);
    });
};

const dispatchPatchWrite = (
  attempt: Extract<LastWriteAttempt, { kind: 'patch' }>
): Promise<void> => {
  useSaveStatusStore.getState().markSaving(attempt);
  lastDispatchedAttempt = attempt;
  const expected = new Set<string>([attempt.cssPath]);

  return window.scamp
    .patchFile({
      cssPath: attempt.cssPath,
      className: attempt.className,
      newDeclarations: attempt.newDeclarations,
      ...(attempt.media ? { media: attempt.media } : {}),
    })
    .then(({ writeId }) => {
      registerPendingSave(writeId, attempt, expected);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      reportError(message, attempt);
      throw err;
    });
};

/**
 * Commit a CSS panel patch through the save-status pipeline. The
 * CssPanel previously called `window.scamp.patchFile` directly; routing
 * through here keeps the "Saving…" / "Saved" transitions consistent
 * between canvas-driven writes and panel edits.
 */
export const savePatch = async (attempt: {
  cssPath: string;
  className: string;
  newDeclarations: string;
  media?: { maxWidth: number };
}): Promise<void> => {
  await dispatchPatchWrite({ kind: 'patch', ...attempt });
};

/**
 * Re-dispatch the last attempted save. Invoked by the error-state
 * retry button on the save-status indicator.
 */
export const retryLastSave = (): void => {
  const attempt = lastDispatchedAttempt;
  if (!attempt) return;
  if (attempt.kind === 'write') {
    dispatchPageWrite(attempt);
  } else {
    void dispatchPatchWrite(attempt);
  }
};

/**
 * Wires the canvas store to the file system.
 *
 *   - On any canvas state change: regenerate code and write the page files
 *     after a 200ms debounce. The write is acked by the main process so
 *     chokidar won't re-read what we just wrote.
 *   - On `file:changed` for the active page: parse the new file content
 *     and reload the canvas — but only if the parsed tree differs from
 *     the current state, so external no-op changes don't cause flicker.
 *   - On `file:writeAck`: correlate against the pending-saves map and
 *     transition the save-status indicator to "Saved" once both IPC
 *     resolution and all expected path acks have landed.
 *   - When the canvas state is loaded from a parse result, the next
 *     subscribe tick refreshes a "last written" cache so the load doesn't
 *     immediately write itself back to disk.
 *
 * Pending-write durability:
 *   - When the active page changes, any pending debounced write is
 *     IMMEDIATELY flushed against the OUTGOING page's state before the
 *     timer is cleared. Without this, switching pages within 200ms of an
 *     edit would silently drop the edit because the timer would fire
 *     against the new page's state and write a no-op.
 *   - When the renderer is unloading (window close, full reload),
 *     `beforeunload` flushes any pending write the same way. The IPC
 *     message is queued for the main process to complete after the
 *     renderer is gone.
 */
export const initSyncBridge = (): (() => void) => {
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSerializedTsx: string | null = null;
  let lastSerializedCss: string | null = null;
  /**
   * Set when a canvas edit lands while the quiet window is open
   * (its `writeIfDirty` gets deferred). `reconcileAfterQuiet`
   * consults this to decide whether to flush the pending canvas
   * change after the window expires, or to leave disk alone (the
   * canvas state's regen differs from disk only because of
   * non-round-tripping user-typed CSS — clobbering disk would lose
   * the user's intent). Cleared on chokidar event (start of quiet
   * window) and after `reconcileAfterQuiet` runs.
   */
  let canvasChangedDuringQuiet = false;

  // Register the snapshot-restore callback so the history slice can
  // apply a saved elements map when the user navigates (undo /
  // redo / click an entry in the panel). The callback writes
  // through `setState` rather than the typed `reloadElements`
  // mutator so it doesn't toggle `isLoading` or push another
  // history entry — restoration is not an external edit.
  useHistoryStore.getState().setRestoreSnapshot((snapshot) => {
    useCanvasStore.setState({ elements: snapshot });
  });

  /**
   * Resync the canvas to a competing on-disk version when main
   * rejects our write with a conflict. See
   * docs/notes/agent-coexistence.md. Adopts the actual disk content as
   * the new synced state, parses + reloads elements so the canvas
   * reflects the external editor's view, and surfaces a one-line
   * app-log message so the user knows their pending edit was
   * dropped in favour of the external version.
   */
  /**
   * `silent: true` is set by the initial-load canonical migration —
   * see `writeIfDirty`'s `silent` option below. The reload still
   * happens (we adopt disk content), but we suppress the
   * `reloaded-from-disk` indicator and the "your in-flight edit was
   * dropped" app-log line, because the user had NO in-flight edit:
   * the write was Scamp's own format-canonicalisation, not a user
   * action. Showing the warning there frightens users when an agent
   * was racing the project open.
   */
  const onWriteConflict = (
    target: EditTarget,
    conflict: { actualTsxContent: string; actualCssContent: string },
    silent: boolean = false
  ): void => {
    const store = useCanvasStore.getState();
    // The write was kicked off against `target`, but the user may
    // have navigated away in the meantime. Reloading the store's
    // elements / pageSource for a stale target would clobber the
    // canvas with the wrong page's content (visible as "Page B's
    // breadcrumb with Page A's design"). Bail out without touching
    // the store — the abandoned target's disk state will reconcile
    // on the next visit via the initial-load path.
    const currentTarget = toEditTarget(store.activePage, store.activeComponent);
    if (
      !currentTarget ||
      currentTarget.tsxPath !== target.tsxPath ||
      currentTarget.cssPath !== target.cssPath
    ) {
      useAppLogStore
        .getState()
        .log(
          'warn',
          `Write conflict on ${target.name} arrived after navigation; skipping canvas reload.`
        );
      return;
    }
    lastSerializedTsx = conflict.actualTsxContent;
    lastSerializedCss = conflict.actualCssContent;
    store.setPageSource({
      tsx: conflict.actualTsxContent,
      css: conflict.actualCssContent,
    });
    try {
      const parsed = parseCode(
        conflict.actualTsxContent,
        conflict.actualCssContent,
        { breakpoints: store.breakpoints }
      );
      store.reloadElements(
        parsed.elements,
        { tsx: conflict.actualTsxContent, css: conflict.actualCssContent },
        parsed.customMediaBlocks,
        parsed.keyframesBlocks,
        parsed.cssDuplicates
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useAppLogStore
        .getState()
        .log(
          'warn',
          `External edit on ${target.name}.tsx couldn't be parsed: ${message}`
        );
      return;
    }
    // Phase 1.2: surface the conflict through the status indicator
    // rather than as a transient app-log message. `reloaded-from-disk`
    // is a terminal state — there's nothing to retry against — so
    // the indicator shows it until the next successful save cycle
    // (markSaving will transition out). The app-log line stays as a
    // secondary audit trail.
    //
    // Silent mode (initial-load canonical migration): adopt disk
    // content but transition straight back to `saved`. The user had
    // no in-flight edit — surfacing "Reloaded" here is misleading.
    if (silent) {
      useSaveStatusStore.setState({
        state: { kind: 'saved' },
        toast: null,
        dirtyDuringSave: false,
      });
      return;
    }
    useSaveStatusStore.getState().markReloadedFromDisk(target.name);
    useAppLogStore
      .getState()
      .log(
        'warn',
        `${target.name} was edited outside Scamp; reloaded to that version. Your in-flight edit was dropped.`
      );
  };

  /**
   * Generate code for the given (elements, rootId, page) tuple and write
   * it to disk if it differs from the last-written cache. Pure with
   * respect to its arguments — used by the debounced flush, the page-
   * switch flush, and the beforeunload flush, all of which need to
   * write a SPECIFIC snapshot rather than whatever the store currently
   * holds.
   *
   * `customMediaBlocks` and `pageKeyframesBlocks` are passed in (not
   * read from the store) because the page-switch flush fires AFTER
   * `loadPage(B)` has swapped the store's per-page CSS into B's
   * values. Reading from the store there would write A's elements
   * paired with B's `@media` / `@keyframes` to A's `.module.css` —
   * silent file corruption on every navigation between pages with
   * different custom CSS.
   */
  /**
   * `silent` is set by the canonical-migration call site (initial
   * load). It propagates through to `onWriteConflict` so a conflict
   * adopts disk without flashing the "Reloaded" indicator — the user
   * hasn't made an edit yet, so the standard conflict UX is wrong here.
   */
  const writeIfDirty = (
    elements: Record<string, ScampElement>,
    rootElementId: string,
    target: EditTarget,
    customMediaBlocks: ReadonlyArray<string>,
    pageKeyframesBlocks: ReadonlyArray<KeyframesBlock>,
    silent: boolean = false
  ): void => {
    // Phase 1.1: bail when chokidar is mid-event for this target.
    // `lastSerialized` is stale until the chokidar handler finishes
    // its reload; dispatching now would race the agent's edit. The
    // canvas state stays in memory — when the handler completes, the
    // user's next interaction triggers a fresh `writeIfDirty` with a
    // correct expected baseline.
    if (externalEditTracker.isPending(target.tsxPath, target.cssPath)) {
      useSaveStatusStore.getState().markPaused('external-edit');
      notifyWriteAborted(target.name);
      return;
    }
    // Phase 3.2: even outside the synchronous chokidar handler, if
    // we're inside the quiet window (an external edit landed in the
    // last QUIET_WINDOW_MS), defer the write. Agents typically write
    // the same file 2-5 times back-to-back; the window absorbs the
    // burst so we don't race the in-between writes.
    if (quietWindow.isQuiet()) {
      useSaveStatusStore.getState().markPaused('external-edit');
      // Don't toast here — the toast was already shown when the
      // window opened or when a write was aborted at the start of
      // the burst. Subsequent aborts inside the same window are silent.
      return;
    }
    // Phase 4.3: pause when an agent is running. Either auto-detected
    // (a non-shell foreground process in any integrated terminal) OR
    // user-engaged (manual pause toggle). The reason carries through
    // so the indicator popover shows the right copy.
    {
      const activity = useTerminalActivityStore.getState();
      if (selectAnyAgentActive(activity)) {
        const reason = selectPauseReason(activity) ?? 'agent-terminal';
        useSaveStatusStore.getState().markPaused(reason);
        return;
      }
    }
    const store = useCanvasStore.getState();
    const code = generateCode({
      elements,
      rootId: rootElementId,
      // generateCode uses `pageName` for the function name AND the
      // CSS-module import basename. For components the name IS the
      // PascalCase component name, which generateCode passes through
      // unchanged — both halves come out right.
      pageName: target.name,
      breakpoints: store.breakpoints,
      customMediaBlocks,
      pageKeyframesBlocks,
      cssModuleImportName: importNameForTarget(target, store.projectFormat),
      isComponent: target.kind === 'component',
    });
    if (code.tsx === lastSerializedTsx && code.css === lastSerializedCss) {
      // No-op dedupe: the debounce fired but the generated code matches
      // what's already on disk. Advance the indicator out of "unsaved"
      // anyway so idle canvases don't get stuck showing pending work.
      useSaveStatusStore.getState().markClean();
      return;
    }
    // Capture the OLD lastSerialized for the conflict check —
    // that's what we believe is currently on disk. Then advance to
    // the new content so subsequent dedupes work.
    const expectedTsx = lastSerializedTsx;
    const expectedCss = lastSerializedCss;
    lastSerializedTsx = code.tsx;
    lastSerializedCss = code.css;
    // Mirror the just-written content into the store so the bottom code
    // panel reflects what's on disk without waiting for chokidar.
    useCanvasStore.getState().setPageSource({ tsx: code.tsx, css: code.css });
    dispatchPageWrite(
      {
        kind: 'write',
        tsxPath: target.tsxPath,
        cssPath: target.cssPath,
        tsxContent: code.tsx,
        cssContent: code.css,
        ...(expectedTsx !== null && expectedCss !== null
          ? {
              expectedTsxContent: expectedTsx,
              expectedCssContent: expectedCss,
            }
          : {}),
      },
      (conflict) => onWriteConflict(target, conflict, silent)
    );
    // Sidebar thumbnail capture for component saves.
    // see docs/notes/components-thumbnails.md
    if (target.kind === 'component') {
      const projectPath = store.projectPath;
      if (projectPath) {
        // rAF so React commits the latest paint before we rasterise.
        requestAnimationFrame(() => {
          captureAndPersistComponentThumbnail({
            projectPath,
            componentName: target.name,
          });
        });
      }
    }
  };

  /** Flush a queued debounced write against the CURRENT store state. */
  const flushDebouncedWrite = (): void => {
    const state = useCanvasStore.getState();
    const target = toEditTarget(state.activePage, state.activeComponent);
    if (!target) return;
    writeIfDirty(
      state.elements,
      state.rootElementId,
      target,
      state.pageCustomMediaBlocks,
      state.pageKeyframesBlocks
    );
  };

  pendingFlush = (): void => {
    cancelWriteTimer();
    flushDebouncedWrite();
  };

  const cancelWriteTimer = (): void => {
    if (writeTimer !== null) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
  };

  /**
   * After the quiet window expires, decide whether the canvas
   * matches disk (resume cleanly → `saved`) or diverges (user
   * picks Save canvas / Discard canvas → `diverged`).
   *
   * The divergence attempt has NO `expected*` field — Save canvas
   * means "force overwrite," intentionally bypassing the conflict
   * check the user already saw with `markReloadedFromDisk`. The
   * intent of clicking Save is "I know there's an external edit,
   * I want mine to win." Saying yes to the user's explicit choice
   * is preferable to deferring to disk a second time.
   */
  const reconcileAfterQuiet = (): void => {
    // Decision #3: don't resume while the OTHER signal still says
    // pause. If the user clicks `Resume now` we'll still bypass this
    // (resumeFromPauseImpl clears the quiet window and we land here;
    // but the agent flag is checked separately and the user's
    // explicit override should win even mid-burst).
    {
      const activity = useTerminalActivityStore.getState();
      if (selectAnyAgentActive(activity)) {
        // Refresh the indicator's reason — quiet may have expired
        // but an agent (auto or manual) is still keeping us paused.
        const reason = selectPauseReason(activity) ?? 'agent-terminal';
        useSaveStatusStore.getState().markPaused(reason);
        return;
      }
    }
    const state = useCanvasStore.getState();
    const target = toEditTarget(state.activePage, state.activeComponent);
    if (!target) {
      useSaveStatusStore.getState().markResumed(null);
      return;
    }
    const code = generateCode({
      elements: state.elements,
      rootId: state.rootElementId,
      pageName: target.name,
      breakpoints: state.breakpoints,
      customMediaBlocks: state.pageCustomMediaBlocks,
      pageKeyframesBlocks: state.pageKeyframesBlocks,
      cssModuleImportName: importNameForTarget(target, state.projectFormat),
      isComponent: target.kind === 'component',
    });
    if (
      code.tsx === lastSerializedTsx &&
      code.css === lastSerializedCss
    ) {
      useSaveStatusStore.getState().markResumed(null);
      return;
    }
    // Canvas state differs from what's on disk. Two interpretations:
    //
    //   (a) The user made a canvas edit during the quiet window —
    //       it was deferred by `writeIfDirty`'s quietWindow guard
    //       and is now waiting to be flushed.
    //   (b) The user typed CSS directly into the file (or via the
    //       raw-CSS panel) that doesn't round-trip cleanly through
    //       Scamp's typed model (e.g. `letter-spacing` on a rect —
    //       parseCode stores it on the element, generateCode drops
    //       it because the typed emitter is text-only). Canvas
    //       state regenerates to a different string than what's on
    //       disk, but the on-disk version is the user's intent.
    //
    // We tell these apart by remembering whether `state.elements`
    // changed during the quiet window. If yes (a) → flush.
    // If no (b) → leave disk alone, just resume.
    if (canvasChangedDuringQuiet) {
      flushDebouncedWrite();
    }
    canvasChangedDuringQuiet = false;
    useSaveStatusStore.getState().markResumed(null);
  };

  /**
   * Schedule the resume check to fire when the quiet window expires.
   * If a fresh chokidar event extends the window before the timer
   * fires, the timer (re-)schedules itself rather than reconciling
   * mid-burst. Idempotent — re-calling cancels any prior timer.
   */
  const scheduleQuietResume = (): void => {
    if (quietResumeTimer !== null) {
      clearTimeout(quietResumeTimer);
      quietResumeTimer = null;
    }
    const remaining = quietWindow.remainingMs();
    if (remaining === 0) {
      reconcileAfterQuiet();
      return;
    }
    // +50ms grace so the timer fires AFTER the window expires,
    // not exactly on it. Avoids a tight loop on slow event loops.
    quietResumeTimer = setTimeout(() => {
      quietResumeTimer = null;
      if (quietWindow.isQuiet()) {
        // Extended in flight; re-schedule for the new deadline.
        scheduleQuietResume();
        return;
      }
      reconcileAfterQuiet();
    }, remaining + 50);
  };

  // Phase 3.3: expose the resume action via the module-scoped
  // setter so the indicator's `Resume now` button can call it.
  resumeFromPauseImpl = (): void => {
    quietWindow.clear();
    if (quietResumeTimer !== null) {
      clearTimeout(quietResumeTimer);
      quietResumeTimer = null;
    }
    reconcileAfterQuiet();
  };

  /**
   * Phase 5.2 — apply the pending diverged attempt to disk, force-
   * overwriting whatever the external editor wrote. The attempt was
   * captured in `reconcileAfterQuiet` from the canvas's state at
   * window expiry; the canvas may have had MORE edits since then.
   * Re-generate from current state so the save reflects everything
   * the user has done.
   */
  saveDivergedCanvasImpl = (): void => {
    const state = useCanvasStore.getState();
    const target = toEditTarget(state.activePage, state.activeComponent);
    if (!target) return;
    const code = generateCode({
      elements: state.elements,
      rootId: state.rootElementId,
      pageName: target.name,
      breakpoints: state.breakpoints,
      customMediaBlocks: state.pageCustomMediaBlocks,
      pageKeyframesBlocks: state.pageKeyframesBlocks,
      cssModuleImportName: importNameForTarget(target, state.projectFormat),
      isComponent: target.kind === 'component',
    });
    lastSerializedTsx = code.tsx;
    lastSerializedCss = code.css;
    state.setPageSource({ tsx: code.tsx, css: code.css });
    // Force-overwrite: no expectedTsxContent. The user has
    // explicitly chosen canvas wins.
    dispatchPageWrite({
      kind: 'write',
      tsxPath: target.tsxPath,
      cssPath: target.cssPath,
      tsxContent: code.tsx,
      cssContent: code.css,
    });
  };

  /**
   * Phase 5.2 — abandon canvas state and reload from disk. Uses the
   * same path as `onWriteConflict` so the reload feels identical to
   * any other "external edit won" outcome.
   */
  discardDivergedCanvasImpl = (): void => {
    const state = useCanvasStore.getState();
    const target = toEditTarget(state.activePage, state.activeComponent);
    if (!target) {
      useSaveStatusStore.getState().markResumed(null);
      return;
    }
    // Read disk synchronously via the renderer-side `pageSource` —
    // it was kept in sync by the chokidar handler at line 893. The
    // user is choosing to abandon canvas state, so re-parsing that
    // disk content into elements is the right "discard" semantic.
    const onDisk = state.pageSource;
    if (!onDisk) {
      useSaveStatusStore.getState().markResumed(null);
      return;
    }
    try {
      const parsed = parseCode(onDisk.tsx, onDisk.css, {
        breakpoints: state.breakpoints,
      });
      state.reloadElements(
        parsed.elements,
        onDisk,
        parsed.customMediaBlocks,
        parsed.keyframesBlocks,
        parsed.cssDuplicates
      );
      lastSerializedTsx = onDisk.tsx;
      lastSerializedCss = onDisk.css;
      useSaveStatusStore.setState({
        state: { kind: 'saved' },
        toast: null,
        dirtyDuringSave: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useAppLogStore
        .getState()
        .log('warn', `Could not discard canvas (parse failed): ${message}`);
    }
  };

  /**
   * Phase 4.3 — subscribe to the terminal activity slice so the
   * sync engine reacts immediately when an agent appears or finishes
   * in any of Scamp's integrated terminals. Two transitions matter:
   *
   *   - idle → busy: cancel the debounce timer, transition status
   *     to `paused('agent-terminal')`. We pause PROACTIVELY here so
   *     the first canvas write the user attempts won't race the
   *     agent's first write.
   *   - busy → idle: if the quiet window is also clear, reconcile
   *     immediately. Otherwise the quiet-window timer will pick it
   *     up when IT expires (decision: stay paused until BOTH signals
   *     clear; see agent-coexistence-plan.md decision #3).
   */
  let prevAgentActive = selectAnyAgentActive(
    useTerminalActivityStore.getState()
  );
  const unsubAgent = useTerminalActivityStore.subscribe((s) => {
    const nextAgentActive = selectAnyAgentActive(s);
    if (nextAgentActive === prevAgentActive) return;
    prevAgentActive = nextAgentActive;
    if (nextAgentActive) {
      cancelWriteTimer();
      const reason = selectPauseReason(s) ?? 'agent-terminal';
      useSaveStatusStore.getState().markPaused(reason);
      return;
    }
    // Agent just went idle. If the chokidar quiet window is also
    // closed, reconcile now. If not, leave the existing quiet-resume
    // timer to do the reconcile when its window expires.
    if (!quietWindow.isQuiet()) {
      reconcileAfterQuiet();
    }
  });

  const unsubStore = useCanvasStore.subscribe((state, prev) => {
    try {
      // Detect target change against the STABLE underlying refs.
      // `toEditTarget` returns a fresh object each call, so
      // comparing its return values directly would always trip
      // "target changed" and tank performance — every Zustand
      // mutation (selection, hover, etc.) would flush, regen,
      // and re-arm the debounce timer.
      const targetChanged =
        state.activePage !== prev.activePage ||
        state.activeComponent !== prev.activeComponent;
      const currentTarget = toEditTarget(
        state.activePage,
        state.activeComponent
      );

      // Target swap — flush outgoing, then transition.
      // see docs/notes/components-sync.md
      if (targetChanged) {
        cancelWriteTimer();
        const consumeSuppress = suppressNextTargetSwapWrite;
        suppressNextTargetSwapWrite = false;
        if (suppressTargetSwapTimer !== null) {
          clearTimeout(suppressTargetSwapTimer);
          suppressTargetSwapTimer = null;
        }
        const prevTarget = toEditTarget(
          prev.activePage,
          prev.activeComponent
        );
        if (prevTarget && !consumeSuppress) {
          // Pass the OUTGOING page's per-page CSS — loadPage() has
          // already swapped the store's pageCustomMediaBlocks /
          // pageKeyframesBlocks to the incoming page's values, so
          // reading from the store here would write A's elements
          // paired with B's @media / @keyframes to A's file.
          writeIfDirty(
            prev.elements,
            prev.rootElementId,
            prevTarget,
            prev.pageCustomMediaBlocks,
            prev.pageKeyframesBlocks
          );
        }
        lastSerializedTsx = null;
        lastSerializedCss = null;
      }

      // Nothing relevant changed.
      if (state.elements === prev.elements && !targetChanged) {
        return;
      }

      if (!currentTarget) return;

      // The change came from a load — refresh the write cache. For
      // initial page loads (`'initial'`), if the re-generated code
      // differs from what's on disk (e.g. old-format data-scamp-id,
      // `<div></div>` vs `<div />`), write the canonical version back
      // to migrate the file to the current format.
      //
      // For external edits (`'external'`, fired from chokidar when an
      // agent / hand edit landed on disk), we NEVER auto-write back.
      // Even when generateCode would produce something slightly
      // different — declaration ordering, whitespace, comments —
      // the agent's content is the source of truth on disk. Auto-
      // writing here would clobber agent-written formatting and
      // preserved customProperties values, which is the bug Track C
      // exists to fix. The next user-driven canvas edit will write a
      // canonical version on its own debounce cycle.
      if (state.isLoading) {
        const onDisk = state.pageSource;
        const isExternal = state.lastLoadKind === 'external';
        // Anchor `lastSerialized` to whatever is ACTUALLY on disk,
        // regardless of load kind. The previous behaviour optimistically
        // pinned it to the regenerated `code.tsx` before the
        // format-migration write landed — so if the user edited the
        // canvas and navigated away while that write was still in
        // flight, the follow-up flush would dispatch with
        // `expectedTsxContent = code.tsx` while disk still held
        // `onDisk.tsx`. The conflict path then ran for a no-longer-
        // active target and dropped the edit.
        if (onDisk) {
          lastSerializedTsx = onDisk.tsx;
          lastSerializedCss = onDisk.css;
        } else {
          lastSerializedTsx = null;
          lastSerializedCss = null;
        }
        // Initial loads: if the parsed-and-regenerated form differs
        // from disk (legacy format, whitespace drift, etc.), dispatch
        // a canonical write through the tracked path. `writeIfDirty`
        // will diff the code against `lastSerialized` (set above to
        // `onDisk`), capture the right expected baseline, and update
        // `lastSerialized` to the new content via the normal flow.
        //
        // External edits skip this entirely — the agent's content on
        // disk is the source of truth and round-tripping through
        // generateCode could clobber preserved formatting / customProps.
        if (!isExternal && onDisk) {
          // silent=true: this is Scamp's own canonical migration of
          // whatever just landed on disk, not a user edit. If an
          // agent races us during a project open and the optimistic-
          // concurrency check rejects, we adopt disk silently rather
          // than scaring the user with "Reloaded — your edit was
          // dropped" (they made no edit).
          writeIfDirty(
            state.elements,
            state.rootElementId,
            currentTarget,
            state.pageCustomMediaBlocks,
            state.pageKeyframesBlocks,
            true
          );
        }
        // Defer clearing the flag so any in-flight subscribers also see it.
        queueMicrotask(() => {
          useCanvasStore.setState({ isLoading: false, lastLoadKind: null });
        });
        return;
      }

      // Genuine canvas edit — mark the indicator and update the code
      // preview immediately so the user sees changes reflected without
      // waiting for the debounced write.
      useSaveStatusStore.getState().markUnsaved();
      if (quietWindow.isQuiet()) {
        // The actual `writeIfDirty` won't fire until after the quiet
        // window expires (or it'll bail when the debounce flushes
        // inside the window). Remember that the user did edit the
        // canvas so `reconcileAfterQuiet` knows to flush instead of
        // silently dropping the change.
        canvasChangedDuringQuiet = true;
      }
      const previewCode = generateCode({
        elements: state.elements,
        rootId: state.rootElementId,
        pageName: currentTarget.name,
        breakpoints: state.breakpoints,
        customMediaBlocks: state.pageCustomMediaBlocks,
        pageKeyframesBlocks: state.pageKeyframesBlocks,
        cssModuleImportName: importNameForTarget(
          currentTarget,
          state.projectFormat
        ),
        isComponent: currentTarget.kind === 'component',
      });
      state.setPageSource({ tsx: previewCode.tsx, css: previewCode.css });

      // Schedule the debounced disk write.
      cancelWriteTimer();
      writeTimer = setTimeout(flushDebouncedWrite, WRITE_DEBOUNCE_MS);
    } catch (err) {
      console.warn('[syncBridge] store subscription error:', err);
    }
  });

  const offAck = window.scamp.onFileWriteAck((payload) => {
    handleAck(payload.writeId, payload.path);
  });

  const offFile = window.scamp.onFileChanged((payload) => {
    const state = useCanvasStore.getState();
    const target = toEditTarget(state.activePage, state.activeComponent);
    if (!target) return;
    if (
      payload.path !== target.tsxPath &&
      payload.path !== target.cssPath
    ) {
      return;
    }
    if (payload.tsxContent === null || payload.cssContent === null) return;

    // Late-echo guard: if the incoming payload byte-matches what
    // we last wrote, this is chokidar replaying our own save past
    // the main-side pending-write expiry. Ignore it — re-parsing
    // would either no-op (best case) or clobber an in-memory edit
    // the user made since the save (worst case).
    // see docs/notes/agent-coexistence.md — late-chokidar echo race.
    if (
      payload.tsxContent === lastSerializedTsx &&
      payload.cssContent === lastSerializedCss
    ) {
      return;
    }

    // Phase 1.1: mark this path as actively being reloaded so any
    // concurrent canvas-side `writeIfDirty` bails until we've
    // refreshed `lastSerialized`. We mark both sibling paths even
    // though chokidar only reported one — they ride together
    // through `dispatchPageWrite` so the protection should too.
    externalEditTracker.markPair(target.tsxPath, target.cssPath);

    // Phase 3.2: open / extend the quiet window. Agents typically
    // write the same file multiple times in a burst; the window
    // absorbs the rest of the burst so we don't race the in-between
    // writes. Each chokidar event rolls the deadline forward, so a
    // long agent task keeps Scamp paused until the agent settles.
    quietWindow.extend();
    cancelWriteTimer();
    // Reset the canvas-changed-during-quiet flag at the start of
    // (or extension to) the quiet window. We're now watching for
    // canvas edits arriving DURING this window — anything before
    // doesn't count.
    canvasChangedDuringQuiet = false;
    useSaveStatusStore.getState().markPaused('external-edit');
    scheduleQuietResume();

    // External editors (Claude Code, vim, etc.) can trigger chokidar
    // mid-write — the file content may be truncated or malformed. Guard
    // the entire parse → diff → reload pipeline so a transient bad read
    // logs a warning instead of crashing the renderer process.
    try {
      const parsed = parseCode(payload.tsxContent, payload.cssContent, {
        breakpoints: state.breakpoints,
      });

      // Always mirror the new on-disk source into the store so the code
      // panel reflects exactly what the agent / external editor wrote
      // (including comments, ordering, etc.) — even if the parsed tree
      // round-trips to the same canvas state.
      const nextSource = { tsx: payload.tsxContent, css: payload.cssContent };
      state.setPageSource(nextSource);

      // Skip the canvas reload when the parsed tree round-trips to the
      // same code — prevents flicker during agent edits that don't actually
      // change a canvas-mappable property.
      const importName = importNameForTarget(target, state.projectFormat);
      const isComponent = target.kind === 'component';
      const currentCode = generateCode({
        elements: state.elements,
        rootId: state.rootElementId,
        pageName: target.name,
        breakpoints: state.breakpoints,
        customMediaBlocks: state.pageCustomMediaBlocks,
        pageKeyframesBlocks: state.pageKeyframesBlocks,
        cssModuleImportName: importName,
        isComponent,
      });
      const nextCode = generateCode({
        elements: parsed.elements,
        rootId: parsed.rootId,
        pageName: target.name,
        breakpoints: state.breakpoints,
        customMediaBlocks: parsed.customMediaBlocks,
        pageKeyframesBlocks: parsed.keyframesBlocks,
        cssModuleImportName: importName,
        isComponent,
      });
      if (currentCode.tsx === nextCode.tsx && currentCode.css === nextCode.css) {
        return;
      }

      // If a canvas drag is in flight (transactionDepth > 0), defer
      // the reload until the transaction ends — option B from the
      // history-panel plan. The history slice queues the snapshot
      // and applies it via `restoreSnapshot` once the user releases
      // the mouse.
      const history = useHistoryStore.getState();
      if (history.transactionDepth > 0) {
        history.enqueueExternalEdit(parsed.elements);
        // The page source still needs to update so the bottom code
        // panel reflects the disk content; we update the source but
        // leave the canvas elements alone until the drag ends.
        return;
      }
      state.reloadElements(
        parsed.elements,
        nextSource,
        parsed.customMediaBlocks,
        parsed.keyframesBlocks,
        parsed.cssDuplicates
      );
      // Push an `external-edit` entry rather than clearing — the
      // history panel surfaces the agent's edit as a navigable
      // step. Future entries can undo past it; new user actions
      // discard the forward history as usual.
      history.enqueueExternalEdit(parsed.elements);
    } catch (err) {
      // Transient parse failure — the next chokidar event (once the
      // external write settles) will deliver valid content and succeed.
      console.warn('[syncBridge] skipping malformed file change:', err);
    } finally {
      // Phase 1.1: clear the per-path "external edit pending" flag
      // for both sibling files regardless of which paths through
      // the handler we took (success, no-op round-trip, transaction
      // defer, parse failure). `writeIfDirty` will now proceed again.
      externalEditTracker.clearPair(target.tsxPath, target.cssPath);
    }
  });

  // Flush any queued write when the renderer is about to go away
  // (window close, full reload, HMR). The main-process IPC handler
  // will complete the file write after the renderer is gone — Electron
  // keeps the main process alive long enough to drain its message
  // queue.
  const handleBeforeUnload = (): void => {
    cancelWriteTimer();
    flushDebouncedWrite();
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Listen for theme.css changes and update both the token store and
  // the project-fonts store — the file now holds both.
  const offTheme = window.scamp.onThemeChanged((content: string) => {
    const parsed = parseThemeFile(content);
    useCanvasStore.getState().setThemeTokens(parsed.tokens);
    applyThemeFonts(parsed.fontImportUrls);
  });

  return () => {
    cancelWriteTimer();
    pendingFlush = null;
    if (quietResumeTimer !== null) {
      clearTimeout(quietResumeTimer);
      quietResumeTimer = null;
    }
    quietWindow.clear();
    resumeFromPauseImpl = null;
    saveDivergedCanvasImpl = null;
    discardDivergedCanvasImpl = null;
    window.removeEventListener('beforeunload', handleBeforeUnload);
    unsubStore();
    unsubAgent();
    offFile();
    offAck();
    offTheme();
  };
};
