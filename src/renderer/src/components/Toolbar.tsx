import { type ReactNode, useEffect } from 'react';
import {
  IconPointer,
  IconSquare,
  IconLetterT,
  IconPhoto,
  IconForms,
  IconPalette,
  IconSettings,
} from '@tabler/icons-react';
import { useCanvasStore, type Tool } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import styles from './Toolbar.module.css';

const ICON_SIZE = 16;

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

type Props = {
  onOpenSettings?: () => void;
  onOpenTheme?: () => void;
};

export const Toolbar = ({ onOpenSettings, onOpenTheme }: Props): JSX.Element => {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setTool = useCanvasStore((s) => s.setTool);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
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
            aria-pressed={activeTool === t.tool}
            data-tool={t.tool}
          >
            {t.icon}
            {t.label}
            <span className={styles.shortcut}>{t.shortcut}</span>
          </button>
        </Tooltip>
      ))}
      <span className={styles.spacer} />
      {onOpenTheme && (
        <Tooltip label="Theme tokens">
          <button className={styles.button} onClick={onOpenTheme} type="button">
            <IconPalette size={ICON_SIZE} />
            Theme
          </button>
        </Tooltip>
      )}
      {onOpenSettings && (
        <Tooltip label="Settings">
          <button className={styles.button} onClick={onOpenSettings} type="button">
            <IconSettings size={ICON_SIZE} />
            Settings
          </button>
        </Tooltip>
      )}
    </div>
  );
};
