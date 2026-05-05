type Props = {
    elementId: string;
};
/**
 * The link controls that live inside the Element section. Picks the
 * destination dropdown's mode (None / Page / External URL) and either
 * writes the href directly (for `<a>` elements), converts the current
 * tag to `<a>` (for div/span/p/button/etc.), or wraps the element in
 * a new `<a>` parent (for img/video/iframe/svg/input/textarea/select).
 *
 * No prompt asks the user "Convert or Wrap?" — the right action is
 * determined by the current tag. A short tooltip on the dropdown
 * explains what will happen when a destination is picked.
 */
export declare const LinkField: ({ elementId }: Props) => JSX.Element | null;
export {};
