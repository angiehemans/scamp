import { capturePng } from './exportCapture';

/**
 * Phase 9 — capture a small canvas screenshot of the active
 * component and persist it under
 * `<projectPath>/.scamp/component-thumbs/<Name>.png` for the
 * sidebar preview. Best-effort: never throws, never blocks the
 * underlying save.
 *
 * Throttling: at most one capture in flight per component at a
 * time. A second save while the first is still capturing is
 * dropped on the floor — the next save will pick up the latest
 * state.
 */

const inFlight = new Set<string>();

/**
 * Dispatched after a thumbnail successfully writes to disk so the
 * sidebar can refresh its cached `<img>` source. We use a custom
 * event rather than relying on chokidar because the watcher
 * intentionally ignores dotfile-prefixed paths (`.scamp/` is one
 * of them) so it doesn't thrash on tooling artefacts.
 */
export const COMPONENT_THUMBNAIL_UPDATED_EVENT =
  'scamp:component-thumbnail-updated';

export type ComponentThumbnailUpdatedDetail = {
  componentName: string;
};

/**
 * Locate the canvas frame in the current DOM. The frame is the
 * only element marked with `data-testid="canvas-frame"`. Returns
 * null when no frame is mounted (e.g. the user closed the
 * project mid-write — shouldn't happen but defended for).
 */
const findCanvasFrame = (): HTMLElement | null => {
  const node = document.querySelector('[data-testid="canvas-frame"]');
  return node instanceof HTMLElement ? node : null;
};

export type CaptureThumbnailInputs = {
  projectPath: string;
  componentName: string;
};

/**
 * Fire-and-forget capture. Awaits internally but the outer
 * caller doesn't need to — the save pipeline shouldn't depend
 * on thumbnail capture succeeding.
 */
export const captureAndPersistComponentThumbnail = (
  inputs: CaptureThumbnailInputs
): void => {
  const key = `${inputs.projectPath}::${inputs.componentName}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  void (async () => {
    try {
      const frame = findCanvasFrame();
      if (!frame) return;
      // Use the frame's intrinsic (pre-scale) dimensions. The
      // capture helper resets `transform: scale(...)` for the
      // duration so the resulting image matches the design size,
      // not the visible zoom-scaled rendering.
      const width = frame.offsetWidth;
      const height = frame.offsetHeight;
      if (width === 0 || height === 0) return;
      const dataUrl = await capturePng({
        node: frame,
        backgroundColor: null,
        width,
        height,
        // Sidebar thumbnails render small (~32px tall). 1× capture
        // is enough; higher pixel ratios bloat the on-disk PNG
        // without visible benefit at that size.
        scale: 1,
      });
      const result = await window.scamp.writeComponentThumbnail({
        projectPath: inputs.projectPath,
        componentName: inputs.componentName,
        dataUrl,
      });
      if (!result.ok) {
        // Log but don't surface — thumbnail failures shouldn't
        // distract the user. The underlying save already
        // succeeded by the time we hit this path.
        console.warn(
          '[componentThumbnail] write failed for',
          inputs.componentName,
          result.error
        );
        return;
      }
      // Sidebar items listen for this and re-fetch their
      // thumbnail data so the user sees their latest edit
      // reflected without restarting the app or reopening the
      // project.
      window.dispatchEvent(
        new CustomEvent<ComponentThumbnailUpdatedDetail>(
          COMPONENT_THUMBNAIL_UPDATED_EVENT,
          { detail: { componentName: inputs.componentName } }
        )
      );
    } catch (err) {
      console.warn(
        '[componentThumbnail] capture failed for',
        inputs.componentName,
        err
      );
    } finally {
      inFlight.delete(key);
    }
  })();
};
