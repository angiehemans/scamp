import { useCallback, useEffect, useRef, useState, } from 'react';
import { computePopoverPosition, } from '@lib/popoverPosition';
/**
 * Anchored popover state. Owns open/close, positioning (via
 * computePopoverPosition), Escape-to-close, outside-click-to-close,
 * and window-resize repositioning. Callers attach `triggerRef` to the
 * element that anchors the popover and `popoverRef` to the popover
 * container so outside-click detection can exclude clicks that land
 * inside either.
 */
export const usePopover = (options) => {
    const [open, setOpenState] = useState(false);
    const [position, setPosition] = useState(null);
    const triggerRef = useRef(null);
    const popoverRef = useRef(null);
    const closeOnEscape = options.closeOnEscape ?? true;
    const closeOnOutsideClick = options.closeOnOutsideClick ?? true;
    const positionOptions = options.position;
    const onCloseRef = useRef(options.onClose);
    onCloseRef.current = options.onClose;
    const compute = useCallback(() => {
        const el = triggerRef.current;
        if (!el)
            return null;
        return computePopoverPosition(el.getBoundingClientRect(), positionOptions);
    }, [positionOptions]);
    const setOpen = useCallback((next) => {
        if (next) {
            const pos = compute();
            if (!pos)
                return;
            setPosition(pos);
            setOpenState(true);
            return;
        }
        setOpenState((prev) => {
            if (prev)
                onCloseRef.current?.();
            return false;
        });
        setPosition(null);
    }, [compute]);
    const toggle = useCallback(() => {
        setOpen(!open);
    }, [open, setOpen]);
    // Outside-click → close. mousedown fires before click, so clicking a
    // different trigger that opens its own popover works without a double
    // toggle. Inside-trigger/inside-popover clicks are excluded.
    useEffect(() => {
        if (!open || !closeOnOutsideClick)
            return;
        const handleMouseDown = (e) => {
            const target = e.target;
            if (triggerRef.current?.contains(target))
                return;
            if (popoverRef.current?.contains(target))
                return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [open, closeOnOutsideClick, setOpen]);
    // Escape → close. Uses keydown at the document level so focused
    // inputs inside the popover still trigger it.
    useEffect(() => {
        if (!open || !closeOnEscape)
            return;
        const handleKey = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, closeOnEscape, setOpen]);
    // Reposition on resize so the popover follows the trigger when the
    // window changes size.
    useEffect(() => {
        if (!open)
            return;
        const handleResize = () => {
            const pos = compute();
            if (pos)
                setPosition(pos);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [open, compute]);
    return { open, setOpen, toggle, triggerRef, popoverRef, position };
};
