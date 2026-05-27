export declare const checkWriteConflict: (args: {
    tsxPath: string;
    cssPath: string;
    expectedTsxContent?: string;
    expectedCssContent?: string;
}) => Promise<{
    actualTsxContent: string;
    actualCssContent: string;
} | null>;
