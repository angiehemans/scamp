import { useCallback, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { TerminalView } from './TerminalView';
import { AppLogView } from './AppLogView';
import { Tooltip } from './controls/Tooltip';
import styles from './TerminalPanel.module.css';

const MAX_SHELLS = 3;

/**
 * A `shell` tab hosts a real pty; a `log` tab renders the app-event
 * log view (save failures etc.). The log tab is pinned — it can't be
 * closed — and is always the first tab so diagnostics are easy to
 * find.
 */
type ShellTab = {
  kind: 'shell';
  /** Stable React key, distinct from the pty id (which the child manages). */
  key: number;
};

type LogTab = {
  kind: 'log';
};

type Tab = ShellTab | LogTab;

const LOG_TAB: LogTab = { kind: 'log' };

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
  const [shells, setShells] = useState<ShellTab[]>([{ kind: 'shell', key: 1 }]);
  const [activeTab, setActiveTab] = useState<Tab>({ kind: 'shell', key: 1 });
  const [nextKey, setNextKey] = useState<number>(2);
  const logEntryCount = useAppLogStore((s) => s.entries.length);

  const handleAddTab = (): void => {
    if (shells.length >= MAX_SHELLS) return;
    const tab: ShellTab = { kind: 'shell', key: nextKey };
    setShells([...shells, tab]);
    setActiveTab(tab);
    setNextKey(nextKey + 1);
  };

  const handleCloseShell = (key: number): void => {
    const remaining = shells.filter((t) => t.key !== key);
    setShells(remaining);
    if (remaining.length === 0) {
      // No shells left — hide the panel and seed a fresh shell so the
      // next time the user opens the terminal there's something ready.
      setBottomPanel('none');
      const seed: ShellTab = { kind: 'shell', key: nextKey };
      setShells([seed]);
      setActiveTab(seed);
      setNextKey(nextKey + 1);
      return;
    }
    if (activeTab.kind === 'shell' && activeTab.key === key) {
      setActiveTab(remaining[0]!);
    }
  };

  const handleExit = useCallback(() => {
    // node-pty exit happens when the user types `exit`. We leave the tab in
    // place so they can read the final output; closing it is their choice.
  }, []);

  const isActive = (tab: Tab): boolean => {
    if (tab.kind === 'log') return activeTab.kind === 'log';
    return activeTab.kind === 'shell' && activeTab.key === tab.key;
  };

  return (
    <div
      className={styles.panel}
      data-testid="terminal-panel"
      data-hidden={hidden ? 'true' : 'false'}
      // Hidden mode keeps the DOM tree (and the pty processes inside
      // each TerminalView) alive while occupying zero layout space.
      style={hidden ? { display: 'none' } : undefined}
    >
      <div className={styles.header}>
        <span className={styles.title}>Terminal</span>
        <div className={styles.tabs}>
          <div
            key="app-log"
            className={`${styles.tab} ${isActive(LOG_TAB) ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(LOG_TAB)}
          >
            <span>App Log</span>
            {logEntryCount > 0 && (
              <span className={styles.badge}>{logEntryCount}</span>
            )}
          </div>
          {shells.map((tab, idx) => (
            <div
              key={tab.key}
              className={`${styles.tab} ${isActive(tab) ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <span>{`Shell ${idx + 1}`}</span>
              <Tooltip label="Close">
                <button
                  className={styles.tabClose}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseShell(tab.key);
                  }}
                  type="button"
                >
                  ×
                </button>
              </Tooltip>
            </div>
          ))}
          {shells.length < MAX_SHELLS && (
            <Tooltip label="New shell">
              <button className={styles.addTab} onClick={handleAddTab} type="button">
                +
              </button>
            </Tooltip>
          )}
        </div>
        <span className={styles.spacer} />
        <Tooltip label="Hide terminal panel">
          <button
            className={styles.closePanel}
            onClick={() => setBottomPanel('none')}
            type="button"
          >
            ×
          </button>
        </Tooltip>
      </div>
      <div className={styles.body}>
        <div
          key="app-log-content"
          className={styles.tabContent}
          style={{ display: isActive(LOG_TAB) ? 'block' : 'none' }}
        >
          <AppLogView />
        </div>
        {shells.map((tab) => (
          <div
            key={tab.key}
            className={styles.tabContent}
            style={{ display: isActive(tab) ? 'block' : 'none' }}
          >
            <TerminalView cwd={cwd} onExit={handleExit} />
          </div>
        ))}
      </div>
    </div>
  );
};
