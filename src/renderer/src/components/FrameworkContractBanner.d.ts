import type { FrameworkInfo } from '@shared/types';
type Props = {
    framework: FrameworkInfo;
    onDismiss: () => void;
};
/**
 * Shown above the canvas of a scamp-format project whose installed
 * `scampjs` is missing or implements a contract this build can't read
 * or write. The app still opens the project; the banner says what to
 * install. Renders nothing when the install is in range.
 * see docs/plans/framework-phase-1-plan.md, step 6
 */
export declare const FrameworkContractBanner: ({ framework, onDismiss }: Props) => JSX.Element | null;
export {};
