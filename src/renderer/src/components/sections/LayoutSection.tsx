import {
  IconArrowDown,
  IconArrowRight,
  IconLayoutBoard,
  IconLayoutGrid,
} from '@tabler/icons-react';

import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { NumberInput } from '../controls/NumberInput';
import { EnumSelect } from '../controls/EnumSelect';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import { SegmentedControl } from '../controls/SegmentedControl';
import type {
  AlignItems,
  GridSelfAlign,
  JustifyContent,
  ScampElement,
} from '@lib/element';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

/**
 * The four UI options the panel surfaces. Internally these still map
 * onto `display` + `flexDirection` so generated CSS and round-trips
 * stay unchanged.
 */
type LayoutMode = 'block' | 'flex-row' | 'flex-column' | 'grid';

const ICON_SIZE = 16;

const LAYOUT_OPTIONS: ReadonlyArray<{
  value: LayoutMode;
  label: JSX.Element;
  ariaLabel: string;
  tooltip: string;
}> = [
  {
    value: 'block',
    label: <IconLayoutBoard size={ICON_SIZE} stroke={1.75} />,
    ariaLabel: 'Block',
    tooltip: 'Block (no flex / no grid)',
  },
  {
    value: 'flex-row',
    label: <IconArrowRight size={ICON_SIZE} stroke={1.75} />,
    ariaLabel: 'Flex row',
    tooltip: 'Flex row — children flow horizontally',
  },
  {
    value: 'flex-column',
    label: <IconArrowDown size={ICON_SIZE} stroke={1.75} />,
    ariaLabel: 'Flex column',
    tooltip: 'Flex column — children flow vertically',
  },
  {
    value: 'grid',
    label: <IconLayoutGrid size={ICON_SIZE} stroke={1.75} />,
    ariaLabel: 'Grid',
    tooltip: 'Grid — 2D layout',
  },
];

const ALIGN_OPTIONS: ReadonlyArray<{ value: AlignItems; label: string }> = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'stretch', label: 'Stretch' },
];

const JUSTIFY_OPTIONS: ReadonlyArray<{ value: JustifyContent; label: string }> = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'space-between', label: 'Between' },
  { value: 'space-around', label: 'Around' },
];

const GRID_SELF_OPTIONS: ReadonlyArray<{ value: GridSelfAlign; label: string }> = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
  { value: 'stretch', label: 'Stretch' },
];

const layoutModeFor = (el: ScampElement): LayoutMode => {
  if (el.display === 'grid') return 'grid';
  if (el.display === 'flex') {
    return el.flexDirection === 'column' ? 'flex-column' : 'flex-row';
  }
  return 'block';
};

/**
 * Build a patch that switches the element's layout mode and migrates
 * gap fields so the user's intuition about gap-vs-row/column-gap is
 * preserved.
 *
 * - * → flex-(row|column): set display=flex, set flexDirection. If the
 *   previous mode was grid, copy `columnGap` (preferring the more
 *   common axis) into `gap` and reset both grid gaps.
 * - * → grid: set display=grid. If the previous mode was a flex one,
 *   copy `gap` into both `columnGap` and `rowGap` and reset `gap`.
 * - * → block: set display='none'.
 */
const computeLayoutPatch = (
  current: ScampElement,
  next: LayoutMode
): Partial<ScampElement> => {
  const wasGrid = current.display === 'grid';
  const wasFlex = current.display === 'flex';

  if (next === 'block') {
    return { display: 'none' };
  }
  if (next === 'grid') {
    if (wasFlex) {
      return {
        display: 'grid',
        columnGap: current.gap,
        rowGap: current.gap,
        gap: 0,
      };
    }
    return { display: 'grid' };
  }
  // Flex row / flex column.
  const flexDirection = next === 'flex-column' ? 'column' : 'row';
  if (wasGrid) {
    return {
      display: 'flex',
      flexDirection,
      gap: current.columnGap || current.rowGap,
      columnGap: 0,
      rowGap: 0,
    };
  }
  return { display: 'flex', flexDirection };
};

export const LayoutSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  const isFlex = element.display === 'flex';
  const isGrid = element.display === 'grid';
  const mode = layoutModeFor(element);

  // When the element is hidden with `display: none`, layout controls
  // are meaningless — surface that clearly rather than showing
  // interactive controls that won't affect the output CSS.
  if (element.visibilityMode === 'none') {
    return (
      <Section title="Layout">
        <div
          style={{
            fontSize: 12,
            color: '#888',
            padding: '8px 0',
            lineHeight: 1.4,
          }}
        >
          Layout is disabled while Visibility is set to None — the
          element is removed from the page.
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="Layout"
      elementId={elementId}
      fields={[
        'display',
        'flexDirection',
        'alignItems',
        'justifyContent',
        'gap',
        'gridTemplateColumns',
        'gridTemplateRows',
        'columnGap',
        'rowGap',
        'justifyItems',
      ]}
    >
      <Row label="">
        <SegmentedControl<LayoutMode>
          value={mode}
          options={LAYOUT_OPTIONS}
          onChange={(value) =>
            patchElement(elementId, computeLayoutPatch(element, value))
          }
          title="Display mode"
        />
      </Row>
      {isFlex && (
        <>
          <Row label="">
            <EnumSelect<AlignItems>
              value={element.alignItems}
              options={ALIGN_OPTIONS}
              onChange={(value) => patchElement(elementId, { alignItems: value })}
              title="Align items"
            />
            <EnumSelect<JustifyContent>
              value={element.justifyContent}
              options={JUSTIFY_OPTIONS}
              onChange={(value) => patchElement(elementId, { justifyContent: value })}
              title="Justify content"
            />
          </Row>
          <Row label="">
            <NumberInput
              prefix="Gap"
              title="Gap between flex children"
              value={element.gap}
              onChange={(value) => patchElement(elementId, { gap: value ?? 0 })}
              min={0}
            />
          </Row>
        </>
      )}
      {isGrid && (
        <>
          <Row label="">
            <PrefixSuffixInput
              prefix="Cols"
              title="grid-template-columns"
              value={element.gridTemplateColumns}
              placeholder="1fr 1fr"
              onCommit={(value) =>
                patchElement(elementId, { gridTemplateColumns: value.trim() })
              }
            />
          </Row>
          <Row label="">
            <PrefixSuffixInput
              prefix="Rows"
              title="grid-template-rows"
              value={element.gridTemplateRows}
              placeholder="auto"
              onCommit={(value) =>
                patchElement(elementId, { gridTemplateRows: value.trim() })
              }
            />
          </Row>
          <Row label="">
            <NumberInput
              prefix="C-gap"
              title="column-gap"
              value={element.columnGap}
              onChange={(value) =>
                patchElement(elementId, { columnGap: value ?? 0 })
              }
              min={0}
            />
            <NumberInput
              prefix="R-gap"
              title="row-gap"
              value={element.rowGap}
              onChange={(value) => patchElement(elementId, { rowGap: value ?? 0 })}
              min={0}
            />
          </Row>
          <Row label="">
            <EnumSelect<AlignItems>
              value={element.alignItems}
              options={ALIGN_OPTIONS}
              onChange={(value) => patchElement(elementId, { alignItems: value })}
              title="Align items"
            />
            <EnumSelect<GridSelfAlign>
              value={element.justifyItems}
              options={GRID_SELF_OPTIONS}
              onChange={(value) => patchElement(elementId, { justifyItems: value })}
              title="Justify items"
            />
          </Row>
        </>
      )}
    </Section>
  );
};
