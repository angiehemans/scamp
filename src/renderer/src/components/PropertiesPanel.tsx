import { useCanvasStore } from '@store/canvasSlice';
import { PanelHeader } from './PanelHeader';
import { PanelModeToggle } from './PanelModeToggle';
import { StateSwitcher } from './StateSwitcher';
import { UiPanel } from './UiPanel';
import { CssPanel } from './CssPanel';
import styles from './PropertiesPanel.module.css';

const SHORTCUTS: ReadonlyArray<{ keys: string; description: string }> = [
  { keys: 'V', description: 'Select tool' },
  { keys: 'R', description: 'Rectangle tool' },
  { keys: 'T', description: 'Text tool' },
  { keys: 'I', description: 'Image tool' },
  { keys: 'Delete', description: 'Delete element' },
  { keys: 'Cmd+C', description: 'Copy element' },
  { keys: 'Cmd+V', description: 'Paste element' },
  { keys: 'Cmd+D', description: 'Duplicate element' },
  { keys: 'Cmd+G', description: 'Group selection' },
  { keys: 'Cmd+Z', description: 'Undo' },
  { keys: 'Cmd+Shift+Z', description: 'Redo' },
  { keys: 'Cmd+S', description: 'Save CSS edits' },
  { keys: 'Cmd+=', description: 'Zoom in' },
  { keys: 'Cmd+-', description: 'Zoom out' },
  { keys: 'Cmd+0', description: 'Reset zoom' },
  { keys: 'Double-click', description: 'Edit text / Rename layer' },
  { keys: 'Shift+click', description: 'Multi-select' },
];

const ShortcutsTable = (): JSX.Element => (
  <div className={styles.shortcutsWrap}>
    <h3 className={styles.shortcutsTitle}>Keyboard Shortcuts</h3>
    <table className={styles.shortcutsTable}>
      <tbody>
        {SHORTCUTS.map((s) => (
          <tr key={s.keys}>
            <td className={styles.shortcutKeys}>{s.keys}</td>
            <td className={styles.shortcutDesc}>{s.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const PropertiesPanel = (): JSX.Element => {
  const selectedId = useCanvasStore((s) => s.selectedElementIds[0] ?? null);
  const panelMode = useCanvasStore((s) => s.panelMode);

  if (!selectedId) {
    return (
      <aside
        className={styles.panel}
        data-testid="properties-panel"
        data-panel-mode="empty"
      >
        <ShortcutsTable />
      </aside>
    );
  }

  return (
    <aside
      className={styles.panel}
      data-testid="properties-panel"
      data-panel-mode={panelMode}
    >
      <PanelHeader />
      <PanelModeToggle />
      {panelMode === 'ui' && <StateSwitcher />}
      {panelMode === 'ui' ? <UiPanel /> : <CssPanel />}
    </aside>
  );
};
