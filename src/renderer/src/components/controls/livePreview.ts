/**
 * Build a callback the color picker calls on every drag tick to
 * preview the value on the live canvas DOM. Direct style mutation,
 * bypasses React and Zustand entirely — the canvas updates at the
 * cursor's frame rate without paying the cost of the full sync
 * pipeline on every tick.
 *
 * On pointer release, the picker fires its `onChange` callback
 * which goes through `patchElement` and produces a normal React
 * re-render. That render overwrites the inline style we wrote
 * here with the Zustand-backed value. Same color, no flicker.
 *
 * Returns a no-op when the element isn't currently rendered
 * (selection changed, page switched mid-drag, etc.) — the next
 * commit handles the source-of-truth update anyway.
 */
export const previewStyle = (
  elementId: string,
  styleProperty: keyof CSSStyleDeclaration
): ((value: string) => void) => {
  return (value: string) => {
    const node = document.querySelector<HTMLElement>(
      `[data-scamp-id="${elementId}"]`
    );
    if (!node) return;
    // CSSStyleDeclaration's typed setter expects a string. We
    // cast via `unknown` to a record-like type because the typed
    // surface doesn't permit indexed string assignment, but the
    // runtime semantics are exactly that.
    (node.style as unknown as Record<string, string>)[
      styleProperty as string
    ] = value;
  };
};
