import { describe, it, expect } from 'vitest';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';

describe('DEFAULT_RECT_STYLES', () => {
  it('matches the documented PRD defaults exactly', () => {
    expect(DEFAULT_RECT_STYLES).toEqual({
      display: 'none',
      flexDirection: 'row',
      gap: 0,
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      padding: [0, 0, 0, 0],
      margin: [0, 0, 0, 0],
      widthMode: 'fixed',
      widthValue: 100,
      heightMode: 'fixed',
      heightValue: 100,
      backgroundColor: 'transparent',
      borderRadius: [0, 0, 0, 0],
      borderWidth: [0, 0, 0, 0],
      borderStyle: 'none',
      borderColor: '#000000',
      opacity: 1,
      visibilityMode: 'visible',
    });
  });

  it('has padding as a 4-tuple', () => {
    expect(DEFAULT_RECT_STYLES.padding).toHaveLength(4);
  });

  it('opacity defaults to fully opaque', () => {
    expect(DEFAULT_RECT_STYLES.opacity).toBe(1);
  });

  it('visibilityMode defaults to visible', () => {
    expect(DEFAULT_RECT_STYLES.visibilityMode).toBe('visible');
  });
});
