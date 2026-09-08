# Linux

Scamp runs on Linux as an AppImage or a `.deb` package. This page covers
the one Linux-specific behavior worth knowing about: how Scamp draws its
window on Wayland.

## Scamp runs through XWayland by default

Most current Linux desktops, including GNOME and KDE on Ubuntu, Fedora,
and others, use Wayland as the display server. Scamp doesn't draw
directly on Wayland. It asks for the X11 backend instead, which on a
Wayland session means it runs through XWayland, the compatibility layer
your desktop already uses for other X11 apps.

This is deliberate. On the Electron version Scamp is built on, drawing
directly on Wayland crashes on startup on some systems: the app exits
immediately with no window and no error message. Using X11 avoids the
crash entirely.

You don't need to do anything to get this behavior; it's the default.

### Scamp restarts itself once at launch

Selecting the display backend has to happen before the window is
created, so on Linux Scamp starts, switches to X11, and immediately
restarts itself. This takes a fraction of a second, and you don't
normally notice it.

It has one visible effect: if you launch Scamp from a terminal, your
prompt comes back immediately while Scamp keeps running. That's
expected; it isn't a sign that Scamp failed to start or has quit.

## What this costs you

For most people, nothing visible. The trade-off shows up only in two
situations.

### Fractional display scaling

If your display scaling is set to a fractional value such as 125%,
150%, or 175%, text and interface elements in Scamp might look slightly
softer than in apps that draw natively on Wayland. This is how XWayland
works: your desktop renders at the next whole-number scale and shrinks
the result, which costs a little sharpness.

Whole-number scaling (100% or 200%) isn't affected and looks exactly as
it should. On a HiDPI laptop at 200%, you see no difference at all.

### Multiple monitors at different scales

Under X11 there's a single scaling value for all displays. If you have a
HiDPI laptop screen and a standard external monitor set to different
scales, Scamp looks correctly sized on one and wrongly sized on the
other when you drag the window across.

If both monitors use the same scale, this doesn't affect you.

## Switch back to native Wayland

If your system runs Wayland without trouble and you prefer native
rendering, with sharper fractional scaling and correct per-monitor
scaling, you can turn the default off.

Start Scamp with the `SCAMP_OZONE_PLATFORM` environment variable set to
`auto`:

```bash
SCAMP_OZONE_PLATFORM=auto scamp
```

`auto` lets Electron choose the backend the way it normally does, which
on a Wayland session means native Wayland.

To make the setting permanent, add it to your shell profile, such as
`~/.bashrc` or `~/.zshrc`:

```bash
export SCAMP_OZONE_PLATFORM=auto
```

If you launch Scamp from your desktop's application menu rather than a
terminal, edit the `Exec=` line in its `.desktop` file instead:

```
Exec=env SCAMP_OZONE_PLATFORM=auto /opt/Scamp/scamp %U
```

**Caution:** If Scamp stops opening after you do this, your system is
affected by the Wayland crash. Remove the setting, and Scamp starts
normally again.

You can also force a specific backend by name with
`SCAMP_OZONE_PLATFORM=wayland` or `SCAMP_OZONE_PLATFORM=x11`, or pass
`--ozone-platform=` on the command line, which overrides the environment
variable.

## Troubleshooting

### Scamp exits immediately with no window

This is almost always the Wayland crash described above, which means
something has overridden the default. Check whether
`SCAMP_OZONE_PLATFORM` is set to `auto` or `wayland` in your shell
profile or `.desktop` file:

```bash
echo $SCAMP_OZONE_PLATFORM
```

An empty result means the default is in place. If it prints `auto` or
`wayland`, that's the cause; remove the setting.

This is different from the prompt returning immediately while Scamp
stays open, which is normal. See
[Scamp restarts itself once at launch](#scamp-restarts-itself-once-at-launch).

### Messages in the terminal when launching from a shell

Launching from a terminal might print messages like these:

```
ERROR:ui/gtk/gtk_ui.cc] Schema org.gnome.desktop.interface does not have key font-antialiasing
ERROR:media/gpu/vaapi/vaapi_wrapper.cc] vaInitialize failed: unknown libva error
ERROR:ui/gl/gl_surface_presentation_helper.cc] GetVSyncParametersIfAvailable() failed
```

These come from Chromium probing your desktop and graphics drivers.
They're harmless, Scamp works normally, and they appear even on a
healthy install. You can ignore them.
