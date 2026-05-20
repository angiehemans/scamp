import { describe, it, expect } from 'vitest';
import {
  suggestComponentName,
  validateComponentName,
} from '../src/shared/componentName';

describe('validateComponentName', () => {
  it('accepts a simple PascalCase name', () => {
    expect(validateComponentName('Button', [])).toEqual({
      ok: true,
      value: 'Button',
    });
  });

  it('accepts multi-word PascalCase', () => {
    expect(validateComponentName('HeroCard', [])).toEqual({
      ok: true,
      value: 'HeroCard',
    });
  });

  it('accepts digits in the body of the name', () => {
    expect(validateComponentName('Heading2', [])).toEqual({
      ok: true,
      value: 'Heading2',
    });
  });

  it('rejects an empty name', () => {
    expect(validateComponentName('', []).ok).toBe(false);
    expect(validateComponentName('   ', []).ok).toBe(false);
  });

  it('rejects a leading-lowercase name', () => {
    const result = validateComponentName('button', []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/PascalCase/);
  });

  it('rejects names with hyphens or underscores', () => {
    expect(validateComponentName('Hero-Card', []).ok).toBe(false);
    expect(validateComponentName('Hero_Card', []).ok).toBe(false);
  });

  it('rejects names that start with a digit', () => {
    expect(validateComponentName('1Button', []).ok).toBe(false);
  });

  it('rejects a name that collides with an existing component', () => {
    const result = validateComponentName('Button', ['Button', 'Card']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already exists/);
  });

  it('treats case-distinct names as non-colliding', () => {
    // PascalCase distinctions matter for JSX resolution, so two
    // different-cased names are different components.
    expect(validateComponentName('button', ['Button']).ok).toBe(false);
    expect(validateComponentName('Buttons', ['Button']).ok).toBe(true);
  });
});

describe('suggestComponentName', () => {
  it('returns an empty string for an empty input', () => {
    expect(suggestComponentName('')).toBe('');
  });

  it('PascalCases a single lowercase word', () => {
    expect(suggestComponentName('button')).toBe('Button');
  });

  it('joins space-separated words into PascalCase', () => {
    expect(suggestComponentName('hero card')).toBe('HeroCard');
  });

  it('handles hyphens, underscores, and mixed separators', () => {
    expect(suggestComponentName('hero-card')).toBe('HeroCard');
    expect(suggestComponentName('hero_card')).toBe('HeroCard');
    expect(suggestComponentName('hero  card')).toBe('HeroCard');
    expect(suggestComponentName('hero card_widget')).toBe('HeroCardWidget');
  });

  it('normalises ALL CAPS input', () => {
    expect(suggestComponentName('HERO CARD')).toBe('HeroCard');
  });

  it('strips leading digits (JSX identifiers cannot start with a number)', () => {
    expect(suggestComponentName('123hero')).toBe('Hero');
    expect(suggestComponentName('1 hero card')).toBe('HeroCard');
  });

  it('keeps digits inside the name', () => {
    expect(suggestComponentName('heading 2')).toBe('Heading2');
  });

  it('returns an empty string when every chunk is filtered out', () => {
    expect(suggestComponentName('---')).toBe('');
    expect(suggestComponentName('   ')).toBe('');
  });
});
