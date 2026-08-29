import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { containerOverflow, formatOverflowLabel } from '@lib/canvasOverflow';
import { layoutEdges } from './animatedExtent';
import styles from './NestedOverflowMarkers.module.css';
const scan = (frame) => {
    const markers = [];
    for (const node of frame.querySelectorAll('[data-element-id]')) {
        if (!(node instanceof HTMLElement))
            continue;
        // Only containers that lay their children out can meaningfully
        // overflow in a way the user can act on.
        const display = globalThis.getComputedStyle(node).display;
        if (display !== 'flex' && display !== 'grid')
            continue;
        if (node.children.length === 0)
            continue;
        const children = [];
        for (const child of node.children) {
            if (!(child instanceof HTMLElement))
                continue;
            if (child.getAttribute('data-canvas-chrome') === 'true')
                continue;
            const edges = layoutEdges(child, node);
            if (edges !== null)
                children.push(edges);
        }
        const over = containerOverflow(children, node.clientWidth, node.clientHeight);
        if (over.x === 0 && over.y === 0)
            continue;
        const box = layoutEdges(node, frame);
        if (box === null)
            continue;
        markers.push({
            id: node.getAttribute('data-element-id') ?? '',
            left: box.right - node.offsetWidth,
            top: box.bottom - node.offsetHeight,
            width: node.offsetWidth,
            height: node.offsetHeight,
            label: formatOverflowLabel(Math.max(over.x, over.y)),
        });
    }
    return markers;
};
export const NestedOverflowMarkers = ({ frame, scale, revision, }) => {
    const [markers, setMarkers] = useState([]);
    useEffect(() => {
        if (!frame) {
            setMarkers([]);
            return;
        }
        // After paint, so the scan sees the layout this render produced.
        const id = requestAnimationFrame(() => setMarkers(scan(frame)));
        return () => cancelAnimationFrame(id);
    }, [frame, revision]);
    if (markers.length === 0)
        return null;
    return (_jsx("div", { className: styles.layer, style: { pointerEvents: 'none' }, "data-canvas-chrome": "true", "aria-hidden": "true", children: markers.map((marker) => (_jsx("div", { className: styles.marker, "data-testid": "nested-overflow-marker", "data-element-overflow": marker.id, style: {
                left: marker.left,
                top: marker.top,
                width: marker.width,
                height: marker.height,
            }, children: _jsx("span", { className: styles.label, style: { transform: `scale(${1 / scale})`, transformOrigin: 'bottom right' }, children: marker.label }) }, marker.id))) }));
};
