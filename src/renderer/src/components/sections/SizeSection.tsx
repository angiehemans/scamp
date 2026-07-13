import { useEffect, useState } from 'react';
import { IconLink, IconLinkOff } from '@tabler/icons-react';
import { useCanvasStore, selectIsRatioLocked } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { EnumSelect } from '../controls/EnumSelect';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import type {
  GridSelfAlign,
  HeightMode,
  WidthMode,
} from '@lib/element';
import { formatSizeValue, parseSizeValue } from '@lib/parsers';
import { lockedSizePatch } from '@lib/aspectRatio';
import { Section, Row } from './Section';
import styles from './SizeSection.module.css';

type Props = {
  elementId: string;
};

const WIDTH_MODE_OPTIONS: ReadonlyArray<{ value: WidthMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'fit-content', label: 'Hug' },
  { value: 'auto', label: 'Auto' },
];

const HEIGHT_MODE_OPTIONS: ReadonlyArray<{ value: HeightMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'fit-content', label: 'Hug' },
  { value: 'auto', label: 'Auto' },
];

const GRID_SELF_OPTIONS: ReadonlyArray<{ value: GridSelfAlign; label: string }> = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
  { value: 'stretch', label: 'Stretch' },
];

/**
 * Measure the actual rendered size of an element on the canvas.
 * Returns undefined if the element isn't mounted or both axes are
 * `fixed` (no computed read-out needed).
 *
 * Uses a `ResizeObserver` rather than polling so the panel reflects
 * layout changes immediately — the user changes a font-size and the
 * computed height in the panel updates in the same frame. The
 * observer is also re-attached when the target element is replaced
 * (e.g. canvas re-renders mounting a fresh DOM node) via a short
 * mutation-tolerant lookup loop on each render.
 *
 * IMPORTANT: scopes the lookup to the canvas frame. The layers panel
 * also tags its rows with `data-element-id`, and a `document.query
 * Selector` would happily return the layers row (which appears
 * earlier in DOM order). The frame is identified by
 * `data-testid="canvas-frame"` (set by `Viewport.tsx`).
 */
const useMeasuredSize = (
  elementId: string,
  widthMode: WidthMode,
  heightMode: HeightMode
): { width: number | undefined; height: number | undefined } => {
  const [size, setSize] = useState<{
    width: number | undefined;
    height: number | undefined;
  }>({ width: undefined, height: undefined });

  useEffect(() => {
    // Both axes fixed → no computed read needed; clear and bail.
    if (widthMode === 'fixed' && heightMode === 'fixed') {
      setSize({ width: undefined, height: undefined });
      return;
    }

    const apply = (node: HTMLElement): void => {
      setSize({
        width: widthMode !== 'fixed' ? Math.round(node.offsetWidth) : undefined,
        height:
          heightMode !== 'fixed' ? Math.round(node.offsetHeight) : undefined,
      });
    };

    /** Find the rendered element inside the canvas frame — NOT inside
     *  the layers panel, which mirrors the same `data-element-id`. */
    const findCanvasNode = (): HTMLElement | null => {
      const frame = document.querySelector('[data-testid="canvas-frame"]');
      if (!(frame instanceof HTMLElement)) return null;
      const node = frame.querySelector(`[data-element-id="${elementId}"]`);
      return node instanceof HTMLElement ? node : null;
    };

    let observer: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const attach = (): boolean => {
      const node = findCanvasNode();
      if (!node) return false;
      apply(node);
      observer = new ResizeObserver(() => apply(node));
      observer.observe(node);
      return true;
    };

    if (!attach()) {
      // Frame or element not yet in the DOM — watch the body for
      // additions and attach as soon as it appears. Disconnect once
      // observed.
      mutationObserver = new MutationObserver(() => {
        if (attach()) {
          mutationObserver?.disconnect();
          mutationObserver = null;
        }
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      observer?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [elementId, widthMode, heightMode]);

  return size;
};

export const SizeSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const toggleRatioLock = useCanvasStore((s) => s.toggleRatioLock);
  const clearRatioLock = useCanvasStore((s) => s.clearRatioLock);
  const ratioLocked = useCanvasStore((s) => selectIsRatioLocked(s, elementId));
  const lockedRatio = useCanvasStore((s) => s.ratioLocks[elementId]);
  // Whether THIS element's parent is a grid container — drives the
  // grid-item controls below.
  const parentIsGrid = useCanvasStore((s) => {
    if (!elementId) return false;
    const el = s.elements[elementId];
    if (!el?.parentId) return false;
    return s.elements[el.parentId]?.display === 'grid';
  });
  if (!element) return null;

  const measured = useMeasuredSize(elementId, element.widthMode, element.heightMode);
  const isWidthFixed = element.widthMode === 'fixed';
  const isHeightFixed = element.heightMode === 'fixed';
  // "Hug" (fit-content) and "Auto" size an element to its content. A plain
  // rectangle that isn't a flex/grid container has no content mechanism —
  // its absolutely-positioned children don't contribute to an auto size —
  // so those modes collapse it to ~0. Disable them there. Text / input /
  // image / component-instance size to intrinsic or rendered content, and
  // flex/grid rectangles hug their children, so all keep every mode.
  const contentSizingDisabled =
    element.type === 'rectangle' &&
    element.display !== 'flex' &&
    element.display !== 'grid';
  const gateContentModes = <M extends WidthMode | HeightMode>(
    options: ReadonlyArray<{ value: M; label: string }>
  ): ReadonlyArray<{ value: M; label: string; disabled?: boolean }> =>
    contentSizingDisabled
      ? options.map((o) =>
          o.value === 'fit-content' || o.value === 'auto'
            ? { ...o, disabled: true }
            : o
        )
      : options;
  const modeSelectTitle = (axis: 'Width' | 'Height'): string =>
    contentSizingDisabled
      ? `${axis} mode — Hug and Auto need a Flex or Grid layout`
      : `${axis} mode`;
  // Ratio to feed the commit helpers — only when the lock is actually in
  // effect (both axes fixed). `lockedRatio` may be undefined when unlocked.
  const activeRatio = ratioLocked ? lockedRatio ?? null : null;

  // A committed W/H edit that lands a non-fixed mode drops the lock (a
  // stretch/auto axis can't be ratio-locked). When locked+fixed, the
  // paired dimension is recomputed inside `lockedSizePatch`.
  const handleCommitWidth = (raw: string): void => {
    if (parseSizeValue(raw).mode !== 'fixed') clearRatioLock(elementId);
    patchElement(elementId, lockedSizePatch(element, 'width', raw, activeRatio));
  };
  const handleCommitHeight = (raw: string): void => {
    if (parseSizeValue(raw).mode !== 'fixed') clearRatioLock(elementId);
    patchElement(elementId, lockedSizePatch(element, 'height', raw, activeRatio));
  };
  const handleToggleLock = (): void => {
    // Pass the measured render size so a non-fixed axis can be snapped to
    // fixed on lock (undefined axes fall back to the stored value).
    toggleRatioLock(elementId, {
      width: measured.width,
      height: measured.height,
    });
  };

  // Ratio-lock toggle, hoisted onto the section's title row (right-aligned).
  const lockButton = (
    <button
      type="button"
      className={`${styles.lockButton} ${
        ratioLocked ? styles.lockButtonActive : ''
      }`}
      onClick={handleToggleLock}
      aria-pressed={ratioLocked}
      title={
        ratioLocked
          ? 'Unlock aspect ratio'
          : 'Lock aspect ratio — width and height scale together'
      }
    >
      {ratioLocked ? <IconLink size={13} /> : <IconLinkOff size={13} />}
      {ratioLocked ? 'Ratio locked' : 'Lock ratio'}
    </button>
  );

  return (
    <Section
      title="Size"
      titleAccessory={lockButton}
      elementId={elementId}
      fields={[
        'widthMode',
        'widthValue',
        'widthCustom',
        'heightMode',
        'heightValue',
        'heightCustom',
        'gridColumn',
        'gridRow',
        'alignSelf',
        'justifySelf',
      ]}
      cssProperties={[
        'width',
        'height',
        'min-height',
        'grid-column',
        'grid-row',
        'align-self',
        'justify-self',
      ]}
    >
      <Row label="">
        <PrefixSuffixInput
          prefix="W"
          title={
            isWidthFixed
              ? 'Width — type any CSS length (100, 100px, 100vh, 100%, calc(...), auto, fit-content)'
              : 'Computed width (border-box, including padding). Type any CSS length to override.'
          }
          value={
            isWidthFixed
              ? formatSizeValue(
                  element.widthMode,
                  element.widthValue,
                  element.widthCustom
                )
              : measured.width !== undefined
                ? `${measured.width}px`
                : ''
          }
          placeholder={isWidthFixed ? undefined : element.widthMode}
          onCommit={handleCommitWidth}
          computed={!isWidthFixed}
        />
        <EnumSelect<WidthMode>
          value={element.widthMode}
          options={gateContentModes(WIDTH_MODE_OPTIONS)}
          onChange={(mode) => {
            if (mode !== 'fixed') clearRatioLock(elementId);
            patchElement(
              elementId,
              mode === 'fixed'
                ? { widthMode: 'fixed', widthCustom: undefined }
                : { widthMode: mode, widthCustom: undefined }
            );
          }}
          title={modeSelectTitle('Width')}
        />
      </Row>
      <Row label="">
        <PrefixSuffixInput
          prefix="H"
          title={
            isHeightFixed
              ? 'Height — type any CSS length (100, 100px, 100vh, 100%, calc(...), auto, fit-content)'
              : 'Computed height (border-box, including padding). Type any CSS length to override.'
          }
          value={
            isHeightFixed
              ? formatSizeValue(
                  element.heightMode,
                  element.heightValue,
                  element.heightCustom
                )
              : measured.height !== undefined
                ? `${measured.height}px`
                : ''
          }
          placeholder={isHeightFixed ? undefined : element.heightMode}
          onCommit={handleCommitHeight}
          computed={!isHeightFixed}
        />
        <EnumSelect<HeightMode>
          value={element.heightMode}
          options={gateContentModes(HEIGHT_MODE_OPTIONS)}
          onChange={(mode) => {
            if (mode !== 'fixed') clearRatioLock(elementId);
            patchElement(
              elementId,
              mode === 'fixed'
                ? { heightMode: 'fixed', heightCustom: undefined }
                : { heightMode: mode, heightCustom: undefined }
            );
          }}
          title={modeSelectTitle('Height')}
        />
      </Row>
      {parentIsGrid && (
        <>
          <Row label="">
            <PrefixSuffixInput
              prefix="Col"
              title="grid-column"
              value={element.gridColumn}
              placeholder="span 2"
              onCommit={(value) =>
                patchElement(elementId, { gridColumn: value.trim() })
              }
            />
          </Row>
          <Row label="">
            <PrefixSuffixInput
              prefix="Row"
              title="grid-row"
              value={element.gridRow}
              placeholder="1 / 3"
              onCommit={(value) =>
                patchElement(elementId, { gridRow: value.trim() })
              }
            />
          </Row>
          <Row label="">
            <EnumSelect<GridSelfAlign>
              value={element.alignSelf}
              options={GRID_SELF_OPTIONS}
              onChange={(value) => patchElement(elementId, { alignSelf: value })}
              title="Align self"
            />
            <EnumSelect<GridSelfAlign>
              value={element.justifySelf}
              options={GRID_SELF_OPTIONS}
              onChange={(value) => patchElement(elementId, { justifySelf: value })}
              title="Justify self"
            />
          </Row>
        </>
      )}
    </Section>
  );
};

