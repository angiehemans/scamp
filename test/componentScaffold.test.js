import { describe, expect, it } from 'vitest';
import { COMPONENT_NAME_RE, DEFAULT_COMPONENT_CSS, componentRelativePaths, defaultComponentTsx, } from '../src/main/ipc/componentScaffold';
describe('COMPONENT_NAME_RE', () => {
    it('accepts PascalCase letters and digits', () => {
        for (const name of ['Card', 'HeroCard', 'Button2', 'A']) {
            expect(COMPONENT_NAME_RE.test(name), name).toBe(true);
        }
    });
    it('rejects anything that is not a valid Capitalised JSX identifier', () => {
        for (const name of ['card', 'hero-card', 'hero_card', '2Card', '', 'Hero Card']) {
            expect(COMPONENT_NAME_RE.test(name), name).toBe(false);
        }
    });
});
describe('defaultComponentTsx', () => {
    it('names the props type, the function, and the styles import after the component', () => {
        const tsx = defaultComponentTsx('HeroCard');
        expect(tsx).toContain("import styles from './HeroCard.module.css';");
        expect(tsx).toContain('type HeroCardProps = {');
        expect(tsx).toContain('export default function HeroCard({ className }: HeroCardProps)');
    });
    it('gives the root the className passthrough every component accepts', () => {
        expect(defaultComponentTsx('Card')).toContain('<div data-scamp-id="root" className={`${styles.root} ${className ?? \'\'}`} />');
    });
});
describe('DEFAULT_COMPONENT_CSS', () => {
    it('sizes the root to its content with no viewport floor', () => {
        expect(DEFAULT_COMPONENT_CSS).toContain('width: 100%;');
        expect(DEFAULT_COMPONENT_CSS).not.toContain('100vh');
    });
});
describe('componentRelativePaths', () => {
    it('puts both files in a folder named after the component', () => {
        expect(componentRelativePaths('Card')).toEqual({
            tsx: 'components/Card/Card.tsx',
            css: 'components/Card/Card.module.css',
        });
    });
});
