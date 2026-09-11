import { describe, it, expect } from 'vitest';
import { parseViewWrapper, viewNameForPage, viewSlugFor, viewWrapperTsx, } from '@shared/templates';
describe('viewWrapperTsx', () => {
    it('imports the view through the @/views alias and renders it', () => {
        expect(viewWrapperTsx('Lobby')).toBe(`import Lobby from '@/views/Lobby/Lobby';\n\nexport default function LobbyPage() {\n  return <Lobby />;\n}\n`);
    });
    it('round-trips through parseViewWrapper', () => {
        expect(parseViewWrapper(viewWrapperTsx('HeroCard'))).toBe('HeroCard');
    });
});
describe('parseViewWrapper', () => {
    it('returns null for a real page', () => {
        const page = `import styles from './page.module.css';\n\nexport default function Home() {\n  return (\n    <div data-scamp-id="root" className={styles.root}></div>\n  );\n}\n`;
        expect(parseViewWrapper(page)).toBeNull();
    });
    it('returns null when the import and the rendered tag disagree', () => {
        const tsx = `import Lobby from '@/views/Lobby/Lobby';\n\nexport default function LobbyPage() {\n  return <Home />;\n}\n`;
        expect(parseViewWrapper(tsx)).toBeNull();
    });
    it('returns null for a wrapper with extra logic (that is a route, not a wrapper)', () => {
        const tsx = `import Lobby from '@/views/Lobby/Lobby';\n\nexport default function LobbyPage() {\n  const x = 1;\n  return <Lobby />;\n}\n`;
        expect(parseViewWrapper(tsx)).toBeNull();
    });
    it('tolerates surrounding whitespace', () => {
        expect(parseViewWrapper(`\n${viewWrapperTsx('Home')}\n\n`)).toBe('Home');
    });
    it('returns null for an empty string', () => {
        expect(parseViewWrapper('')).toBeNull();
    });
});
describe('viewSlugFor', () => {
    it('lowercases a single word', () => {
        expect(viewSlugFor('Home')).toBe('home');
    });
    it('kebab-cases PascalCase', () => {
        expect(viewSlugFor('HeroCard')).toBe('hero-card');
        expect(viewSlugFor('CheckoutFlowStep')).toBe('checkout-flow-step');
    });
    it('keeps digits attached and splits acronyms sensibly', () => {
        expect(viewSlugFor('Button2')).toBe('button2');
        expect(viewSlugFor('FAQPage')).toBe('faq-page');
    });
});
describe('viewNameForPage', () => {
    it('PascalCases a kebab-case page name', () => {
        expect(viewNameForPage('checkout-flow')).toBe('CheckoutFlow');
        expect(viewNameForPage('home')).toBe('Home');
    });
    it('inverts viewSlugFor for every page-name shape', () => {
        for (const page of ['home', 'about', 'checkout-flow', 'page2', 'v2-beta', 'faq']) {
            expect(viewSlugFor(viewNameForPage(page))).toBe(page);
        }
    });
});
