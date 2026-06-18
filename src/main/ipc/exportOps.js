export const EXTENSION_FOR = {
    png: 'png',
    svg: 'svg',
};
/** Strip path separators and other characters that don't belong in a filename. */
export const sanitizeFilename = (raw) => raw.replace(/[\\/:*?"<>|]+/g, '').trim();
/** Decode a `data:image/png;base64,…` URL into a buffer. */
export const decodeDataUrl = (dataUrl) => {
    const comma = dataUrl.indexOf(',');
    if (comma < 0)
        throw new Error('Malformed data URL');
    const base64 = dataUrl.slice(comma + 1);
    return Buffer.from(base64, 'base64');
};
