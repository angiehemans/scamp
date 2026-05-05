import { describe, it, expect } from 'vitest';
import {
  classifyHref,
  isValidExternalUrl,
  pageNameToHref,
} from '@lib/linkHref';

const PAGES = ['home', 'about', 'dashboard'];

describe('classifyHref', () => {
  it('returns none for empty / undefined / whitespace href', () => {
    expect(classifyHref(undefined, PAGES)).toEqual({ kind: 'none' });
    expect(classifyHref('', PAGES)).toEqual({ kind: 'none' });
    expect(classifyHref('   ', PAGES)).toEqual({ kind: 'none' });
  });

  it('maps `/` to the home page when home exists in the project', () => {
    expect(classifyHref('/', PAGES)).toEqual({ kind: 'page', pageName: 'home' });
  });

  it('maps `/<slug>` to the matching page', () => {
    expect(classifyHref('/about', PAGES)).toEqual({
      kind: 'page',
      pageName: 'about',
    });
    expect(classifyHref('/dashboard', PAGES)).toEqual({
      kind: 'page',
      pageName: 'dashboard',
    });
  });

  it('flags `/<slug>` for a missing page as broken', () => {
    expect(classifyHref('/contact', PAGES)).toEqual({
      kind: 'broken',
      pageName: 'contact',
    });
  });

  it('strips trailing path / query / fragment when matching the page slug', () => {
    expect(classifyHref('/about#contact', PAGES)).toEqual({
      kind: 'page',
      pageName: 'about',
    });
    expect(classifyHref('/about?tab=team', PAGES)).toEqual({
      kind: 'page',
      pageName: 'about',
    });
    expect(classifyHref('/about/team', PAGES)).toEqual({
      kind: 'page',
      pageName: 'about',
    });
  });

  it('classifies http / https / mailto / tel as external', () => {
    expect(classifyHref('https://example.com', PAGES)).toEqual({
      kind: 'external',
      url: 'https://example.com',
    });
    expect(classifyHref('http://example.com/path', PAGES)).toEqual({
      kind: 'external',
      url: 'http://example.com/path',
    });
    expect(classifyHref('mailto:hello@example.com', PAGES)).toEqual({
      kind: 'external',
      url: 'mailto:hello@example.com',
    });
    expect(classifyHref('tel:+15551234567', PAGES)).toEqual({
      kind: 'external',
      url: 'tel:+15551234567',
    });
  });

  it('routes javascript: / data: schemes to custom (refusing to claim them as external)', () => {
    expect(classifyHref('javascript:alert(1)', PAGES)).toEqual({
      kind: 'custom',
      raw: 'javascript:alert(1)',
    });
    expect(classifyHref('data:text/html,<script>1</script>', PAGES)).toEqual({
      kind: 'custom',
      raw: 'data:text/html,<script>1</script>',
    });
  });

  it('routes fragment-only and relative paths to custom', () => {
    expect(classifyHref('#section', PAGES)).toEqual({
      kind: 'custom',
      raw: '#section',
    });
    expect(classifyHref('./about', PAGES)).toEqual({
      kind: 'custom',
      raw: './about',
    });
    expect(classifyHref('about', PAGES)).toEqual({
      kind: 'custom',
      raw: 'about',
    });
  });

  it('treats the home page as broken when home is missing from the project (defensive)', () => {
    expect(classifyHref('/', ['about'])).toEqual({
      kind: 'broken',
      pageName: 'home',
    });
  });
});

describe('pageNameToHref', () => {
  it('emits `/` for the home page', () => {
    expect(pageNameToHref('home')).toBe('/');
  });
  it('emits `/<slug>` for any other page', () => {
    expect(pageNameToHref('about')).toBe('/about');
    expect(pageNameToHref('checkout-flow')).toBe('/checkout-flow');
  });
});

describe('isValidExternalUrl', () => {
  it('accepts http / https / mailto / tel', () => {
    expect(isValidExternalUrl('https://example.com')).toBe(true);
    expect(isValidExternalUrl('http://x.test')).toBe(true);
    expect(isValidExternalUrl('mailto:a@b.com')).toBe(true);
    expect(isValidExternalUrl('tel:+1')).toBe(true);
  });
  it('rejects forbidden schemes', () => {
    expect(isValidExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isValidExternalUrl('data:text/html,foo')).toBe(false);
  });
  it('rejects empty, fragment-only, and relative paths', () => {
    expect(isValidExternalUrl('')).toBe(false);
    expect(isValidExternalUrl('   ')).toBe(false);
    expect(isValidExternalUrl('#section')).toBe(false);
    expect(isValidExternalUrl('/about')).toBe(false);
    expect(isValidExternalUrl('about')).toBe(false);
  });
});
