import { describe, it, expect } from 'vitest';

import { requireGroup, requireAt } from '@lib/safeAccess';

describe('requireGroup', () => {
  it('returns a present capture group', () => {
    const match = 'abc123'.match(/([a-z]+)(\d+)/);
    expect(match).not.toBeNull();
    if (match === null) return;
    expect(requireGroup(match, 1)).toBe('abc');
    expect(requireGroup(match, 2)).toBe('123');
  });

  it('returns the full match at index 0', () => {
    const match = 'x=1'.match(/(\w)=(\d)/);
    if (match === null) throw new Error('expected match');
    expect(requireGroup(match, 0)).toBe('x=1');
  });

  it('throws when the requested group is absent', () => {
    const match = 'abc'.match(/[a-z]+/);
    if (match === null) throw new Error('expected match');
    expect(() => requireGroup(match, 5)).toThrow(/capture group 5/);
  });

  it('throws when an optional group did not participate', () => {
    const match = 'a'.match(/(a)(b)?/);
    if (match === null) throw new Error('expected match');
    expect(() => requireGroup(match, 2)).toThrow(/capture group 2/);
  });
});

describe('requireAt', () => {
  it('returns the element at an in-bounds index', () => {
    expect(requireAt(['a', 'b', 'c'], 0)).toBe('a');
    expect(requireAt(['a', 'b', 'c'], 2)).toBe('c');
  });

  it('works with number arrays', () => {
    expect(requireAt([10, 20, 30], 1)).toBe(20);
  });

  it('throws when the index is past the end', () => {
    expect(() => requireAt(['a'], 3)).toThrow(/out of bounds/);
  });

  it('throws on an empty array', () => {
    expect(() => requireAt([], 0)).toThrow(/out of bounds \(length 0\)/);
  });
});
