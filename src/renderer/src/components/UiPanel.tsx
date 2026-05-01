import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { PositionSection } from './sections/PositionSection';
import { SizeSection } from './sections/SizeSection';
import { LayoutSection } from './sections/LayoutSection';
import { SpacingSection } from './sections/SpacingSection';
import { BackgroundSection } from './sections/BackgroundSection';
import { BorderSection } from './sections/BorderSection';
import { ElementSection } from './sections/ElementSection';
import { TypographySection } from './sections/TypographySection';
import { ImageSection } from './sections/ImageSection';
import { VisibilitySection } from './sections/VisibilitySection';
import { TransitionsSection } from './sections/TransitionsSection';
import { AnimationSection } from './sections/AnimationSection';
import styles from './PropertiesPanel.module.css';

/**
 * The typed view of the properties panel. Reads the primary selected
 * element from the store and renders the sections that apply to its
 * element type. Root is treated like a regular rectangle — it just
 * has no parent, so Position is hidden.
 *
 * Each section is its own small component that reads its own slice of
 * the store and writes via `patchElement`. The UI panel is a thin
 * orchestrator with no edit logic of its own.
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
  const isInput = element.type === 'input';
  // Position is only meaningful when there's a non-flex parent to
  // anchor against. Root has no parent; flex children flow with the
  // layout engine.
  const showPosition = !isRoot && !parentIsFlex;

  return (
    <div className={styles.uiPanelBody}>
      {/* Element section handles tag + tag-specific attributes. Not
          rendered for root because the root's tag is always `<div>`
          (the wrapping page component) and the section has nothing
          meaningful to show there. */}
      {!isRoot && <ElementSection elementId={elementId} />}
      {showPosition && <PositionSection elementId={elementId} />}
      <SizeSection elementId={elementId} />
      {!isText && !isImage && !isInput && <LayoutSection elementId={elementId} />}
      <SpacingSection elementId={elementId} hideMargin={isRoot} />
      {!isImage && <BackgroundSection elementId={elementId} />}
      {!isImage && <BorderSection elementId={elementId} />}
      {isImage && <ImageSection elementId={elementId} />}
      {isText && <TypographySection elementId={elementId} />}
      <VisibilitySection elementId={elementId} />
      <TransitionsSection elementId={elementId} />
      <AnimationSection elementId={elementId} />
    </div>
  );
};
