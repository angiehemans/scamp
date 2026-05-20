import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { PageContextMenu } from './PageContextMenu';
import { EXPORT_SECTION_DOM_ID } from './sections/ExportSection';
/**
 * Custom event the menu dispatches when the user picks "Create
 * component" on a non-root, non-instance element. `ProjectShell`
 * listens for it, opens the name-input dialog, and on confirm
 * runs the convert-to-component flow.
 */
export const CONVERT_TO_COMPONENT_EVENT = 'scamp:convert-to-component';
/**
 * Custom event for the Phase 8 "Detach from component" action.
 * Fired by the right-click menu when the target element is a
 * component-instance. `ProjectShell` listens, surfaces a one-way
 * ConfirmDialog (with an override-impact note if any overrides
 * are set), and on confirm runs `detachInstance`.
 */
export const DETACH_INSTANCE_EVENT = 'scamp:detach-instance';
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
    // Subscribe to the menu target's type so we can hide
    // "Create component" for cases where the conversion doesn't
    // apply: the page root (no parent to splice an instance into)
    // and existing component instances (they're already
    // components — converting again would orphan their identity).
    const targetType = useCanvasStore((s) => menu ? s.elements[menu.elementId]?.type : undefined);
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
    const canConvert = menu.elementId !== ROOT_ELEMENT_ID &&
        targetType !== 'component-instance';
    const isInstance = targetType === 'component-instance';
    const items = [
        ...(canConvert
            ? [
                {
                    label: 'Create component…',
                    onSelect: () => {
                        window.dispatchEvent(new CustomEvent(CONVERT_TO_COMPONENT_EVENT, { detail: { elementId: menu.elementId } }));
                    },
                },
            ]
            : []),
        ...(isInstance
            ? [
                {
                    label: 'Detach from component…',
                    onSelect: () => {
                        window.dispatchEvent(new CustomEvent(DETACH_INSTANCE_EVENT, { detail: { instanceId: menu.elementId } }));
                    },
                },
            ]
            : []),
        {
            label: 'Export…',
            onSelect: () => {
                const section = document.getElementById(EXPORT_SECTION_DOM_ID);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            },
        },
    ];
    return (_jsx(PageContextMenu, { x: menu.x, y: menu.y, onClose: () => setMenu(null), items: items }));
};
