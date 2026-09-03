import { describe, it, expect } from 'vitest';
import { resolveOzonePlatform } from '../src/main/ozone';
const LINUX = 'linux';
describe('resolveOzonePlatform', () => {
    describe('non-Linux platforms', () => {
        it('appends nothing on macOS', () => {
            expect(resolveOzonePlatform({ platform: 'darwin', argv: [], override: undefined })).toBe(null);
        });
        it('appends nothing on Windows', () => {
            expect(resolveOzonePlatform({ platform: 'win32', argv: [], override: undefined })).toBe(null);
        });
        it('appends nothing on macOS even when the override is set', () => {
            expect(resolveOzonePlatform({ platform: 'darwin', argv: [], override: 'wayland' })).toBe(null);
        });
    });
    describe('the Linux default', () => {
        it('forces x11 when nothing is specified', () => {
            expect(resolveOzonePlatform({ platform: LINUX, argv: [], override: undefined })).toBe('x11');
        });
        it('forces x11 when the override is an empty string', () => {
            expect(resolveOzonePlatform({ platform: LINUX, argv: [], override: '' })).toBe('x11');
        });
        it('forces x11 when the override is only whitespace', () => {
            expect(resolveOzonePlatform({ platform: LINUX, argv: [], override: '   ' })).toBe('x11');
        });
    });
    describe('the SCAMP_OZONE_PLATFORM override', () => {
        it('appends nothing for "auto" so Electron picks the backend', () => {
            expect(resolveOzonePlatform({ platform: LINUX, argv: [], override: 'auto' })).toBe(null);
        });
        it('passes "wayland" through so users can opt back in', () => {
            expect(resolveOzonePlatform({ platform: LINUX, argv: [], override: 'wayland' })).toBe('wayland');
        });
        it('trims surrounding whitespace before using the value', () => {
            expect(resolveOzonePlatform({ platform: LINUX, argv: [], override: '  wayland  ' })).toBe('wayland');
        });
        it('treats a padded "auto" as auto', () => {
            expect(resolveOzonePlatform({ platform: LINUX, argv: [], override: ' auto ' })).toBe(null);
        });
    });
    describe('an explicit --ozone-platform on argv', () => {
        it('appends nothing when the flag uses = syntax', () => {
            expect(resolveOzonePlatform({
                platform: LINUX,
                argv: ['/usr/bin/scamp', '--ozone-platform=wayland'],
                override: undefined,
            })).toBe(null);
        });
        it('appends nothing when the flag is a bare separate argument', () => {
            expect(resolveOzonePlatform({
                platform: LINUX,
                argv: ['/usr/bin/scamp', '--ozone-platform', 'wayland'],
                override: undefined,
            })).toBe(null);
        });
        it('lets an argv flag win over the environment override', () => {
            expect(resolveOzonePlatform({
                platform: LINUX,
                argv: ['--ozone-platform=wayland'],
                override: 'x11',
            })).toBe(null);
        });
        it('is not fooled by a different flag that shares the prefix', () => {
            expect(resolveOzonePlatform({
                platform: LINUX,
                argv: ['--ozone-platform-hint=x11'],
                override: undefined,
            })).toBe('x11');
        });
    });
});
