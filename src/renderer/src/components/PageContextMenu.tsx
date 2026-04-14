import { useEffect, useRef } from 'react';
import styles from './PageContextMenu.module.css';

export type PageMenuItem = {
  label: string;
  onSelect: () => void;
  /** Disables the item (grey, non-clickable). */
  disabled?: boolean;
  /** Styles the item red to signal a destructive action. */
  destructive?: boolean;
};

type Props = {
  x: number;
  y: number;
  items: ReadonlyArray<PageMenuItem>;
  onClose: () => void;
};

/**
 * Small floating context menu anchored at a viewport (x, y). Closes on
 * outside click, Escape, or after an item is chosen.
 */
export const PageContextMenu = ({ x, y, items, onClose }: Props): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    // Defer attaching to the next microtask so the click that opened the
    // menu doesn't immediately close it.
    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleDown);
      document.addEventListener('keydown', handleKey);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={styles.menu}
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          className={`${styles.item} ${item.destructive ? styles.destructive : ''}`}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
