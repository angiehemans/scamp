import type { Page } from '@playwright/test';
/**
 * Helpers for driving real mouse + keyboard against the canvas. The
 * frame element is `transform: scale()`-ed to fit the viewport, so
 * every helper translates frame-local (unscaled) coordinates into the
 * client coordinates Playwright's mouse API expects.
 */
export type FramePoint = {
    x: number;
    y: number;
};
export type FrameMetrics = {
    /** Scaled top-left of the frame in viewport coords. */
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** Ratio between visible pixels and logical pixels (== 1 if not auto-fit). */
    scale: number;
};
export declare const measureFrame: (page: Page) => Promise<FrameMetrics>;
export declare const frameToClient: (metrics: FrameMetrics, point: FramePoint) => {
    x: number;
    y: number;
};
/**
 * Drag from `start` to `end` in frame-local coordinates. Emits real
 * pointer events via Playwright's mouse API — the canvas interaction
 * layer captures the pointer and the draw/move/resize handlers react.
 *
 * `steps` controls the number of intermediate mouse-move events; more
 * steps make pointer-move handlers see a smooth drag. 10 is enough
 * for every draw/move/resize handler in Scamp today.
 */
export declare const dragInFrame: (page: Page, start: FramePoint, end: FramePoint, options?: {
    steps?: number;
}) => Promise<void>;
/** Click once at a frame-local coordinate. */
export declare const clickInFrame: (page: Page, point: FramePoint) => Promise<void>;
/** Activate a drawing tool via keyboard shortcut (r, t, f, v). */
export declare const selectTool: (page: Page, shortcut: "v" | "r" | "t" | "i" | "f") => Promise<void>;
