import { type ReactNode, useEffect } from 'react';
import {
  IconCode,
  IconPointer,
  IconSquare,
  IconLetterT,
  IconPhoto,
  IconForms,
  IconTerminal2,
} from '@tabler/icons-react';
import { useCanvasStore, type Tool } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import styles from './Toolbar.module.css';

const ICON_SIZE = 18;

type ToolDef = {
  tool: Tool;
  label: string;
  shortcut: string;
  icon: ReactNode;
};

const TOOLS: ToolDef[] = [
  { tool: 'select', label: 'Select', shortcut: 'V', icon: <IconPointer size={ICON_SIZE} /> },
  { tool: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <IconSquare size={ICON_SIZE} /> },
  { tool: 'text', label: 'Text', shortcut: 'T', icon: <IconLetterT size={ICON_SIZE} /> },
  { tool: 'image', label: 'Image', shortcut: 'I', icon: <IconPhoto size={ICON_SIZE} /> },
  { tool: 'input', label: 'Input', shortcut: 'F', icon: <IconForms size={ICON_SIZE} /> },
];

export const Toolbar = (): JSX.Element => {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setTool = useCanvasStore((s) => s.setTool);
  // Tools are disabled while previewing a snapshot (read-only canvas).
  const isPreviewing = useCanvasStore((s) => s.snapshotPreview !== null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (useCanvasStore.getState().snapshotPreview !== null) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'r' || e.key === 'R') setTool('rectangle');
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 't' || e.key === 'T') setTool('text');
      if (e.key === 'i' || e.key === 'I') setTool('image');
      if (e.key === 'f' || e.key === 'F') setTool('input');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setTool]);

  return (
    <div className={styles.toolbar} data-testid="element-toolbar" data-active-tool={activeTool}>
      {TOOLS.map((t) => (
        <Tooltip key={t.tool} label={`${t.label} (${t.shortcut})`}>
          <button
            className={`${styles.button} ${activeTool === t.tool ? styles.active : ''}`}
            onClick={() => setTool(t.tool)}
            type="button"
            disabled={isPreviewing}
            aria-pressed={activeTool === t.tool}
            aria-label={t.label}
            data-tool={t.tool}
          >
            {t.icon}
          </button>
        </Tooltip>
      ))}
      <div className={styles.spacer} />
      <PanelToggles />
    </div>
  );
};

/**
 * Code and terminal toggles, right-aligned on the canvas toolbar.
 *
 * Icon-only: the strip is already dense, and both icons are unambiguous
 * with a tooltip. Reads the store directly rather than taking props —
 * `ProjectShell` → `CanvasArea` → `Toolbar` would be three levels of
 * drilling for a toggle the store already owns.
 */
const PanelToggles = (): JSX.Element => {
  const bottomPanel = useCanvasStore((s) => s.bottomPanel);
  const toggleBottomPanel = useCanvasStore((s) => s.toggleBottomPanel);

  return (
    <>
      <Tooltip label="Toggle code panel">
        <button
          className={`${styles.button} ${
            bottomPanel === 'code' ? styles.active : ''
          }`}
          onClick={() => toggleBottomPanel('code')}
          type="button"
          aria-label="Toggle code panel"
          aria-pressed={bottomPanel === 'code'}
          data-action="toggle-code"
        >
          <IconCode size={ICON_SIZE} />
        </button>
      </Tooltip>
      <Tooltip label="Toggle terminal (Ctrl+`)">
        <button
          className={`${styles.button} ${
            bottomPanel === 'terminal' ? styles.active : ''
          }`}
          onClick={() => toggleBottomPanel('terminal')}
          type="button"
          aria-label="Toggle terminal"
          aria-pressed={bottomPanel === 'terminal'}
          data-action="toggle-terminal"
        >
          <IconTerminal2 size={ICON_SIZE} />
        </button>
      </Tooltip>
    </>
  );
};
