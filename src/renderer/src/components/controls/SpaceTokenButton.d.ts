import type { ThemeToken } from '@shared/types';
type Props = {
    /** Theme tokens to offer. Caller filters to length-shaped ones. */
    tokens: ReadonlyArray<ThemeToken>;
    /** Fired with the chosen token's full `var(--name)` reference. */
    onSelect: (varRef: string) => void;
    /** Called from the empty-state "Add token" button when the popover
     *  opens with no tokens to pick from. */
    onOpenTheme?: () => void;
    /** True when the field already has a token applied — paints the icon
     *  in the accent color so the user can see at a glance that a token
     *  is in effect. */
    active?: boolean;
    /** Accessible label for the trigger button. Defaults to "Pick token". */
    ariaLabel?: string;
};
/**
 * Inline icon button that opens a popover of available tokens. Used by
 * the spacing-typed controls (padding/margin/border-width/border-radius
 * and the singular gap properties) so the user can apply a project
 * spacing token without dropping into raw-CSS mode.
 *
 * Styling is shared with `TokenOrNumberInput` — same button + popover
 * shapes so the spacing picker looks identical to the typography one.
 *
 * The component is presentation only — it doesn't know about
 * `SpaceTuple` / `SpaceValue`. The caller decides whether the picked
 * token applies to a single value, all four sides, or something else.
 */
export declare const SpaceTokenButton: ({ tokens, onSelect, onOpenTheme, active, ariaLabel, }: Props) => JSX.Element;
export {};
