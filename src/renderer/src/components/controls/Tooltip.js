import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { cloneElement, useLayoutEffect, useRef, useState, } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';
/**
 * Inset from the viewport edge the tooltip should keep — tooltips
 * sliding right up against the window border look pinched, especially
 * on the right where the properties panel lives.
 */
const VIEWPORT_INSET = 12;
/**
 * Small custom tooltip. Matches the project's in-app tooltip design (dark
 * background, mono font, subtle border + shadow). Portaled to `document.body`
 * so it escapes overflow clipping from parent panels.
 *
 * The wrapper clones the child and attaches hover/focus handlers — it
 * doesn't add an extra DOM node, so layout of the trigger is preserved.
 */
export const Tooltip = ({ label, header, children, delay = 400, }) => {
    const [position, setPosition] = useState(null);
    const timerRef = useRef(null);
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const show = () => {
        const el = triggerRef.current;
        if (!el)
            return;
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
        if (position === null)
            return;
        const tip = tooltipRef.current;
        if (!tip)
            return;
        const tipWidth = tip.offsetWidth;
        // The tooltip's CSS uses `translate(-50%, ...)`, so `position.left`
        // is the centerpoint and the tooltip extends ±tipWidth/2 from it.
        const halfWidth = tipWidth / 2;
        const minLeft = halfWidth + VIEWPORT_INSET;
        const maxLeft = window.innerWidth - halfWidth - VIEWPORT_INSET;
        let nextLeft = position.left;
        if (nextLeft > maxLeft)
            nextLeft = maxLeft;
        if (nextLeft < minLeft)
            nextLeft = minLeft;
        if (nextLeft !== position.left) {
            setPosition({ left: nextLeft, top: position.top });
        }
    }, [position]);
    const handleEnter = () => {
        if (timerRef.current !== null)
            window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(show, delay);
    };
    const handleLeave = () => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setPosition(null);
    };
    const childProps = children.props;
    const trigger = cloneElement(children, {
        ref: (node) => {
            triggerRef.current = node;
            // Preserve any existing ref on the child.
            const childRef = children.ref;
            if (typeof childRef === 'function')
                childRef(node);
            else if (childRef && typeof childRef === 'object') {
                childRef.current = node;
            }
        },
        onMouseEnter: (e) => {
            childProps.onMouseEnter?.(e);
            handleEnter();
        },
        onMouseLeave: (e) => {
            childProps.onMouseLeave?.(e);
            handleLeave();
        },
        onFocus: (e) => {
            childProps.onFocus?.(e);
            handleEnter();
        },
        onBlur: (e) => {
            childProps.onBlur?.(e);
            handleLeave();
        },
    });
    return (_jsxs(_Fragment, { children: [trigger, position !== null &&
                createPortal(_jsxs("div", { ref: tooltipRef, className: styles.tooltip, style: {
                        left: position.left,
                        top: position.top,
                    }, role: "tooltip", children: [header !== undefined && (_jsx("p", { className: styles.tooltipHeader, children: header })), _jsx("p", { className: styles.tooltipText, children: label })] }), document.body)] }));
};
