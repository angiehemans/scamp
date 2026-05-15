import { describe, it, expect } from 'vitest';
import {
  ALL_PROPERTY_GROUPS,
  CUSTOM_PROP_TO_GROUP,
  FIELD_TO_GROUP,
  GROUP_CUSTOM_PROPS,
  GROUP_FIELDS,
  canonicalizeGroupList,
  isPropertyGroup,
  type PropertyGroup,
} from '@lib/propertyGroups';

describe('PropertyGroup taxonomy', () => {
  it('lists exactly the eight togglable groups', () => {
    expect([...ALL_PROPERTY_GROUPS].sort()).toEqual([
      'animation',
      'background',
      'blend',
      'border',
      'filters',
      'shadow',
      'transitions',
      'typography',
    ]);
  });

  it('excludes layout, sizing, and visibility (per CLAUDE.md design rationale)', () => {
    const excluded = ['layout', 'sizing', 'visibility', 'position', 'element', 'export'];
    for (const name of excluded) {
      expect(ALL_PROPERTY_GROUPS).not.toContain(name);
    }
  });
});

describe('isPropertyGroup', () => {
  it('accepts every known group name', () => {
    for (const g of ALL_PROPERTY_GROUPS) {
      expect(isPropertyGroup(g)).toBe(true);
    }
  });

  it('rejects unknown names', () => {
    expect(isPropertyGroup('layout')).toBe(false);
    expect(isPropertyGroup('')).toBe(false);
    expect(isPropertyGroup('Background')).toBe(false);
  });
});

describe('GROUP_FIELDS', () => {
  it('has an entry for every group', () => {
    for (const g of ALL_PROPERTY_GROUPS) {
      expect(GROUP_FIELDS[g]).toBeDefined();
      expect(GROUP_FIELDS[g].length).toBeGreaterThan(0);
    }
  });

  it('routes border-related fields into the border group', () => {
    expect(GROUP_FIELDS.border).toEqual([
      'borderColor',
      'borderStyle',
      'borderWidth',
      'borderRadius',
    ]);
  });

  it('routes blend modes into the blend group (not background)', () => {
    expect(GROUP_FIELDS.blend).toContain('mixBlendMode');
    expect(GROUP_FIELDS.blend).toContain('backgroundBlendMode');
    expect(GROUP_FIELDS.background).not.toContain('backgroundBlendMode');
  });

  it('every field appears in exactly one group', () => {
    const seen = new Map<string, PropertyGroup>();
    for (const [group, fields] of Object.entries(GROUP_FIELDS) as Array<
      [PropertyGroup, ReadonlyArray<string>]
    >) {
      for (const field of fields) {
        expect(seen.has(field)).toBe(false);
        seen.set(field, group);
      }
    }
  });
});

describe('FIELD_TO_GROUP', () => {
  it('is the inverse of GROUP_FIELDS', () => {
    for (const [group, fields] of Object.entries(GROUP_FIELDS) as Array<
      [PropertyGroup, ReadonlyArray<string>]
    >) {
      for (const field of fields) {
        expect(FIELD_TO_GROUP[field as never]).toBe(group);
      }
    }
  });

  it('returns undefined for fields not in any group', () => {
    expect(FIELD_TO_GROUP['widthMode' as never]).toBeUndefined();
    expect(FIELD_TO_GROUP['display' as never]).toBeUndefined();
    expect(FIELD_TO_GROUP['x' as never]).toBeUndefined();
  });
});

describe('GROUP_CUSTOM_PROPS', () => {
  it('routes background-image and siblings to the background group', () => {
    expect(GROUP_CUSTOM_PROPS.background).toEqual([
      'background-image',
      'background-size',
      'background-position',
      'background-repeat',
    ]);
  });

  it('CUSTOM_PROP_TO_GROUP is the inverse', () => {
    expect(CUSTOM_PROP_TO_GROUP['background-image']).toBe('background');
    expect(CUSTOM_PROP_TO_GROUP['background-size']).toBe('background');
    expect(CUSTOM_PROP_TO_GROUP['background-position']).toBe('background');
    expect(CUSTOM_PROP_TO_GROUP['background-repeat']).toBe('background');
  });

  it('returns undefined for unmapped custom properties', () => {
    expect(CUSTOM_PROP_TO_GROUP['outline']).toBeUndefined();
    expect(CUSTOM_PROP_TO_GROUP['cursor']).toBeUndefined();
  });
});

describe('canonicalizeGroupList', () => {
  it('sorts alphabetically', () => {
    expect(canonicalizeGroupList(['shadow', 'background', 'border'])).toEqual([
      'background',
      'border',
      'shadow',
    ]);
  });

  it('dedupes', () => {
    expect(
      canonicalizeGroupList(['shadow', 'shadow', 'background', 'shadow'])
    ).toEqual(['background', 'shadow']);
  });

  it('returns an empty list for empty input', () => {
    expect(canonicalizeGroupList([])).toEqual([]);
  });
});
