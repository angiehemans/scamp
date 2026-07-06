import { clipboard, ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { saveImageBuffer } from './imageOps';
import { getProjectFormat } from './projectFormatCache';
import { assertInsideActiveProject } from './pathContainment';
/** Cheap structural check mirroring lib/svg.isSvgMarkup (the renderer
 *  helper is DOM-side and can't be imported here). */
const looksLikeSvg = (text) => /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s/>]/i.test(text);
/**
 * Read the OS clipboard for a canvas paste: SVG markup (text) wins, then
 * a raster image (returned as a PNG data URL), else empty. Sanitization /
 * normalization of svg happens in the renderer (lib/svg) before insert.
 * see docs/plans/svg-improvements-plan.md
 */
export const registerClipboardIpc = () => {
    ipcMain.handle(IPC.ClipboardRead, async () => {
        const text = clipboard.readText();
        if (text.length > 0 && looksLikeSvg(text)) {
            return { kind: 'svg', svg: text };
        }
        const image = clipboard.readImage();
        if (!image.isEmpty()) {
            return { kind: 'image', dataUrl: image.toDataURL() };
        }
        return { kind: 'empty' };
    });
    ipcMain.handle(IPC.ClipboardSaveImage, async (_e, args) => {
        assertInsideActiveProject(args.projectPath);
        const format = await getProjectFormat(args.projectPath);
        const m = /^data:image\/png;base64,(.+)$/.exec(args.dataUrl);
        if (!m)
            throw new Error('clipboard image is not a PNG data URL');
        const data = Buffer.from(m[1], 'base64');
        return saveImageBuffer(args.projectPath, data, 'pasted-image', '.png', format);
    });
};
