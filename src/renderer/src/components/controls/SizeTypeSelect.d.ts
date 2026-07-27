import { type SizeType } from '@lib/sizeType';
type Props = {
    /** The field's current type (drives the button icon + active row). */
    value: SizeType;
    /** Axis this field controls — picks the Fill / Hug icon orientation. */
    orientation: 'horizontal' | 'vertical';
    /** Fired with the chosen type when a menu row is clicked. */
    onSelect: (type: SizeType) => void;
    /** Types to render disabled (e.g. Hug / Auto without a flex/grid parent). */
    disabledTypes?: ReadonlySet<SizeType>;
    ariaLabel?: string;
};
/**
 * The right-side unit/mode picker inside a Size field. The trigger shows
 * an icon for the current type; the popover menu lists icon + label for
 * each type. Presentation only — the caller maps the chosen type onto the
 * element's stored size.
 */
export declare const SizeTypeSelect: ({ value, orientation, onSelect, disabledTypes, ariaLabel, }: Props) => JSX.Element;
export {};
