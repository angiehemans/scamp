import { useCallback, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { TerminalView } from './TerminalView';
import styles from './TerminalPanel.module.css';

const MAX_TABS = 3;

type Tab = {
  /** Stable React key, distinct from the pty id (which the child manages). */
  key: number;
};

type Props = {
  cwd: string;
  /**
   * When true, the panel is hidden via `display: none` rather than
   * unmounted. The pty processes inside each tab keep running so the
   * user can come back to a long-running command (e.g. an agent CLI)
   * without losing the session.
   */
  hidden?: boolean;
};

export const TerminalPanel = ({ cwd, hidden = false }: Props): JSX.Element => {
  const setBottomPanel = useCanvasStore((s) => s.setBottomPanel);
  const [tabs, setTabs] = useState<Tab[]>([{ key: 1 }]);
  const [activeKey, setActiveKey] = useState<number>(1);
  const [nextKey, setNextKey] = useState<number>(2);

  const handleAddTab = (): void => {
    if (tabs.length >= MAX_TABS) return;
    const tab: Tab = { key: nextKey };
    setTabs([...tabs, tab]);
    setActiveKey(nextKey);
    setNextKey(nextKey + 1);
  };

  const handleCloseTab = (key: number): void => {
    const remaining = tabs.filter((t) => t.key !== key);
    setTabs(remaining);
    if (remaining.length === 0) {
      // No tabs left — hide the panel and seed a fresh tab so the next
      // time the user opens the terminal there's something ready.
      setBottomPanel('none');
      setTabs([{ key: nextKey }]);
      setActiveKey(nextKey);
      setNextKey(nextKey + 1);
      return;
    }
    if (activeKey === key) {
      setActiveKey(remaining[0]!.key);
    }
  };

  const handleExit = useCallback(() => {
    // node-pty exit happens when the user types `exit`. We leave the tab in
    // place so they can read the final output; closing it is their choice.
  }, []);

  return (
    <div
      className={styles.panel}
      // Hidden mode keeps the DOM tree (and the pty processes inside
      // each TerminalView) alive while occupying zero layout space.
      style={hidden ? { display: 'none' } : undefined}
    >
      <div className={styles.header}>
        <span className={styles.title}>Terminal</span>
        <div className={styles.tabs}>
          {tabs.map((tab, idx) => (
            <div
              key={tab.key}
              className={`${styles.tab} ${activeKey === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveKey(tab.key)}
            >
              <span>{`Shell ${idx + 1}`}</span>
              <button
                className={styles.tabClose}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.key);
                }}
                type="button"
                title="Close"
              >
                ×
              </button>
            </div>
          ))}
          {tabs.length < MAX_TABS && (
            <button
              className={styles.addTab}
              onClick={handleAddTab}
              type="button"
              title="New shell"
            >
              +
            </button>
          )}
        </div>
        <span className={styles.spacer} />
        <button
          className={styles.closePanel}
          onClick={() => setBottomPanel('none')}
          type="button"
          title="Hide terminal panel"
        >
          ×
        </button>
      </div>
      <div className={styles.body}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={styles.tabContent}
            style={{ display: activeKey === tab.key ? 'block' : 'none' }}
          >
            <TerminalView cwd={cwd} onExit={handleExit} />
          </div>
        ))}
      </div>
    </div>
  );
};
