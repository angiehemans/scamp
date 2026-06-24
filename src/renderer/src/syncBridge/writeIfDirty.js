// The core "serialize the canvas and write it to disk if it changed"
// logic, plus the write-conflict resolver it dispatches with. Lifted out
// of initSyncBridge (Phase 5.4); reads/writes the shared cache via `ctx`.
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { useCanvasStore } from '@store/canvasSlice';
import { useSaveStatusStore } from '@store/saveStatusSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { errorMessage } from '@shared/errorMessage';
import { selectAnyAgentActive, selectPauseReason, useTerminalActivityStore, } from '@store/terminalActivitySlice';
import { externalEditTracker } from '../lib/externalEditTracker';
import { captureAndPersistComponentThumbnail } from '../lib/componentThumbnail';
import { importNameForTarget, toEditTarget } from './editTarget';
import { notifyWriteAborted } from './pendingSaves';
import { dispatchPageWrite } from './writeDispatch';
/**
 * Resync the canvas to a competing on-disk version when main rejects our
 * write with a conflict. See docs/notes/agent-coexistence.md. Adopts the
 * actual disk content as the new synced state, parses + reloads elements,
 * and surfaces a one-line app-log message.
 *
 * `silent: true` is set by the initial-load canonical migration — the
 * reload still happens (we adopt disk content), but we suppress the
 * `reloaded-from-disk` indicator and the "your in-flight edit was dropped"
 * app-log line, because the user had NO in-flight edit.
 */
export const makeOnWriteConflict = (ctx) => (target, conflict, silent = false) => {
    const store = useCanvasStore.getState();
    // The write was kicked off against `target`, but the user may
    // have navigated away in the meantime. Reloading the store's
    // elements / pageSource for a stale target would clobber the
    // canvas with the wrong page's content (visible as "Page B's
    // breadcrumb with Page A's design"). Bail out without touching
    // the store — the abandoned target's disk state will reconcile
    // on the next visit via the initial-load path.
    const currentTarget = toEditTarget(store.activePage, store.activeComponent);
    if (!currentTarget ||
        currentTarget.tsxPath !== target.tsxPath ||
        currentTarget.cssPath !== target.cssPath) {
        useAppLogStore
            .getState()
            .log('warn', `Write conflict on ${target.name} arrived after navigation; skipping canvas reload.`);
        return;
    }
    ctx.lastSerializedTsx = conflict.actualTsxContent;
    ctx.lastSerializedCss = conflict.actualCssContent;
    store.setPageSource({
        tsx: conflict.actualTsxContent,
        css: conflict.actualCssContent,
    });
    try {
        const parsed = parseCode(conflict.actualTsxContent, conflict.actualCssContent, { breakpoints: store.breakpoints, isComponent: target.kind === 'component' });
        store.reloadElements(parsed.elements, { tsx: conflict.actualTsxContent, css: conflict.actualCssContent }, parsed.customMediaBlocks, parsed.keyframesBlocks, parsed.cssDuplicates);
    }
    catch (err) {
        const message = errorMessage(err);
        useAppLogStore
            .getState()
            .log('warn', `External edit on ${target.name}.tsx couldn't be parsed: ${message}`);
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
        .log('warn', `${target.name} was edited outside Scamp; reloaded to that version. Your in-flight edit was dropped.`);
};
/**
 * Generate code for the given (elements, rootId, page) tuple and write
 * it to disk if it differs from the last-written cache. Pure with
 * respect to its arguments — used by the debounced flush, the page-
 * switch flush, and the beforeunload flush, all of which need to write a
 * SPECIFIC snapshot rather than whatever the store currently holds.
 *
 * `customMediaBlocks` and `pageKeyframesBlocks` are passed in (not read
 * from the store) because the page-switch flush fires AFTER `loadPage(B)`
 * has swapped the store's per-page CSS into B's values.
 *
 * `silent` is set by the canonical-migration call site (initial load). It
 * propagates through to `onWriteConflict` so a conflict adopts disk
 * without flashing the "Reloaded" indicator.
 */
export const makeWriteIfDirty = (ctx) => (elements, rootElementId, target, customMediaBlocks, pageKeyframesBlocks, silent = false) => {
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
    if (ctx.quietWindow.isQuiet()) {
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
    if (code.tsx === ctx.lastSerializedTsx && code.css === ctx.lastSerializedCss) {
        // No-op dedupe: the debounce fired but the generated code matches
        // what's already on disk. Advance the indicator out of "unsaved"
        // anyway so idle canvases don't get stuck showing pending work.
        useSaveStatusStore.getState().markClean();
        return;
    }
    // Capture the OLD lastSerialized for the conflict check —
    // that's what we believe is currently on disk. Then advance to
    // the new content so subsequent dedupes work.
    const expectedTsx = ctx.lastSerializedTsx;
    const expectedCss = ctx.lastSerializedCss;
    ctx.lastSerializedTsx = code.tsx;
    ctx.lastSerializedCss = code.css;
    // Mirror the just-written content into the store so the bottom code
    // panel reflects what's on disk without waiting for chokidar.
    useCanvasStore.getState().setPageSource({ tsx: code.tsx, css: code.css });
    dispatchPageWrite({
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
    }, (conflict) => ctx.onWriteConflict(target, conflict, silent));
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
