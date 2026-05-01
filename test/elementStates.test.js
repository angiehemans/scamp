import { describe, it, expect } from 'vitest';
import { resolveElementAtState } from '@lib/stateCascade';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { DEFAULT_BREAKPOINTS } from '@shared/types';
const makeRect = (overrides) => ({
    ...DEFAULT_RECT_STYLES,
    type: 'rectangle',
    parentId: 'root',
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    ...overrides,
});
describe('resolveElementAtState', () => {
    it('returns the element unchanged when activeState is null and no breakpoints apply', () => {
        const el = makeRect({
            id: 'a1b2',
            backgroundColor: '#ffffff',
        });
        const resolved = resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, null);
        expect(resolved).toBe(el);
    });
    it('returns the element unchanged when the active state has no override', () => {
        const el = makeRect({
            id: 'a1b2',
            backgroundColor: '#ffffff',
            // hover override exists but we ask for active.
            stateOverrides: {
                hover: { backgroundColor: '#f0f0f0' },
            },
        });
        const resolved = resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, 'active');
        expect(resolved.backgroundColor).toBe('#ffffff');
    });
    it('returns the element unchanged when the override exists but is empty', () => {
        const el = makeRect({
            id: 'a1b2',
            backgroundColor: '#ffffff',
            stateOverrides: { hover: {} },
        });
        const resolved = resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, 'hover');
        expect(resolved.backgroundColor).toBe('#ffffff');
    });
    it('layers a hover override on top of base styles', () => {
        const el = makeRect({
            id: 'a1b2',
            backgroundColor: '#ffffff',
            borderRadius: [8, 8, 8, 8],
            stateOverrides: {
                hover: { backgroundColor: '#f0f0f0' },
            },
        });
        const resolved = resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, 'hover');
        expect(resolved.backgroundColor).toBe('#f0f0f0');
        // Non-overridden fields cascade from base.
        expect(resolved.borderRadius).toEqual([8, 8, 8, 8]);
    });
    it('merges customProperties object-wise rather than replacing', () => {
        const el = makeRect({
            id: 'a1b2',
            customProperties: { transform: 'rotate(0deg)', 'will-change': 'transform' },
            stateOverrides: {
                hover: {
                    customProperties: {
                        'box-shadow': '0 4px 8px rgba(0,0,0,0.1)',
                    },
                },
            },
        });
        const resolved = resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, 'hover');
        expect(resolved.customProperties).toEqual({
            transform: 'rotate(0deg)',
            'will-change': 'transform',
            'box-shadow': '0 4px 8px rgba(0,0,0,0.1)',
        });
    });
    it('lets a hover customProperty override a base value with the same key', () => {
        const el = makeRect({
            id: 'a1b2',
            customProperties: { transform: 'rotate(0deg)' },
            stateOverrides: {
                hover: { customProperties: { transform: 'rotate(2deg)' } },
            },
        });
        const resolved = resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, 'hover');
        expect(resolved.customProperties.transform).toBe('rotate(2deg)');
    });
    it('applies state override on top of an active breakpoint override', () => {
        // Tablet sets background red; hover should still win when both
        // axes are active because the state override layers last.
        const el = makeRect({
            id: 'a1b2',
            backgroundColor: '#ffffff',
            breakpointOverrides: {
                tablet: { backgroundColor: '#ff0000' },
            },
            stateOverrides: {
                hover: { backgroundColor: '#0000ff' },
            },
        });
        const resolved = resolveElementAtState(el, 'tablet', DEFAULT_BREAKPOINTS, 'hover');
        expect(resolved.backgroundColor).toBe('#0000ff');
    });
    it('falls back to the breakpoint cascade alone when state has no override', () => {
        const el = makeRect({
            id: 'a1b2',
            backgroundColor: '#ffffff',
            breakpointOverrides: {
                tablet: { backgroundColor: '#ff0000' },
            },
        });
        const resolved = resolveElementAtState(el, 'tablet', DEFAULT_BREAKPOINTS, 'hover');
        // No hover override → just the breakpoint cascade applies.
        expect(resolved.backgroundColor).toBe('#ff0000');
    });
    it('handles all three state keys independently', () => {
        const el = makeRect({
            id: 'a1b2',
            backgroundColor: '#ffffff',
            stateOverrides: {
                hover: { backgroundColor: '#aaaaaa' },
                active: { backgroundColor: '#888888' },
                focus: { backgroundColor: '#cccccc' },
            },
        });
        expect(resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, 'hover')
            .backgroundColor).toBe('#aaaaaa');
        expect(resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, 'active')
            .backgroundColor).toBe('#888888');
        expect(resolveElementAtState(el, 'desktop', DEFAULT_BREAKPOINTS, 'focus')
            .backgroundColor).toBe('#cccccc');
    });
});
