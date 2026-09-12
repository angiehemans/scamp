import { type RowScope } from '@lib/bindingEval';
type Props = {
    elementId: string;
    /** The repeat row this render is for; absent outside a repeat. */
    row?: RowScope;
};
export declare const ElementRenderer: ({ elementId, row }: Props) => JSX.Element | null;
export {};
