import { useEffect, useRef } from 'react';
import { useAppLogStore, type AppLogLevel } from '@store/appLogSlice';
import styles from './AppLogView.module.css';

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const levelClass = (level: AppLogLevel): string | undefined => {
  if (level === 'error') return styles.levelError;
  if (level === 'warn') return styles.levelWarn;
  return styles.levelInfo;
};

/**
 * Read-only pane that surfaces app-level log entries (currently just
 * save failures). Lives as a tab inside `TerminalPanel` alongside the
 * real pty shells — users expect diagnostic output to live in the
 * terminal area.
 */
export const AppLogView = (): JSX.Element => {
  const entries = useAppLogStore((s) => s.entries);
  const clear = useAppLogStore((s) => s.clear);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the view pinned to the newest entry unless the user scrolls
  // up. We autoscroll on mount and on every new entry.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries.length]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>App events</span>
        <span className={styles.spacer} />
        {entries.length > 0 && (
          <button className={styles.clear} onClick={clear} type="button">
            Clear
          </button>
        )}
      </div>
      <div className={styles.body} ref={scrollRef}>
        {entries.length === 0 ? (
          <div className={styles.empty}>No events yet.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={styles.row}>
              <span className={styles.time}>{formatTime(entry.timestamp)}</span>
              <span className={levelClass(entry.level)}>{entry.level.toUpperCase()}</span>
              <span className={styles.message}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
