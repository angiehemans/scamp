import { describe, it, expect } from 'vitest';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';

const HOME_TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2} />
    </div>
  );
}
`;

describe('parseCode — element-level animation', () => {
  it('parses a preset animation into the typed field with isPreset=true', () => {
    const css = `.root {
}

.rect_a1b2 {
  animation: fade-in-up 300ms ease forwards;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.animation).toEqual({
      name: 'fade-in-up',
      isPreset: true,
      durationMs: 300,
      easing: 'ease',
      delayMs: 0,
      iterationCount: 1,
      direction: 'normal',
      fillMode: 'forwards',
      playState: 'running',
    });
  });

  it('parses a custom-named animation with isPreset=false', () => {
    const css = `.root {
}

.rect_a1b2 {
  animation: myCustomAnim 500ms linear infinite;
}

@keyframes myCustomAnim {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.animation?.name).toBe('myCustomAnim');
    expect(el?.animation?.isPreset).toBe(false);
  });

  it('falls back to customProperties for multi-animation source', () => {
    const css = `.root {
}

.rect_a1b2 {
  animation: fade-in 300ms, slide-in-left 500ms;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.animation).toBeUndefined();
    expect(el?.customProperties.animation).toBe(
      'fade-in 300ms, slide-in-left 500ms'
    );
  });
});

describe('parseCode — @keyframes blocks', () => {
  it('collects @keyframes blocks into keyframesBlocks', () => {
    const css = `.root {
}

@keyframes my-anim {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;
    const parsed = parseCode(HOME_TSX, css);
    expect(parsed.keyframesBlocks.length).toBe(1);
    expect(parsed.keyframesBlocks[0]?.name).toBe('my-anim');
    expect(parsed.keyframesBlocks[0]?.body).toContain('opacity: 0');
  });

  it('marks isPreset=true when name + body match a known preset', () => {
    const css = `.root {
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;
    const parsed = parseCode(HOME_TSX, css);
    expect(parsed.keyframesBlocks[0]?.isPreset).toBe(true);
  });

  it('marks isPreset=false when a preset name has been agent-edited', () => {
    const css = `.root {
}

@keyframes fade-in {
  from { opacity: 0.5; }
  to { opacity: 1; }
}
`;
    const parsed = parseCode(HOME_TSX, css);
    expect(parsed.keyframesBlocks[0]?.isPreset).toBe(false);
  });

  it('preserves vendor-prefixed @-webkit-keyframes via customMediaBlocks', () => {
    const css = `.root {
}

@-webkit-keyframes my-anim {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;
    const parsed = parseCode(HOME_TSX, css);
    // -webkit-keyframes isn't routed to keyframesBlocks (we only
    // handle the unprefixed form) but must round-trip via the
    // generic at-rule passthrough.
    expect(parsed.keyframesBlocks.length).toBe(0);
    expect(parsed.customMediaBlocks.some((b) => b.includes('-webkit-keyframes'))).toBe(true);
  });
});

describe('parseCode — animation in :hover state block', () => {
  it('parses :hover { animation: ... } into stateOverrides.hover.animation', () => {
    const css = `.root {
}

.rect_a1b2 {
}

.rect_a1b2:hover {
  animation: shake 500ms ease-in-out;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.stateOverrides?.hover?.animation).toEqual({
      name: 'shake',
      isPreset: true,
      durationMs: 500,
      easing: 'ease-in-out',
      delayMs: 0,
      iterationCount: 1,
      direction: 'normal',
      fillMode: 'none',
      playState: 'running',
    });
  });

  it('does not double-store the animation in customProperties', () => {
    const css = `.root {
}

.rect_a1b2 {
}

.rect_a1b2:hover {
  animation: shake 500ms ease-in-out;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.stateOverrides?.hover?.customProperties).toBeUndefined();
  });
});

describe('parseCode — @media containing animation declarations', () => {
  it('routes the whole @media block to customMediaBlocks (out of scope)', () => {
    const css = `.root {
}

.rect_a1b2 {
}

@media (max-width: 768px) {
  .rect_a1b2 {
    animation: spin 1s linear infinite;
  }
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    // No breakpoint override should be created for an animation-
    // bearing @media block.
    expect(el?.breakpointOverrides?.tablet).toBeUndefined();
    // The block round-trips via customMediaBlocks.
    expect(parsed.customMediaBlocks.length).toBe(1);
    expect(parsed.customMediaBlocks[0]).toContain('animation: spin 1s linear infinite');
  });
});

describe('parseCode — round-trip invariants', () => {
  it('round-trips a preset animation through generate → parse', () => {
    const css = `.root {
  position: relative;
}

.rect_a1b2 {
  position: absolute;
  left: 0px;
  top: 0px;
  animation: fade-in-up 300ms ease forwards;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
    const first = parseCode(HOME_TSX, css);
    const regenerated = generateCode({
      elements: first.elements,
      rootId: first.rootId,
      pageName: 'home',
      customMediaBlocks: first.customMediaBlocks,
      pageKeyframesBlocks: first.keyframesBlocks,
    });
    const second = parseCode(regenerated.tsx, regenerated.css);
    expect(second.elements).toEqual(first.elements);
    expect(second.keyframesBlocks).toEqual(first.keyframesBlocks);
  });

  it('round-trips a hover animation', () => {
    const css = `.root {
  position: relative;
}

.rect_a1b2 {
  position: absolute;
  left: 0px;
  top: 0px;
}

.rect_a1b2:hover {
  animation: shake 500ms ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
`;
    const first = parseCode(HOME_TSX, css);
    const regenerated = generateCode({
      elements: first.elements,
      rootId: first.rootId,
      pageName: 'home',
      customMediaBlocks: first.customMediaBlocks,
      pageKeyframesBlocks: first.keyframesBlocks,
    });
    const second = parseCode(regenerated.tsx, regenerated.css);
    expect(second.elements).toEqual(first.elements);
  });
});
