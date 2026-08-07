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
 * A 3×3 alignment picker (Figma-style). Clicking a cell packs the element to
 * that corner/edge/center by setting both `alignItems` and `justifyContent`.
 *
 * The bars render INSIDE the cell they describe, as grid items sharing that
 * cell's tracks — not as an overlay stretched across the whole control. That
 * is what makes them line up with the dots for free: the cell centres them,
 * so there is no geometry to hand-tune.
 * see docs/notes/alignment-grid.md
 */
export declare const AlignmentGrid: ({ direction, alignItems, justifyContent, onChange, }: Props) => JSX.Element;
export {};
