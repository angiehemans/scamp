import { useMemo } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { classifyToken } from '@lib/tokenClassify';
import { FourSideInput } from '../controls/FourSideInput';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
  hideMargin?: boolean;
};

export const SpacingSection = ({ elementId, hideMargin = false }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const openThemePanel = useCanvasStore((s) => s.openThemePanel);
  // Spacing-typed controls offer length-shaped tokens (px / rem / em).
  // `classifyToken` calls them `'fontSize'` because that's the bucket
  // the classifier originally needed for typography; we reuse the
  // same bucket here because spacing tokens are length values too.
  const spacingTokens = useMemo(
    () => themeTokens.filter((t) => classifyToken(t.value) === 'fontSize'),
    [themeTokens]
  );
  if (!element) return null;

  return (
    <Section
      title="Spacing"
      elementId={elementId}
      fields={hideMargin ? ['padding'] : ['padding', 'margin']}
      cssProperties={hideMargin ? ['padding'] : ['padding', 'margin']}
    >
      <Row label="">
        <FourSideInput
          prefix="P"
          title="Padding (top right bottom left)"
          value={element.padding}
          onChange={(next) => patchElement(elementId, { padding: next })}
          min={0}
          tokens={spacingTokens}
          {...(openThemePanel ? { onOpenTheme: openThemePanel } : {})}
        />
      </Row>
      {!hideMargin && (
        <Row label="">
          <FourSideInput
            prefix="M"
            title="Margin (top right bottom left)"
            value={element.margin}
            onChange={(next) => patchElement(elementId, { margin: next })}
            tokens={spacingTokens}
            {...(openThemePanel ? { onOpenTheme: openThemePanel } : {})}
          />
        </Row>
      )}
    </Section>
  );
};
