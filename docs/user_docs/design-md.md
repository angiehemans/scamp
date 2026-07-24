# DESIGN.md — Your Design Document for Agents

Scamp keeps a `DESIGN.md` file at the root of your project, next to
`agent.md`. It's a human- and agent-readable summary of your design
system: the tokens as structured data, plus prose describing how to use
them. Its main job is to give an **AI agent** working in your project the
context it needs to build UI that matches your design.

The file follows the
[design.md](https://github.com/google-labs-code/design.md) format.

## What's In It

`DESIGN.md` has two parts:

1. **Token data (YAML front matter)** — auto-generated from your design
   system: colors (with references to your semantic tokens), typography
   from your text styles, and spacing / radius values from your tokens.
   This part is **owned by Scamp** — it regenerates whenever your tokens
   change, so it's always in sync.
2. **Prose sections (Markdown)** — written by you, describing intent and
   guidance. Scamp preserves these across regenerations.

## The Documentation Forms

At the bottom of the [Design System panel](design-system.md) is a
**Documentation** section. It has fields for your project **name** and
**description**, plus a text area for each prose section:

- Overview
- Colors
- Typography
- Layout
- Elevation & Depth
- Shapes
- Components
- Do's and Don'ts

Type into any field and it's written into `DESIGN.md` (debounced, so it
saves as you pause). Empty sections are simply omitted from the file.

## Two-Way Sync

`DESIGN.md` stays in sync in both directions:

- **Panel → file.** Editing tokens regenerates the YAML; editing the
  Documentation forms updates the prose. Both are debounced and only
  written when something actually changed.
- **File → panel.** Edit `DESIGN.md` in your code editor (or let an agent
  edit it) and the prose loads back into the Documentation forms
  automatically. Scamp ignores echoes of its own writes, so your
  in-progress typing is never clobbered.

The token YAML is always regenerated from your design system on read —
the panel is the source of truth for tokens — while your authored prose
round-trips untouched.

## Working With Agents

`agent.md` references `DESIGN.md`, so an agent that reads your project
instructions is pointed at the design document. Combined with the real
`theme.css` tokens and the [bidirectional sync](bidirectional-sync.md) of
your TSX/CSS, an agent has everything it needs to extend your design
consistently.
