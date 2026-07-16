import { wouldCreateComponentCycle } from '@lib/componentUsage';
import { elementIdOf } from './canvasHitTest';
/**
 * True when committing this slot drop would create a component cycle. Only
 * an absolute drop whose target is a component-instance is a slot drop, and
 * only a dragged component-instance can introduce a reference. The cycle is
 * checked against the component currently being edited (`activeComponentName`)
 * — dropping into a slot while editing component A folds the dragged
 * component into A's definition; if it transitively uses A, that's a cycle.
 * On a page (`activeComponentName` null) this is always false.
 * see docs/notes/components-multi-file-ops.md
 */
export const slotDropCreatesCycle = (drop, draggedId, elements, componentTrees, activeComponentName) => {
    if (drop.kind !== 'absolute')
        return false;
    const target = elements[drop.targetId];
    if (!target || target.type !== 'component-instance')
        return false;
    const dragged = elements[draggedId];
    if (!dragged ||
        dragged.type !== 'component-instance' ||
        !dragged.componentName) {
        return false;
    }
    return wouldCreateComponentCycle(componentTrees, activeComponentName, dragged.componentName);
};
const LINE = 2;
/**
 * Gap-line indicator + insert index for dropping into a flow (flex/grid)
 * container. Generalised from the same-parent reorder math to any parent.
 * Grid containers append to the end (Q3); flex uses the sibling under the
 * cursor and which side of its centre. When no sibling is under the cursor
 * (empty container, padding, between rows), falls back to appending at the
 * container's trailing edge so any drop inside the container is valid.
 */
const flowIndicator = (parent, draggedId, clientX, clientY, geometry) => {
    const isRow = parent.flexDirection === 'row';
    const isGrid = parent.display === 'grid';
    if (!isGrid) {
        const siblingIds = parent.childIds.filter((id) => id !== draggedId);
        let hitSiblingId = null;
        for (const node of document.elementsFromPoint(clientX, clientY)) {
            const id = elementIdOf(node);
            if (id && siblingIds.includes(id)) {
                hitSiblingId = id;
                break;
            }
        }
        if (hitSiblingId) {
            const r = geometry.measureElementInFrame(hitSiblingId);
            if (r) {
                const cursor = geometry.toFrame(clientX, clientY);
                const before = isRow
                    ? cursor.x < r.x + r.w / 2
                    : cursor.y < r.y + r.h / 2;
                const siblingIdx = parent.childIds.indexOf(hitSiblingId);
                const newIndex = before ? siblingIdx : siblingIdx + 1;
                const rect = isRow
                    ? {
                        x: before ? r.x - LINE / 2 : r.x + r.w - LINE / 2,
                        y: r.y,
                        w: LINE,
                        h: r.h,
                    }
                    : {
                        x: r.x,
                        y: before ? r.y - LINE / 2 : r.y + r.h - LINE / 2,
                        w: r.w,
                        h: LINE,
                    };
                return { rect, newIndex };
            }
        }
    }
    // Append fallback (also the whole grid path): a line at the container's
    // trailing inner edge, dropping at the end of the child list.
    const cr = geometry.measureElementInFrame(parent.id);
    if (!cr)
        return null;
    const rect = isRow
        ? { x: cr.x + cr.w - LINE, y: cr.y, w: LINE, h: cr.h }
        : { x: cr.x, y: cr.y + cr.h - LINE, w: cr.w, h: LINE };
    return { rect, newIndex: parent.childIds.length };
};
/**
 * Resolve a pending reparent for the dragged element under the cursor, or
 * null when there's no valid DIFFERENT container (decision (b): reparent
 * only when the target differs from the current parent). `grab` is the
 * frame-local offset of the cursor within the dragged element, used to
 * keep the element under the cursor when dropping into an absolute parent.
 */
export const resolveReparentDrop = (draggedEl, grab, clientX, clientY, geometry, elements) => {
    // Any different container under the cursor is a valid nest target —
    // siblings included. Reordering a flex child still works: dropping in the
    // GAP between siblings targets the shared PARENT (rejected below as
    // "same parent"), so it falls through to the reorder path; only dropping
    // onto a sibling's body nests into it. see docs/plans/component-slots-plan.md
    const drop = geometry.resolveDropContainer(clientX, clientY, draggedEl.id);
    if (!drop || drop.parentId === draggedEl.parentId)
        return null;
    if (drop.isFlow) {
        const parent = elements[drop.parentId];
        if (!parent)
            return null;
        const indicator = flowIndicator(parent, draggedEl.id, clientX, clientY, geometry);
        if (!indicator)
            return null;
        return { kind: 'flow', targetId: drop.parentId, indicator };
    }
    const rect = geometry.measureElementInFrame(drop.parentId);
    if (!rect)
        return null;
    const cursor = geometry.toFrame(clientX, clientY);
    const localX = cursor.x - rect.x - grab.dx;
    const localY = cursor.y - rect.y - grab.dy;
    const x = Math.round(Math.max(0, Math.min(localX, rect.w - draggedEl.widthValue)));
    const y = Math.round(Math.max(0, Math.min(localY, rect.h - draggedEl.heightValue)));
    return {
        kind: 'absolute',
        targetId: drop.parentId,
        rect,
        x,
        y,
        // The default `children` slot carries no explicit slotName (it emits as
        // JSX children); only named slots get one.
        ...(drop.slotName !== undefined && drop.slotName !== 'children'
            ? { slotName: drop.slotName }
            : {}),
    };
};
/**
 * Commit a resolved reparent. Flow targets reorder into the destination
 * at the computed index (layout owns position); absolute targets reparent
 * with the drop position appended to the container's children.
 */
export const commitReparentDrop = (drop, draggedId, elements, reorderElement, reparentElement) => {
    if (drop.kind === 'flow') {
        reorderElement(draggedId, drop.targetId, drop.indicator.newIndex);
        return;
    }
    const target = elements[drop.targetId];
    const index = target ? target.childIds.length : 0;
    reparentElement(draggedId, drop.targetId, index, { x: drop.x, y: drop.y });
};
