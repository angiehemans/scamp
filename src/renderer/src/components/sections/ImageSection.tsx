import { useCanvasStore } from '@store/canvasSlice';
import { assetsDirSegment } from '@renderer/src/lib/path';
import { Button } from '../controls/Button';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Tooltip } from '../controls/Tooltip';
import { Section, Row } from './Section';
import styles from './ImageSection.module.css';

type Props = {
  elementId: string;
};

const OBJ_FIT_OPTIONS = [
  { value: 'cover', label: 'Cover', tooltip: 'Fill the element, cropping the image if needed' },
  { value: 'contain', label: 'Contain', tooltip: 'Fit the whole image inside, leaving empty space if needed' },
  { value: 'fill', label: 'Fill', tooltip: 'Stretch the image to match the element, ignoring aspect ratio' },
  { value: 'none', label: 'None', tooltip: 'Use the image at its natural size' },
] as const;
const OBJ_POSITION_OPTIONS = [
  'top left', 'top center', 'top right',
  'center left', 'center', 'center right',
  'bottom left', 'bottom center', 'bottom right',
] as const;

export const ImageSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const patchCustomProperties = useCanvasStore((s) => s.patchCustomProperties);
  const activePage = useCanvasStore((s) => s.activePage);
  const projectFormat = useCanvasStore((s) => s.projectFormat);
  const projectPath = useCanvasStore((s) => s.projectPath);
  if (!element || element.type !== 'image') return null;

  const objFit = element.customProperties['object-fit'] ?? 'cover';
  const objPosition = element.customProperties['object-position'] ?? 'center';

  const handleReplace = async (): Promise<void> => {
    if (!activePage || !projectPath) return;
    const chosen = await window.scamp.chooseImage({
      defaultPath: `${projectPath}/${assetsDirSegment(projectFormat)}`,
    });
    if (chosen.canceled || !chosen.path) return;
    const copied = await window.scamp.copyImage({
      sourcePath: chosen.path,
      projectPath,
    });
    patchElement(elementId, { src: copied.relativePath, alt: copied.fileName });
  };

  const updateCustomProp = (prop: string, value: string): void => {
    patchCustomProperties(elementId, { [prop]: value });
  };

  return (
    <Section title="Image">
      <Row label="Source">
        <div className={styles.sourceRow}>
          {element.src ? (
            <Tooltip label={element.src}>
              <span className={styles.sourcePath}>
                {element.src.split('/').pop() ?? '(none)'}
              </span>
            </Tooltip>
          ) : (
            <span className={styles.sourcePath}>(none)</span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleReplace()}
          >
            Replace
          </Button>
        </div>
      </Row>
      <Row label="Alt text">
        <input
          className={styles.altInput}
          type="text"
          value={element.alt ?? ''}
          onChange={(e) => patchElement(elementId, { alt: e.target.value })}
          placeholder="Image description"
        />
      </Row>
      <Row label="Fit">
        <SegmentedControl
          value={objFit}
          options={OBJ_FIT_OPTIONS}
          onChange={(value) => updateCustomProp('object-fit', value)}
        />
      </Row>
      <Row label="Position">
        {/* Raw <button>s: a 3x3 anchor-picker grid of empty cells, not
            labeled action buttons — controls/Button doesn't model this. */}
        <div className={styles.positionGrid}>
          {OBJ_POSITION_OPTIONS.map((opt) => (
            <Tooltip key={opt} label={`Anchor the image to the ${opt}`}>
              <button
                className={`${styles.positionBtn} ${objPosition === opt ? styles.positionActive : ''}`}
                onClick={() => updateCustomProp('object-position', opt)}
                type="button"
              />
            </Tooltip>
          ))}
        </div>
      </Row>
    </Section>
  );
};
