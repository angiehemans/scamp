import type { ExportFormat } from '@shared/types';
export declare const EXTENSION_FOR: Record<ExportFormat, string>;
/** Strip path separators and other characters that don't belong in a filename. */
export declare const sanitizeFilename: (raw: string) => string;
/** Decode a `data:image/png;base64,…` URL into a buffer. */
export declare const decodeDataUrl: (dataUrl: string) => Buffer;
