import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { ColorInput } from '../controls/ColorInput';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

export const BackgroundSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const projectColors = useCanvasStore(selectProjectColors);
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const openThemePanel = useCanvasStore((s) => s.openThemePanel);
  if (!element) return null;

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
    </Section>
  );
};
