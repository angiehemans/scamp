import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { wouldCreateComponentCycle } from '@lib/componentUsage';
import { resolveComponentDrop } from './reparentDrop';
/** Mime carrying the component name on a sidebar drag. */
export const COMPONENT_DRAG_MIME = 'application/x-scamp-component';
/**
 * Drops a component from the sidebar into whatever container is under the
 * cursor, rather than always at the page root. Mirrors the canvas
 * reparent drag: a flex/grid target shows a gap line and inserts at that
 * index; anything else outlines the container and places the instance at
 * the cursor. see docs/plans/canvas-drag-reparent-plan.md
 */
export const useComponentDrop = (geometry) => {
    const [drop, setDrop] = useState(null);
    // A drag that ends anywhere other than on this layer — released over the
    // sidebar, cancelled with Escape, dragged out of the window — fires no
    // drop and no dragleave here, which would strand the indicator on the
    // canvas. `dragend` always fires on the source, so clear from there.
    useEffect(() => {
        const handleDragEnd = () => setDrop(null);
        window.addEventListener('dragend', handleDragEnd);
        return () => window.removeEventListener('dragend', handleDragEnd);
    }, []);
    const handleDragOver = (e) => {
        if (!e.dataTransfer.types.includes(COMPONENT_DRAG_MIME))
            return;
        // preventDefault is the HTML5-DnD opt-in that makes this a valid drop
        // target. Gated on our own mime so other drags (files, text
        // selections) fall through to the handlers that want them.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const store = useCanvasStore.getState();
        setDrop(resolveComponentDrop(e.clientX, e.clientY, geometry, store.elements, store.rootElementId));
    };
    const handleDragLeave = (e) => {
        // Only clear when the cursor leaves the layer itself — dragleave also
        // fires when moving between descendants, which would flicker the
        // indicator off and on across every element boundary.
        if (e.currentTarget.contains(e.relatedTarget))
            return;
        setDrop(null);
    };
    const handleDrop = (e) => {
        const componentName = e.dataTransfer.getData(COMPONENT_DRAG_MIME);
        if (!componentName)
            return;
        e.preventDefault();
        setDrop(null);
        const store = useCanvasStore.getState();
        // Cycle guard. see docs/notes/components-multi-file-ops.md
        const activeTargetName = store.activeComponent?.name ?? null;
        if (wouldCreateComponentCycle(store.componentTrees, activeTargetName, componentName)) {
            useAppLogStore
                .getState()
                .log('warn', `Refused: placing ${componentName} inside ${activeTargetName} would create a cycle.`);
            return;
        }
        const target = resolveComponentDrop(e.clientX, e.clientY, geometry, store.elements, store.rootElementId);
        if (target.kind === 'flow') {
            store.insertComponentInstance({
                parentId: target.targetId,
                componentName,
                x: 0,
                y: 0,
                index: target.indicator.newIndex,
            });
            return;
        }
        store.insertComponentInstance({
            parentId: target.targetId,
            componentName,
            x: target.x,
            y: target.y,
        });
    };
    return { handleDragOver, handleDragLeave, handleDrop, drop };
};
