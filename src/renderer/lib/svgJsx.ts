/**
 * Turn captured SVG markup into markup React will accept.
 *
 * `svgSource` is the DOM's own serialisation of an icon's innards, and
 * it is emitted into a `.tsx` file verbatim. The DOM writes HTML:
 * `style` is a string, and presentation attributes keep their hyphens.
 * React takes neither. The result was icons that rendered black —
 * `style="fill: currentcolor"` was captured correctly and then thrown
 * away by the renderer — and files React refused outright.
 *
 * Converting here rather than in the generator keeps it to imported
 * markup: a hand-written `<svg>` already contains JSX and must be
 * emitted byte-for-byte, which is the contract `svgSource` promises.
 * see docs/notes/import-svg-jsx.md
 */

/** `stroke-width` → `strokeWidth`; `data-x` and `aria-x` keep their hyphens. */
export const jsxAttributeName = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return lower;
  // `xlink:href` and friends: React spells the namespace in too.
  const flat = lower.replace(/:/g, '-');
  // Nothing to change: hand the name back AS WRITTEN. Lowercasing here
  // un-camel-cased `strokeWidth` on the second pass, and the source is
  // converted again on every save.
  if (!flat.includes('-')) return NON_HYPHEN_ATTRIBUTES[flat] ?? name;
  return flat.replace(/-([a-z])/g, (_m, c: string) => (c ?? '').toUpperCase());
};

/**
 * Attributes React spells differently for reasons other than hyphens.
 * `datetime` is the one that turns up in real pages; the rest are here
 * because leaving them out would be an arbitrary place to stop.
 */
const NON_HYPHEN_ATTRIBUTES: Readonly<Record<string, string>> = {
  datetime: 'dateTime',
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
  gradienttransform: 'gradientTransform',
  gradientunits: 'gradientUnits',
  patternunits: 'patternUnits',
  spreadmethod: 'spreadMethod',
  stopcolor: 'stopColor',
  stopopacity: 'stopOpacity',
  textlength: 'textLength',
  lengthadjust: 'lengthAdjust',
  markerwidth: 'markerWidth',
  markerheight: 'markerHeight',
  markerunits: 'markerUnits',
  refx: 'refX',
  refy: 'refY',
};

/** `fill: none; stroke-width: 2` → `{fill: 'none', strokeWidth: '2'}` source. */
export const jsxStyleObject = (declarations: string): string => {
  const pairs: string[] = [];
  for (const chunk of declarations.split(';')) {
    const at = chunk.indexOf(':');
    if (at < 0) continue;
    const prop = chunk.slice(0, at).trim().toLowerCase();
    const value = chunk.slice(at + 1).trim();
    if (prop.length === 0 || value.length === 0) continue;
    // A custom property keeps its name and has to be quoted as a key.
    const key = prop.startsWith('--')
      ? `'${prop}'`
      : prop.replace(/-([a-z])/g, (_m, c: string) => (c ?? '').toUpperCase());
    pairs.push(`${key}: '${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
  }
  return `{{ ${pairs.join(', ')} }}`;
};

/** Every attribute in a tag, tolerating single, double and bare values. */
const ATTRIBUTE = /([:A-Za-z_][-:.\w]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>`=]+)/g;

/**
 * Rewrite one tag's attributes. Anything that is already a JSX
 * expression (`{...}`) is left exactly as it is, so re-running this on
 * markup it has already converted changes nothing.
 */
const convertTag = (tag: string): string =>
  tag.replace(ATTRIBUTE, (whole, rawName: string, rawValue: string) => {
    const quoted = rawValue.startsWith('"') || rawValue.startsWith("'");
    const value = quoted ? rawValue.slice(1, -1) : rawValue;
    if (rawValue.startsWith('{')) return whole;
    const name = jsxAttributeName(rawName);
    if (name === 'style') return `style=${jsxStyleObject(value)}`;
    return `${name}="${value.replace(/"/g, '&quot;')}"`;
  });

/**
 * Convert a run of captured SVG markup to JSX.
 *
 * Idempotent: markup that is already JSX comes back unchanged, which
 * matters because the source round-trips through `parseCode` and is
 * converted again on every save.
 */
export const svgSourceToJsx = (source: string): string =>
  source.replace(/<[A-Za-z][^>]*>/g, (tag) => convertTag(tag));
