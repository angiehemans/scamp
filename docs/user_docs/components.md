# Components

A component is a reusable piece of UI that lives in its own folder
and can be dropped onto any page. Edit it once and every instance
across every page updates.

Components are the answer to "I'm copy-pasting this same card on
five pages" — promote it to a component, drop instances where you
need them, and changes in the component editor propagate everywhere.

## Where Components Live

Each component is two files inside `components/[Name]/`:

```
my-project/
├── app/
│   ├── page.tsx
│   └── about/
│       └── page.tsx
└── components/
    └── Card/
        ├── Card.tsx
        └── Card.module.css
```

The component's name becomes the folder name, the TSX filename, the
React function name, and the JSX tag used to instantiate it on a
page. Names are PascalCase — Scamp converts whatever you type
(`my card`, `my-card`, `MyCard`) into a valid PascalCase identifier.

Components show up in the **Components** section of the left
sidebar, right below Pages.

## Creating a Component

### From an existing element

1. Right-click any element on the canvas (a rect, a text node, or a
   group) and pick **Create component**.
2. Type a name and confirm.
3. Scamp:
   - Writes `components/[Name]/[Name].tsx` and `[Name].module.css`
     with the element's structure and styles.
   - Replaces the element on the page with an instance of the new
     component.
   - Adds the component to the sidebar list.

The page's `.tsx` gets an import (`import [Name] from '@/components/[Name]/[Name]'`)
and the JSX swaps from the original element to `<[Name] />`.

### From scratch

Click **+ Add component** at the bottom of the Components list.
Type a name. Scamp scaffolds an empty component and opens the
component editor so you can start designing.

## The Component Editor

Double-click a component in the sidebar — or double-click any
instance on a page canvas — to open the component editor. It's the
same canvas, properties panel, and code panel you already know,
scoped to one component.

A banner across the top of the canvas reminds you that you're
editing a component:

```
Editing component: Card. Changes affect all instances.
```

A breadcrumb above the canvas (`home → Card`) lets you click back
to the page that brought you in. The instance you came from is
re-selected when you return.

### The Data tab

When you're inside the component editor, the properties panel grows
a third tab:

```
[ UI ]  [ CSS ]  [ Data ]
```

The Data tab lists every text element in the component and lets you
decide whether each one is **dynamic** (becomes a React prop) or
**locked** (hardcoded into the component).

| State | What happens |
|---|---|
| **Prop** | The text becomes a `?: string` prop on the component. Each instance can override it. The Data tab shows an editable prop name (`label`, `title`, etc.) — rename it from the default `prop-1`. |
| **Locked** | The text is hardcoded into the component. Every instance renders the same string. Editing the text here updates everywhere. |

The default for new text elements added to a component is **Prop**.
Toggle individual text rows to **Locked** when the text should never
vary between instances (footer copyright lines, fixed labels, etc.).

## Instancing on a Page

Drag a component from the sidebar onto any page canvas. Scamp:

- Adds the import to the page's `.tsx`.
- Inserts `<[Name] />` at the drop location.
- Selects the new instance so you can position it.

An instance behaves like a single element on the page — click to
select, drag to move, change its layout-related properties like any
other rectangle. The instance's **internal** structure is read-only
from the page; to edit what's inside, open the component editor by
double-clicking.

### Per-instance text overrides

When you select an instance and the component has any **Prop**-mode
text elements, the properties panel shows an **Instance** section
with one input per prop. Type a value to override it for this
instance; leave it blank to use the component's default.

The generated JSX picks up overrides as JSX attributes:

```tsx
<Card title="Pricing" cta="Get started" />
```

Locked text in the component renders the same across every instance
and never appears in the Instance section.

## Slots (Passing In Content)

Props let an instance customize *text*. **Slots** let an instance pass
in whole *elements* — Scamp's version of React's `children` prop. A
`Card` with a slot can hold different content on every page while
sharing one frame, border, and padding.

### Defining a slot

Inside the component editor, right-click any **empty rectangle** and
choose **Make slot**. The rectangle turns into a labelled drop target:

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
   ✦ slot: children
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

- The first slot is named **`children`** (the default slot). Add more
  and they come up as `slot1`, `slot2`, … — rename them in the **Data
  tab**'s Slots list to something meaningful (`header`, `footer`,
  `icon`). Names must be unique.
- A component can have **one default slot plus any number of named
  slots**.
- Only a **childless** rectangle can become a slot — a slot's job is
  to hold *page* content, so it can't have its own children, and a
  slot can't be placed inside another slot (no nesting).

Behind the scenes this becomes a real `children` / `React.ReactNode`
prop:

```tsx
type CardProps = {
  children?: React.ReactNode;   // the default slot
  header?: React.ReactNode;     // a named slot
};
```

### Filling a slot on a page

Place the component on a page and each slot shows as a drop zone:

```
┌──────────────────────────────┐
│  Card                        │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│     Drop elements here      │ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└──────────────────────────────┘
```

Two ways to put content in:

- **Drag** an existing element (from the canvas or the [Layers
  panel](layers-panel.md)) and drop it onto the slot box.
- **Draw or type directly** — with the slot box under your cursor, use
  the rectangle/text/image tools to create an element right inside it.

Drop multiple elements and they stack as siblings in the slot. With
several named slots, each box fills its own slot; the content routes
to whichever box you dropped on.

Slot content **belongs to the page, not the component** — it's the
instance's children, so it can differ on every page and doesn't change
the component definition. In the generated page TSX the default slot
becomes JSX children and named slots become props:

```tsx
<Card>
  <p className={styles.body}>Anything you like.</p>
</Card>

<SplitLayout
  left={<p className={styles.heading}>Hello</p>}
  right={<img src="/assets/hero.png" />}
/>
```

### Slots in the Data tab

- **In the component editor**, the Data tab lists each slot with a
  rename field and a Remove button; click a slot's badge to select its
  box on the canvas.
- **On a page instance**, the Data tab shows which slots have content
  and which are empty (`✦ header  ● 2 elements` / `○ Empty`).

> If a component defines slots but an instance's content doesn't match
> any of them — e.g. plain children on a component that only has named
> slots — that content simply doesn't render, exactly as it wouldn't in
> React. It's still in your page file; give it a matching slot or move
> it into one to bring it back.

## Editing a Component

Changes you make in the component editor — adding elements, moving
them, changing colors, tweaking layout — write to the component's
own files. The file watcher picks up the change and every instance
on every page re-renders to reflect the update. There's no
"recompile" step.

If you delete an element that was a Prop, every instance loses
access to that prop. Scamp warns you before the delete lands if
any page currently uses that override.

## Smart Warnings

Scamp surfaces specific warnings before destructive operations that
could silently break instances or pages. The warnings name the
affected pages and instance counts, never a generic message.

- **Deleting a component** — Lists every page that uses it and the
  number of instances on each. You can choose to detach instances
  (replace them with the component's frozen contents inline on each
  page) or cancel.
- **Renaming a component** — Updates every instance's JSX tag and
  the import path in every consuming page. The History panel shows
  one entry per page touched.
- **Removing a Prop-mode text element** — Lists every page with
  instances that override that prop.
- **Removing a slot** — If instances on other pages have content in
  that slot, lists the affected pages. The content isn't deleted — it
  stays in each page file and stops rendering until you re-place it.
- **Nesting a component into its own slot** — A drop that would make a
  component contain itself (a circular slot dependency) is refused with
  a note in the app log.

## When NOT to Use a Component

- **One-off layouts** — If a layout only appears once on one page,
  it doesn't need to be a component. Keep it inline; you can always
  promote later.
- **Single-element wrappers** — A component that just wraps one
  rect with no extra structure is usually noise. Promote when there
  are multiple elements that move together.
- **Page-specific copy** — If a card's text varies per page and
  there's no shared structure to extract, keep it inline. Components
  are about *structural* reuse; per-page variation belongs on the
  page.

## Tips

- The component editor's canvas has no page root — the component's
  outermost element IS the root. Sizing rules differ slightly: the
  component canvas is sized to fit the component's content, not the
  artboard.
- Instances render their CSS Modules from the component's own
  `[Name].module.css`. Page-level styles don't leak in.
- Renaming an instance on a page only changes its `data-scamp-id`
  on that page — the component definition is untouched.
- An AI agent can edit `components/[Name]/[Name].tsx` directly, just
  like a page file. The canvas reloads as expected.
