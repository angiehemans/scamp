import type { Settings } from '@shared/types';
export declare const isValidInstallId: (value: unknown) => value is string;
export type InstallIdResult = {
    installId: string;
    /** True when this call minted a new one, so the caller knows to persist. */
    created: boolean;
};
/**
 * The install id from settings, generating one if absent or malformed.
 *
 * Pure — takes settings in, hands an id back, and reports whether it made
 * one. Persisting is the caller's job, which keeps this testable without
 * touching Electron's userData path.
 */
export declare const resolveInstallId: (settings: Settings) => InstallIdResult;
/**
 * The id to use given the user's consent — `null` when they haven't opted in
 * under the current wording.
 *
 * Returning null (rather than generating one anyway) is what makes opting out
 * actually sever the link: the caller clears the stored value, so opting back
 * in later mints a fresh id rather than rejoining the old identity.
 */
export declare const installIdForConsent: (settings: Settings, optedIn: boolean) => InstallIdResult | null;
