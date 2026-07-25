import type { AlignItems, FlexDirection, JustifyContent } from '@lib/element';
type Props = {
    direction: FlexDirection;
    alignItems: AlignItems;
    justifyContent: JustifyContent;
    onChange: (patch: {
        alignItems: AlignItems;
        justifyContent: JustifyContent;
    }) => void;
};
/**
 * A 3×3 alignment picker (Figma-style). Clicking a cell packs the
 * element to that corner/edge/center by setting both `alignItems` and
 * `justifyContent`. The preview bars mirror the element's ACTUAL values
 * — including `space-*` / `stretch`, which the grid can't pin to a
 * single cell (those are still editable via the dropdowns below it).
 */
export declare const AlignmentGrid: ({ direction, alignItems, justifyContent, onChange, }: Props) => JSX.Element;
export {};
