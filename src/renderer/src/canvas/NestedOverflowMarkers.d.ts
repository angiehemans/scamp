type Props = {
    /** Frame element to scan. Markers are positioned in its logical space. */
    frame: HTMLElement | null;
    /** Applied canvas zoom. Only used to counter-scale the label — marker
     *  boxes are in frame-local px and the frame's transform scales them. */
    scale: number;
    /** Any value that changes when the tree does, to trigger a re-scan. */
    revision: unknown;
};
export declare const NestedOverflowMarkers: ({ frame, scale, revision, }: Props) => JSX.Element | null;
export {};
