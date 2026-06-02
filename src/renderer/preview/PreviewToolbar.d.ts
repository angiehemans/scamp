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
    /** Currently-displayed page name. Selected in the URL-bar
     *  dropdown so the user can jump between pages without leaving
     *  the preview window. */
    pageName: string;
    /** Every page in the project, in canvas-sidebar order. */
    pageNames: ReadonlyArray<string>;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onOpenDevTools: () => void;
    onViewportChange: (width: ViewportWidth) => void;
    /** Navigate the preview to a different page in the same project. */
    onPageChange: (pageName: string) => void;
};
export declare const PreviewToolbar: ({ url, statusKind, canGoBack, canGoForward, viewportWidth, pageName, pageNames, onBack, onForward, onReload, onOpenDevTools, onViewportChange, onPageChange, }: Props) => JSX.Element;
/** Resolve a `ViewportWidth` to the wrapper width in CSS units.
 *  Fullscreen uses `100%`; everything else is fixed pixels. */
export declare const viewportCss: (vp: ViewportWidth) => string;
export {};
