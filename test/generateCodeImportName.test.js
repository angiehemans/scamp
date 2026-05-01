import { describe, it, expect } from 'vitest';
import { generateCode, generateCodeLegacy } from '@lib/generateCode';
import { ROOT_ELEMENT_ID } from '@lib/element';
const makeRoot = () => ({
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds: [],
    widthMode: 'stretch',
    widthValue: 1440,
    heightMode: 'auto',
    heightValue: 900,
    minHeight: '100vh',
    x: 0,
    y: 0,
    display: 'none',
    flexDirection: 'row',
    gap: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gridTemplateColumns: '',
    gridTemplateRows: '',
    columnGap: 0,
    rowGap: 0,
    justifyItems: 'stretch',
    gridColumn: '',
    gridRow: '',
    alignSelf: 'stretch',
    justifySelf: 'stretch',
    padding: [0, 0, 0, 0],
    margin: [0, 0, 0, 0],
    backgroundColor: '#ffffff',
    borderRadius: [0, 0, 0, 0],
    borderWidth: [0, 0, 0, 0],
    borderStyle: 'none',
    borderColor: '#000000',
    opacity: 1,
    visibilityMode: 'visible',
    position: 'auto',
    transitions: [],
    inlineFragments: [],
    customProperties: {},
});
describe('generateCode — cssModuleImportName', () => {
    it('emits ./<pageName>.module.css when no override is given (legacy default)', () => {
        const { tsx } = generateCode({
            elements: { [ROOT_ELEMENT_ID]: makeRoot() },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'about',
        });
        expect(tsx).toContain(`import styles from './about.module.css';`);
    });
    it('emits ./page.module.css when cssModuleImportName=page (nextjs)', () => {
        // In the Next.js layout every page lives in its own folder and
        // imports the co-located `page.module.css` regardless of the page
        // slug, so the slug shouldn't leak into the import line.
        const { tsx } = generateCode({
            elements: { [ROOT_ELEMENT_ID]: makeRoot() },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'about',
            cssModuleImportName: 'page',
        });
        expect(tsx).toContain(`import styles from './page.module.css';`);
        expect(tsx).not.toContain('about.module.css');
    });
    it('still derives the component name from the page slug when overriding the import', () => {
        // The component name still comes from the page slug — only the
        // CSS-module import basename is parameterised.
        const { tsx } = generateCode({
            elements: { [ROOT_ELEMENT_ID]: makeRoot() },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'about-us',
            cssModuleImportName: 'page',
        });
        expect(tsx).toContain('export default function AboutUs()');
    });
});
describe('generateCodeLegacy', () => {
    it('matches generateCode with cssModuleImportName=pageName', () => {
        const elements = { [ROOT_ELEMENT_ID]: makeRoot() };
        const legacy = generateCodeLegacy({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
        });
        const explicit = generateCode({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            cssModuleImportName: 'home',
        });
        expect(legacy).toEqual(explicit);
    });
    it('ignores any cssModuleImportName the caller passes', () => {
        // The legacy entry point's whole point is that the import is
        // pinned to the page name — if a caller threads an override through
        // by accident, legacy should still behave legacy.
        const elements = { [ROOT_ELEMENT_ID]: makeRoot() };
        const legacy = generateCodeLegacy({
            elements,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            cssModuleImportName: 'page',
        });
        expect(legacy.tsx).toContain(`import styles from './home.module.css';`);
    });
});
