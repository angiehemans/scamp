import { RefObject } from 'react';
type Props = {
    frameRef: RefObject<HTMLDivElement>;
    scale: number;
};
/**
 * The chrome layer that sits above the rendered canvas and owns all
 * pointer interaction. It holds the selection-overlay measurement and the
 * select-tool hit-testing, and dispatches drags to the per-tool state
 * machines: draw (rectangle / input / text / image), move, resize, reorder
 * (flex children), and OS image drop. See interactions/ for each hook.
 */
export declare const CanvasInteractionLayer: ({ frameRef, scale }: Props) => JSX.Element;
export {};
