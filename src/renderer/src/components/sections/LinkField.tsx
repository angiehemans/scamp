import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { DEFAULT_TAG } from '@lib/elementTags';
import {
  classifyHref,
  isValidExternalUrl,
  pageNameToHref,
  type HrefKind,
} from '@lib/linkHref';
import { EnumSelect } from '../controls/EnumSelect';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import { Row } from './Section';
import styles from './LinkField.module.css';

type Props = {
  elementId: string;
};

/**
 * Self-contained content where tag-swap would lose what makes the
 * element meaningful (an `<img>` swapped to `<a>` is no longer an
 * image). Picking a destination on these tags wraps the element in a
 * new `<a>` parent silently — the user doesn't need to choose how.
 */
const WRAP_ON_PICK_TAGS: ReadonlySet<string> = new Set([
  'img',
  'video',
  'iframe',
  'svg',
  'input',
  'textarea',
  'select',
]);

/**
 * Semantic block tags where making the entire region a link is
 * uncommon enough that the Link field would be more noise than help.
 * Hides the field entirely; users who genuinely want to link a
 * `<section>` can change the tag to `<div>` first or hand-edit the
 * TSX. Matches the "uncommon to make these full sections links"
 * judgement from the linking-pages plan.
 */
const NO_LINK_TAGS: ReadonlySet<string> = new Set([
  'article',
  'section',
  'header',
  'nav',
  'aside',
  'main',
  'footer',
  'figure',
]);

type DestinationKind = 'none' | 'page' | 'external';

/**
 * The link controls that live inside the Element section. Picks the
 * destination dropdown's mode (None / Page / External URL) and either
 * writes the href directly (for `<a>` elements), converts the current
 * tag to `<a>` (for div/span/p/button/etc.), or wraps the element in
 * a new `<a>` parent (for img/video/iframe/svg/input/textarea/select).
 *
 * No prompt asks the user "Convert or Wrap?" — the right action is
 * determined by the current tag. A short tooltip on the dropdown
 * explains what will happen when a destination is picked.
 */
export const LinkField = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const parent = useCanvasStore((s) =>
    element?.parentId ? s.elements[element.parentId] : undefined
  );
  const pageNames = useCanvasStore((s) => s.pageNames);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const wrapInLinkParent = useCanvasStore((s) => s.wrapInLinkParent);
  const selectElement = useCanvasStore((s) => s.selectElement);

  const currentTag =
    element?.tag ?? (element ? DEFAULT_TAG[element.type] : '');

  // Pending external state: the user picked "External URL" from the
  // destination dropdown but hasn't committed a valid URL yet, so
  // there's no href to read back from the file. Reset whenever the
  // selected element changes (so switching elements doesn't carry
  // pending state across).
  const [pendingExternal, setPendingExternal] = useState(false);
  useEffect(() => {
    setPendingExternal(false);
  }, [elementId]);

  if (!element) return null;
  // Root never gets a link — there's nothing meaningful to link the
  // page itself to.
  if (elementId === ROOT_ELEMENT_ID) return null;
  // Some semantic block tags are uncommon to link as a whole — hide
  // the field entirely. The user can change the tag to `<div>` first
  // if they really want a section-wide link.
  if (NO_LINK_TAGS.has(currentTag)) return null;

  // If this element is the wrapped child of a Scamp `<a>` parent,
  // surface a hint pointing at the wrapper rather than letting the
  // user edit a link that lives elsewhere.
  const parentTag = parent?.tag ?? (parent ? DEFAULT_TAG[parent.type] : '');
  const wrappedByLinkParent =
    parent !== undefined &&
    parentTag === 'a' &&
    typeof parent.attributes?.href === 'string' &&
    parent.attributes.href.length > 0;

  if (wrappedByLinkParent && parent) {
    return <WrappedHint parent={parent} onSelectParent={selectElement} />;
  }

  const isAnchor = currentTag === 'a';
  const shouldWrap = WRAP_ON_PICK_TAGS.has(currentTag);
  const href = element.attributes?.href ?? '';
  const target = element.attributes?.target;
  const classification = classifyHref(href, pageNames);
  const currentKind: DestinationKind = !isAnchor
    ? 'none'
    : classification.kind === 'external'
      ? 'external'
      : classification.kind === 'page' || classification.kind === 'broken'
        ? 'page'
        : 'none';
  const effectiveKind: DestinationKind = pendingExternal
    ? 'external'
    : currentKind;

  /** Apply a chosen destination to disk, picking the right action
   *  for the current tag (write / convert / wrap). */
  const commitLink = (
    dest: { kind: 'page'; pageName: string } | { kind: 'external'; url: string },
    openInNewTab: boolean
  ): void => {
    const newHref =
      dest.kind === 'page' ? pageNameToHref(dest.pageName) : dest.url;
    if (isAnchor) {
      const attrs: Record<string, string> = {
        ...(element.attributes ?? {}),
        href: newHref,
      };
      if (openInNewTab) {
        attrs.target = '_blank';
        attrs.rel = 'noopener noreferrer';
      } else {
        delete attrs.target;
        delete attrs.rel;
      }
      patchElement(elementId, {
        attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
      });
    } else if (shouldWrap) {
      wrapInLinkParent(
        elementId,
        newHref,
        openInNewTab
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : undefined
      );
    } else {
      // Convert the tag to `<a>` and set the href in one patch.
      const attrs: Record<string, string> = {
        ...(element.attributes ?? {}),
        href: newHref,
      };
      if (openInNewTab) {
        attrs.target = '_blank';
        attrs.rel = 'noopener noreferrer';
      } else {
        delete attrs.target;
        delete attrs.rel;
      }
      patchElement(elementId, {
        tag: 'a',
        attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
      });
    }
  };

  const clearLink = (): void => {
    if (!isAnchor) {
      // No href yet — nothing on disk to clear.
      return;
    }
    const attrs: Record<string, string> = { ...(element.attributes ?? {}) };
    delete attrs.href;
    delete attrs.target;
    delete attrs.rel;
    patchElement(elementId, {
      attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
    });
  };

  const setOpenInNewTab = (next: boolean): void => {
    if (!isAnchor) return;
    const attrs: Record<string, string> = { ...(element.attributes ?? {}) };
    if (next) {
      attrs.target = '_blank';
      attrs.rel = 'noopener noreferrer';
    } else {
      delete attrs.target;
      delete attrs.rel;
    }
    patchElement(elementId, {
      attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
    });
  };

  const handleKindChange = (next: DestinationKind): void => {
    if (next === 'none') {
      clearLink();
      setPendingExternal(false);
      return;
    }
    if (next === 'page') {
      const first = pageNames[0];
      if (!first) {
        // No pages to link to — leave the dropdown selection as-is so
        // the empty hint surfaces in the follow-up row.
        setPendingExternal(false);
        return;
      }
      commitLink({ kind: 'page', pageName: first }, target === '_blank');
      setPendingExternal(false);
      return;
    }
    // 'external' — enter pending state. Don't commit until the user
    // types a valid URL.
    setPendingExternal(true);
  };

  const tooltip = isAnchor
    ? 'Where this link points'
    : shouldWrap
      ? 'Pick a destination to wrap this element in a link'
      : 'Pick a destination to convert this element to a link';

  return (
    <>
      <Row label="Link to" tooltip={tooltip}>
        <DestinationDropdown<DestinationKind>
          value={effectiveKind}
          options={[
            { value: 'none', label: 'None' },
            { value: 'page', label: 'Page' },
            { value: 'external', label: 'External URL' },
          ]}
          onChange={handleKindChange}
        />
      </Row>
      {effectiveKind === 'page' && (
        <PageDropdown
          classification={classification}
          pageNames={pageNames}
          onChange={(pageName) =>
            commitLink({ kind: 'page', pageName }, target === '_blank')
          }
        />
      )}
      {effectiveKind === 'external' && (
        <ExternalUrlInput
          value={
            classification.kind === 'external'
              ? classification.url
              : (element.attributes?.href ?? '')
          }
          onCommit={(value) => {
            if (value === '') {
              // User cleared the URL — drop the link entirely (only
              // possible when the element is already `<a>`; otherwise
              // there's nothing on disk to clear).
              clearLink();
              setPendingExternal(false);
              return;
            }
            commitLink({ kind: 'external', url: value }, target === '_blank');
            setPendingExternal(false);
          }}
        />
      )}
      {isAnchor && currentKind !== 'none' && (
        <Row
          label="Open in new tab"
          tooltip="Adds target=&quot;_blank&quot; and rel=&quot;noopener noreferrer&quot;."
        >
          <label className={styles.boolRow}>
            <input
              type="checkbox"
              checked={target === '_blank'}
              onChange={(e) => setOpenInNewTab(e.target.checked)}
            />
            <span>{target === '_blank' ? 'Yes' : 'No'}</span>
          </label>
        </Row>
      )}
      {classification.kind === 'broken' && (
        <p className={styles.brokenWarning}>
          Page <code>/{classification.pageName}</code> doesn't exist in
          this project.
        </p>
      )}
    </>
  );
};

/**
 * Small chain-link SVG used as the leading icon on the destination
 * dropdown so the field reads as "this is the link control" without
 * a separate section heading. Inherits the surrounding text colour.
 */
const ChainIcon = (): JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M6.5 4.5h-1a3 3 0 0 0 0 6h1m3 0h1a3 3 0 0 0 0-6h-1m-3 3h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const DestinationDropdown = <V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: ReadonlyArray<{ value: V; label: string }>;
  onChange: (value: V) => void;
}): JSX.Element => (
  <div className={styles.iconSelect}>
    <span className={styles.icon} aria-hidden="true">
      <ChainIcon />
    </span>
    <EnumSelect value={value} options={options} onChange={onChange} />
  </div>
);

type PageDropdownProps = {
  classification: HrefKind;
  pageNames: ReadonlyArray<string>;
  onChange: (pageName: string) => void;
};

const PageDropdown = ({
  classification,
  pageNames,
  onChange,
}: PageDropdownProps): JSX.Element => {
  const currentPageName =
    classification.kind === 'page' || classification.kind === 'broken'
      ? classification.pageName
      : (pageNames[0] ?? 'home');
  // If the current pageName isn't in the project (broken link),
  // surface it as an extra option labelled "(missing)" so the user
  // can see and replace it.
  const isMissing =
    classification.kind === 'broken' && !pageNames.includes(currentPageName);
  const options = isMissing
    ? [
        ...pageNames.map((n) => ({ value: n, label: n })),
        { value: currentPageName, label: `${currentPageName} (missing)` },
      ]
    : pageNames.map((n) => ({ value: n, label: n }));
  if (options.length === 0) {
    return (
      <Row label="Page">
        <span className={styles.emptyHint}>No pages in this project</span>
      </Row>
    );
  }
  return (
    <Row label="Page">
      <EnumSelect
        value={currentPageName}
        options={options}
        onChange={onChange}
      />
    </Row>
  );
};

type ExternalUrlInputProps = {
  value: string;
  onCommit: (value: string) => void;
};

const ExternalUrlInput = ({
  value,
  onCommit,
}: ExternalUrlInputProps): JSX.Element => {
  const [error, setError] = useState<string | null>(null);
  return (
    <Row label="URL">
      <div className={styles.urlField}>
        <PrefixSuffixInput
          value={value}
          placeholder="https://example.com"
          onCommit={(next) => {
            const trimmed = next.trim();
            if (trimmed.length === 0) {
              setError(null);
              onCommit('');
              return;
            }
            if (!isValidExternalUrl(trimmed)) {
              setError('Use http(s)://, mailto:, or tel:');
              return;
            }
            setError(null);
            onCommit(trimmed);
          }}
          stopKeyPropagation
        />
        {error !== null && <span className={styles.urlError}>{error}</span>}
      </div>
    </Row>
  );
};

type WrappedHintProps = {
  parent: ScampElement;
  onSelectParent: (id: string) => void;
};

const WrappedHint = ({
  parent,
  onSelectParent,
}: WrappedHintProps): JSX.Element => {
  const href = parent.attributes?.href ?? '';
  return (
    <Row label="Link to">
      <button
        type="button"
        className={styles.wrappedHint}
        onClick={() => onSelectParent(parent.id)}
        title="Wrapped in a link — click to select the wrapper"
      >
        <span className={styles.iconInline} aria-hidden="true">
          <ChainIcon />
        </span>
        <span className={styles.wrappedHintText}>
          Wrapped in <code>{href}</code>
        </span>
      </button>
    </Row>
  );
};
