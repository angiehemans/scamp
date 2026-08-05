import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  IconAi,
  IconCheck,
  IconPointer,
  IconSquare,
  IconLetterT,
  IconPhoto,
  IconForms,
} from '@tabler/icons-react';
import { useCanvasStore, type Tool } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import { copyContextToClipboard } from '../lib/copyContext';
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
      <CopyContextButton />
    </div>
  );
};

/** How long the check mark replaces the icon after a successful copy. */
const COPIED_FEEDBACK_MS = 1200;

/**
 * Copies a one-line description of the selection for pasting in front of a
 * terminal question. Deliberately NOT disabled without a selection — the
 * page-level string is useful on its own, and dimming it would hide the
 * feature exactly when someone is asking a whole-page question.
 * see docs/plans/copy-context-button-plan.md
 */
const CopyContextButton = (): JSX.Element => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );

  const handleClick = (): void => {
    void copyContextToClipboard().then((ok) => {
      // Only claim success when the write actually landed.
      if (!ok) return;
      setCopied(true);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    });
  };

  return (
    <Tooltip label={copied ? 'Copied' : 'Copy context for agent (⇧⌘C)'}>
      <button
        className={styles.button}
        onClick={handleClick}
        type="button"
        aria-label="Copy context for agent"
        data-copied={copied ? 'true' : undefined}
        data-action="copy-context"
      >
        {copied ? (
          <IconCheck size={ICON_SIZE} />
        ) : (
          <IconAi size={ICON_SIZE} />
        )}
      </button>
    </Tooltip>
  );
};
