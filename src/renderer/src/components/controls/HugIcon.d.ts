type Props = {
    /** `horizontal` for the width axis, `vertical` for the height axis. */
    orientation: 'horizontal' | 'vertical';
    size?: number;
};
/**
 * The "hug contents" glyph for the Size type picker — horizontal for the
 * width axis, vertical for the height axis.
 */
export declare const HugIcon: ({ orientation, size }: Props) => JSX.Element;
export {};
