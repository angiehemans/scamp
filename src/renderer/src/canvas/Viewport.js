import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_BODY_FONT_FAMILY } from '@shared/agentMd';
import { ElementRenderer } from './ElementRenderer';
import { CanvasInteractionLayer } from './CanvasInteractionLayer';
import styles from './Viewport.module.css';
// Padding subtracted from the scroll container's inner width when
// computing fit-to-width zoom. Mirrors the artboard's horizontal
// padding so the fitted frame doesn't sit flush against the
// scrollbar.
const FRAME_FIT_INSET = 40;
/**
 * Floor on the canvas frame's rendered height. Purely a design-tool
 * convenience — the frame grows past this as content is added, but
 * this keeps an empty project looking like a blank page rather than
 * a thin strip. Also used by `ElementRenderer` as the root element's
 * canvas-only min-height so flex-column centering has vertical space
 * to distribute within.
 */
export const EMPTY_FRAME_MIN_HEIGHT = 900;
export const Viewport = ({ canvasWidth, canvasOverflowHidden, scrollContainerRef, }) => {
    const frameRef = useRef(null);
    const [scale, setScale] = useState(1);
    // Tracks the frame's natural (pre-scale) height so the frameShell
    // reserves the correct scrolled-space footprint after the frame's
    // own content grows.
    const [frameH, setFrameH] = useState(0);
    const rootElementId = useCanvasStore((s) => s.rootElementId);
    const activeTool = useCanvasStore((s) => s.activeTool);
    const userZoom = useCanvasStore((s) => s.userZoom);
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    // Resolve the body-level default font from the project's theme.css
    // tokens. Mirrors what the preview / `next dev` would inherit from
    // the `body { font-family: var(--font-sans) }` rule in theme.css —
    // so the canvas and the deployed page render the same default font.
    // Falls back to the constant when the project hasn't defined a
    // `--font-sans` token (e.g. older projects pre-dating this default).
    const themeFontFamily = themeTokens.find((t) => t.name === '--font-sans')?.value ??
        DEFAULT_BODY_FONT_FAMILY;
    // Inject every project theme token as a CSS custom property on the
    // canvas frame so `var(--…)` references inside both typed style and
    // unmapped customProperties resolve natively (same scope rules as
    // the preview, where `theme.css` lives in the page's `<head>`).
    // Without this, only the typed-property path gets `resolveTokenColor`
    // / `resolveTokenValue` substitution; raw shorthand declarations
    // routed through `customProperties` (e.g. `border-bottom: 1px solid
    // var(--color-border)`) silently fall back to currentColor or
    // browser defaults because the Scamp app's `:root` doesn't carry
    // the project tokens.
    const themeCssVars = useMemo(() => {
        const vars = {};
        for (const token of themeTokens) {
            // Skip Scamp chrome variables — only project-declared tokens
            // (the parser only surfaces declarations from theme.css's
            // `:root` so this filter is mostly defensive).
            if (!token.name.startsWith('--'))
                continue;
            vars[token.name] = token.value;
        }
        return vars;
    }, [themeTokens]);
    const frameW = canvasWidth;
    // Auto-fit scale derived from the scroll container's client width.
    const [fitScale, setFitScale] = useState(1);
    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        if (!container)
            return;
        const measure = () => {
            const w = container.clientWidth - FRAME_FIT_INSET * 2;
            if (w <= 0)
                return;
            // Width-only fit — tall pages scroll vertically inside the
            // artboard instead of squashing. Never scale up past 1.0.
            const next = Math.min(w / frameW, 1);
            setFitScale(next);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(container);
        return () => ro.disconnect();
    }, [frameW, scrollContainerRef]);
    // Effective scale: explicit user zoom wins, otherwise auto-fit.
    useLayoutEffect(() => {
        setScale(userZoom ?? fitScale);
    }, [userZoom, fitScale]);
    // Track the frame's natural (pre-scale) height. `transform: scale`
    // doesn't affect layout, so without this the wrapper would reserve
    // logical space only and scrolling would be wrong when the user
    // zooms in. Re-observe on frame remount for a live subscription.
    useEffect(() => {
        const frame = frameRef.current;
        if (!frame)
            return;
        const measure = () => {
            setFrameH(frame.offsetHeight);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(frame);
        return () => ro.disconnect();
    }, []);
    return (_jsx("div", { className: styles.frameShell, style: {
            width: frameW * scale,
            height: frameH * scale,
        }, children: _jsxs("div", { ref: frameRef, className: styles.frame, "data-testid": "canvas-frame", "data-canvas-width": frameW, "data-canvas-scale": scale, "data-cursor": activeTool === 'rectangle' || activeTool === 'image'
                ? 'crosshair'
                : activeTool === 'text'
                    ? 'text'
                    : 'default', style: {
                // Project theme tokens live on the frame as real CSS custom
                // properties, so `var(--…)` references inside any descendant
                // (typed inline styles, customProperties, hand-written CSS
                // in CodeMirror) resolve natively. MUST spread first so the
                // explicit style properties below win on key collisions.
                ...themeCssVars,
                width: `${frameW}px`,
                minHeight: `${EMPTY_FRAME_MIN_HEIGHT}px`,
                overflow: canvasOverflowHidden ? 'hidden' : undefined,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                // Mirror the project's `body { font-family: var(--font-sans) }`
                // rule from theme.css so an unstyled element on the canvas
                // renders in the same font as in preview / `next dev` /
                // production. Without this, the canvas inherits Scamp's
                // chrome font (Ubuntu Mono on Linux, San Francisco on
                // macOS, etc.) and visually disagrees with the preview.
                fontFamily: themeFontFamily,
            }, children: [_jsx(CanvasKeyframes, {}), _jsx(ElementRenderer, { elementId: rootElementId }), _jsx(CanvasInteractionLayer, { frameRef: frameRef, scale: scale })] }) }));
};
/**
 * Mounts a `<style>` element inside the canvas frame containing the
 * page's `@keyframes` blocks. Without this, the inline `animation`
 * declarations the renderer applies during preview can't resolve
 * their keyframe names — Scamp renders into the Electron renderer's
 * own document, not via the user's CSS module file.
 *
 * Re-renders only when `pageKeyframesBlocks` changes; otherwise the
 * `<style>` tag's textContent stays stable and doesn't churn.
 */
const CanvasKeyframes = () => {
    const keyframes = useCanvasStore((s) => s.pageKeyframesBlocks);
    if (keyframes.length === 0)
        return null;
    const css = keyframes
        .map((block) => `@keyframes ${block.name} {\n${block.body}\n}`)
        .join('\n\n');
    return _jsx("style", { children: css });
};
