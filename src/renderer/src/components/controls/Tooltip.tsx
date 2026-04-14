import { cloneElement, ReactElement, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

type Props = {
  /** Tooltip text shown on hover. */
  label: string;
  /**
   * The element to hover over. Must be a single React element that can
   * accept `onMouseEnter` / `onMouseLeave` / `onFocus` / `onBlur` handlers.
   */
  children: ReactElement;
  /** Hover delay in ms before showing. Default 400. */
  delay?: number;
};

type Position = {
  left: number;
  top: number;
};

/**
 * Small custom tooltip. Matches the project's in-app tooltip design (dark
 * background, mono font, subtle border + shadow). Portaled to `document.body`
 * so it escapes overflow clipping from parent panels.
 *
 * The wrapper clones the child and attaches hover/focus handlers — it
 * doesn't add an extra DOM node, so layout of the trigger is preserved.
 */
export const Tooltip = ({ label, children, delay = 400 }: Props): JSX.Element => {
  const [position, setPosition] = useState<Position | null>(null);
  const timerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const show = (): void => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Position above the trigger, horizontally centered.
    setPosition({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
  };

  const handleEnter = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(show, delay);
  };

  const handleLeave = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPosition(null);
  };

  const childProps = children.props as {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  };

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      // Preserve any existing ref on the child.
      const childRef = (children as unknown as { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof childRef === 'function') childRef(node);
      else if (childRef && typeof childRef === 'object') {
        (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      childProps.onMouseEnter?.(e);
      handleEnter();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      childProps.onMouseLeave?.(e);
      handleLeave();
    },
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e);
      handleEnter();
    },
    onBlur: (e: React.FocusEvent) => {
      childProps.onBlur?.(e);
      handleLeave();
    },
  });

  return (
    <>
      {trigger}
      {position !== null &&
        createPortal(
          <div
            className={styles.tooltip}
            style={{
              left: position.left,
              top: position.top,
            }}
            role="tooltip"
          >
            <p className={styles.tooltipText}>{label}</p>
          </div>,
          document.body
        )}
    </>
  );
};
