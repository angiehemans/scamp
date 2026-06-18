import type { ProjectData } from '@shared/types';
type ComponentNavRef = {
    current: {
        openComponent: (name: string, fromPage: string | null) => void;
        activePageName: string | null;
    };
};
/**
 * Consumes the one-shot canvas → navigation requests the store exposes:
 * the link indicator's page jump, and the page canvas's double-click into
 * a component instance's editor. Both route through the same flows the
 * sidebar uses, then clear the pending field. The component-nav effect
 * reads `openComponent` / `activePageName` via a `useLatest` ref so it
 * fires only when the one-shot request flips, with no stale-closure dep.
 */
export declare const useNavigationRequests: (project: ProjectData, setActivePageName: (name: string) => void, componentNav: ComponentNavRef) => void;
export {};
