import {
  parseBorderRadiusShorthand,
  parseBorderShorthand,
  parsePaddingShorthand,
  parsePx,
} from './parsers';
import type { ScampElement } from './element';

/**
 * A delta over an element produced from a single CSS declaration. Anything
 * the canvas can model goes here; anything else lands in `customProperties`.
 */
export type ScampPropertyDelta = Partial<ScampElement>;

type Mapper = (value: string) => ScampPropertyDelta;

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
  'border-radius': (v) => ({ borderRadius: parseBorderRadiusShorthand(v) }),
  display: (v) => (v === 'flex' ? { display: 'flex' } : { display: 'none' }),
  'flex-direction': (v) => {
    if (v === 'row' || v === 'column') return { flexDirection: v };
    return {};
  },
  gap: (v) => ({ gap: parsePx(v) }),
  'align-items': (v) => {
    if (v === 'flex-start' || v === 'center' || v === 'flex-end' || v === 'stretch') {
      return { alignItems: v };
    }
    return {};
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
    return {};
  },
  width: (v) => {
    if (v === '100%') return { widthMode: 'stretch' };
    if (v === 'fit-content') return { widthMode: 'fit-content' };
    if (v === 'auto') return { widthMode: 'auto' };
    return { widthMode: 'fixed', widthValue: parsePx(v) };
  },
  height: (v) => {
    if (v === '100%') return { heightMode: 'stretch' };
    if (v === 'fit-content') return { heightMode: 'fit-content' };
    if (v === 'auto') return { heightMode: 'auto' };
    return { heightMode: 'fixed', heightValue: parsePx(v) };
  },
  border: (v) => {
    const parsed = parseBorderShorthand(v);
    // Convert the single borderWidth from the shorthand parser into a
    // uniform tuple so it matches the new per-side model.
    const w = parsed.borderWidth;
    return { ...parsed, borderWidth: [w, w, w, w] as [number, number, number, number] };
  },
  'border-width': (v) => ({ borderWidth: parsePaddingShorthand(v) }),
  'border-style': (v) => {
    if (v === 'none' || v === 'solid' || v === 'dashed' || v === 'dotted') {
      return { borderStyle: v };
    }
    return {};
  },
  'border-color': (v) => ({ borderColor: v }),
  padding: (v) => ({ padding: parsePaddingShorthand(v) }),
  margin: (v) => ({ margin: parsePaddingShorthand(v) }),
  'line-height': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return {};
    // Reject px form for POC — only unitless multipliers.
    if (/px$/.test(trimmed)) return {};
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return {};
    return { lineHeight: n };
  },
  'letter-spacing': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return {};
    return { letterSpacing: parsePx(trimmed) };
  },
  'font-family': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return {};
    return { fontFamily: trimmed };
  },
  'font-size': (v) => ({ fontSize: parsePx(v) }),
  'font-weight': (v) => {
    const n = parseInt(v, 10);
    if (n === 400 || n === 500 || n === 600 || n === 700) {
      return { fontWeight: n };
    }
    return {};
  },
  color: (v) => ({ color: v }),
  'text-align': (v) => {
    if (v === 'left' || v === 'center' || v === 'right') {
      return { textAlign: v };
    }
    return {};
  },
};

export const isMappedProperty = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(cssToScampProperty, name);
