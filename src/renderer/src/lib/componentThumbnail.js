import { capturePng } from './exportCapture';
// Sidebar thumbnail capture. see docs/notes/components-thumbnails.md
const inFlight = new Set();
export const COMPONENT_THUMBNAIL_UPDATED_EVENT = 'scamp:component-thumbnail-updated';
const findCanvasFrame = () => {
    const node = document.querySelector('[data-testid="canvas-frame"]');
    return node instanceof HTMLElement ? node : null;
};
/** Fire-and-forget; never blocks the underlying save. */
export const captureAndPersistComponentThumbnail = (inputs) => {
    const key = `${inputs.projectPath}::${inputs.componentName}`;
    if (inFlight.has(key))
        return;
    inFlight.add(key);
    void (async () => {
        try {
            const frame = findCanvasFrame();
            if (!frame)
                return;
            const width = frame.offsetWidth;
            const height = frame.offsetHeight;
            if (width === 0 || height === 0)
                return;
            const dataUrl = await capturePng({
                node: frame,
                backgroundColor: null,
                width,
                height,
                scale: 1,
            });
            const result = await window.scamp.writeComponentThumbnail({
                projectPath: inputs.projectPath,
                componentName: inputs.componentName,
                dataUrl,
            });
            if (!result.ok) {
                console.warn('[componentThumbnail] write failed for', inputs.componentName, result.error);
                return;
            }
            window.dispatchEvent(new CustomEvent(COMPONENT_THUMBNAIL_UPDATED_EVENT, { detail: { componentName: inputs.componentName } }));
        }
        catch (err) {
            console.warn('[componentThumbnail] capture failed for', inputs.componentName, err);
        }
        finally {
            inFlight.delete(key);
        }
    })();
};
