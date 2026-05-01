import { type MutableRefObject } from 'react';
import { type PopoverPosition, type PopoverPositionOptions } from '@lib/popoverPosition';
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
export declare const usePopover: <T extends HTMLElement = HTMLButtonElement>(options: UsePopoverOptions) => UsePopoverResult<T>;
export {};
