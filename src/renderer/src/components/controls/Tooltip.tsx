import {
  cloneElement,
  ReactElement,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

/**
 * Inset from the viewport edge the tooltip should keep — tooltips
 * sliding right up against the window border look pinched, especially
 * on the right where the properties panel lives.
 */
const VIEWPORT_INSET = 12;

type Props = {
  /** Tooltip body text shown on hover. Supports `\n` line breaks. */
  label: string;
  /**
   * Optional header rendered above the body with a subtle
   * border-bottom separator. Used by richer tooltips (e.g. the
   * section override indicator's "Style Overrides" block).
   */
  header?: string;
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
export const Tooltip = ({
  label,
  header,
  children,
  delay = 400,
}: Props): JSX.Element => {
  const [position, setPosition] = useState<Position | null>(null);
  const timerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const show = (): void => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Default: position above the trigger, horizontally centered.
    // The layout effect below will clamp this to the viewport once
    // the tooltip's actual width is known.
    setPosition({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
  };

  // After the tooltip mounts, measure its rendered width and shift
  // the anchor leftward when the centered-above position would
  // spill off the viewport's right edge. Most tooltips in Scamp
  // live inside the properties panel on the right side of the
  // window, so without this clamp the right edge regularly clips.
  useLayoutEffect(() => {
    if (position === null) return;
    const tip = tooltipRef.current;
    if (!tip) return;
    const tipWidth = tip.offsetWidth;
    // The tooltip's CSS uses `translate(-50%, ...)`, so `position.left`
    // is the centerpoint and the tooltip extends ±tipWidth/2 from it.
    const halfWidth = tipWidth / 2;
    const minLeft = halfWidth + VIEWPORT_INSET;
    const maxLeft = window.innerWidth - halfWidth - VIEWPORT_INSET;
    let nextLeft = position.left;
    if (nextLeft > maxLeft) nextLeft = maxLeft;
    if (nextLeft < minLeft) nextLeft = minLeft;
    if (nextLeft !== position.left) {
      setPosition({ left: nextLeft, top: position.top });
    }
  }, [position]);

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
            ref={tooltipRef}
            className={styles.tooltip}
            style={{
              left: position.left,
              top: position.top,
            }}
            role="tooltip"
          >
            {header !== undefined && (
              <p className={styles.tooltipHeader}>{header}</p>
            )}
            <p className={styles.tooltipText}>{label}</p>
          </div>,
          document.body
        )}
    </>
  );
};
