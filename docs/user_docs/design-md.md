# DESIGN.md: your design document for agents

Scamp keeps a `DESIGN.md` file at the root of your project, next to
`agent.md`. It's a summary of your design system that both people and
agents can read: the tokens as structured data, plus prose that
describes how to use them. Its main job is to give an AI agent that
works in your project the context it needs to build UI that matches
your design.

The file follows the
[design.md](https://github.com/google-labs-code/design.md) format.

## What the file contains

`DESIGN.md` has two parts:

1. **Token data (YAML front matter)**: Generated from your design
   system—colors (with references to your semantic tokens), typography
   from your text styles, and spacing and radius values from your
   tokens. Scamp owns this part and regenerates it whenever your tokens
   change, so it's always in sync.
2. **Prose sections (Markdown)**: Written by you, describing intent and
   guidance. Scamp preserves these sections across regenerations.

## The Documentation forms

At the bottom of the [Design System panel](design-system.md) is a
**Documentation** section. It has fields for your project **name** and
**description**, plus a text area for each prose section:

- Overview
- Colors
- Typography
- Layout
- Elevation and depth
- Shapes
- Components
- Do's and don'ts

Type into any field, and Scamp writes it to `DESIGN.md`. Writes are
debounced, so the file saves as you pause. Empty sections are omitted
from the file.

## Two-way sync

`DESIGN.md` stays in sync in both directions:

- **Panel to file**: Editing tokens regenerates the YAML; editing the
  Documentation forms updates the prose. Both are debounced and written
  only when something changed.
- **File to panel**: Edit `DESIGN.md` in your code editor, or let an
  agent edit it, and the prose loads back into the Documentation forms
  automatically. Scamp ignores echoes of its own writes, so your
  in-progress typing is never overwritten.

Scamp always regenerates the token YAML from your design system on
read—the panel is the source of truth for tokens—while your authored
prose round-trips untouched.

## Work with agents

`agent.md` references `DESIGN.md`, so an agent that reads your project
instructions is pointed at the design document. Combined with the real
`theme.css` tokens and the [bidirectional sync](bidirectional-sync.md)
of your TSX and CSS, an agent has everything it needs to extend your
design consistently.
