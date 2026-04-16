import { useCanvasStore } from '@store/canvasSlice';
import { SegmentedControl } from './controls/SegmentedControl';
import styles from './PropertiesPanel.module.css';

const OPTIONS = [
  { value: 'ui' as const, label: 'Visual' },
  { value: 'css' as const, label: 'CSS' },
];

/**
 * Top-of-panel toggle between the typed UI view and the raw CSS editor.
 * The selection lives in the canvas store as `panelMode` so it survives
 * selection changes and re-renders without being persisted to disk.
 */
export const PanelModeToggle = (): JSX.Element => {
  const panelMode = useCanvasStore((s) => s.panelMode);
  const setPanelMode = useCanvasStore((s) => s.setPanelMode);
  return (
    <div className={styles.modeToggleWrap}>
      <SegmentedControl value={panelMode} options={OPTIONS} onChange={setPanelMode} />
    </div>
  );
};
