# Scamp — Components

**Depends on:** Next.js file structure story must be complete first.
The `components/` folder convention and `@/` import alias both require
the scaffolded project structure to be in place.

---

## User stories

As a user designing a layout, I want to convert any element and its
children into a reusable component so I can use it across multiple pages
and have changes propagate everywhere it is used.

As a user starting from scratch, I want to create a new blank component
from the components list so I can design it in isolation and then place
it on any page.

As a user with components in my project, I want to drag a component onto
any page canvas and place it as an instance so I can reuse my work without
copying and pasting elements.

---

## Project structure

Each component lives in its own folder inside a top-level `components/`
directory in the project:

```
my-project/
├── app/
│   ├── page.tsx
│   └── dashboard/
│       └── page.tsx
└── components/
    └── Button/
        ├── Button.tsx
        └── Button.module.css
```

The component name becomes the folder name, the TSX filename, and the
React component function name. Names must be PascalCase — Scamp converts
whatever the user types into valid PascalCase on creation.

---

## Creating a component

**From an existing element:**
- Right-click any element on the canvas and select "Create component"
- A name input appears — user types a name and confirms
- Scamp creates `components/[Name]/[Name].tsx` and
  `components/[Name]/[Name].module.css` with the element's structure
  and styles
- The original element on the page is replaced with an instance of the
  new component
- The component appears in the components list in the left sidebar

**From scratch:**
- Click "+ New component" at the bottom of the components list
- User types a name and confirms
- Scamp creates an empty component folder with a blank TSX and CSS module
- The component editor opens automatically so the user can start designing

---

## The component editor

Each component has its own editor view that works exactly like a page
view — the same canvas, the same properties panel, the same CSS editor.

- Open the component editor by double-clicking the component name in
  the list, or by double-clicking a component instance on a page canvas
- The editor shows the component in isolation on a neutral background
- The component's root element is the outermost element in the tree —
  there is no page root
- All the same tools are available: draw rectangles, add text, set flex
  layout, edit CSS
- Changes in the component editor are written to the component's TSX
  and CSS module files and propagate to every instance on every page
  automatically via chokidar

**Panel tabs in the component editor:**

The properties panel has three tabs when editing a component:

```
[ UI ]  [ CSS ]  [ Data ]
```

UI and CSS tabs work exactly as they do on page elements. The Data tab
is new and is described in detail below.

**Navigating back to a page:**
- A breadcrumb at the top of the canvas shows current context:
  `home > Button` when entering a component from a page
- Clicking the page name returns to the page view
- The edited component instance is re-selected on return

A persistent banner appears at the top of the canvas when inside a
component editor:

```
Editing component: Button. Changes affect all instances.
```

---

## The Data tab

The Data tab is the control centre for a component's props. It appears
in the properties panel when editing a component and shows a flat list
of every text element in the component, regardless of nesting depth.

Each text element in the list has two states:

**Prop (dynamic):**
- The text is exposed as a React prop that can be overridden per instance
- A name input shows the current prop name, editable inline
- The default value is whatever text was in the element when it was
  first added to the component
- The prop name defaults to `prop-1`, `prop-2` etc. in order of
  creation — the user should rename it to something meaningful

**Locked (static):**
- The text is hardcoded — it always renders the same literal string
  on every instance
- No prop is generated in the component's type definition
- The text can still be edited here but it updates everywhere simultaneously

A toggle on each row switches between Prop and Locked states.

**Example Data tab:**

```
Text elements

  "Get started"     [ Prop ▾ ]   Name: label
  "Learn more"      [ Locked ▾ ]
  "© 2026 Scamp"    [ Locked ▾ ]
```

**Generated code from the Data tab:**

```tsx
type ButtonProps = {
  label?: string;
};

export default function Button({ label = 'Get started' }: ButtonProps) {
  return (
    <div data-scamp-id="btn-root" className={styles.root}>
      <span data-scamp-id="btn-text" className={styles.label}>
        {label}
      </span>
    </div>
  );
}
```

Locked text renders as a literal string in JSX. Prop text renders as
a JSX expression with the prop name.

---

## Smart warnings

These warnings fire before any destructive operation that could silently
break pages or instances. Every warning must be specific — it names
the affected pages and instance counts, never a generic "this may
cause issues" message.

**Deleting a component:**

If the component is used on any pages:

```
┌─────────────────────────────────────────────────────┐
│  Delete Button?                                     │
│                                                     │
│  Button is used in 3 places:                        │
│  · home (2 instances)                               │
│  · dashboard (1 instance)                           │
│                                                     │
│  All instances will be removed from those pages.   │
│  This cannot be undone.                             │
│                                                     │
│  [ Delete anyway ]           [ Cancel ]             │
└─────────────────────────────────────────────────────┘
```

On confirm: the component folder is deleted and all instances are removed
from every page. Import statements are cleaned up. All file writes are
atomic — either everything updates or nothing does.

If the component has no instances, it is deleted immediately with no
confirmation.

**Changing a prop from Prop to Locked:**

If the prop has been overridden on any instances:

```
┌─────────────────────────────────────────────────────┐
│  Lock "label"?                                      │
│                                                     │
│  This prop has been overridden in 4 places:         │
│  · home — "Get started", "Learn more"               │
│  · dashboard — "Sign in"                            │
│  · pricing — "Buy now"                              │
│                                                     │
│  Locking it will replace all overrides with the    │
│  default text: "Get started".                       │
│                                                     │
│  [ Lock anyway ]             [ Cancel ]             │
└─────────────────────────────────────────────────────┘
```

On confirm: the prop is removed from the component's type definition,
all instance overrides are removed from every page's TSX, and the
literal default text is written into the component JSX.

**Renaming a prop:**

Renaming `label` to `buttonText` requires updating every page that
uses the component with an override. No confirmation needed — this
is non-destructive — but a brief toast notification confirms the
change:

```
Prop renamed. Updated 4 instances across 2 pages.
```

The rename is an atomic multi-file write via a dedicated
`component:renameProp` IPC channel. If any write fails, all files
are left unchanged.

**Deleting a text element that is a prop:**

If a text element inside a component has an active prop with overrides
on instances:

```
┌─────────────────────────────────────────────────────┐
│  Delete this element?                               │
│                                                     │
│  It is linked to the "label" prop which has been    │
│  overridden in 4 places across 2 pages.             │
│                                                     │
│  Deleting it will remove the prop and all           │
│  overrides.                                         │
│                                                     │
│  [ Delete anyway ]           [ Cancel ]             │
└─────────────────────────────────────────────────────┘
```

**Renaming a component:**

Renaming is an atomic multi-file operation:

1. Rename `components/[OldName]/` to `components/[NewName]/`
2. Rename `[OldName].tsx` and `[OldName].module.css` inside the folder
3. Update the component function name inside the TSX
4. Update all import statements on every page that uses the component
5. Update the component name in the layers panel and components list

Uses a dedicated `component:rename` IPC channel. If any step fails
the component is left unchanged. A toast confirms:

```
Component renamed. Updated imports on 3 pages.
```

**Circular dependency detection:**

If a user attempts to place Component A inside Component B, and
Component B is already used inside Component A (at any depth), block
the action immediately with a clear message:

```
Cannot add Button inside Card.
Card is already used inside Button — this would create a loop.
```

---

## Placing components on a page

- The components list in the left sidebar shows all components in the
  project with a small thumbnail preview of each
- Drag a component from the list onto the page canvas to place an instance
- Instances can be placed inside any container element the same way
  a rectangle can be drawn inside another rectangle
- The instance appears in the layers panel with a component icon to
  distinguish it from regular elements

---

## Instance identity

Each instance placed on a page gets a unique `data-scamp-instance-id`
attribute in the page's TSX, separate from the `data-scamp-id` attributes
inside the component itself:

```tsx
import styles from './page.module.css';
import Button from '@/components/Button/Button';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <Button data-scamp-instance-id="inst_a1b2" label="Get started" />
      <Button data-scamp-instance-id="inst_c3d4" label="Learn more" />
    </div>
  );
}
```

---

## Instance vs component editing

- **Single-click** a component instance on a page canvas to select it
  as an instance. The properties panel shows instance-level controls
  (position, size within parent layout) and a Data tab showing all
  editable props
- **Double-click** to enter the component editor for that component

---

## Data tab on a page (instance props)

When a component instance is selected on a page canvas, the properties
panel shows three tabs:

```
[ UI ]  [ CSS ]  [ Data ]
```

The Data tab shows a flat list of every prop the component exposes —
the same props defined in the component's own Data tab, but here the
user sets per-instance override values rather than defining the prop
itself.

**Example:**

```
Button props

  label         "Get started"    ← editable text input
  variant       [ solid ▾ ]      ← if variant prop exists
```

- Each prop shows its name (read-only, defined in the component) and
  an editable value input for this instance
- Text props show a text input pre-filled with the current override
  value, or the component default if no override has been set yet
- Clearing an input back to empty removes the override and falls back
  to the component's default value
- Changes commit on blur or Enter and write the updated prop value to
  the page's TSX immediately

---

## Inline canvas editing for text props

Double-clicking a text element inside a component instance on the page
canvas enters inline edit mode for that text prop directly on the canvas,
the same way plain text elements work.

This is feasible because component instances are rendered as real DOM
elements — the text is already there and can be made contentEditable
on double-click.

**Behaviour:**

- Double-click a text element inside a component instance to enter
  inline edit mode
- The text becomes editable directly on the canvas
- As the user types, the Data tab updates in real time showing the
  new value
- Pressing Escape or clicking away commits the change and writes the
  prop override to the page's TSX
- A subtle indicator on the element signals it is a component prop
  being overridden (a small component icon or highlight color distinct
  from the normal selection outline)

**Sync between canvas and panel:**

The canvas edit and the Data tab input are always in sync. Editing
in one immediately reflects in the other — there is no commit step
between them. The file write happens on blur/Escape from whichever
surface the user was editing in.

**Locked text:**

Text elements marked as Locked in the component's Data tab are not
editable from the page canvas or the instance Data tab. Attempting
to double-click locked text shows a brief tooltip:

```
This text is locked in the component.
Double-click the component to edit it.
```



---

## Detaching an instance

- Right-click a component instance and select "Detach from component"
- The instance is converted to regular elements with new unique element IDs
- A confirmation prompt is shown:

  ```
  Detach Button from component?
  This instance will no longer update when Button changes.
  [ Detach ]   [ Cancel ]
  ```

- One-way operation — there is no re-attach

---

## `parseCode` updates

- The TSX parser must recognise component imports and capitalised JSX
  tags as component instances
- Instance elements are identified by `data-scamp-instance-id` and
  mapped to the correct component definition
- Text override props are parsed back into the instance's override map
- The parser resolves component definitions from the `components/`
  folder when reading a page file

---

## `agent.md` additions

```markdown
## Components

Components live in `components/[Name]/[Name].tsx` and
`components/[Name]/[Name].module.css`.

- Component names are PascalCase
- Each component exports a single default function
- Do not rename component folders or files directly — use the rename
  flow or all page imports will break
- Do not remove `data-scamp-id` attributes inside component files
- Instance identity on pages uses `data-scamp-instance-id` — do not
  remove these from page files
- Text props follow the pattern in the component's type definition —
  add new props to the type and default value list
- Locked text renders as a literal string in JSX — do not convert
  it to a prop without updating all instances
```

---

## Notes

- The `@/components` import alias requires `tsconfig.json` to include
  the path mapping — add this to the scaffolded tsconfig when the
  Next.js structure feature ships
- Prop naming defaults (`prop-1`, `prop-2`) are intentionally generic.
  Prompt the user to rename them the first time they place a component
  on a page if any props are still using default names
- Variants (a component with multiple visual configurations triggered
  by a variant prop) are out of scope for this story and will be
  addressed in a follow-up
- The thumbnail preview in the components list is a lightweight
  screenshot of the component canvas taken on save