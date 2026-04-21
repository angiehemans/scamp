/**
 * Default style values applied to every newly-created rectangle.
 *
 * The code generator only emits properties that differ from this object,
 * which keeps generated CSS clean. The parser applies these as a baseline
 * before overlaying parsed values, so missing properties round-trip as
 * defaults.
 */
export const DEFAULT_RECT_STYLES = {
  display: 'none' as const,
  flexDirection: 'row' as const,
  gap: 0,
  alignItems: 'flex-start' as const,
  justifyContent: 'flex-start' as const,
  padding: [0, 0, 0, 0] as [number, number, number, number],
  margin: [0, 0, 0, 0] as [number, number, number, number],
  widthMode: 'fixed' as const,
  widthValue: 100,
  heightMode: 'fixed' as const,
  heightValue: 100,
  backgroundColor: 'transparent',
  borderRadius: [0, 0, 0, 0] as [number, number, number, number],
  borderWidth: [0, 0, 0, 0] as [number, number, number, number],
  borderStyle: 'none' as const,
  borderColor: '#000000',
  opacity: 1,
  visibilityMode: 'visible' as const,
};

export type DefaultRectStyles = typeof DEFAULT_RECT_STYLES;

/**
 * Defaults for the page-root element.
 *
 * The root is treated like any other rectangle for emission purposes —
 * there's no root-specific sizing branch in `generateCode` — but its
 * DEFAULTS differ: a white page background, and web-idiomatic
 * sizing (`width: 100%; height: auto`) that works outside Scamp
 * without assuming a specific viewport.
 *
 * Both `generateCode` and `parseCode` use this object as the baseline
 * for the root so the user can override any property from the panel
 * and have them round-trip cleanly.
 *
 * The `widthValue` / `heightValue` numbers are fallbacks used only
 * when the user switches the corresponding mode to 'fixed' from the
 * panel — they have no effect in the default stretch/auto mode.
 */
export const DEFAULT_ROOT_STYLES = {
  display: 'none' as const,
  flexDirection: 'row' as const,
  gap: 0,
  alignItems: 'flex-start' as const,
  justifyContent: 'flex-start' as const,
  padding: [0, 0, 0, 0] as [number, number, number, number],
  margin: [0, 0, 0, 0] as [number, number, number, number],
  widthMode: 'stretch' as const,
  widthValue: 1440,
  heightMode: 'auto' as const,
  heightValue: 900,
  backgroundColor: '#ffffff',
  borderRadius: [0, 0, 0, 0] as [number, number, number, number],
  borderWidth: [0, 0, 0, 0] as [number, number, number, number],
  borderStyle: 'none' as const,
  borderColor: '#000000',
  opacity: 1,
  visibilityMode: 'visible' as const,
};

export type DefaultRootStyles = typeof DEFAULT_ROOT_STYLES;
