# Scamp — Feature Backlog v5

User stories ordered easiest to hardest.

---

## 1. Crash reporting and feedback (Sentry + in-app)

**User story**

As a Scamp user, I want the app to handle crashes gracefully and give me
an easy way to report bugs so the developer can fix issues quickly, and I
want full control over whether my usage data is shared so I can trust that
the app respects my privacy.

---

**Behaviour — opt-in prompt on first launch**

On first launch a one-time prompt appears before the app is fully loaded:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Help improve Scamp                                 │
│                                                     │
│  Send anonymous crash reports when something goes   │
│  wrong. No personal data, no project files, no      │
│  file contents — only error details and your OS     │
│  and app version.                                   │
│                                                     │
│  You can change this at any time in Settings.       │
│                                                     │
│  [ Send crash reports ]     [ No thanks ]           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- The choice is stored in `app.getPath('userData')` alongside the recent
  projects JSON
- If the user clicks "No thanks" crash reporting is never initialised —
  no Sentry SDK code runs at all
- If the user clicks "Send crash reports" Sentry is initialised with the
  privacy-safe configuration below

---

**Sentry configuration**

Sentry is initialised only when the user has opted in. The configuration
strips all potentially identifying information before any event is
transmitted:

```ts
import * as Sentry from '@sentry/electron';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: userHasOptedIn,
  autoSessionTracking: false,       // no persistent session IDs
  beforeSend(event) {
    // Strip file paths that could identify the user
    if (event.breadcrumbs?.values) {
      event.breadcrumbs.values = event.breadcrumbs.values.map(b => ({
        ...b,
        message: b.message?.replace(
          /\/Users\/[^/]+/g,
          '/Users/[redacted]'
        ),
        data: undefined,
      }));
    }
    // Strip any request data
    delete event.request;
    return event;
  },
});
```

What Sentry receives with this configuration:
- Error message and stack trace (pointing to Scamp's own code)
- OS name and version
- Scamp app version
- Nothing else

What Sentry never receives:
- File paths
- Project names
- Element data or canvas state
- Any user-identifying information

---

**Settings toggle**

A "Privacy" section in Scamp's Settings panel contains a single toggle:

```
Send anonymous crash reports
Helps fix bugs faster. No personal data or project
files are ever shared.
[ toggle — on/off ]
```

Toggling off disables Sentry immediately for the current session and
updates the stored preference. Toggling on re-initialises Sentry with
the same privacy-safe configuration.

---

**In-app bug report**

A "Report a bug" option in the app menu (Help → Report a bug) opens
a GitHub Issues new issue page in the user's default browser,
pre-filled with the app version and OS via URL parameters:

```
https://github.com/[org]/scamp/issues/new?template=bug_report.md
&labels=bug&title=&body=**App+version:**+1.0.0%0A**OS:**+macOS+14.0
```

A GitHub issue template (`bug_report.md`) is maintained in the repo
with fields for:
- App version (pre-filled)
- OS and version (pre-filled)
- Steps to reproduce
- Expected behaviour
- Actual behaviour
- Screenshots (optional)

---

**Notes**

- Sentry is installed as a runtime dependency (`@sentry/electron`) not
  a dev dependency — it runs in the packaged app
- The opt-in prompt should appear before any project is loaded so the
  user is not distracted by it mid-session
- The privacy policy on scampdesign.app should document exactly what
  is collected, reference Sentry as the service used, and explain how
  to opt out — link to it from the Settings panel
- Never initialise Sentry before the user has made their choice — not
  even for a single frame. Check the stored preference synchronously
  before any other app initialisation
- The free Sentry tier (5,000 errors/month) is sufficient for early
  stage. Self-hosted Sentry is worth considering later as a privacy
  marketing point

---

## 2. Toggle CSS property groups

**User story**

As a user designing a layout, I want to temporarily disable an entire
group of CSS properties on any element by toggling the section off in
the WYSIWYG panel so I can preview how the design looks without those
properties without losing them entirely or having to retype them.

---

**Behaviour — group toggle**

Each section in the WYSIWYG panel has a toggle at the section header
level that comments out all properties in that group simultaneously.
This lets users disable an entire layout or border system in one click
to compare before and after.

When a group is toggled off, all active properties in that group are
commented out together as a labelled block:

```css
.rect_a1b2 {
  width: 400px;
  height: 300px;

  /* layout off */
  /* display: flex; */
  /* flex-direction: row; */
  /* gap: 16px; */
  /* align-items: center; */
  /* padding: 24px; */

  background: #f0f0f0;
  border-radius: 8px;
}
```

The group header in the panel shows a reduced opacity state and a clear
"off" indicator when the group is toggled off. All property rows within
a toggled-off group are shown as inactive.

Toggling the group back on removes the comment block and all properties
are active again. Toggled-off groups persist in the file — they survive
chokidar reloads and are still visible in the panel on next open.

**Property groups and what they cover:**

| Group | Properties commented out |
|---|---|
| Layout | `display`, `flex-direction`, `flex-wrap`, `gap`, `align-items`, `justify-content`, `padding` |
| Sizing | `width`, `height` (see sizing note below) |
| Background | `background`, `background-color`, `background-image`, `background-size`, `background-position`, `background-repeat` |
| Border | `border`, `border-width`, `border-style`, `border-color`, `border-radius` |
| Shadow | `box-shadow` (all shadow rows together) |
| Typography | `font-size`, `font-weight`, `color`, `text-align`, `line-height`, `font-family` |
| Filters | `filter`, `backdrop-filter` |
| Visibility | `opacity`, `visibility` |
| Blend | `mix-blend-mode`, `background-blend-mode` |
| Transitions | `transition` (all transition rows together) |
| Animation | `animation` — the associated `@keyframes` block is left in place |

**Sizing group toggle note:**

The sizing group toggle is available but shows a warning in the panel:

```
Toggling off sizing may collapse this element.
[ Toggle off anyway ]  [ Cancel ]
```

Width and height set to `100%` (stretch mode) cannot be toggled off —
the toggle is disabled with a tooltip explaining why.

---

**Behaviour — raw CSS editor**

- Group comment labels (`/* layout off */`) are recognised by their
  exact label and the corresponding group toggle is shown as off in
  the panel
- The user can manually add or remove the comment block in the raw
  editor to toggle a group — the panel stays in sync on next parse

---

**parseCode updates**

- The CSS parser recognises labelled group comment blocks and maps
  them back to toggled group state:
  ```ts
  interface Element {
    // existing fields...
    toggledOffGroups: string[];  // e.g. ['layout', 'border']
  }
  ```
- `generateCode` emits toggled-off groups as labelled comment blocks,
  always after all active properties in the class block
- The group label comment (`/* layout off */`) is how `parseCode`
  identifies a toggled group — it must be preserved verbatim

---

**What cannot be toggled off**

- `width: 100%` and `height: 100%` (stretch mode) — would collapse
  the element
- `position` — not user-editable
- Properties already at their default value are not emitted and
  therefore cannot be toggled

---

**Notes**

- Group comment labels must be exact (`/* layout off */`,
  `/* border off */` etc.) — `parseCode` matches these literally.
  Document the exact labels in `agent.md` so agents preserve them
  and do not reformat or remove them
- The animation group toggle comments out the `animation` property
  but leaves `@keyframes` in the file — removing keyframes could
  break other elements that reference the same animation name
- This mirrors the workflow developers use in browser devtools every
  day and brings it directly into the design environment

---

## 3. Auto-updates

**User story**

As a Scamp user, I want the app to automatically download and install
updates in the background so I always have the latest version without
having to manually check, download, and reinstall.

As a Scamp user, I want to be informed when an update is ready and
choose when to restart and install it so an update never interrupts
my work unexpectedly.

---

**Behaviour — update check**

- On launch, the app silently checks GitHub Releases for a newer version
- The check repeats every 4 hours while the app is running
- If no update is available nothing happens and nothing is shown
- If an update is available it downloads silently in the background
  with no UI interruption

**Behaviour — update ready prompt**

When a download completes a non-blocking banner appears at the bottom
of the app window:

```
┌──────────────────────────────────────────────────────────────┐
│  Scamp [version] is ready to install.   [Restart and install] │
│                                                    [Dismiss]  │
└──────────────────────────────────────────────────────────────┘
```

- The banner slides up from the bottom of the window
- It does not appear while the save status indicator shows "Saving" —
  it waits until the status returns to "Saved" so it never interrupts
  a file write
- "Restart and install" quits the app and installs the update
  immediately via `autoUpdater.quitAndInstall()`
- "Dismiss" hides the banner — the update installs silently the next
  time the app is quit normally via `autoInstallOnAppQuit: true`
- The banner never reappears after being dismissed for the same version

**Behaviour — update error**

If the update check or download fails:

- Nothing is shown to the user — a failed update check is not worth
  surfacing
- The error is logged via the app's internal logger
- If Sentry is enabled the error is captured silently
- The next scheduled check (4 hours) will try again automatically

**Platform support**

| Platform | Format | Auto-update |
|---|---|---|
| macOS | .dmg (arm64) | Full — requires code signing and notarization |
| Windows | .exe (NSIS) | Full — recommended code signing |
| Linux | .AppImage | Full — AppImage self-updates natively |

**Implementation**

`electron-updater` from the `electron-builder` ecosystem handles the
update mechanism. It is a runtime dependency, not a dev dependency.

```ts
// src/main/updater.ts
import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

const FOUR_HOURS = 4 * 60 * 60 * 1000;

export const initAutoUpdater = (mainWindow: BrowserWindow): void => {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('updater:downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    // log silently, do not surface to user
  });

  autoUpdater.checkForUpdatesAndNotify();

  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, FOUR_HOURS);
};
```

**IPC channels**

| Channel | Direction | Payload |
|---|---|---|
| `updater:downloaded` | main → renderer | `{ version, releaseNotes }` |
| `updater:install-now` | renderer → main | none |

**Release process**

Pushing a version tag triggers the GitHub Actions release workflow which
builds all three platform targets, signs and notarizes, and publishes to
GitHub Releases. Running instances check for the new version on their
next launch or 4-hour interval.

```bash
# Bump version in package.json, then:
git tag v1.1.0
git push origin v1.1.0
```

**Code signing prerequisites**

See `auto-update-prd.md` for the full list of manual prerequisite steps
required before auto-updates can ship — Apple Developer Program
enrollment, Developer ID certificate, notarization credentials, and
Windows code signing certificate. These must be completed and stored
as GitHub Actions secrets before the release workflow will produce
signed, auto-updatable builds.

**Notes**

- `electron-updater` must be a runtime dependency in `package.json`
  not a devDependency — it runs inside the packaged app
- The update banner must check the save status indicator state before
  showing — never interrupt a save in progress
- Auto-updates on Linux require AppImage format. The `.deb` format does
  not support auto-updates and should not advertise this feature
- The Gumroad download page should note that auto-updates are available
  from v[first auto-update version] onwards — users on earlier versions
  will need to download manually one final time