import {
  parseBorderRadiusShorthandOrNull,
  parseBorderShorthand,
  parsePaddingShorthandOrNull,
  parsePxOrNull,
  parseTransitionShorthand,
} from './parsers';
import type { ScampElement } from './element';

/**
 * A delta over an element produced from a single CSS declaration. Anything
 * the canvas can model goes here; anything else lands in `customProperties`.
 */
export type ScampPropertyDelta = Partial<ScampElement>;

/**
 * A mapper turns a CSS value string into a delta over the typed
 * canvas element. Returning `null` means "I can't reduce this value
 * to a typed field — preserve the raw declaration in
 * customProperties instead". Returning `{}` is a deliberate "this
 * value is intentionally a no-op" (rare).
 *
 * The lossless contract: the parser must never silently drop
 * agent-written values. Agent writes `padding: var(--space-3)` →
 * `parsePaddingShorthandOrNull` returns null → mapper returns null →
 * the parser pushes `padding: var(--space-3)` into customProperties
 * → the generator emits it back byte-equivalent.
 */
type Mapper = (value: string) => ScampPropertyDelta | null;

const POSITIONS: ReadonlySet<string> = new Set([
  'static',
  'relative',
  'absolute',
  'fixed',
  'sticky',
]);

/**
 * The single source of truth for "what CSS properties does scamp understand".
 *
 * The parser uses this to overlay parsed values onto a defaults baseline;
 * the generator uses the *keys* of this map (indirectly, via what it knows
 * how to emit) to decide what gets emitted vs. relegated to customProperties.
 *
 * Adding canvas support for a new CSS property = add an entry here + add
 * an emitter case in `generateCode`.
 */
export const cssToScampProperty: Record<string, Mapper> = {
  background: (v) => ({ backgroundColor: v }),
  'background-color': (v) => ({ backgroundColor: v }),
  'border-radius': (v) => {
    const parsed = parseBorderRadiusShorthandOrNull(v);
    if (parsed === null) return null;
    return { borderRadius: parsed };
  },
  display: (v) => {
    const trimmed = v.trim();
    if (trimmed === 'flex') return { display: 'flex' };
    if (trimmed === 'grid') return { display: 'grid' };
    if (trimmed === 'none') return { visibilityMode: 'none' };
    if (trimmed === 'block' || trimmed === 'inline-block') {
      return { display: 'none' };
    }
    // Other display values (`inline`, `contents`, `flow-root`, …) get
    // preserved verbatim via customProperties.
    return null;
  },
  visibility: (v) => {
    if (v === 'hidden') return { visibilityMode: 'hidden' };
    if (v === 'visible') return { visibilityMode: 'visible' };
    return null;
  },
  opacity: (v) => {
    const n = Number(v.trim());
    if (!Number.isFinite(n)) return null;
    return { opacity: Math.min(1, Math.max(0, n)) };
  },
  position: (v) => {
    const trimmed = v.trim();
    if (POSITIONS.has(trimmed)) {
      return { position: trimmed as ScampElement['position'] };
    }
    return null;
  },
  'flex-direction': (v) => {
    if (v === 'row' || v === 'column') return { flexDirection: v };
    return null;
  },
  gap: (v) => {
    const px = parsePxOrNull(v);
    if (px === null) return null;
    return { gap: px };
  },
  'align-items': (v) => {
    if (v === 'flex-start' || v === 'center' || v === 'flex-end' || v === 'stretch') {
      return { alignItems: v };
    }
    return null;
  },
  'justify-content': (v) => {
    if (
      v === 'flex-start' ||
      v === 'center' ||
      v === 'flex-end' ||
      v === 'space-between' ||
      v === 'space-around'
    ) {
      return { justifyContent: v };
    }
    return null;
  },
  width: (v) => {
    if (v === '100%') return { widthMode: 'stretch' };
    if (v === 'fit-content') return { widthMode: 'fit-content' };
    if (v === 'auto') return { widthMode: 'auto' };
    const px = parsePxOrNull(v);
    if (px === null) return null;
    return { widthMode: 'fixed', widthValue: px };
  },
  height: (v) => {
    if (v === '100%') return { heightMode: 'stretch' };
    if (v === 'fit-content') return { heightMode: 'fit-content' };
    if (v === 'auto') return { heightMode: 'auto' };
    const px = parsePxOrNull(v);
    if (px === null) return null;
    return { heightMode: 'fixed', heightValue: px };
  },
  border: (v) => {
    const parsed = parseBorderShorthand(v);
    // Convert the single borderWidth from the shorthand parser into a
    // uniform tuple so it matches the new per-side model.
    const w = parsed.borderWidth;
    return { ...parsed, borderWidth: [w, w, w, w] as [number, number, number, number] };
  },
  'border-width': (v) => {
    const parsed = parsePaddingShorthandOrNull(v);
    if (parsed === null) return null;
    return { borderWidth: parsed };
  },
  'border-style': (v) => {
    if (v === 'none' || v === 'solid' || v === 'dashed' || v === 'dotted') {
      return { borderStyle: v };
    }
    return null;
  },
  'border-color': (v) => ({ borderColor: v }),
  padding: (v) => {
    const parsed = parsePaddingShorthandOrNull(v);
    if (parsed === null) return null;
    return { padding: parsed };
  },
  margin: (v) => {
    const parsed = parsePaddingShorthandOrNull(v);
    if (parsed === null) return null;
    return { margin: parsed };
  },
  'line-height': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return null;
    return { lineHeight: trimmed };
  },
  'letter-spacing': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return null;
    return { letterSpacing: trimmed };
  },
  'font-family': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return null;
    return { fontFamily: trimmed };
  },
  'font-size': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return null;
    return { fontSize: trimmed };
  },
  'font-weight': (v) => {
    const n = parseInt(v, 10);
    if (n === 400 || n === 500 || n === 600 || n === 700) {
      return { fontWeight: n };
    }
    return null;
  },
  color: (v) => ({ color: v }),
  'text-align': (v) => {
    if (v === 'left' || v === 'center' || v === 'right') {
      return { textAlign: v };
    }
    return null;
  },
  transition: (v) => {
    const transitions = parseTransitionShorthand(v);
    return { transitions };
  },

  // ---- Grid ----
  'grid-template-columns': (v) => {
    const trimmed = v.trim();
    return { gridTemplateColumns: trimmed === 'none' ? '' : trimmed };
  },
  'grid-template-rows': (v) => {
    const trimmed = v.trim();
    return { gridTemplateRows: trimmed === 'none' ? '' : trimmed };
  },
  'column-gap': (v) => {
    const px = parsePxOrNull(v);
    if (px === null) return null;
    return { columnGap: px };
  },
  'row-gap': (v) => {
    const px = parsePxOrNull(v);
    if (px === null) return null;
    return { rowGap: px };
  },
  'justify-items': (v) => {
    if (v === 'start' || v === 'center' || v === 'end' || v === 'stretch') {
      return { justifyItems: v };
    }
    return null;
  },
  'grid-column': (v) => ({ gridColumn: v.trim() }),
  'grid-row': (v) => ({ gridRow: v.trim() }),
  'align-self': (v) => {
    if (v === 'start' || v === 'center' || v === 'end' || v === 'stretch') {
      return { alignSelf: v };
    }
    return null;
  },
  'justify-self': (v) => {
    if (v === 'start' || v === 'center' || v === 'end' || v === 'stretch') {
      return { justifySelf: v };
    }
    return null;
  },
};

export const isMappedProperty = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(cssToScampProperty, name);
