import { useEffect } from 'react';
import { useCanvasStore, type Tool } from '@store/canvasSlice';
import styles from './Toolbar.module.css';

type ToolDef = {
  tool: Tool;
  label: string;
  shortcut: string;
};

const TOOLS: ToolDef[] = [
  { tool: 'select', label: 'Select', shortcut: 'V' },
  { tool: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { tool: 'text', label: 'Text', shortcut: 'T' },
];

export const Toolbar = (): JSX.Element => {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setTool = useCanvasStore((s) => s.setTool);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      // Ignore when typing in inputs / editors.
      const target = e.target as HTMLElement;
      if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'r' || e.key === 'R') setTool('rectangle');
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 't' || e.key === 'T') setTool('text');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setTool]);

  return (
    <div className={styles.toolbar}>
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`${styles.button} ${activeTool === t.tool ? styles.active : ''}`}
          onClick={() => setTool(t.tool)}
          type="button"
          title={`${t.label} (${t.shortcut})`}
        >
          {t.label}
          <span className={styles.shortcut}>{t.shortcut}</span>
        </button>
      ))}
    </div>
  );
};
