# Getting Started

## Installation

Scamp needs macOS 13 (Ventura) or later, Windows 10 or later, or a
64-bit Linux desktop.

1. Download the Scamp installer for your platform.
2. Run the installer and follow the on-screen prompts.
3. Launch Scamp from your Applications folder (macOS) or Start Menu (Windows).

## The Start Screen

When you open Scamp, you see the start screen with two areas:

- **Sidebar** -- The "New Project" button, navigation, a link to Settings,
  and an [account panel](accounts.md) at the foot. Signing in is optional
  and Scamp works fully without it.
- **Projects** -- Cards for the projects you have opened before, each
  showing a picture of its home page. Click any card to reopen it. Folder
  names are shown the way you'd read them, so `my-portfolio` appears as
  "My Portfolio" — hover to see the folder name on disk.

The folder icon beside the **Projects** heading is your default projects
folder: hover to see its path, click to choose a different one. You can
also change or clear it in [Settings](settings.md).

## Creating Your First Project

1. Click **New Project** in the sidebar.
2. Enter a project name. Scamp creates a folder for it inside your default projects directory.
3. The project opens with a blank canvas and a single page called "home."

## Default Folder Setup

Scamp stores projects in a default folder on your system. You can change this in [Settings](settings.md). Inside each project folder you will find:

- `home.tsx` -- The TSX component for your first page
- `home.module.css` -- The matching CSS Module
- `theme.css` -- Your project's [theme tokens](themes.md)
- `agent.md` -- Instructions for AI coding agents (see [Bidirectional Sync](bidirectional-sync.md))

These files are real, editable code. Open them in any editor and your changes sync back to the canvas.

## Next Steps

- Learn how to [draw on the canvas](canvas.md)
- Explore the [properties panel](properties-panel.md)
- Read about [bidirectional sync](bidirectional-sync.md) to understand what makes Scamp unique
