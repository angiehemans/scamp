import { type PointerEvent } from 'react';
import { IconLink, IconLinkOff } from '@tabler/icons-react';
import styles from './SelectionOverlay.module.css';

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** When false, the resize handles are not rendered (e.g. for the page root). */
  showHandles?: boolean;
  /**
   * When true, the aspect ratio is locked: only the four corner handles
   * render (edge handles are disabled) and the lock badge shows its
   * linked state.
   */
  ratioLocked?: boolean;
  /**
   * Toggle the ratio lock. When provided (and `showHandles`), a small
   * chain-link badge renders just outside the top-left corner. Omitted
   * for selections that can't be resized (root, flex children).
   */
  onToggleLock?: () => void;
};

const CORNER_HANDLES: Array<{ key: string; className: string }> = [
  { key: 'nw', className: 'handleNw' },
  { key: 'ne', className: 'handleNe' },
  { key: 'se', className: 'handleSe' },
  { key: 'sw', className: 'handleSw' },
];

const EDGE_HANDLES: Array<{ key: string; className: string }> = [
  { key: 'n', className: 'handleN' },
  { key: 'e', className: 'handleE' },
  { key: 's', className: 'handleS' },
  { key: 'w', className: 'handleW' },
];

export const SelectionOverlay = ({
  x,
  y,
  width,
  height,
  showHandles = true,
  ratioLocked = false,
  onToggleLock,
}: Props): JSX.Element => {
  // Corner handles always; edge handles only when the ratio isn't locked
  // (a locked ratio scales proportionally, which only corner drags do).
  const handles = ratioLocked
    ? CORNER_HANDLES
    : [...CORNER_HANDLES, ...EDGE_HANDLES];

  // Stop the badge's pointerdown from reaching the interaction layer,
  // which would otherwise start a marquee / clear the selection.
  const handleBadgePointerDown = (e: PointerEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
  };

  return (
    <div className={styles.outline} style={{ left: x, top: y, width, height }}>
      {showHandles &&
        handles.map((h) => (
          <div
            key={h.key}
            data-handle={h.key}
            className={`${styles.handle} ${styles[h.className]}`}
          />
        ))}
      {showHandles && onToggleLock && (
        <button
          type="button"
          className={`${styles.lockBadge} ${
            ratioLocked ? styles.lockBadgeActive : ''
          }`}
          onPointerDown={handleBadgePointerDown}
          onClick={onToggleLock}
          aria-pressed={ratioLocked}
          title={
            ratioLocked
              ? 'Unlock aspect ratio'
              : 'Lock aspect ratio — width and height scale together'
          }
        >
          {ratioLocked ? <IconLink size={12} /> : <IconLinkOff size={12} />}
        </button>
      )}
    </div>
  );
};
