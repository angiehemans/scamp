type Props = {
    elementId: string;
};
/**
 * Fill / stroke / stroke-width controls for an inline `<svg>` element.
 * Element-level paint cascades to the svg's shapes (whose own fill/stroke
 * were stripped on import), so editing here recolours the icon without
 * touching `svgSource`. Rendered by UiPanel only when `tag === 'svg'`.
 * see docs/plans/svg-improvements-plan.md
 */
export declare const SvgSection: ({ elementId }: Props) => JSX.Element | null;
export {};
