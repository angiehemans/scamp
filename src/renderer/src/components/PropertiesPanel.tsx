import { useCanvasStore } from '@store/canvasSlice';
import { PanelHeader } from './PanelHeader';
import { PanelModeToggle } from './PanelModeToggle';
import { UiPanel } from './UiPanel';
import { CssPanel } from './CssPanel';
import styles from './PropertiesPanel.module.css';

/**
 * Properties panel router. Renders the class chip + mode toggle, then
 * either the typed UI view or the raw CSS view depending on the canvas
 * store's `panelMode`. Both views read the same element state, so flipping
 * is instant and lossless.
 */
export const PropertiesPanel = (): JSX.Element => {
  const selectedId = useCanvasStore((s) => s.selectedElementIds[0] ?? null);
  const panelMode = useCanvasStore((s) => s.panelMode);

  if (!selectedId) {
    return (
      <aside className={styles.panel}>
        <div className={styles.placeholder}>← Select an element to edit its styles</div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel}>
      <PanelHeader />
      <PanelModeToggle />
      {panelMode === 'ui' ? <UiPanel /> : <CssPanel />}
    </aside>
  );
};
