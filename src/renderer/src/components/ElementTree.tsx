import { DragEvent, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { classNameFor } from '@lib/generateCode';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
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

type DropPosition = 'before' | 'after' | 'inside';

type DragOverState = {
  targetId: string;
  position: DropPosition;
};

type RowProps = {
  element: ScampElement;
  depth: number;
  dragOver: DragOverState | null;
  setDragOver: (next: DragOverState | null) => void;
};

const labelFor = (el: ScampElement): string => {
  if (el.id === ROOT_ELEMENT_ID) return 'Page';
  if (el.type === 'text') {
    const text = (el.text ?? '').trim();
    return text.length > 0 ? `Text · ${truncate(text, 20)}` : 'Text';
  }
  return 'Rectangle';
};

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Decide whether the cursor's vertical position over a row means
 * "before", "after", or "inside" — only rectangles can be a drop target
 * for "inside" since text elements can't have children.
 */
const computeDropPosition = (
  e: DragEvent<HTMLElement>,
  el: ScampElement
): DropPosition => {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const h = rect.height;
  // Root: only "inside" is meaningful — you can't put a sibling next to
  // the page itself.
  if (el.id === ROOT_ELEMENT_ID) return 'inside';
  // Text elements can't have children — only before/after.
  if (el.type === 'text') return y < h / 2 ? 'before' : 'after';
  if (y < h * 0.25) return 'before';
  if (y > h * 0.75) return 'after';
  return 'inside';
};

const Row = ({ element, depth, dragOver, setDragOver }: RowProps): JSX.Element => {
  const isSelected = useCanvasStore((s) => s.selectedElementIds.includes(element.id));
  const selectElement = useCanvasStore((s) => s.selectElement);
  const toggleSelectElement = useCanvasStore((s) => s.toggleSelectElement);
  const reorderElement = useCanvasStore((s) => s.reorderElement);
  const ref = useRef<HTMLDivElement>(null);

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

  const handleDragStart = (e: DragEvent<HTMLDivElement>): void => {
    if (element.id === ROOT_ELEMENT_ID) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(DRAG_MIME, element.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    // Only react if the drag carries one of our element ids.
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const position = computeDropPosition(e, element);
    if (
      !dragOver ||
      dragOver.targetId !== element.id ||
      dragOver.position !== position
    ) {
      setDragOver({ targetId: element.id, position });
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    // Only clear if the cursor truly left the row (not just moved to a child).
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    if (dragOver?.targetId === element.id) setDragOver(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    const draggedId = e.dataTransfer.getData(DRAG_MIME);
    setDragOver(null);
    if (!draggedId || draggedId === element.id) return;
    e.preventDefault();
    const position = computeDropPosition(e, element);
    runDrop(draggedId, element, position, reorderElement);
  };

  return (
    <div
      ref={ref}
      className={`${styles.rowWrap} ${showInside ? styles.rowDropInside : ''}`}
      draggable={element.id !== ROOT_ELEMENT_ID}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showBefore && <div className={styles.dropLine} />}
      <button
        type="button"
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={(e) => {
          if (e.shiftKey) toggleSelectElement(element.id);
          else selectElement(element.id);
        }}
        title={`.${classNameFor(element)}`}
      >
        <span className={styles.icon} aria-hidden="true">
          {element.type === 'text' ? 'T' : '▢'}
        </span>
        <span className={styles.label}>{labelFor(element)}</span>
      </button>
      {showAfter && <div className={styles.dropLine} />}
    </div>
  );
};

/**
 * Apply a tree-row drop to the store. Resolves the (target, position)
 * pair into a (newParentId, newIndex) pair that the store action expects.
 */
const runDrop = (
  draggedId: string,
  target: ScampElement,
  position: DropPosition,
  reorder: (elementId: string, newParentId: string, newIndex: number) => void
): void => {
  if (position === 'inside') {
    // Drop into the target as the last child. Root and rectangles allow
    // this; text elements never reach this branch (computeDropPosition
    // refuses).
    reorder(draggedId, target.id, target.childIds.length);
    return;
  }
  // Before / after: insert next to `target` in target.parent.childIds.
  if (!target.parentId) return;
  const parent = useCanvasStore.getState().elements[target.parentId];
  if (!parent) return;
  const idx = parent.childIds.indexOf(target.id);
  if (idx < 0) return;
  const insertAt = position === 'before' ? idx : idx + 1;
  reorder(draggedId, target.parentId, insertAt);
};

export const ElementTree = (): JSX.Element => {
  const rootElementId = useCanvasStore((s) => s.rootElementId);
  const elements = useCanvasStore((s) => s.elements);
  const [dragOver, setDragOver] = useState<DragOverState | null>(null);

  // Walk the tree depth-first, producing a flat array of (element, depth)
  // entries for rendering. We do this in render rather than in a memo
  // because the elements map is replaced wholesale on every store update,
  // so a memo wouldn't help much and would just add complexity.
  const rows: Array<{ element: ScampElement; depth: number }> = [];
  const visit = (id: string, depth: number): void => {
    const el = elements[id];
    if (!el) return;
    rows.push({ element: el, depth });
    for (const childId of el.childIds) visit(childId, depth + 1);
  };
  visit(rootElementId, 0);

  return (
    <div
      className={styles.tree}
      onDragEnd={() => setDragOver(null)}
      onDragLeave={(e) => {
        // Clear when the drag leaves the entire tree, not just one row.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(null);
      }}
    >
      {rows.map(({ element, depth }) => (
        <Row
          key={element.id}
          element={element}
          depth={depth}
          dragOver={dragOver}
          setDragOver={setDragOver}
        />
      ))}
    </div>
  );
};
