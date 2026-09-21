import { type ScampElement } from '@lib/element';
export declare const makeRoot: (childIds?: string[]) => ScampElement;
export declare const makeRect: (overrides: Partial<ScampElement> & {
    id: string;
}) => ScampElement;
