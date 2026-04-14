import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { ColorInput } from '../controls/ColorInput';
import { Tooltip } from '../controls/Tooltip';
import { Section, Row } from './Section';
import styles from './BackgroundSection.module.css';

type Props = {
  elementId: string;
};

const BG_SIZE_OPTIONS: ReadonlyArray<{ value: string; label: string; tooltip: string }> = [
  { value: 'cover', label: 'Cover', tooltip: 'Fill the element, cropping the image if needed' },
  { value: 'contain', label: 'Contain', tooltip: 'Fit the whole image inside, leaving empty space if needed' },
  { value: 'auto', label: 'Auto', tooltip: 'Use the image at its original size' },
];

const BG_REPEAT_OPTIONS: ReadonlyArray<{ value: string; label: string; tooltip: string }> = [
  { value: 'no-repeat', label: 'None', tooltip: 'No repeat — show the image once' },
  { value: 'repeat', label: 'All', tooltip: 'Tile the image in both directions' },
  { value: 'repeat-x', label: 'X', tooltip: 'Tile the image horizontally' },
  { value: 'repeat-y', label: 'Y', tooltip: 'Tile the image vertically' },
];

const BG_POSITION_OPTIONS = [
  'top left', 'top center', 'top right',
  'center left', 'center', 'center right',
  'bottom left', 'bottom center', 'bottom right',
] as const;

export const BackgroundSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const projectColors = useCanvasStore(selectProjectColors);
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const openThemePanel = useCanvasStore((s) => s.openThemePanel);
  const activePage = useCanvasStore((s) => s.activePage);
  if (!element) return null;

  const bgImage = element.customProperties['background-image'] ?? null;
  const bgSize = element.customProperties['background-size'] ?? 'cover';
  const bgPosition = element.customProperties['background-position'] ?? 'center';
  const bgRepeat = element.customProperties['background-repeat'] ?? 'no-repeat';

  const handleSetBackgroundImage = async (): Promise<void> => {
    if (!activePage) return;
    const normalized = activePage.tsxPath.replace(/\\/g, '/');
    const projectPath = normalized.slice(0, normalized.lastIndexOf('/'));
    const chosen = await window.scamp.chooseImage({ defaultPath: `${projectPath}/assets` });
    if (chosen.canceled || !chosen.path) return;
    const copied = await window.scamp.copyImage({
      sourcePath: chosen.path,
      projectPath,
    });
    patchElement(elementId, {
      customProperties: {
        ...element.customProperties,
        'background-image': `url("${copied.relativePath}")`,
        'background-size': 'cover',
        'background-position': 'center',
        'background-repeat': 'no-repeat',
      },
    });
  };

  const handleRemoveBackgroundImage = (): void => {
    const next = { ...element.customProperties };
    delete next['background-image'];
    delete next['background-size'];
    delete next['background-position'];
    delete next['background-repeat'];
    patchElement(elementId, { customProperties: next });
  };

  const updateBgProp = (prop: string, value: string): void => {
    patchElement(elementId, {
      customProperties: {
        ...element.customProperties,
        [prop]: value,
      },
    });
  };

  return (
    <Section title="Background">
      <Row label="">
        <ColorInput
          value={element.backgroundColor}
          onChange={(value) => patchElement(elementId, { backgroundColor: value })}
          presetColors={projectColors.length > 0 ? projectColors : undefined}
          tokens={themeTokens}
          onOpenTheme={openThemePanel ?? undefined}
        />
      </Row>
      <Row label="">
        <button
          className={styles.imageButton}
          onClick={() => void handleSetBackgroundImage()}
          type="button"
        >
          {bgImage ? 'Replace image' : 'Set background image'}
        </button>
      </Row>
      {bgImage && (
        <>
          <Row label="Size">
            <div className={styles.segmented}>
              {BG_SIZE_OPTIONS.map((opt) => (
                <Tooltip key={opt.value} label={opt.tooltip}>
                  <button
                    className={`${styles.segmentedBtn} ${bgSize === opt.value ? styles.segmentedActive : ''}`}
                    onClick={() => updateBgProp('background-size', opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                </Tooltip>
              ))}
            </div>
          </Row>
          <Row label="Position">
            <div className={styles.positionGrid}>
              {BG_POSITION_OPTIONS.map((opt) => (
                <Tooltip key={opt} label={`Anchor the image to the ${opt}`}>
                  <button
                    className={`${styles.positionBtn} ${bgPosition === opt ? styles.positionActive : ''}`}
                    onClick={() => updateBgProp('background-position', opt)}
                    type="button"
                  />
                </Tooltip>
              ))}
            </div>
          </Row>
          <Row label="Repeat">
            <div className={styles.segmented}>
              {BG_REPEAT_OPTIONS.map((opt) => (
                <Tooltip key={opt.value} label={opt.tooltip}>
                  <button
                    className={`${styles.segmentedBtn} ${bgRepeat === opt.value ? styles.segmentedActive : ''}`}
                    onClick={() => updateBgProp('background-repeat', opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                </Tooltip>
              ))}
            </div>
          </Row>
          <Row label="">
            <button
              className={styles.removeButton}
              onClick={handleRemoveBackgroundImage}
              type="button"
            >
              Remove background image
            </button>
          </Row>
        </>
      )}
    </Section>
  );
};
