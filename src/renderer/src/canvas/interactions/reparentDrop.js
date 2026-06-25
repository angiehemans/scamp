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
            if (!(node instanceof HTMLElement))
                continue;
            const id = node.dataset['elementId'];
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
export const resolveReparentDrop = (draggedEl, grab, clientX, clientY, geometry, elements, 
// The reorder (flex-child) path drags OVER siblings to reorder, so a
// sibling container must not be treated as a reparent target or normal
// reordering would break. The move (absolute) path has no reorder
// concept, so it reparents into any different container, siblings
// included — matching decision (b). see the plan's Open questions.
excludeSiblings) => {
    const drop = geometry.resolveDropContainer(clientX, clientY, draggedEl.id);
    if (!drop || drop.parentId === draggedEl.parentId)
        return null;
    if (excludeSiblings &&
        (elements[drop.parentId]?.parentId ?? null) === draggedEl.parentId) {
        return null;
    }
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
    return { kind: 'absolute', targetId: drop.parentId, rect, x, y };
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
