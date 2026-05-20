import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { parseThemeFile } from '@lib/parseTheme';
import { parseGoogleFontsEmbed } from '@lib/googleFontsEmbed';
import { captureAndPersistComponentThumbnail } from './lib/componentThumbnail';
import { useFontsStore } from '@store/fontsSlice';
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
 * One-shot suppression for the next "active target changed → flush
 * the OUTGOING target" write inside the canvas-store subscription.
 *
 * The default behaviour exists so that switching pages/components
 * flushes any unsaved edit to the file the user just left. But for
 * destructive multi-file operations like component rename or
 * component delete, the outgoing target's file may have been
 * removed from disk WHILE the React state is still mid-transition
 * to the new identity. Writing to that path now would ENOENT and
 * surface as a "Save failed" notification, even though the rename
 * itself succeeded.
 *
 * The flag is consumed by the very next target-swap (the rename
 * is the only operation that needs the suppression, and it always
 * triggers exactly one swap). It auto-resets even if no swap
 * happens, so a forgotten call to `armTargetSwapSuppression` can't
 * silently mask future writes.
 */
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
    target: EditTarget
  ): void => {
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
      customMediaBlocks: store.pageCustomMediaBlocks,
      pageKeyframesBlocks: store.pageKeyframesBlocks,
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
    lastSerializedTsx = code.tsx;
    lastSerializedCss = code.css;
    // Mirror the just-written content into the store so the bottom code
    // panel reflects what's on disk without waiting for chokidar.
    useCanvasStore.getState().setPageSource({ tsx: code.tsx, css: code.css });
    dispatchPageWrite({
      kind: 'write',
      tsxPath: target.tsxPath,
      cssPath: target.cssPath,
      tsxContent: code.tsx,
      cssContent: code.css,
    });
    // Phase 9: capture a sidebar thumbnail for component saves.
    // Fire-and-forget — capture runs in the next microtask so the
    // canvas DOM has finished painting the user's latest edit
    // before `html-to-image` snapshots it. The helper internally
    // throttles concurrent captures per component.
    if (target.kind === 'component') {
      const projectPath = store.projectPath;
      if (projectPath) {
        // Defer so React has finished committing the just-set
        // pageSource (and any in-flight visual updates) before we
        // rasterise the canvas. Without this, a capture taken
        // mid-edit can occasionally render a half-applied state.
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
    writeIfDirty(state.elements, state.rootElementId, target);
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

      // Active target changed (page → page, page → component, or
      // component → page) — flush any pending edit to the OUTGOING
      // target BEFORE we drop the cache and start tracking the new
      // one. Without this, edits made within the debounce window
      // before a target switch would be silently lost.
      //
      // Suppression: component rename arms `suppressNextTargetSwapWrite`
      // before the file ops so this flush can't run against the OLD
      // path after `deleteComponent` has removed it. The one-shot
      // flag clears itself on consumption so subsequent swaps behave
      // normally.
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
          writeIfDirty(prev.elements, prev.rootElementId, prevTarget);
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
        const code = generateCode({
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
        const onDisk = state.pageSource;
        const isExternal = state.lastLoadKind === 'external';
        if (
          !isExternal &&
          onDisk &&
          (code.tsx !== onDisk.tsx || code.css !== onDisk.css)
        ) {
          state.setPageSource({ tsx: code.tsx, css: code.css });
          void window.scamp
            .writeFile({
              tsxPath: currentTarget.tsxPath,
              cssPath: currentTarget.cssPath,
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
