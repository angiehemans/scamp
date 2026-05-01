import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import { ANIMATION_PRESETS, PRESETS_BY_NAME, isPresetName, } from '@lib/animationPresets';
import { matchesPreset, normaliseKeyframesBody } from '@lib/keyframesMatch';
describe('animationPresets library', () => {
    it('exposes a non-empty preset list', () => {
        expect(ANIMATION_PRESETS.length).toBeGreaterThan(0);
    });
    it('PRESETS_BY_NAME contains exactly the names in ANIMATION_PRESETS', () => {
        expect(PRESETS_BY_NAME.size).toBe(ANIMATION_PRESETS.length);
        for (const preset of ANIMATION_PRESETS) {
            expect(PRESETS_BY_NAME.get(preset.name)).toBe(preset);
        }
    });
    it('every preset body parses cleanly via postcss', () => {
        for (const preset of ANIMATION_PRESETS) {
            // Wrap in @keyframes so postcss accepts the body.
            expect(() => postcss.parse(`@keyframes ${preset.name} {\n${preset.body}\n}`)).not.toThrow();
        }
    });
    it('isPresetName returns true for known names and false for unknown', () => {
        expect(isPresetName('fade-in-up')).toBe(true);
        expect(isPresetName('spin')).toBe(true);
        expect(isPresetName('completely-made-up-name')).toBe(false);
        expect(isPresetName('')).toBe(false);
    });
});
describe('matchesPreset', () => {
    it('matches a preset against its own canonical body', () => {
        for (const preset of ANIMATION_PRESETS) {
            expect(matchesPreset(preset.name, preset.body)).toBe(true);
        }
    });
    it('returns false for an unknown name even if the body looks valid', () => {
        expect(matchesPreset('not-a-preset', 'from { opacity: 0; } to { opacity: 1; }')).toBe(false);
    });
    it('returns true when the agent uses 0%/100% instead of from/to', () => {
        const body = `0% { opacity: 0; }
100% { opacity: 1; }`;
        expect(matchesPreset('fade-in', body)).toBe(true);
    });
    it('returns true when the agent uses different whitespace', () => {
        const body = `  from{opacity:0}
  to{opacity:1}`;
        expect(matchesPreset('fade-in', body)).toBe(true);
    });
    it('returns true when declarations are in a different order', () => {
        const body = `from { transform: translateY(16px); opacity: 0; }
to { transform: translateY(0); opacity: 1; }`;
        expect(matchesPreset('fade-in-up', body)).toBe(true);
    });
    it('returns false when an agent has actually changed a value', () => {
        const body = `from { opacity: 0.5; }
to { opacity: 1; }`;
        expect(matchesPreset('fade-in', body)).toBe(false);
    });
    it('returns false for malformed input', () => {
        expect(matchesPreset('fade-in', '{ this is not css }')).toBe(false);
    });
});
describe('normaliseKeyframesBody', () => {
    it('treats from/to as equivalent to 0%/100%', () => {
        const a = normaliseKeyframesBody('from { opacity: 0; } to { opacity: 1; }');
        const b = normaliseKeyframesBody('0% { opacity: 0; } 100% { opacity: 1; }');
        expect(a).not.toBeNull();
        expect(a).toBe(b);
    });
    it('treats multi-stop selectors as order-independent', () => {
        const a = normaliseKeyframesBody('0%, 100% { opacity: 1; }');
        const b = normaliseKeyframesBody('100%, 0% { opacity: 1; }');
        expect(a).toBe(b);
    });
});
