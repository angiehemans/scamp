import type { ReactNode } from 'react';
import styles from './Button.module.css';

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

export const Button = ({
  variant = 'secondary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  type = 'button',
  autoFocus = false,
  fullWidth = false,
}: Props): JSX.Element => {
  const className = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
    >
      {children}
    </button>
  );
};
