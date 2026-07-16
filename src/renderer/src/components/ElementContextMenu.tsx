import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
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

/**
 * Custom event the menu dispatches when the user picks "Create
 * component" on a non-root, non-instance element. `ProjectShell`
 * listens for it, opens the name-input dialog, and on confirm
 * runs the convert-to-component flow.
 */
export const CONVERT_TO_COMPONENT_EVENT = 'scamp:convert-to-component';

export type ConvertToComponentEventDetail = {
  elementId: string;
};

/**
 * Custom event for the Phase 8 "Detach from component" action.
 * Fired by the right-click menu when the target element is a
 * component-instance. `ProjectShell` listens, surfaces a one-way
 * ConfirmDialog (with an override-impact note if any overrides
 * are set), and on confirm runs `detachInstance`.
 */
export const DETACH_INSTANCE_EVENT = 'scamp:detach-instance';

export type DetachInstanceEventDetail = {
  instanceId: string;
};

/**
 * Custom event for removing a slot from a component (Phase 4, component
 * slots). Both the right-click menu and the DataPanel Slots list dispatch
 * it rather than calling `toggleSlotOnRect` directly, so `ProjectShell` can
 * first check whether instances on other pages have content in this slot
 * and — if so — surface a confirm dialog before the slot is removed.
 * see docs/plans/component-slots-plan.md
 */
export const REQUEST_REMOVE_SLOT_EVENT = 'scamp:request-remove-slot';

export type RequestRemoveSlotEventDetail = {
  /** Canvas id of the slot rectangle (passed to `toggleSlotOnRect`). */
  elementId: string;
  /** Component currently being edited (to scan its instances). */
  componentName: string;
  /** The slot's name (`children` for the default slot). */
  slotName: string;
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
  // Subscribe to the menu target's type so we can hide
  // "Create component" for cases where the conversion doesn't
  // apply: the page root (no parent to splice an instance into)
  // and existing component instances (they're already
  // components — converting again would orphan their identity).
  const targetType = useCanvasStore((s) =>
    menu ? s.elements[menu.elementId]?.type : undefined
  );
  // Slot actions are component-editor-only, on a childless rectangle.
  const activeComponentName = useCanvasStore(
    (s) => s.activeComponent?.name ?? null
  );
  const inComponent = activeComponentName !== null;
  const targetSlot = useCanvasStore((s) =>
    menu ? s.elements[menu.elementId]?.slot : undefined
  );
  const targetHasChildren = useCanvasStore((s) =>
    menu ? (s.elements[menu.elementId]?.childIds.length ?? 0) > 0 : false
  );
  const toggleSlotOnRect = useCanvasStore((s) => s.toggleSlotOnRect);

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

  const canConvert =
    menu.elementId !== ROOT_ELEMENT_ID &&
    targetType !== 'component-instance';
  const isInstance = targetType === 'component-instance';

  const isRect =
    targetType === 'rectangle' && menu.elementId !== ROOT_ELEMENT_ID;
  const isSlot = typeof targetSlot === 'string' && targetSlot.length > 0;
  // "Make slot" needs a childless rectangle inside a component (a slot's
  // JSX becomes `{slotName}`, so it can't have its own children — this also
  // prevents nested slots). "Remove slot" shows on an existing slot.
  const canMakeSlot = inComponent && isRect && !isSlot && !targetHasChildren;
  const canRemoveSlot = inComponent && isRect && isSlot;

  const items = [
    ...(canMakeSlot
      ? [
          {
            label: 'Make slot',
            onSelect: () => toggleSlotOnRect(menu.elementId),
          },
        ]
      : []),
    ...(canRemoveSlot
      ? [
          {
            label: 'Remove slot',
            onSelect: () => {
              // Route through ProjectShell so it can warn when instances on
              // other pages have content in this slot. With no active
              // component name (shouldn't happen when canRemoveSlot) fall
              // back to a direct removal.
              if (
                activeComponentName === null ||
                typeof targetSlot !== 'string'
              ) {
                toggleSlotOnRect(menu.elementId);
                return;
              }
              window.dispatchEvent(
                new CustomEvent<RequestRemoveSlotEventDetail>(
                  REQUEST_REMOVE_SLOT_EVENT,
                  {
                    detail: {
                      elementId: menu.elementId,
                      componentName: activeComponentName,
                      slotName: targetSlot,
                    },
                  }
                )
              );
            },
          },
        ]
      : []),
    ...(canConvert
      ? [
          {
            label: 'Create component…',
            onSelect: () => {
              window.dispatchEvent(
                new CustomEvent<ConvertToComponentEventDetail>(
                  CONVERT_TO_COMPONENT_EVENT,
                  { detail: { elementId: menu.elementId } }
                )
              );
            },
          },
        ]
      : []),
    ...(isInstance
      ? [
          {
            label: 'Detach from component…',
            onSelect: () => {
              window.dispatchEvent(
                new CustomEvent<DetachInstanceEventDetail>(
                  DETACH_INSTANCE_EVENT,
                  { detail: { instanceId: menu.elementId } }
                )
              );
            },
          },
        ]
      : []),
    {
      label: 'Export…',
      onSelect: () => {
        const section = document.getElementById(EXPORT_SECTION_DOM_ID);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
    },
  ];

  return (
    <PageContextMenu
      x={menu.x}
      y={menu.y}
      onClose={() => setMenu(null)}
      items={items}
    />
  );
};
