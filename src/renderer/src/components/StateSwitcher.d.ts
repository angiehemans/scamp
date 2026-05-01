/**
 * Sits at the top of the properties panel and lets the user switch
 * between editing the element's default ("rest") styles and any of
 * the three recognised pseudo-class states. Edits made while a state
 * is active land in `element.stateOverrides[state]`; switching back
 * to Default returns the panel to top-level fields.
 *
 * State × non-desktop breakpoint isn't supported in this version, so
 * the non-default buttons are disabled (with a tooltip) when the
 * active breakpoint is anything but desktop.
 *
 * The dot indicator on a non-default button signals that the
 * currently-selected element has at least one override registered for
 * that state — so the user can tell at a glance which states already
 * have styles defined without clicking through them.
 */
export declare const StateSwitcher: () => JSX.Element;
