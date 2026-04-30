import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { parseThemeFile } from '@lib/parseTheme';
import { parseGoogleFontsEmbed } from '@lib/googleFontsEmbed';
import { useFontsStore } from '@store/fontsSlice';
import { useCanvasStore, type ActivePage } from '@store/canvasSlice';
import type { ProjectFormat } from '@shared/types';
import {
  useSaveStatusStore,
  type LastWriteAttempt,
} from '@store/saveStatusSlice';
import { useAppLogStore } from '@store/appLogSlice';
import type { ScampElement } from '@lib/element';

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
const dispatchPageWrite = (attempt: Extract<LastWriteAttempt, { kind: 'write' }>): void => {
  useSaveStatusStore.getState().markSaving(attempt);
  lastDispatchedAttempt = attempt;

  const expected = new Set<string>([attempt.tsxPath, attempt.cssPath]);

  void window.scamp
    .writeFile({
      tsxPath: attempt.tsxPath,
      cssPath: attempt.cssPath,
      tsxContent: attempt.tsxContent,
      cssContent: attempt.cssContent,
    })
    .then(({ writeId }) => {
      registerPendingSave(writeId, attempt, expected);
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
   * Generate code for the given (elements, rootId, page) tuple and write
   * it to disk if it differs from the last-written cache. Pure with
   * respect to its arguments — used by the debounced flush, the page-
   * switch flush, and the beforeunload flush, all of which need to
   * write a SPECIFIC snapshot rather than whatever the store currently
   * holds.
   */
  const writeIfDirty = (
    elements: Record<string, ScampElement>,
    rootElementId: string,
    page: ActivePage
  ): void => {
    const store = useCanvasStore.getState();
    const code = generateCode({
      elements,
      rootId: rootElementId,
      pageName: page.name,
      breakpoints: store.breakpoints,
      customMediaBlocks: store.pageCustomMediaBlocks,
      cssModuleImportName: cssModuleImportNameFor(
        store.projectFormat,
        page.name
      ),
    });
    if (code.tsx === lastSerializedTsx && code.css === lastSerializedCss) {
      // No-op dedupe: the debounce fired but the generated code matches
      // what's already on disk. Advance the indicator out of "unsaved"
      // anyway so idle canvases don't get stuck showing pending work.
      useSaveStatusStore.getState().markClean();
      return;
    }
    lastSerializedTsx = code.tsx;
    lastSerializedCss = code.css;
    // Mirror the just-written content into the store so the bottom code
    // panel reflects what's on disk without waiting for chokidar.
    useCanvasStore.getState().setPageSource({ tsx: code.tsx, css: code.css });
    dispatchPageWrite({
      kind: 'write',
      tsxPath: page.tsxPath,
      cssPath: page.cssPath,
      tsxContent: code.tsx,
      cssContent: code.css,
    });
  };

  /** Flush a queued debounced write against the CURRENT store state. */
  const flushDebouncedWrite = (): void => {
    const state = useCanvasStore.getState();
    if (!state.activePage) return;
    writeIfDirty(state.elements, state.rootElementId, state.activePage);
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

  const unsubStore = useCanvasStore.subscribe((state, prev) => {
    try {
      // Active page changed — flush any pending edit to the OUTGOING page
      // BEFORE we drop the cache and start tracking the new page. Without
      // this, edits made within the debounce window before a page switch
      // would be silently lost.
      if (state.activePage !== prev.activePage) {
        cancelWriteTimer();
        if (prev.activePage) {
          writeIfDirty(prev.elements, prev.rootElementId, prev.activePage);
        }
        lastSerializedTsx = null;
        lastSerializedCss = null;
      }

      // Nothing relevant changed.
      if (state.elements === prev.elements && state.activePage === prev.activePage) {
        return;
      }

      if (!state.activePage) return;

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
        const code = generateCode({
          elements: state.elements,
          rootId: state.rootElementId,
          pageName: state.activePage.name,
          breakpoints: state.breakpoints,
          customMediaBlocks: state.pageCustomMediaBlocks,
          cssModuleImportName: cssModuleImportNameFor(
            state.projectFormat,
            state.activePage.name
          ),
        });
        const onDisk = state.pageSource;
        const isExternal = state.lastLoadKind === 'external';
        if (
          !isExternal &&
          onDisk &&
          (code.tsx !== onDisk.tsx || code.css !== onDisk.css)
        ) {
          state.setPageSource({ tsx: code.tsx, css: code.css });
          const page = state.activePage;
          void window.scamp
            .writeFile({
              tsxPath: page.tsxPath,
              cssPath: page.cssPath,
              tsxContent: code.tsx,
              cssContent: code.css,
            })
            .catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err);
              useAppLogStore
                .getState()
                .log('warn', `Format migration write failed: ${message}`);
            });
        }
        // The serialized cache should reflect what's on disk — for
        // external edits that's the agent's content (NOT our regen).
        if (isExternal && onDisk) {
          lastSerializedTsx = onDisk.tsx;
          lastSerializedCss = onDisk.css;
        } else {
          lastSerializedTsx = code.tsx;
          lastSerializedCss = code.css;
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
      const previewCode = generateCode({
        elements: state.elements,
        rootId: state.rootElementId,
        pageName: state.activePage.name,
        breakpoints: state.breakpoints,
        customMediaBlocks: state.pageCustomMediaBlocks,
        cssModuleImportName: cssModuleImportNameFor(
          state.projectFormat,
          state.activePage.name
        ),
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
    if (!state.activePage) return;
    if (
      payload.path !== state.activePage.tsxPath &&
      payload.path !== state.activePage.cssPath
    ) {
      return;
    }
    if (payload.tsxContent === null || payload.cssContent === null) return;

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
      const importName = cssModuleImportNameFor(
        state.projectFormat,
        state.activePage.name
      );
      const currentCode = generateCode({
        elements: state.elements,
        rootId: state.rootElementId,
        pageName: state.activePage.name,
        breakpoints: state.breakpoints,
        customMediaBlocks: state.pageCustomMediaBlocks,
        cssModuleImportName: importName,
      });
      const nextCode = generateCode({
        elements: parsed.elements,
        rootId: parsed.rootId,
        pageName: state.activePage.name,
        breakpoints: state.breakpoints,
        customMediaBlocks: parsed.customMediaBlocks,
        cssModuleImportName: importName,
      });
      if (currentCode.tsx === nextCode.tsx && currentCode.css === nextCode.css) {
        return;
      }

      state.reloadElements(parsed.elements, nextSource, parsed.customMediaBlocks);
      // External edits invalidate the undo history — the old states
      // reference element maps that no longer match the file on disk.
      useCanvasStore.temporal.getState().clear();
    } catch (err) {
      // Transient parse failure — the next chokidar event (once the
      // external write settles) will deliver valid content and succeed.
      console.warn('[syncBridge] skipping malformed file change:', err);
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
    const families = parsed.fontImportUrls.flatMap((url) => {
      const result = parseGoogleFontsEmbed(url);
      return result.ok ? result.value.families : [];
    });
    useFontsStore.getState().setProjectFonts({
      families,
      urls: parsed.fontImportUrls,
    });
  });

  return () => {
    cancelWriteTimer();
    pendingFlush = null;
    window.removeEventListener('beforeunload', handleBeforeUnload);
    unsubStore();
    offFile();
    offAck();
    offTheme();
  };
};
