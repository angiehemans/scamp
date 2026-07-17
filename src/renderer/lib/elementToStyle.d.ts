import { type ScampElement } from "./element";
import { type ThemeToken } from "@shared/types";
import { type CSSProperties } from "react";
/**
 * A handful of tags we deliberately render with a different element on
 * the canvas than in the generated TSX. The canvas is a design surface,
 * not a runtime — a real `<dialog open>` would go modal, a real
 * `<svg>` would try to interpret its source. Both scenarios interfere
 * with placing, selecting, and sizing the box.
 *
 * The generator still emits the true tag to disk; this override only
 * affects the DOM node React renders inside the canvas iframe.
 */
export declare const canvasRenderTag: (tag: string) => string;
/**
 * Attribute names we never forward from the element's `attributes`
 * bag to the canvas DOM. Each has a reason:
 *   - tag-specific side effects we don't want on a design surface
 *     (`open` on dialog, `href` on anchor → navigation, etc.)
 *   - React/JSX-only names the DOM wouldn't understand
 */
export declare const CANVAS_SKIP_ATTRS_BY_TAG: Record<string, ReadonlySet<string>>;
export declare const elementToStyle: (el: ScampElement, parentDisplay: "flex" | "grid" | "none" | undefined, parentDirection: "row" | "column" | undefined, tokens: ReadonlyArray<ThemeToken>, projectDir: string | null, projectFormat: "legacy" | "nextjs", isInstanceInner: boolean | undefined, rootMinHeight: number, inComponentEditor?: boolean) => CSSProperties;
/**
 * Render an element subtree that lives in a separate elements map
 * (not the canvas store's page-elements). Used by the
 * component-instance branch of `ElementRenderer` to render the
 * subtree from `componentTrees[name].elements` — that map is a
 * completely separate set of ids from the page's elements, so the
 * normal `<ElementRenderer elementId={id} />` recursion (which
 * reads from `state.elements`) wouldn't find them.
 *
 * No selection / edit / animation-preview affordances apply here —
 * the inner DOM is read-only from the page's perspective. The
 * outer `ElementRenderer` wrapper around the instance handles the
 * selection outline + double-click-to-edit; everything inside
 * has `pointer-events: none` so all clicks reach the wrapper.
 *
 * Component instances nested inside a component definition (slot
 * composition) are explicitly out of scope per the components
 * plan; we render them as a labelled placeholder.
 */
