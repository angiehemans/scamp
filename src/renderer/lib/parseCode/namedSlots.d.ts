/** The attribute the hoist injects onto slot-content elements. Read back
 *  into `slotName` after the structural parse, then dropped from the bag. */
export declare const SLOT_MARKER_ATTR = "data-scamp-slot";
/**
 * Rewrite every component-instance's named-slot props into
 * marker-carrying JSX children. Instances are located by
 * `data-scamp-instance-id`; a named-slot prop is any `name={<…>}` attribute
 * on the opening tag. String props (`label="x"`) and non-element braced
 * props (`className={styles.x}`) are left untouched.
 */
export declare const hoistNamedSlots: (tsx: string) => string;
