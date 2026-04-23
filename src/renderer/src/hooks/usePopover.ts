import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  computePopoverPosition,
  type PopoverPosition,
  type PopoverPositionOptions,
} from '@lib/popoverPosition';

type UsePopoverOptions = {
  /** Positioning options passed to computePopoverPosition. The hook
   * recomputes on open and on window resize. */
  position: PopoverPositionOptions;
  /** Close on Escape. Default: true. */
  closeOnEscape?: boolean;
  /** Close when the user mousedowns outside both the trigger and the
   * popover. Default: true. */
  closeOnOutsideClick?: boolean;
  /** Fires every time the popover transitions from open to closed —
   * regardless of the cause (setOpen(false), Escape, outside click). */
  onClose?: () => void;
};

type UsePopoverResult<T extends HTMLElement> = {
  open: boolean;
  /** Programmatically toggle. Opening computes position synchronously
   * from the current trigger rect; closing clears it. */
  setOpen: (open: boolean) => void;
  toggle: () => void;
  triggerRef: MutableRefObject<T | null>;
  popoverRef: MutableRefObject<HTMLDivElement | null>;
  position: PopoverPosition | null;
};

/**
 * Anchored popover state. Owns open/close, positioning (via
 * computePopoverPosition), Escape-to-close, outside-click-to-close,
 * and window-resize repositioning. Callers attach `triggerRef` to the
 * element that anchors the popover and `popoverRef` to the popover
 * container so outside-click detection can exclude clicks that land
 * inside either.
 */
export const usePopover = <T extends HTMLElement = HTMLButtonElement>(
  options: UsePopoverOptions
): UsePopoverResult<T> => {
  const [open, setOpenState] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<T | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const closeOnEscape = options.closeOnEscape ?? true;
  const closeOnOutsideClick = options.closeOnOutsideClick ?? true;
  const positionOptions = options.position;
  const onCloseRef = useRef(options.onClose);
  onCloseRef.current = options.onClose;

  const compute = useCallback((): PopoverPosition | null => {
    const el = triggerRef.current;
    if (!el) return null;
    return computePopoverPosition(el.getBoundingClientRect(), positionOptions);
  }, [positionOptions]);

  const setOpen = useCallback(
    (next: boolean): void => {
      if (next) {
        const pos = compute();
        if (!pos) return;
        setPosition(pos);
        setOpenState(true);
        return;
      }
      setOpenState((prev) => {
        if (prev) onCloseRef.current?.();
        return false;
      });
      setPosition(null);
    },
    [compute]
  );

  const toggle = useCallback((): void => {
    setOpen(!open);
  }, [open, setOpen]);

  // Outside-click → close. mousedown fires before click, so clicking a
  // different trigger that opens its own popover works without a double
  // toggle. Inside-trigger/inside-popover clicks are excluded.
  useEffect(() => {
    if (!open || !closeOnOutsideClick) return;
    const handleMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, closeOnOutsideClick, setOpen]);

  // Escape → close. Uses keydown at the document level so focused
  // inputs inside the popover still trigger it.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, closeOnEscape, setOpen]);

  // Reposition on resize so the popover follows the trigger when the
  // window changes size.
  useEffect(() => {
    if (!open) return;
    const handleResize = (): void => {
      const pos = compute();
      if (pos) setPosition(pos);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open, compute]);

  return { open, setOpen, toggle, triggerRef, popoverRef, position };
};
