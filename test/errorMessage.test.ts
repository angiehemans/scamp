import { describe, it, expect } from 'vitest';

import { errorMessage } from '@shared/errorMessage';

describe('errorMessage', () => {
  it('returns the message of a real Error instance', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the message of an Error subclass', () => {
    expect(errorMessage(new TypeError('bad type'))).toBe('bad type');
  });

  it('coerces a thrown string', () => {
    expect(errorMessage('plain string')).toBe('plain string');
  });

  it('coerces a thrown number', () => {
    expect(errorMessage(42)).toBe('42');
  });

  it('coerces null', () => {
    expect(errorMessage(null)).toBe('null');
  });

  it('coerces undefined', () => {
    expect(errorMessage(undefined)).toBe('undefined');
  });

  it('coerces a plain object via String()', () => {
    expect(errorMessage({ code: 'EACCES' })).toBe('[object Object]');
  });
});
