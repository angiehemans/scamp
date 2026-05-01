import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { classNameFor } from '@lib/generateCode';
import { ROOT_ELEMENT_ID, slugifyName } from '@lib/element';
import { Tooltip } from './controls/Tooltip';
import styles from './ElementTree.module.css';
/**
 * Layers panel: a collapsible-by-depth tree of every element in the
 * current page, in DOM order. Clicking a row selects that element on the
 * canvas; selecting on the canvas highlights the matching row.
 *
 * Drag-and-drop reorders the tree:
 *   - Drop in the top half of a row → become its previous sibling
 *   - Drop in the bottom half → become its next sibling
 *   - Drop in the middle of a rectangle row → become its last child
 *
 * The drop target and indicator position live in `dragOver` state on the
 * tree component (not on individual rows) so React only re-renders one
 * row's worth of indicator at a time.
 */
const DRAG_MIME = 'application/x-scamp-element-id';
/** Convert a slug like "hero_card" to title case "Hero Card". */
const titleCaseFromSlug = (slug) => slug
    .split('_')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
const labelFor = (el) => {
    if (el.id === ROOT_ELEMENT_ID)
        return 'Page';
    if (el.name)
        return titleCaseFromSlug(el.name);
    if (el.type === 'text') {
        const text = (el.text ?? '').trim();
        return text.length > 0 ? `Text · ${truncate(text, 20)}` : 'Text';
    }
    return 'Rectangle';
};
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
/**
 * Decide whether the cursor's vertical position over a row means
 * "before", "after", or "inside" — only rectangles can be a drop target
 * for "inside" since text elements can't have children.
 */
const computeDropPosition = (e, el) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    // Root: only "inside" is meaningful — you can't put a sibling next to
    // the page itself.
    if (el.id === ROOT_ELEMENT_ID)
        return 'inside';
    // Text elements can't have children — only before/after.
    if (el.type === 'text')
        return y < h / 2 ? 'before' : 'after';
    if (y < h * 0.25)
        return 'before';
    if (y > h * 0.75)
        return 'after';
    return 'inside';
};
const Row = ({ element, depth, dragOver, setDragOver }) => {
    const isSelected = useCanvasStore((s) => s.selectedElementIds.includes(element.id));
    const selectElement = useCanvasStore((s) => s.selectElement);
    const toggleSelectElement = useCanvasStore((s) => s.toggleSelectElement);
    const reorderElement = useCanvasStore((s) => s.reorderElement);
    const patchElement = useCanvasStore((s) => s.patchElement);
    const ref = useRef(null);
    const inputRef = useRef(null);
    const [renaming, setRenaming] = useState(false);
    const [draft, setDraft] = useState('');
    // When the selection lands on this row from the canvas, scroll the tree
    // so the row is visible. Cheap and only fires for the selected row.
    useEffect(() => {
        if (isSelected) {
            ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }, [isSelected]);
    const isDragTarget = dragOver?.targetId === element.id;
    const showBefore = isDragTarget && dragOver.position === 'before';
    const showAfter = isDragTarget && dragOver.position === 'after';
    const showInside = isDragTarget && dragOver.position === 'inside';
    const handleDragStart = (e) => {
        if (element.id === ROOT_ELEMENT_ID) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData(DRAG_MIME, element.id);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e) => {
        // Only react if the drag carries one of our element ids.
        if (!e.dataTransfer.types.includes(DRAG_MIME))
            return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const position = computeDropPosition(e, element);
        if (!dragOver ||
            dragOver.targetId !== element.id ||
            dragOver.position !== position) {
            setDragOver({ targetId: element.id, position });
        }
    };
    const handleDragLeave = (e) => {
        // Only clear if the cursor truly left the row (not just moved to a child).
        const related = e.relatedTarget;
        if (related && e.currentTarget.contains(related))
            return;
        if (dragOver?.targetId === element.id)
            setDragOver(null);
    };
    const handleDrop = (e) => {
        const draggedId = e.dataTransfer.getData(DRAG_MIME);
        setDragOver(null);
        if (!draggedId || draggedId === element.id)
            return;
        e.preventDefault();
        const position = computeDropPosition(e, element);
        runDrop(draggedId, element, position, reorderElement);
    };
    return (_jsxs("div", { ref: ref, className: `${styles.rowWrap} ${showInside ? styles.rowDropInside : ''}`, draggable: element.id !== ROOT_ELEMENT_ID, onDragStart: handleDragStart, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, "data-testid": "layers-row", "data-element-id": element.id, "data-element-class": classNameFor(element), children: [showBefore && _jsx("div", { className: styles.dropLine }), _jsx(Tooltip, { label: `.${classNameFor(element)}`, children: _jsxs("button", { type: "button", className: `${styles.row} ${isSelected ? styles.rowSelected : ''}`, style: { paddingLeft: 8 + depth * 12 }, onClick: (e) => {
                        if (renaming)
                            return;
                        if (e.shiftKey)
                            toggleSelectElement(element.id);
                        else
                            selectElement(element.id);
                    }, onDoubleClick: () => {
                        // Root can't be renamed.
                        if (element.id === ROOT_ELEMENT_ID)
                            return;
                        setDraft(element.name ? titleCaseFromSlug(element.name) : '');
                        setRenaming(true);
                        // Focus the input on next tick after it renders.
                        requestAnimationFrame(() => {
                            inputRef.current?.focus();
                            inputRef.current?.select();
                        });
                    }, children: [_jsx("span", { className: styles.icon, "aria-hidden": "true", children: element.type === 'text' ? 'T' : '▢' }), renaming ? (_jsx("input", { ref: inputRef, type: "text", className: styles.renameInput, value: draft, onChange: (e) => setDraft(e.target.value), onBlur: () => {
                                const slug = slugifyName(draft);
                                patchElement(element.id, {
                                    name: slug.length > 0 ? slug : undefined,
                                });
                                setRenaming(false);
                            }, onKeyDown: (e) => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                }
                                if (e.key === 'Escape') {
                                    setRenaming(false);
                                }
                                // Stop propagation so typing doesn't trigger tool shortcuts.
                                e.stopPropagation();
                            }, onClick: (e) => e.stopPropagation(), onPointerDown: (e) => e.stopPropagation() })) : (_jsx("span", { className: styles.label, children: labelFor(element) }))] }) }), showAfter && _jsx("div", { className: styles.dropLine })] }));
};
/**
 * Apply a tree-row drop to the store. Resolves the (target, position)
 * pair into a (newParentId, newIndex) pair that the store action expects.
 */
const runDrop = (draggedId, target, position, reorder) => {
    if (position === 'inside') {
        // Drop into the target as the last child. Root and rectangles allow
        // this; text elements never reach this branch (computeDropPosition
        // refuses).
        reorder(draggedId, target.id, target.childIds.length);
        return;
    }
    // Before / after: insert next to `target` in target.parent.childIds.
    if (!target.parentId)
        return;
    const parent = useCanvasStore.getState().elements[target.parentId];
    if (!parent)
        return;
    const idx = parent.childIds.indexOf(target.id);
    if (idx < 0)
        return;
    const insertAt = position === 'before' ? idx : idx + 1;
    reorder(draggedId, target.parentId, insertAt);
};
export const ElementTree = () => {
    const rootElementId = useCanvasStore((s) => s.rootElementId);
    const elements = useCanvasStore((s) => s.elements);
    const [dragOver, setDragOver] = useState(null);
    // Walk the tree depth-first. Element rows are draggable and
    // clickable; "raw" rows appear under any element that has
    // inlineFragments (loose text or unclassed JSX captured by the
    // parser) so the user can see the fragments exist even though
    // they're not editable from the canvas.
    const rows = [];
    const visit = (id, depth) => {
        const el = elements[id];
        if (!el)
            return;
        rows.push({ kind: 'element', element: el, depth });
        for (const childId of el.childIds)
            visit(childId, depth + 1);
        if (el.inlineFragments.length > 0) {
            rows.push({
                kind: 'raw',
                parentId: el.id,
                count: el.inlineFragments.length,
                depth: depth + 1,
            });
        }
    };
    visit(rootElementId, 0);
    return (_jsx("div", { className: styles.tree, onDragEnd: () => setDragOver(null), onDragLeave: (e) => {
            // Clear when the drag leaves the entire tree, not just one row.
            if (e.currentTarget.contains(e.relatedTarget))
                return;
            setDragOver(null);
        }, children: rows.map((row) => row.kind === 'element' ? (_jsx(Row, { element: row.element, depth: row.depth, dragOver: dragOver, setDragOver: setDragOver }, row.element.id)) : (_jsx(RawRow, { parentId: row.parentId, count: row.count, depth: row.depth }, `${row.parentId}-raw`))) }));
};
/**
 * Non-interactive row showing "Raw (N)" under any element that has
 * loose text or unclassed JSX captured in `inlineFragments`. Edit by
 * touching the TSX file directly — these fragments aren't surfaced
 * via the canvas because Scamp doesn't model them as elements.
 */
const RawRow = ({ parentId, count, depth }) => {
    const elements = useCanvasStore((s) => s.elements);
    const fragments = elements[parentId]?.inlineFragments ?? [];
    const tooltip = fragments
        .map((f) => {
        if (f.kind === 'text') {
            const v = f.value.trim();
            return `text: ${v.length > 40 ? `${v.slice(0, 40)}…` : v}`;
        }
        const s = f.source.replace(/\s+/g, ' ').trim();
        return `jsx: ${s.length > 40 ? `${s.slice(0, 40)}…` : s}`;
    })
        .join('\n');
    return (_jsx(Tooltip, { label: tooltip || 'No raw fragments', children: _jsx("div", { className: `${styles.rowWrap} ${styles.rowRaw}`, "data-testid": "layers-row-raw", "data-parent-id": parentId, children: _jsxs("div", { className: styles.row, style: { paddingLeft: 8 + depth * 12, cursor: 'default' }, children: [_jsx("span", { className: styles.icon, "aria-hidden": "true", children: "\u00B6" }), _jsx("span", { className: styles.label, children: `Raw (${count})` })] }) }) }));
};
