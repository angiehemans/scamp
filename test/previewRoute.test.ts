import { describe, it, expect } from 'vitest';
import { pageNameToRoute, previewUrl } from '../src/renderer/preview/route';

describe('pageNameToRoute', () => {
  it('maps the home page to the root route', () => {
    expect(pageNameToRoute('home')).toBe('/');
  });

  it('maps an empty string to the root route (defensive)', () => {
    expect(pageNameToRoute('')).toBe('/');
  });

  it('prefers an explicit route, as a Scamp-framework view uses for /_views/<Name>', () => {
    const routes = { home: '/_views/Home', lobby: '/_views/Lobby' };
    expect(pageNameToRoute('lobby', routes)).toBe('/_views/Lobby');
    expect(pageNameToRoute('home', routes)).toBe('/_views/Home');
    // A name outside the map falls back to the Next.js convention.
    expect(pageNameToRoute('about', routes)).toBe('/about');
  });

  it('maps any other page name to /<name>', () => {
    expect(pageNameToRoute('about')).toBe('/about');
    expect(pageNameToRoute('checkout-flow')).toBe('/checkout-flow');
  });
});

describe('previewUrl', () => {
  it('composes a localhost URL with the given port and route', () => {
    expect(previewUrl(3001, '/about')).toBe('http://localhost:3001/about');
  });

  it('inserts a leading slash when the route is missing one', () => {
    expect(previewUrl(3001, 'dashboard')).toBe('http://localhost:3001/dashboard');
  });

  it('preserves the bare root path', () => {
    expect(previewUrl(3001, '/')).toBe('http://localhost:3001/');
  });
});
