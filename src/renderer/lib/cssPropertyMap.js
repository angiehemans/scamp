import { parseBorderRadiusShorthandOrNull, parseBorderShorthand, parseBoxShadowShorthand, parseFilterList, parsePaddingShorthandOrNull, parsePxOrNull, parseSizeValue, parseTransitionShorthand, } from './parsers';
import { isBlendMode } from './blendModes';
const POSITIONS = new Set([
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
export const cssToScampProperty = {
    background: (v) => ({ backgroundColor: v }),
    'background-color': (v) => ({ backgroundColor: v }),
    'border-radius': (v) => {
        const parsed = parseBorderRadiusShorthandOrNull(v);
        if (parsed === null)
            return null;
        return { borderRadius: parsed };
    },
    display: (v) => {
        const trimmed = v.trim();
        if (trimmed === 'flex')
            return { display: 'flex' };
        if (trimmed === 'grid')
            return { display: 'grid' };
        if (trimmed === 'none')
            return { visibilityMode: 'none' };
        if (trimmed === 'block' || trimmed === 'inline-block') {
            return { display: 'none' };
        }
        // Other display values (`inline`, `contents`, `flow-root`, …) get
        // preserved verbatim via customProperties.
        return null;
    },
    visibility: (v) => {
        if (v === 'hidden')
            return { visibilityMode: 'hidden' };
        if (v === 'visible')
            return { visibilityMode: 'visible' };
        return null;
    },
    opacity: (v) => {
        const n = Number(v.trim());
        if (!Number.isFinite(n))
            return null;
        return { opacity: Math.min(1, Math.max(0, n)) };
    },
    position: (v) => {
        const trimmed = v.trim();
        if (POSITIONS.has(trimmed)) {
            return { position: trimmed };
        }
        return null;
    },
    'flex-direction': (v) => {
        if (v === 'row' || v === 'column')
            return { flexDirection: v };
        return null;
    },
    gap: (v) => {
        const px = parsePxOrNull(v);
        if (px === null)
            return null;
        return { gap: px };
    },
    'align-items': (v) => {
        if (v === 'flex-start' || v === 'center' || v === 'flex-end' || v === 'stretch') {
            return { alignItems: v };
        }
        return null;
    },
    'justify-content': (v) => {
        if (v === 'flex-start' ||
            v === 'center' ||
            v === 'flex-end' ||
            v === 'space-between' ||
            v === 'space-around') {
            return { justifyContent: v };
        }
        return null;
    },
    // Width / height accept any CSS length: plain numbers / `px` →
    // fixed-px, `100%` → stretch, `auto` → auto, `fit-content` → hug,
    // anything else (`100vh`, `2em`, `calc(...)`, `var(--w)`) → fixed
    // with the verbatim string preserved in `widthCustom` /
    // `heightCustom`. See `parseSizeValue` for the full table.
    //
    // Always returns a delta — the lossless contract is upheld by the
    // verbatim-string fallback rather than by routing through
    // `customProperties`.
    width: (v) => {
        const parsed = parseSizeValue(v);
        if (parsed.mode === 'fixed') {
            return {
                widthMode: 'fixed',
                widthValue: parsed.value,
                widthCustom: parsed.custom,
            };
        }
        // Non-fixed mode: leave widthValue alone but clear any stale
        // widthCustom so the generator doesn't keep emitting an old vh
        // value after the user / agent switched to `100%`.
        return { widthMode: parsed.mode, widthCustom: undefined };
    },
    height: (v) => {
        const parsed = parseSizeValue(v);
        if (parsed.mode === 'fixed') {
            return {
                heightMode: 'fixed',
                heightValue: parsed.value,
                heightCustom: parsed.custom,
            };
        }
        return { heightMode: parsed.mode, heightCustom: undefined };
    },
    // Free-form string so `100vh`, `500px`, `var(--page-min-h)`,
    // `calc(...)`, etc. round-trip without parallel "raw" state. The
    // generator emits whatever the user / agent wrote.
    'min-height': (v) => {
        const trimmed = v.trim();
        if (trimmed.length === 0)
            return null;
        return { minHeight: trimmed };
    },
    border: (v) => {
        const parsed = parseBorderShorthand(v);
        // Convert the single borderWidth from the shorthand parser into a
        // uniform tuple so it matches the new per-side model.
        const w = parsed.borderWidth;
        return { ...parsed, borderWidth: [w, w, w, w] };
    },
    'border-width': (v) => {
        const parsed = parsePaddingShorthandOrNull(v);
        if (parsed === null)
            return null;
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
        if (parsed === null)
            return null;
        return { padding: parsed };
    },
    margin: (v) => {
        const parsed = parsePaddingShorthandOrNull(v);
        if (parsed === null)
            return null;
        return { margin: parsed };
    },
    'line-height': (v) => {
        const trimmed = v.trim();
        if (trimmed.length === 0)
            return null;
        return { lineHeight: trimmed };
    },
    'letter-spacing': (v) => {
        const trimmed = v.trim();
        if (trimmed.length === 0)
            return null;
        return { letterSpacing: trimmed };
    },
    'font-family': (v) => {
        const trimmed = v.trim();
        if (trimmed.length === 0)
            return null;
        return { fontFamily: trimmed };
    },
    'font-size': (v) => {
        const trimmed = v.trim();
        if (trimmed.length === 0)
            return null;
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
    'box-shadow': (v) => {
        const parsed = parseBoxShadowShorthand(v);
        if (parsed === null)
            return null;
        return { boxShadows: parsed };
    },
    'mix-blend-mode': (v) => {
        const trimmed = v.trim().toLowerCase();
        if (!isBlendMode(trimmed))
            return null;
        return { mixBlendMode: trimmed };
    },
    'background-blend-mode': (v) => {
        const trimmed = v.trim().toLowerCase();
        if (!isBlendMode(trimmed))
            return null;
        return { backgroundBlendMode: trimmed };
    },
    filter: (v) => {
        const parsed = parseFilterList(v);
        if (parsed === null)
            return null;
        return { filters: parsed };
    },
    'backdrop-filter': (v) => {
        const parsed = parseFilterList(v);
        if (parsed === null)
            return null;
        return { backdropFilters: parsed };
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
        if (px === null)
            return null;
        return { columnGap: px };
    },
    'row-gap': (v) => {
        const px = parsePxOrNull(v);
        if (px === null)
            return null;
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
export const isMappedProperty = (name) => Object.prototype.hasOwnProperty.call(cssToScampProperty, name);
