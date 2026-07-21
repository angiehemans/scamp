/**
 * Compact theme selector for the canvas toolbar. Switches the previewed
 * theme (`activeThemeId`), which re-derives `themeTokens` so the canvas
 * repaints in that theme's semantic colours — a quick toggle without
 * opening the theme panel. Hidden when a project has only the Light
 * theme (nothing to switch). see docs/plans/design-system-plan.md
 */
export declare const ThemeSwitcher: () => JSX.Element | null;
