/**
 * Classify a raw `href` value into the kinds the Link section's UI
 * cares about. Pure: takes the href + the project's page list, returns
 * a tagged union.
 *
 * The Link section uses this on every render to decide which control
 * group is active (page dropdown / external URL / custom passthrough),
 * so there's no separate "kind" field stored on the element — the
 * file is the source of truth.
 */
export type HrefKind = 
/** Empty / missing href — element isn't a link. */
{
    kind: 'none';
}
/** href points at a known page in the project (`/`, `/about`). */
 | {
    kind: 'page';
    pageName: string;
}
/** href looks like a page reference (`/foo`) but no matching page. */
 | {
    kind: 'broken';
    pageName: string;
}
/** Absolute external URL (http/https), mailto:, tel:, etc. */
 | {
    kind: 'external';
    url: string;
}
/** Anything else — `#anchor`, relative paths, raw expressions. */
 | {
    kind: 'custom';
    raw: string;
};
export declare const classifyHref: (rawHref: string | undefined | null, pageNames: ReadonlyArray<string>) => HrefKind;
/** Inverse: emit the href string for an internal page reference. */
export declare const pageNameToHref: (pageName: string) => string;
/**
 * True when a URL string passes the Link section's external-URL
 * validation (modern scheme, no forbidden schemes). Used to gate the
 * URL text input — invalid input shows an inline error rather than
 * landing in the file.
 */
export declare const isValidExternalUrl: (raw: string) => boolean;
