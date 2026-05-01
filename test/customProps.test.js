import { describe, it, expect } from 'vitest';
import { customPropsToStyle } from '@lib/customProps';
describe('customPropsToStyle', () => {
    it('converts kebab-case to camelCase', () => {
        expect(customPropsToStyle({ 'background-color': 'red' })).toEqual({
            backgroundColor: 'red',
        });
        expect(customPropsToStyle({ 'box-shadow': '0 1px 2px black' })).toEqual({
            boxShadow: '0 1px 2px black',
        });
        expect(customPropsToStyle({ 'letter-spacing': '-1px' })).toEqual({
            letterSpacing: '-1px',
        });
    });
    it('passes single-word properties through unchanged', () => {
        expect(customPropsToStyle({ margin: '16px' })).toEqual({ margin: '16px' });
        expect(customPropsToStyle({ opacity: '0.5' })).toEqual({ opacity: '0.5' });
    });
    it('preserves CSS custom properties (--foo)', () => {
        expect(customPropsToStyle({ '--brand': '#3b82f6' })).toEqual({
            '--brand': '#3b82f6',
        });
    });
    it('PascalCases vendor-prefixed properties', () => {
        expect(customPropsToStyle({ '-webkit-user-select': 'none' })).toEqual({
            WebkitUserSelect: 'none',
        });
        expect(customPropsToStyle({ '-moz-osx-font-smoothing': 'grayscale' })).toEqual({
            MozOsxFontSmoothing: 'grayscale',
        });
    });
    it('handles a real-world bag with mixed property kinds', () => {
        expect(customPropsToStyle({
            'box-shadow': '0 4px 12px rgba(0,0,0,0.1)',
            'line-height': '1.7',
            'font-family': '-apple-system, sans-serif',
            margin: '0 0 16px',
            '--accent': '#d97a4a',
        })).toEqual({
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            lineHeight: '1.7',
            fontFamily: '-apple-system, sans-serif',
            margin: '0 0 16px',
            '--accent': '#d97a4a',
        });
    });
    it('returns an empty object for an empty bag', () => {
        expect(customPropsToStyle({})).toEqual({});
    });
});
