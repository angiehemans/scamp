import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { PageContextMenu } from './PageContextMenu';
import { EXPORT_SECTION_DOM_ID } from './sections/ExportSection';
const EVENT_NAME = 'scamp:open-element-context-menu';
/**
 * Single-instance context menu for canvas elements. Listens for the
 * `scamp:open-element-context-menu` custom event dispatched by
 * `ElementRenderer.onContextMenu`, opens at the supplied coordinates,
 * dismisses on outside click / Escape (handled by the underlying
 * `PageContextMenu` primitive).
 *
 * Currently exposes a single "Export…" item that scrolls the
 * Export section into view. Future menu entries (Copy, Duplicate,
 * Delete, Bring to Front …) plug in here.
 */
export const ElementContextMenu = () => {
    const [menu, setMenu] = useState(null);
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (!detail)
                return;
            setMenu({ x: detail.x, y: detail.y, elementId: detail.elementId });
        };
        window.addEventListener(EVENT_NAME, handler);
        return () => window.removeEventListener(EVENT_NAME, handler);
    }, []);
    if (!menu)
        return null;
    return (_jsx(PageContextMenu, { x: menu.x, y: menu.y, onClose: () => setMenu(null), items: [
            {
                label: 'Export…',
                onSelect: () => {
                    const section = document.getElementById(EXPORT_SECTION_DOM_ID);
                    if (section) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },
            },
        ] }));
};
