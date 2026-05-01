import type { ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
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
};
export declare const Button: ({ variant, size, disabled, onClick, children, type, autoFocus, fullWidth, }: Props) => JSX.Element;
export {};
