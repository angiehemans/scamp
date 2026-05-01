type Props = {
    elementId: string;
};
/**
 * Properties-panel section for the element's CSS animation. Reads
 * the resolved animation through `useResolvedElement` so the values
 * shown reflect the active state (base in Default mode; the state
 * override in Hover / Active / Focus). Edits route through
 * `setAnimation` / `removeAnimation`, which the canvas store routes
 * to the right axis.
 */
export declare const AnimationSection: ({ elementId }: Props) => JSX.Element | null;
export {};
