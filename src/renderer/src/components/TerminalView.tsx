import { useEffect, useLayoutEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import styles from './TerminalView.module.css';

type Props = {
  cwd: string;
  /** Notifies parent when the spawned terminal exits so the tab can be removed. */
  onExit?: (id: string) => void;
};

/**
 * One xterm.js terminal bound to a node-pty process in the main process.
 *
 * Lifecycle:
 *  - On mount: spin up xterm + ask main to spawn a pty in the project cwd.
 *  - User keystrokes → ipc write → pty stdin.
 *  - Pty stdout → ipc data event → xterm.write.
 *  - Container resize → fit addon → ipc resize → pty resize.
 *  - On unmount: kill the pty and dispose xterm.
 */
export const TerminalView = ({ cwd, onExit }: Props): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 12,
      theme: {
        background: '#0f0f0f',
        foreground: '#e6e6e6',
        cursor: '#3b82f6',
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    let disposed = false;
    let offData: (() => void) | null = null;
    let offExit: (() => void) | null = null;

    const setup = async (): Promise<void> => {
      const { id } = await window.scamp.createTerminal({
        cwd,
        cols: term.cols,
        rows: term.rows,
      });
      if (disposed) {
        void window.scamp.killTerminal({ id });
        return;
      }
      ptyIdRef.current = id;

      offData = window.scamp.onTerminalData((payload) => {
        if (payload.id !== id) return;
        term.write(payload.data);
      });
      offExit = window.scamp.onTerminalExit((payload) => {
        if (payload.id !== id) return;
        term.write('\r\n[process exited]\r\n');
        onExit?.(id);
      });

      term.onData((data) => {
        void window.scamp.writeTerminal({ id, data });
      });
      term.onResize(({ cols, rows }) => {
        void window.scamp.resizeTerminal({ id, cols, rows });
      });
    };

    void setup();

    const handleResize = (): void => {
      try {
        fit.fit();
      } catch {
        // xterm throws if not yet attached or if the container has zero size.
      }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    return () => {
      disposed = true;
      ro.disconnect();
      offData?.();
      offExit?.();
      const id = ptyIdRef.current;
      if (id) {
        void window.scamp.killTerminal({ id });
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // We deliberately re-create the terminal when cwd changes — the project
    // root is the entire reason this component exists.
  }, [cwd, onExit]);

  // Refit when the container becomes visible (e.g. panel toggled).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        fitRef.current?.fit();
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(t);
  });

  return <div ref={containerRef} className={styles.terminal} />;
};
