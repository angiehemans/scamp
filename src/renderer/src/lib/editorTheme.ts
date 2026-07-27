import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';

import type { AppTheme } from '@shared/types';

/**
 * Light CodeMirror chrome. Only styles the editor surface/gutters/selection —
 * syntax colors come from @uiw's default light highlight style (part of its
 * basicSetup) when no dark theme is layered on. Values reference the app
 * chrome tokens so it tracks theme.css without hardcoded hex. Deliberately
 * uses `--bg-input` (a soft grey), never stark white.
 */
const lightEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--bg-input)',
      color: 'var(--text-primary)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-input)',
      color: 'var(--text-tertiary)',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.035)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection':
      {
        backgroundColor: 'var(--accent-muted)',
      },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text-primary)' },
  },
  { dark: false }
);

/** The CodeMirror theme extension for the active app chrome theme. */
export const editorThemeFor = (theme: AppTheme): Extension =>
  theme === 'light' ? lightEditorTheme : oneDark;
