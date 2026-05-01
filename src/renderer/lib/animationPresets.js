const ENTRANCE_DEFAULTS = {
    durationMs: 300,
    easing: 'ease',
    iterationCount: 1,
    direction: 'normal',
    fillMode: 'forwards',
};
const EXIT_DEFAULTS = {
    durationMs: 300,
    easing: 'ease',
    iterationCount: 1,
    direction: 'normal',
    fillMode: 'forwards',
};
const LOOPING_DEFAULTS = {
    durationMs: 1000,
    easing: 'ease-in-out',
    iterationCount: 'infinite',
    direction: 'normal',
    fillMode: 'none',
};
const SHAKE_DEFAULTS = {
    durationMs: 500,
    easing: 'ease-in-out',
    iterationCount: 1,
    direction: 'normal',
    fillMode: 'none',
};
const SPIN_DEFAULTS = {
    durationMs: 1000,
    easing: 'linear',
    iterationCount: 'infinite',
    direction: 'normal',
    fillMode: 'none',
};
export const ANIMATION_PRESETS = [
    // -------- Entrances --------
    {
        name: 'fade-in',
        category: 'entrance',
        description: 'Fade in from transparent',
        defaults: ENTRANCE_DEFAULTS,
        body: `  from { opacity: 0; }
  to { opacity: 1; }`,
    },
    {
        name: 'fade-in-up',
        category: 'entrance',
        description: 'Fade in while moving up',
        defaults: ENTRANCE_DEFAULTS,
        body: `  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }`,
    },
    {
        name: 'fade-in-down',
        category: 'entrance',
        description: 'Fade in while moving down',
        defaults: ENTRANCE_DEFAULTS,
        body: `  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }`,
    },
    {
        name: 'slide-in-left',
        category: 'entrance',
        description: 'Slide in from the left edge',
        defaults: ENTRANCE_DEFAULTS,
        body: `  from { transform: translateX(-100%); }
  to { transform: translateX(0); }`,
    },
    {
        name: 'slide-in-right',
        category: 'entrance',
        description: 'Slide in from the right edge',
        defaults: ENTRANCE_DEFAULTS,
        body: `  from { transform: translateX(100%); }
  to { transform: translateX(0); }`,
    },
    {
        name: 'scale-in',
        category: 'entrance',
        description: 'Fade in while scaling up subtly',
        defaults: ENTRANCE_DEFAULTS,
        body: `  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }`,
    },
    {
        name: 'bounce-in',
        category: 'entrance',
        description: 'Scale up with an overshoot bounce',
        defaults: { ...ENTRANCE_DEFAULTS, durationMs: 500 },
        body: `  0% { opacity: 0; transform: scale(0.8); }
  60% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }`,
    },
    // -------- Exits --------
    {
        name: 'fade-out',
        category: 'exit',
        description: 'Fade out to transparent',
        defaults: EXIT_DEFAULTS,
        body: `  from { opacity: 1; }
  to { opacity: 0; }`,
    },
    {
        name: 'fade-out-up',
        category: 'exit',
        description: 'Fade out while moving up',
        defaults: EXIT_DEFAULTS,
        body: `  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-16px); }`,
    },
    {
        name: 'slide-out-left',
        category: 'exit',
        description: 'Slide out to the left edge',
        defaults: EXIT_DEFAULTS,
        body: `  from { transform: translateX(0); }
  to { transform: translateX(-100%); }`,
    },
    {
        name: 'slide-out-right',
        category: 'exit',
        description: 'Slide out to the right edge',
        defaults: EXIT_DEFAULTS,
        body: `  from { transform: translateX(0); }
  to { transform: translateX(100%); }`,
    },
    {
        name: 'scale-out',
        category: 'exit',
        description: 'Fade out while scaling down subtly',
        defaults: EXIT_DEFAULTS,
        body: `  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }`,
    },
    // -------- Attention --------
    {
        name: 'pulse',
        category: 'attention',
        description: 'Gentle scale pulse, loops',
        defaults: LOOPING_DEFAULTS,
        body: `  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }`,
    },
    {
        name: 'shake',
        category: 'attention',
        description: 'Rapid horizontal shake',
        defaults: SHAKE_DEFAULTS,
        body: `  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }`,
    },
    {
        name: 'bounce',
        category: 'attention',
        description: 'Vertical bounce, loops',
        defaults: LOOPING_DEFAULTS,
        body: `  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }`,
    },
    {
        name: 'spin',
        category: 'attention',
        description: 'Continuous rotation, loops',
        defaults: SPIN_DEFAULTS,
        body: `  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }`,
    },
    {
        name: 'ping',
        category: 'attention',
        description: 'Pulse + fade, suitable for notification dots',
        defaults: LOOPING_DEFAULTS,
        body: `  0% { transform: scale(1); opacity: 1; }
  75%, 100% { transform: scale(2); opacity: 0; }`,
    },
    // -------- Subtle --------
    {
        name: 'float',
        category: 'subtle',
        description: 'Gentle vertical drift, loops',
        defaults: { ...LOOPING_DEFAULTS, durationMs: 3000 },
        body: `  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }`,
    },
    {
        name: 'wiggle',
        category: 'subtle',
        description: 'Subtle rotation oscillation, loops',
        defaults: { ...LOOPING_DEFAULTS, durationMs: 2000 },
        body: `  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }`,
    },
];
export const PRESETS_BY_NAME = new Map(ANIMATION_PRESETS.map((p) => [p.name, p]));
/** True when `name` matches a preset in the library. */
export const isPresetName = (name) => PRESETS_BY_NAME.has(name);
