import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { parseThemeFile } from '@lib/parseTheme';
import { parseGoogleFontsEmbed } from '@lib/googleFontsEmbed';
import { useFontsStore } from '@store/fontsSlice';
import { useCanvasStore, type ActivePage } from '@store/canvasSlice';
import type { ScampElement } from '@lib/element';

const WRITE_DEBOUNCE_MS = 200;

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
 * Wires the canvas store to the file system.
 *
 *   - On any canvas state change: regenerate code and write the page files
 *     after a 200ms debounce. The write is suppressed in the main process
 *     so chokidar won't re-read what we just wrote.
 *   - On `file:changed` for the active page: parse the new file content
 *     and reload the canvas — but only if the parsed tree differs from
 *     the current state, so external no-op changes don't cause flicker.
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
    const code = generateCode({
      elements,
      rootId: rootElementId,
      pageName: page.name,
    });
    if (code.tsx === lastSerializedTsx && code.css === lastSerializedCss) return;
    lastSerializedTsx = code.tsx;
    lastSerializedCss = code.css;
    // Mirror the just-written content into the store so the bottom code
    // panel reflects what's on disk without waiting for chokidar.
    useCanvasStore.getState().setPageSource({ tsx: code.tsx, css: code.css });
    void window.scamp.writeFile({
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

      // The change came from a load — refresh the write cache. If the
      // re-generated code differs from what's on disk (e.g. old-format
      // data-scamp-id), write the canonical version back to migrate the
      // file to the current format.
      if (state.isLoading) {
        const code = generateCode({
          elements: state.elements,
          rootId: state.rootElementId,
          pageName: state.activePage.name,
        });
        // If the regenerated code differs from the on-disk source, write
        // it back to migrate the file format (e.g. short → full class
        // name in data-scamp-id).
        const onDisk = state.pageSource;
        if (onDisk && (code.tsx !== onDisk.tsx || code.css !== onDisk.css)) {
          state.setPageSource({ tsx: code.tsx, css: code.css });
          void window.scamp.writeFile({
            tsxPath: state.activePage.tsxPath,
            cssPath: state.activePage.cssPath,
            tsxContent: code.tsx,
            cssContent: code.css,
          });
        }
        lastSerializedTsx = code.tsx;
        lastSerializedCss = code.css;
        // Defer clearing the flag so any in-flight subscribers also see it.
        queueMicrotask(() => {
          useCanvasStore.setState({ isLoading: false });
        });
        return;
      }

      // Genuine canvas edit — update the code preview immediately so the
      // user sees changes reflected without waiting for the debounced write.
      const previewCode = generateCode({
        elements: state.elements,
        rootId: state.rootElementId,
        pageName: state.activePage.name,
      });
      state.setPageSource({ tsx: previewCode.tsx, css: previewCode.css });

      // Schedule the debounced disk write.
      cancelWriteTimer();
      writeTimer = setTimeout(flushDebouncedWrite, WRITE_DEBOUNCE_MS);
    } catch (err) {
      console.warn('[syncBridge] store subscription error:', err);
    }
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
      const parsed = parseCode(payload.tsxContent, payload.cssContent);

      // Always mirror the new on-disk source into the store so the code
      // panel reflects exactly what the agent / external editor wrote
      // (including comments, ordering, etc.) — even if the parsed tree
      // round-trips to the same canvas state.
      const nextSource = { tsx: payload.tsxContent, css: payload.cssContent };
      state.setPageSource(nextSource);

      // Skip the canvas reload when the parsed tree round-trips to the
      // same code — prevents flicker during agent edits that don't actually
      // change a canvas-mappable property.
      const currentCode = generateCode({
        elements: state.elements,
        rootId: state.rootElementId,
        pageName: state.activePage.name,
      });
      const nextCode = generateCode({
        elements: parsed.elements,
        rootId: parsed.rootId,
        pageName: state.activePage.name,
      });
      if (currentCode.tsx === nextCode.tsx && currentCode.css === nextCode.css) {
        return;
      }

      state.reloadElements(parsed.elements, nextSource);
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
    offTheme();
  };
};
