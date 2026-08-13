export declare const isConvertible: (sourcePath: string) => boolean;
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
