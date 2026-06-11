import {
  forwardRef,
  type FocusEventHandler,
  type MouseEventHandler,
  type ReactNode,
} from 'react';
import styles from './Button.module.css';

// `addRow` / `removeRow` carry the section row-action styling that used
// to live as `rowAddButton` / `rowRemoveButton` in each section's CSS
// module; `dangerGhost` is a transparent error-tinted action (e.g.
// "Remove background image"). These three are self-contained — they set
// their own padding / sizing — so they ignore the `size` prop.
type Variant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'ghost'
  | 'addRow'
  | 'removeRow'
  | 'dangerGhost';
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
  // Forwarded so <Button> can be a <Tooltip> trigger: Tooltip injects
  // these handlers (and a ref — hence forwardRef) onto its child via
  // cloneElement.
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    {
      variant = 'secondary',
      size = 'md',
      disabled = false,
      onClick,
      children,
      type = 'button',
      autoFocus = false,
      fullWidth = false,
      ariaLabel,
      title,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
    },
    ref
  ): JSX.Element => {
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
        ref={ref}
        type={type}
        className={className}
        onClick={onClick}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        title={title}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
