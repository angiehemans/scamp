import { describe, it, expect } from 'vitest';
import { parseTpgid, shellBaseName, } from '../src/main/ipc/terminalForeground';
describe('parseTpgid', () => {
    it('parses a normal /proc/PID/stat line', () => {
        // Real example from bash, abbreviated. Field 8 (tpgid) is 1234.
        const stat = '5678 (bash) S 1 5678 5678 34816 1234 4194304 100 200 0 0 0 0 0 0 20 0 1 0 100 12345 6789';
        expect(parseTpgid(stat)).toBe(1234);
    });
    it('handles comm fields with spaces and parentheses', () => {
        // node-pty's shell can have funky comm values; the last `)` rule
        // is the right anchor.
        const stat = '5678 (the (real) name) S 1 5678 5678 34816 7777 4194304 100 200 0 0 0 0 0 0 20 0 1 0 100 12345 6789';
        expect(parseTpgid(stat)).toBe(7777);
    });
    it('returns null on malformed input (no closing paren)', () => {
        expect(parseTpgid('totally not a stat line')).toBeNull();
    });
    it('returns null when there are fewer than 6 fields after comm', () => {
        expect(parseTpgid('5678 (bash) S 1 5678')).toBeNull();
    });
    it('returns null when tpgid is non-numeric', () => {
        const stat = '5678 (bash) S 1 5678 5678 34816 not-a-number 0 0';
        expect(parseTpgid(stat)).toBeNull();
    });
    it('returns null when tpgid is zero or negative', () => {
        const zero = '5678 (bash) S 1 5678 5678 34816 0 4194304 100 200';
        expect(parseTpgid(zero)).toBeNull();
        const negative = '5678 (bash) S 1 5678 5678 34816 -1 4194304 100 200';
        expect(parseTpgid(negative)).toBeNull();
    });
    it('parses with extra trailing whitespace / newlines', () => {
        const stat = '5678 (bash) S 1 5678 5678 34816 1234 4194304 100 200 0 0 0 0 0 0 20 0 1 0 100 12345 6789\n';
        expect(parseTpgid(stat)).toBe(1234);
    });
});
describe('shellBaseName', () => {
    it('strips the directory from a SHELL path', () => {
        expect(shellBaseName('/bin/bash')).toBe('bash');
        expect(shellBaseName('/usr/local/bin/fish')).toBe('fish');
        expect(shellBaseName('/usr/bin/zsh')).toBe('zsh');
    });
    it('is a no-op when the input already has no directory', () => {
        expect(shellBaseName('bash')).toBe('bash');
    });
});
