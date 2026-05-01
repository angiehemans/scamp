import type { DevServerStatus } from '@shared/types';
export type ViewportWidth = {
    kind: 'mobile';
} | {
    kind: 'tablet';
} | {
    kind: 'desktop';
} | {
    kind: 'fullscreen';
} | {
    kind: 'custom';
    px: number;
};
type Props = {
    url: string;
    /** Dev-server lifecycle kind. Surfaced as a small chip so a stuck
     *  preview is visibly diagnostic. */
    statusKind: DevServerStatus['kind'];
    canGoBack: boolean;
    canGoForward: boolean;
    viewportWidth: ViewportWidth;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onOpenDevTools: () => void;
    onViewportChange: (width: ViewportWidth) => void;
};
export declare const PreviewToolbar: ({ url, statusKind, canGoBack, canGoForward, viewportWidth, onBack, onForward, onReload, onOpenDevTools, onViewportChange, }: Props) => JSX.Element;
/** Resolve a `ViewportWidth` to the wrapper width in CSS units.
 *  Fullscreen uses `100%`; everything else is fixed pixels. */
export declare const viewportCss: (vp: ViewportWidth) => string;
export {};
