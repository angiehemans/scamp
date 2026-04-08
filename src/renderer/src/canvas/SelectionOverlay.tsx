import styles from './SelectionOverlay.module.css';

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** When false, the resize handles are not rendered (e.g. for the page root). */
  showHandles?: boolean;
};

const HANDLES: Array<{ key: string; className: string }> = [
  { key: 'nw', className: 'handleNw' },
  { key: 'n', className: 'handleN' },
  { key: 'ne', className: 'handleNe' },
  { key: 'e', className: 'handleE' },
  { key: 'se', className: 'handleSe' },
  { key: 's', className: 'handleS' },
  { key: 'sw', className: 'handleSw' },
  { key: 'w', className: 'handleW' },
];

export const SelectionOverlay = ({
  x,
  y,
  width,
  height,
  showHandles = true,
}: Props): JSX.Element => {
  return (
    <div
      className={styles.outline}
      style={{ left: x, top: y, width, height }}
    >
      {showHandles &&
        HANDLES.map((h) => (
          <div
            key={h.key}
            data-handle={h.key}
            className={`${styles.handle} ${styles[h.className]}`}
          />
        ))}
    </div>
  );
};
