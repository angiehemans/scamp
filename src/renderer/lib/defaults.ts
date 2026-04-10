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
};

export type DefaultRectStyles = typeof DEFAULT_RECT_STYLES;

/**
 * Defaults for the page-root element. Distinct from rect defaults because
 * the root is a 1440×900 white page frame, not an empty 100×100 hidden box.
 *
 * Both `generateCode` and `parseCode` use this object as the baseline for
 * the root element so the user can override any of these properties from
 * the panel and have them round-trip cleanly.
 */
export const DEFAULT_ROOT_STYLES = {
  display: 'none' as const,
  flexDirection: 'row' as const,
  gap: 0,
  alignItems: 'flex-start' as const,
  justifyContent: 'flex-start' as const,
  padding: [0, 0, 0, 0] as [number, number, number, number],
  margin: [0, 0, 0, 0] as [number, number, number, number],
  widthValue: 1440,
  heightValue: 900,
  backgroundColor: '#ffffff',
  borderRadius: [0, 0, 0, 0] as [number, number, number, number],
  borderWidth: [0, 0, 0, 0] as [number, number, number, number],
  borderStyle: 'none' as const,
  borderColor: '#000000',
};

export type DefaultRootStyles = typeof DEFAULT_ROOT_STYLES;
