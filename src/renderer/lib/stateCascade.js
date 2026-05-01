import { resolveElementAtBreakpoint } from './breakpointCascade';
/**
 * Return the element rendered at the active breakpoint AND active
 * state — base styles with breakpoint overrides layered first
 * (existing cascade), then the active state's overrides on top.
 *
 * The two axes are independent in this version: a state override
 * always wins when present, regardless of which breakpoint is active.
 * State × breakpoint matrix combinations are deferred — see the
 * element-states plan.
 *
 * `customProperties` merge object-wise across both axes so a
 * hover-state `box-shadow` is added to the base/breakpoint's
 * `transform` rather than wiping it.
 *
 * Pure: returns the input element unchanged when there's nothing to
 * apply. `activeState === null` short-circuits to the breakpoint
 * resolver alone.
 */
export const resolveElementAtState = (element, activeBreakpointId, breakpoints, activeState) => {
    const atBreakpoint = resolveElementAtBreakpoint(element, activeBreakpointId, breakpoints);
    if (activeState === null)
        return atBreakpoint;
    const override = element.stateOverrides?.[activeState];
    if (!override || Object.keys(override).length === 0)
        return atBreakpoint;
    const mergedCustom = {
        ...atBreakpoint.customProperties,
        ...(override.customProperties ?? {}),
    };
    return {
        ...atBreakpoint,
        ...override,
        customProperties: mergedCustom,
    };
};
