import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { PositionSection } from './sections/PositionSection';
import { SizeSection, RootSizeSection } from './sections/SizeSection';
import { LayoutSection } from './sections/LayoutSection';
import { SpacingSection } from './sections/SpacingSection';
import { BackgroundSection } from './sections/BackgroundSection';
import { BorderSection } from './sections/BorderSection';
import { TagSection } from './sections/TagSection';
import { TypographySection } from './sections/TypographySection';
import { ImageSection } from './sections/ImageSection';
import styles from './PropertiesPanel.module.css';

/**
 * The typed view of the properties panel. Reads the primary selected
 * element from the store and renders the sections that apply to its
 * element type:
 *
 *   - root: Page size, Layout, Spacing (padding only), Background
 *   - rect: Position*, Size, Layout, Spacing, Background, Border
 *   - text: Position*, Size, Spacing, Background, Border, Tag, Typography
 *          (no Layout — text elements can't have children)
 *
 * (*) Position is only rendered when the parent is non-flex — flex layout
 * owns placement otherwise.
 *
 * Each section is its own small component that reads its own slice of the
 * store and writes via `patchElement`. The UI panel is a thin orchestrator
 * with no edit logic of its own.
 */
export const UiPanel = (): JSX.Element => {
  const elementId = useCanvasStore((s) => s.selectedElementIds[0] ?? null);
  const element = useCanvasStore((s) => (elementId ? s.elements[elementId] : undefined));
  const parentIsFlex = useCanvasStore((s) => {
    if (!element || !element.parentId) return false;
    const parent = s.elements[element.parentId];
    return parent?.display === 'flex';
  });

  if (!elementId || !element) return <></>;

  const isRoot = elementId === ROOT_ELEMENT_ID;
  const isText = element.type === 'text';
  const isImage = element.type === 'image';
  const showPosition = !isRoot && !parentIsFlex;

  if (isRoot) {
    return (
      <div className={styles.uiPanelBody}>
        <RootSizeSection elementId={elementId} />
        <LayoutSection elementId={elementId} />
        <SpacingSection elementId={elementId} hideMargin />
        <BackgroundSection elementId={elementId} />
      </div>
    );
  }

  return (
    <div className={styles.uiPanelBody}>
      {showPosition && <PositionSection elementId={elementId} />}
      <SizeSection elementId={elementId} />
      {!isText && !isImage && <LayoutSection elementId={elementId} />}
      <SpacingSection elementId={elementId} />
      {!isImage && <BackgroundSection elementId={elementId} />}
      {!isImage && <BorderSection elementId={elementId} />}
      {isImage && <ImageSection elementId={elementId} />}
      {isText && <TagSection elementId={elementId} />}
      {isText && <TypographySection elementId={elementId} />}
    </div>
  );
};
