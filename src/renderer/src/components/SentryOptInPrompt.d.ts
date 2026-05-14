type Props = {
    /** Called with the user's choice. The caller is responsible for
     *  writing the pref + re-initialising Sentry. */
    onDecision: (optedIn: boolean) => void;
};
/**
 * First-launch crash-reporting opt-in prompt. Rendered by `App.tsx`
 * before `<StartScreen>` when `settings.sentryOptIn` is `null` (i.e.
 * the user has not been asked yet). Calling `onDecision(true)` or
 * `onDecision(false)` writes the pref via the IPC bridge and
 * re-renders the app normally.
 *
 * Intentionally NOT dismissible by clicking the backdrop — the user
 * has to make an explicit choice. Pressing Escape counts as "No
 * thanks" (the privacy-preserving default).
 */
export declare const SentryOptInPrompt: ({ onDecision }: Props) => JSX.Element;
export {};
