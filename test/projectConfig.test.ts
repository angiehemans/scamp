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

  it('falls back to defaults when the keys are missing', () => {
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
    ).toEqual({
      ...DEFAULT_PROJECT_CONFIG,
      artboardBackground: '#123456',
    });
  });

  it('accepts other CSS colour forms (rgb, named)', () => {
    expect(
      parseProjectConfig('{"artboardBackground": "rgb(10, 20, 30)"}')
    ).toEqual({
      ...DEFAULT_PROJECT_CONFIG,
      artboardBackground: 'rgb(10, 20, 30)',
    });
    expect(
      parseProjectConfig('{"artboardBackground": "rebeccapurple"}')
    ).toEqual({
      ...DEFAULT_PROJECT_CONFIG,
      artboardBackground: 'rebeccapurple',
    });
  });

  it('ignores unknown extra keys without mutating the result', () => {
    const parsed = parseProjectConfig(
      '{"artboardBackground": "#222", "futureKey": 99}'
    );
    expect(parsed).toEqual({ ...DEFAULT_PROJECT_CONFIG, artboardBackground: '#222' });
  });

  it('clamps canvasWidth into the supported range', () => {
    expect(parseProjectConfig('{"canvasWidth": 50}')).toMatchObject({
      canvasWidth: 100,
    });
    expect(parseProjectConfig('{"canvasWidth": 9999}')).toMatchObject({
      canvasWidth: 4000,
    });
    expect(parseProjectConfig('{"canvasWidth": 390}')).toMatchObject({
      canvasWidth: 390,
    });
  });

  it('falls back to the default canvasWidth when the value is the wrong type', () => {
    expect(parseProjectConfig('{"canvasWidth": "huge"}')).toMatchObject({
      canvasWidth: DEFAULT_PROJECT_CONFIG.canvasWidth,
    });
  });

  it('accepts canvasOverflowHidden as a boolean', () => {
    expect(parseProjectConfig('{"canvasOverflowHidden": true}')).toMatchObject({
      canvasOverflowHidden: true,
    });
    expect(parseProjectConfig('{"canvasOverflowHidden": false}')).toMatchObject({
      canvasOverflowHidden: false,
    });
  });

  it('rounds a fractional canvasWidth to the nearest integer', () => {
    expect(parseProjectConfig('{"canvasWidth": 768.4}')).toMatchObject({
      canvasWidth: 768,
    });
  });

  it('stores canvasMigrationAcknowledged only when strictly true', () => {
    expect(
      parseProjectConfig('{"canvasMigrationAcknowledged": true}')
    ).toMatchObject({ canvasMigrationAcknowledged: true });
    // Missing, false, or a truthy non-boolean → field is absent.
    expect(
      parseProjectConfig('{}').canvasMigrationAcknowledged
    ).toBeUndefined();
    expect(
      parseProjectConfig('{"canvasMigrationAcknowledged": false}')
        .canvasMigrationAcknowledged
    ).toBeUndefined();
    expect(
      parseProjectConfig('{"canvasMigrationAcknowledged": "yes"}')
        .canvasMigrationAcknowledged
    ).toBeUndefined();
  });
});

describe('serializeProjectConfig', () => {
  it('round-trips through parse back to the original object', () => {
    const config = { ...DEFAULT_PROJECT_CONFIG, artboardBackground: '#abcdef' };
    expect(parseProjectConfig(serializeProjectConfig(config))).toEqual(config);
  });

  it('emits a trailing newline so the file is POSIX-friendly', () => {
    const serialized = serializeProjectConfig(DEFAULT_PROJECT_CONFIG);
    expect(serialized.endsWith('\n')).toBe(true);
  });

  it('formats with two-space indent', () => {
    const serialized = serializeProjectConfig(DEFAULT_PROJECT_CONFIG);
    // Every field appears on its own line with two-space indent.
    expect(serialized).toContain('\n  "artboardBackground":');
    expect(serialized).toContain('\n  "canvasWidth":');
    expect(serialized).toContain('\n  "canvasOverflowHidden":');
  });
});
