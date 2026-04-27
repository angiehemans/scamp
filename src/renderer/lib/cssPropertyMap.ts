import {
  parseBorderRadiusShorthand,
  parseBorderShorthand,
  parsePaddingShorthand,
  parsePx,
  parseTransitionShorthand,
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
  display: (v) => {
    if (v === 'flex') return { display: 'flex' };
    if (v === 'grid') return { display: 'grid' };
    if (v === 'none') return { visibilityMode: 'none' };
    // Other display values (block, inline-block, …) map back to the
    // non-flex / non-grid sentinel in our model.
    return { display: 'none' };
  },
  visibility: (v) => {
    if (v === 'hidden') return { visibilityMode: 'hidden' };
    if (v === 'visible') return { visibilityMode: 'visible' };
    return {};
  },
  opacity: (v) => {
    const n = Number(v.trim());
    if (!Number.isFinite(n)) return {};
    return { opacity: Math.min(1, Math.max(0, n)) };
  },
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
    return { lineHeight: trimmed };
  },
  'letter-spacing': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return {};
    return { letterSpacing: trimmed };
  },
  'font-family': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return {};
    return { fontFamily: trimmed };
  },
  'font-size': (v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return {};
    return { fontSize: trimmed };
  },
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
  'column-gap': (v) => ({ columnGap: parsePx(v) }),
  'row-gap': (v) => ({ rowGap: parsePx(v) }),
  'justify-items': (v) => {
    if (v === 'start' || v === 'center' || v === 'end' || v === 'stretch') {
      return { justifyItems: v };
    }
    return {};
  },
  'grid-column': (v) => ({ gridColumn: v.trim() }),
  'grid-row': (v) => ({ gridRow: v.trim() }),
  'align-self': (v) => {
    if (v === 'start' || v === 'center' || v === 'end' || v === 'stretch') {
      return { alignSelf: v };
    }
    return {};
  },
  'justify-self': (v) => {
    if (v === 'start' || v === 'center' || v === 'end' || v === 'stretch') {
      return { justifySelf: v };
    }
    return {};
  },
};

export const isMappedProperty = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(cssToScampProperty, name);
