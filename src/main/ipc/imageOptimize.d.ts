/**
 * Is a lossless encode worth attempting for this image?
 *
 * A JPEG source is already lossy, so a lossless re-encode of one can only
 * preserve compression artefacts at great expense — the decoded format
 * decides this, not the file extension, since an extension can lie.
 */
export declare const shouldTryLossless: (decodedAs: "png" | "jpeg", width: number, height: number) => boolean;
export declare const isConvertible: (sourcePath: string) => boolean;
/**
 * Encode `sourcePath` as WebP and return the bytes, or null to keep the
 * original.
 *
 * Null whenever converting isn't a clear win — an unconvertible type, a
 * file that isn't a decodable image, or a WebP that came out no smaller
 * than the source. That last case is the point: this runs silently on
 * every import, so it has to be incapable of making a file worse.
 */
export declare const toWebpIfSmaller: (sourcePath: string) => Promise<{
    data: Buffer;
    ext: ".webp";
} | null>;
/**
 * The same, for bytes with no file behind them — the clipboard-paste
 * path.
 *
 * Worth more here than on a normal import: Electron's `toDataURL()`
 * always hands back PNG, so pasting a photograph that was originally a
 * JPEG re-encodes it to PNG and can multiply its size. This is the one
 * place the pipeline used to actively inflate a file.
 */
export declare const bufferToWebpIfSmaller: (data: Buffer) => Promise<{
    data: Buffer;
    ext: ".webp";
} | null>;
