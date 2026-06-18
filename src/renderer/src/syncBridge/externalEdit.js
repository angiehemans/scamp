// The chokidar `file:changed` handler — the branch that reacts to an
// external editor / agent writing the active page or component on disk.
// Lifted out of initSyncBridge (Phase 5.4); shares the cache + quiet
// window via `ctx`. see docs/notes/agent-coexistence.md
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { useSaveStatusStore } from '@store/saveStatusSlice';
import { externalEditTracker } from '../lib/externalEditTracker';
import { importNameForTarget, toEditTarget } from './editTarget';
export const makeFileChangedHandler = (ctx) => (payload) => {
    const state = useCanvasStore.getState();
    const target = toEditTarget(state.activePage, state.activeComponent);
    if (!target)
        return;
    if (payload.path !== target.tsxPath &&
        payload.path !== target.cssPath) {
        return;
    }
    if (payload.tsxContent === null || payload.cssContent === null)
        return;
    // Late-echo guard: if the incoming payload byte-matches what
    // we last wrote, this is chokidar replaying our own save past
    // the main-side pending-write expiry. Ignore it — re-parsing
    // would either no-op (best case) or clobber an in-memory edit
    // the user made since the save (worst case).
    // see docs/notes/agent-coexistence.md — late-chokidar echo race.
    if (payload.tsxContent === ctx.lastSerializedTsx &&
        payload.cssContent === ctx.lastSerializedCss) {
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
    ctx.quietWindow.extend();
    ctx.cancelWriteTimer();
    // Reset the canvas-changed-during-quiet flag at the start of
    // (or extension to) the quiet window. We're now watching for
    // canvas edits arriving DURING this window — anything before
    // doesn't count.
    ctx.canvasChangedDuringQuiet = false;
    useSaveStatusStore.getState().markPaused('external-edit');
    ctx.scheduleQuietResume();
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
        state.reloadElements(parsed.elements, nextSource, parsed.customMediaBlocks, parsed.keyframesBlocks, parsed.cssDuplicates);
        // Push an `external-edit` entry rather than clearing — the
        // history panel surfaces the agent's edit as a navigable
        // step. Future entries can undo past it; new user actions
        // discard the forward history as usual.
        history.enqueueExternalEdit(parsed.elements);
    }
    catch (err) {
        // Transient parse failure — the next chokidar event (once the
        // external write settles) will deliver valid content and succeed.
        console.warn('[syncBridge] skipping malformed file change:', err);
    }
    finally {
        // Phase 1.1: clear the per-path "external edit pending" flag
        // for both sibling files regardless of which paths through
        // the handler we took (success, no-op round-trip, transaction
        // defer, parse failure). `writeIfDirty` will now proceed again.
        externalEditTracker.clearPair(target.tsxPath, target.cssPath);
    }
};
