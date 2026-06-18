import { describe, it, expect } from 'vitest';

import { DEFAULT_SETTINGS, parseSettingsBlob } from '../src/main/ipc/settingsOps';

describe('parseSettingsBlob', () => {
  it('returns defaults for malformed JSON', () => {
    expect(() => parseSettingsBlob('{ not json')).toThrow();
  });

  it('returns defaults when the top-level value is not an object', () => {
    expect(parseSettingsBlob('"a string"')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettingsBlob('42')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettingsBlob('null')).toEqual(DEFAULT_SETTINGS);
  });

  it('fills missing keys with defaults', () => {
    expect(parseSettingsBlob('{}')).toEqual(DEFAULT_SETTINGS);
  });

  it('reads through valid values', () => {
    expect(
      parseSettingsBlob(
        JSON.stringify({
          defaultProjectsFolder: '/work',
          artboardBackground: '#fff',
          sentryOptIn: true,
        })
      )
    ).toEqual({
      defaultProjectsFolder: '/work',
      artboardBackground: '#fff',
      sentryOptIn: true,
    });
  });

  it('migrates the legacy canvasBackground key to artboardBackground', () => {
    expect(
      parseSettingsBlob(JSON.stringify({ canvasBackground: '#123456' }))
        .artboardBackground
    ).toBe('#123456');
  });

  it('prefers artboardBackground over the legacy key when both are present', () => {
    expect(
      parseSettingsBlob(
        JSON.stringify({ artboardBackground: '#aaa', canvasBackground: '#bbb' })
      ).artboardBackground
    ).toBe('#aaa');
  });

  it('coerces wrong-typed values back to defaults', () => {
    const r = parseSettingsBlob(
      JSON.stringify({ defaultProjectsFolder: 5, sentryOptIn: 'yes' })
    );
    expect(r.defaultProjectsFolder).toBeNull();
    expect(r.sentryOptIn).toBeNull();
  });
});
