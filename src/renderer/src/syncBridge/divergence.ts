// Phase 5.2 divergence resolution: when the canvas and disk diverged
// across a quiet window, the user picks `Save canvas` (force-overwrite
// disk) or `Discard canvas` (reload from disk). Lifted out of
// initSyncBridge (Phase 5.4); shares the cache via `ctx`.
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { useCanvasStore } from '@store/canvasSlice';
import { useSaveStatusStore } from '@store/saveStatusSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { errorMessage } from '@shared/errorMessage';

import { importNameForTarget, toEditTarget } from './editTarget';
import { dispatchPageWrite } from './writeDispatch';
import type { SaveContext } from './saveContext';

/**
 * Apply the pending diverged attempt to disk, force-overwriting whatever
 * the external editor wrote. Re-generates from current state so the save
 * reflects every edit the user has made since the window expired.
 */
export const makeSaveDivergedCanvas = (ctx: SaveContext) => (): void => {
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
  ctx.lastSerializedTsx = code.tsx;
  ctx.lastSerializedCss = code.css;
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
 * Abandon canvas state and reload from disk. Uses the renderer-side
 * `pageSource` (kept current by the chokidar handler) as the disk content
 * to re-parse — the same "external edit won" outcome as a write conflict.
 */
export const makeDiscardDivergedCanvas = (ctx: SaveContext) => (): void => {
  const state = useCanvasStore.getState();
  const target = toEditTarget(state.activePage, state.activeComponent);
  if (!target) {
    useSaveStatusStore.getState().markResumed(null);
    return;
  }
  const onDisk = state.pageSource;
  if (!onDisk) {
    useSaveStatusStore.getState().markResumed(null);
    return;
  }
  try {
    const parsed = parseCode(onDisk.tsx, onDisk.css, {
      breakpoints: state.breakpoints,
      isComponent: target.kind === 'component',
    });
    state.reloadElements(
      parsed.elements,
      onDisk,
      parsed.customMediaBlocks,
      parsed.keyframesBlocks,
      parsed.cssDuplicates
    );
    ctx.lastSerializedTsx = onDisk.tsx;
    ctx.lastSerializedCss = onDisk.css;
    useSaveStatusStore.setState({
      state: { kind: 'saved' },
      toast: null,
      dirtyDuringSave: false,
    });
  } catch (err) {
    const message = errorMessage(err);
    useAppLogStore
      .getState()
      .log('warn', `Could not discard canvas (parse failed): ${message}`);
  }
};
