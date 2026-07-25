type Props = {
    /**
     * `horizontal` — spacing between side-by-side items (flex row /
     * grid column-gap). `vertical` — spacing between stacked items
     * (flex column / grid row-gap).
     */
    orientation: 'horizontal' | 'vertical';
    size?: number;
};
/**
 * The gap-direction glyph shown inside the spacing inputs in place of a
 * "Gap" text label. Horizontal for row / column-gap, vertical for
 * column / row-gap.
 */
export declare const GapIcon: ({ orientation, size }: Props) => JSX.Element;
export {};
