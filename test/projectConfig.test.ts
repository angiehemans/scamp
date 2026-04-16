import { describe, it, expect } from 'vitest';
import {
  parseProjectConfig,
  serializeProjectConfig,
} from '@shared/projectConfig';
import { DEFAULT_PROJECT_CONFIG } from '@shared/types';

describe('parseProjectConfig', () => {
  it('returns defaults for null input (file missing)', () => {
    expect(parseProjectConfig(null)).toEqual(DEFAULT_PROJECT_CONFIG);
  });

  it('returns defaults for empty string', () => {
    expect(parseProjectConfig('')).toEqual(DEFAULT_PROJECT_CONFIG);
  });

  it('returns defaults for malformed JSON', () => {
    expect(parseProjectConfig('{ not json')).toEqual(DEFAULT_PROJECT_CONFIG);
  });

  it('returns defaults when the top-level value is not an object', () => {
    expect(parseProjectConfig('"string"')).toEqual(DEFAULT_PROJECT_CONFIG);
    expect(parseProjectConfig('[1,2,3]')).toEqual(DEFAULT_PROJECT_CONFIG);
    expect(parseProjectConfig('null')).toEqual(DEFAULT_PROJECT_CONFIG);
  });

  it('falls back to the default artboard colour when the key is missing', () => {
    expect(parseProjectConfig('{}')).toEqual(DEFAULT_PROJECT_CONFIG);
  });

  it('falls back to the default artboard colour when the value is the wrong type', () => {
    expect(parseProjectConfig('{"artboardBackground": 42}')).toEqual(
      DEFAULT_PROJECT_CONFIG
    );
    expect(parseProjectConfig('{"artboardBackground": null}')).toEqual(
      DEFAULT_PROJECT_CONFIG
    );
    expect(parseProjectConfig('{"artboardBackground": ""}')).toEqual(
      DEFAULT_PROJECT_CONFIG
    );
  });

  it('accepts a valid hex colour', () => {
    expect(
      parseProjectConfig('{"artboardBackground": "#123456"}')
    ).toEqual({ artboardBackground: '#123456' });
  });

  it('accepts other CSS colour forms (rgb, named)', () => {
    expect(
      parseProjectConfig('{"artboardBackground": "rgb(10, 20, 30)"}')
    ).toEqual({ artboardBackground: 'rgb(10, 20, 30)' });
    expect(
      parseProjectConfig('{"artboardBackground": "rebeccapurple"}')
    ).toEqual({ artboardBackground: 'rebeccapurple' });
  });

  it('ignores unknown extra keys without mutating the result', () => {
    const parsed = parseProjectConfig(
      '{"artboardBackground": "#222", "futureKey": 99}'
    );
    expect(parsed).toEqual({ artboardBackground: '#222' });
  });
});

describe('serializeProjectConfig', () => {
  it('round-trips through parse back to the original object', () => {
    const config = { artboardBackground: '#abcdef' };
    expect(parseProjectConfig(serializeProjectConfig(config))).toEqual(config);
  });

  it('emits a trailing newline so the file is POSIX-friendly', () => {
    const serialized = serializeProjectConfig(DEFAULT_PROJECT_CONFIG);
    expect(serialized.endsWith('\n')).toBe(true);
  });

  it('formats with two-space indent', () => {
    const serialized = serializeProjectConfig({ artboardBackground: '#000' });
    expect(serialized).toBe('{\n  "artboardBackground": "#000"\n}\n');
  });
});
