import type { ElementType } from './element';

/**
 * One option in the tag dropdown. The `value` is the literal HTML tag
 * name; `label` is what the user sees.
 */
export type TagOption = {
  value: string;
  label: string;
};

/**
 * A tag-specific attribute field the Element section renders.
 *
 * - `text`    — free-form string input
 * - `select`  — dropdown with a fixed option set
 * - `boolean` — checkbox; stored as `""` when checked, absent when not
 */
export type AttributeSpec =
  | { name: string; label: string; kind: 'text'; placeholder?: string }
  | {
      name: string;
      label: string;
      kind: 'select';
      options: ReadonlyArray<TagOption>;
    }
  | { name: string; label: string; kind: 'boolean' };

/**
 * Tag options offered in the Element section's tag dropdown, keyed by
 * the element's `type` discriminator.
 *
 * Class-prefix defaults (rect_/text_/img_/input_) stay tied to the
 * element's `type`, not its tag, so a `nav` rectangle still gets a
 * `rect_` prefix.
 */
export const TAG_OPTIONS: Record<ElementType, ReadonlyArray<TagOption>> = {
  rectangle: [
    { value: 'div', label: 'div' },
    { value: 'section', label: 'section' },
    { value: 'article', label: 'article' },
    { value: 'aside', label: 'aside' },
    { value: 'main', label: 'main' },
    { value: 'header', label: 'header' },
    { value: 'footer', label: 'footer' },
    { value: 'nav', label: 'nav' },
    { value: 'figure', label: 'figure' },
    { value: 'form', label: 'form' },
    { value: 'fieldset', label: 'fieldset' },
    { value: 'ul', label: 'ul' },
    { value: 'ol', label: 'ol' },
    { value: 'li', label: 'li' },
    { value: 'details', label: 'details' },
    { value: 'summary', label: 'summary' },
    { value: 'dialog', label: 'dialog' },
    { value: 'button', label: 'button' },
    { value: 'a', label: 'a' },
  ],
  text: [
    { value: 'p', label: 'p' },
    { value: 'h1', label: 'h1' },
    { value: 'h2', label: 'h2' },
    { value: 'h3', label: 'h3' },
    { value: 'h4', label: 'h4' },
    { value: 'h5', label: 'h5' },
    { value: 'h6', label: 'h6' },
    { value: 'span', label: 'span' },
    { value: 'label', label: 'label' },
    { value: 'blockquote', label: 'blockquote' },
    { value: 'pre', label: 'pre' },
    { value: 'code', label: 'code' },
    { value: 'strong', label: 'strong' },
    { value: 'em', label: 'em' },
    { value: 'small', label: 'small' },
    { value: 'time', label: 'time' },
    { value: 'figcaption', label: 'figcaption' },
    { value: 'legend', label: 'legend' },
    { value: 'li', label: 'li' },
  ],
  image: [
    { value: 'img', label: 'img' },
    { value: 'video', label: 'video' },
    { value: 'iframe', label: 'iframe' },
    { value: 'svg', label: 'svg' },
  ],
  input: [
    { value: 'input', label: 'input' },
    { value: 'textarea', label: 'textarea' },
    { value: 'select', label: 'select' },
  ],
};

/** Default tag for a given element type, used when `tag` is undefined. */
export const DEFAULT_TAG: Record<ElementType, string> = {
  rectangle: 'div',
  text: 'p',
  image: 'img',
  input: 'input',
};

const TARGET_OPTIONS: ReadonlyArray<TagOption> = [
  { value: '_self', label: '_self' },
  { value: '_blank', label: '_blank' },
  { value: '_parent', label: '_parent' },
  { value: '_top', label: '_top' },
];

const METHOD_OPTIONS: ReadonlyArray<TagOption> = [
  { value: 'get', label: 'GET' },
  { value: 'post', label: 'POST' },
];

const BUTTON_TYPE_OPTIONS: ReadonlyArray<TagOption> = [
  { value: 'button', label: 'button' },
  { value: 'submit', label: 'submit' },
  { value: 'reset', label: 'reset' },
];

const INPUT_TYPE_OPTIONS: ReadonlyArray<TagOption> = [
  { value: 'text', label: 'text' },
  { value: 'email', label: 'email' },
  { value: 'password', label: 'password' },
  { value: 'number', label: 'number' },
  { value: 'checkbox', label: 'checkbox' },
  { value: 'radio', label: 'radio' },
  { value: 'range', label: 'range' },
  { value: 'date', label: 'date' },
  { value: 'file', label: 'file' },
];

/**
 * Per-tag attribute specs shown in the Element section below the tag
 * dropdown. A tag with no entry here shows just the dropdown.
 *
 * `<select>` (option list) and `<svg>` (raw source) aren't in this map
 * because they have dedicated editors rendered separately.
 */
export const TAG_ATTRIBUTES: Record<string, ReadonlyArray<AttributeSpec>> = {
  a: [
    { name: 'href', label: 'Href', kind: 'text', placeholder: '/path' },
    { name: 'target', label: 'Target', kind: 'select', options: TARGET_OPTIONS },
  ],
  button: [
    { name: 'type', label: 'Type', kind: 'select', options: BUTTON_TYPE_OPTIONS },
  ],
  form: [
    { name: 'method', label: 'Method', kind: 'select', options: METHOD_OPTIONS },
    { name: 'action', label: 'Action', kind: 'text', placeholder: '/submit' },
  ],
  dialog: [{ name: 'open', label: 'Open', kind: 'boolean' }],
  label: [{ name: 'htmlFor', label: 'For', kind: 'text', placeholder: 'input-id' }],
  blockquote: [{ name: 'cite', label: 'Cite', kind: 'text' }],
  time: [
    {
      name: 'datetime',
      label: 'Datetime',
      kind: 'text',
      placeholder: '2026-01-01T12:00',
    },
  ],
  video: [
    { name: 'src', label: 'Src', kind: 'text' },
    { name: 'controls', label: 'Controls', kind: 'boolean' },
    { name: 'autoplay', label: 'Autoplay', kind: 'boolean' },
    { name: 'loop', label: 'Loop', kind: 'boolean' },
    { name: 'muted', label: 'Muted', kind: 'boolean' },
  ],
  iframe: [
    { name: 'src', label: 'Src', kind: 'text' },
    { name: 'title', label: 'Title', kind: 'text' },
  ],
  input: [
    { name: 'type', label: 'Type', kind: 'select', options: INPUT_TYPE_OPTIONS },
    { name: 'placeholder', label: 'Placeholder', kind: 'text' },
  ],
  textarea: [
    { name: 'rows', label: 'Rows', kind: 'text', placeholder: '3' },
    { name: 'placeholder', label: 'Placeholder', kind: 'text' },
  ],
};

/** True when the tag has a dedicated non-dropdown editor (select, svg). */
export const hasSpecialEditor = (tag: string): boolean =>
  tag === 'select' || tag === 'svg';
