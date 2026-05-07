import { useEffect, useState } from 'react';
import { PageContextMenu } from './PageContextMenu';
import { EXPORT_SECTION_DOM_ID } from './sections/ExportSection';

type MenuState = {
  x: number;
  y: number;
  /** Element id the menu is attached to. Stored for future menu items
   *  (Copy, Duplicate, …) — Export uses the current selection rather
   *  than this id so the section's scope and the menu's intent stay
   *  in lockstep. */
  elementId: string;
};

type EventDetail = {
  x: number;
  y: number;
  elementId: string;
};

const EVENT_NAME = 'scamp:open-element-context-menu';

/**
 * Single-instance context menu for canvas elements. Listens for the
 * `scamp:open-element-context-menu` custom event dispatched by
 * `ElementRenderer.onContextMenu`, opens at the supplied coordinates,
 * dismisses on outside click / Escape (handled by the underlying
 * `PageContextMenu` primitive).
 *
 * Currently exposes a single "Export…" item that scrolls the
 * Export section into view. Future menu entries (Copy, Duplicate,
 * Delete, Bring to Front …) plug in here.
 */
export const ElementContextMenu = (): JSX.Element | null => {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<EventDetail>).detail;
      if (!detail) return;
      setMenu({ x: detail.x, y: detail.y, elementId: detail.elementId });
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  if (!menu) return null;

  return (
    <PageContextMenu
      x={menu.x}
      y={menu.y}
      onClose={() => setMenu(null)}
      items={[
        {
          label: 'Export…',
          onSelect: () => {
            const section = document.getElementById(EXPORT_SECTION_DOM_ID);
            if (section) {
              section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          },
        },
      ]}
    />
  );
};
