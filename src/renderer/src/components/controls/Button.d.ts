import { type FocusEventHandler, type MouseEventHandler, type ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'addRow' | 'removeRow' | 'dangerGhost';
type Size = 'sm' | 'md';
type Props = {
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    onClick?: () => void;
    children: ReactNode;
    type?: 'button' | 'submit';
    autoFocus?: boolean;
    /** Make the button stretch to fill its container. */
    fullWidth?: boolean;
    /** Accessible name — required for icon-only buttons (e.g. removeRow). */
    ariaLabel?: string;
    /** Native tooltip text. */
    title?: string;
    onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
    onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
    onFocus?: FocusEventHandler<HTMLButtonElement>;
    onBlur?: FocusEventHandler<HTMLButtonElement>;
};
export declare const Button: import("react").ForwardRefExoticComponent<Props & import("react").RefAttributes<HTMLButtonElement>>;
export {};
