import { describe, it, expect } from 'vitest';
import { findInstanceUsagesAcrossPages, filterUsagesWithPropOverride, groupUsagesByPage, wouldCreateComponentCycle, } from '@lib/componentUsage';
import { generateCode } from '@lib/generateCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * Phase 7 coverage: the cross-page usage helper and cycle
 * detection used by the smart-warning ConfirmDialogs.
 */
const makePageRoot = (childIds = []) => ({
    ...DEFAULT_RECT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds,
    widthMode: 'stretch',
    heightMode: 'auto',
    minHeight: '100vh',
    x: 0,
    y: 0,
    backgroundColor: '#ffffff',
    customProperties: {},
});
const makeInstance = (overrides) => ({
    ...DEFAULT_RECT_STYLES,
    type: 'component-instance',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    widthMode: 'auto',
    heightMode: 'auto',
    x: 0,
    y: 0,
    customProperties: {},
    instanceId: `inst_${overrides.id}`,
    propOverrides: {},
    ...overrides,
});
const buildPageFile = (name, instances) => {
    const elements = {
        [ROOT_ELEMENT_ID]: makePageRoot(instances.map((i) => i.id)),
    };
    for (const inst of instances) {
        elements[inst.id] = makeInstance(inst);
    }
    const { tsx, css } = generateCode({
        elements,
        rootId: ROOT_ELEMENT_ID,
        pageName: name,
    });
    return {
        name,
        tsxPath: `/tmp/${name}.tsx`,
        cssPath: `/tmp/${name}.module.css`,
        tsxContent: tsx,
        cssContent: css,
    };
};
describe('findInstanceUsagesAcrossPages', () => {
    it('returns an empty array when no pages contain instances of the name', () => {
        const pages = [buildPageFile('home', [])];
        expect(findInstanceUsagesAcrossPages(pages, 'Button')).toEqual([]);
    });
    it('finds a single instance on a single page', () => {
        const pages = [
            buildPageFile('home', [
                { id: 'i1', componentName: 'Button', propOverrides: { label: 'Hi' } },
            ]),
        ];
        const usages = findInstanceUsagesAcrossPages(pages, 'Button');
        expect(usages.length).toBe(1);
        expect(usages[0].pageName).toBe('home');
        expect(usages[0].propOverrides).toEqual({ label: 'Hi' });
    });
    it('aggregates instances across multiple pages', () => {
        const pages = [
            buildPageFile('home', [
                { id: 'i1', componentName: 'Button' },
                { id: 'i2', componentName: 'Button', propOverrides: { label: 'two' } },
            ]),
            buildPageFile('about', [{ id: 'i3', componentName: 'Button' }]),
            buildPageFile('contact', []),
        ];
        const usages = findInstanceUsagesAcrossPages(pages, 'Button');
        expect(usages.length).toBe(3);
        expect(usages.map((u) => u.pageName).sort()).toEqual([
            'about',
            'home',
            'home',
        ]);
    });
    it('ignores instances of a different component name', () => {
        const pages = [
            buildPageFile('home', [
                { id: 'i1', componentName: 'Button' },
                { id: 'i2', componentName: 'Card' },
            ]),
        ];
        const usages = findInstanceUsagesAcrossPages(pages, 'Button');
        expect(usages.length).toBe(1);
    });
});
describe('filterUsagesWithPropOverride', () => {
    it('keeps only usages with the named override key', () => {
        const usages = [
            { pageName: 'home', instanceCanvasId: 'i1', propOverrides: { label: 'a' } },
            { pageName: 'home', instanceCanvasId: 'i2', propOverrides: {} },
            {
                pageName: 'about',
                instanceCanvasId: 'i3',
                propOverrides: { title: 't', label: 'b' },
            },
        ];
        const filtered = filterUsagesWithPropOverride(usages, 'label');
        expect(filtered.length).toBe(2);
        expect(filtered.map((u) => u.instanceCanvasId).sort()).toEqual(['i1', 'i3']);
    });
    it('treats empty-string override as a present key (not absence)', () => {
        const usages = [
            { pageName: 'home', instanceCanvasId: 'i1', propOverrides: { label: '' } },
        ];
        expect(filterUsagesWithPropOverride(usages, 'label').length).toBe(1);
    });
});
describe('groupUsagesByPage', () => {
    it('rolls up usages into per-page counts in source order', () => {
        const usages = [
            { pageName: 'home', instanceCanvasId: 'i1', propOverrides: {} },
            { pageName: 'about', instanceCanvasId: 'i2', propOverrides: {} },
            { pageName: 'home', instanceCanvasId: 'i3', propOverrides: {} },
        ];
        expect(groupUsagesByPage(usages)).toEqual([
            { pageName: 'home', count: 2 },
            { pageName: 'about', count: 1 },
        ]);
    });
});
describe('wouldCreateComponentCycle', () => {
    // Helper to build a minimal componentTrees map for the cycle check.
    const tree = (name, nestedComponentNames = []) => {
        const elements = {
            [ROOT_ELEMENT_ID]: makePageRoot(nestedComponentNames.map((_, i) => `n${name}_${i}`)),
        };
        nestedComponentNames.forEach((childName, i) => {
            elements[`n${name}_${i}`] = makeInstance({
                id: `n${name}_${i}`,
                componentName: childName,
            });
        });
        return { elements, rootId: ROOT_ELEMENT_ID };
    };
    it('refuses dropping a component into its own editor (direct cycle)', () => {
        const componentTrees = { Button: tree('Button') };
        expect(wouldCreateComponentCycle(componentTrees, 'Button', 'Button')).toBe(true);
    });
    it('returns false when targetName is null (page editor — no cycle possible)', () => {
        const componentTrees = { Button: tree('Button') };
        expect(wouldCreateComponentCycle(componentTrees, null, 'Button')).toBe(false);
    });
    it('refuses one-hop cycle: A contains B; placing A into B', () => {
        const componentTrees = {
            A: tree('A', ['B']),
            B: tree('B'),
        };
        // Dragging A into the editor of B would form A → B → A.
        expect(wouldCreateComponentCycle(componentTrees, 'B', 'A')).toBe(true);
    });
    it('refuses transitive cycle: A→B→C→A', () => {
        const componentTrees = {
            A: tree('A', ['B']),
            B: tree('B', ['C']),
            C: tree('C', []),
        };
        // Dragging A into C would close the loop.
        expect(wouldCreateComponentCycle(componentTrees, 'C', 'A')).toBe(true);
    });
    it('allows a non-cyclic placement', () => {
        const componentTrees = {
            A: tree('A', ['B']),
            B: tree('B'),
            C: tree('C'),
        };
        // C doesn't reference A or itself; placing C into A is fine.
        expect(wouldCreateComponentCycle(componentTrees, 'A', 'C')).toBe(false);
    });
    it('handles components missing from the tree map gracefully', () => {
        // E.g. a component was just created (no tree yet) — placing it
        // anywhere should not crash; the walker just sees no nested
        // instances.
        const componentTrees = {};
        expect(wouldCreateComponentCycle(componentTrees, 'A', 'B')).toBe(false);
    });
});
