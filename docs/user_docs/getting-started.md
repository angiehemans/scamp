# Get started

## Install Scamp

Scamp requires macOS 13 (Ventura) or later, Windows 10 or later, or a
64-bit Linux desktop.

1. Download the Scamp installer for your platform.
2. Run the installer and follow the prompts.
3. Open Scamp from your Applications folder (macOS) or Start menu (Windows).

## The start screen

When you open Scamp, the start screen has two areas:

- **Sidebar**: The **New Project** button, navigation, a link to
  Settings, and an [account panel](accounts.md) at the bottom. Signing
  in is optional; Scamp works fully without it.
- **Projects**: A card for each project you've opened before, showing a
  picture of its home page. Click a card to reopen the project. Folder
  names appear the way you'd read them, so `my-portfolio` appears as
  "My Portfolio"; hold the pointer over a card to see the folder name on
  disk.

The folder icon beside the **Projects** heading is your default projects
folder. Hold the pointer over it to see its path, or click it to choose
a different folder. You can also change or clear the folder in
[Settings](settings.md).

## Create your first project

1. In the sidebar, click **New Project**.
2. Enter a project name. Scamp creates a folder with that name inside
   your default projects folder.
3. The project opens with a blank canvas and one page named `home`.

## The project folder

Scamp stores projects in a default folder that you can change in
[Settings](settings.md). Each project folder contains the following
files:

- `home.tsx`: The TSX component for your first page
- `home.module.css`: The matching CSS Module
- `theme.css`: Your project's [theme tokens](themes.md)
- `agent.md`: Instructions for AI coding agents (see
  [Bidirectional sync](bidirectional-sync.md))

These files are real, editable code. Open them in any editor, and your
changes sync back to the canvas.

## Next steps

- Learn how to [draw on the canvas](canvas.md).
- Explore the [properties panel](properties-panel.md).
- Read about [bidirectional sync](bidirectional-sync.md) to understand
  what makes Scamp different.
