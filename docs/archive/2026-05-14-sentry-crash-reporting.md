# Crash Reporting and Feedback (Sentry + In-App) — Plan

**Status:** Draft for review.
**Date:** 2026-05-14
**Source:** `docs/backlog-5.md` story #1
**Related:** App settings (`src/main/ipc/settings.ts` — the
existing `settings.json` in `app.getPath('userData')`; we extend
its shape rather than adding a new file), Settings panel
(`src/renderer/src/components/SettingsPage.tsx` — the "General"
section is the template for the new "Privacy" section).

---

## Goal

Add anonymous crash reporting (Sentry) and an in-app bug-report
shortcut, with privacy as a non-negotiable constraint:

1. A one-time **opt-in prompt** on first launch — defaults to
   nothing collected.
2. **Privacy-safe Sentry init** that runs ONLY after the user has
   said yes. Strips file paths and any user-identifying data
   before transmit.
3. A **Settings → Privacy toggle** that lets the user flip the
   choice at any time, with effect on the current session.
4. A **Help → Report a bug** menu entry that opens a pre-filled
   GitHub issue in the user's default browser.

---

## ⚠ Manual steps on the Sentry website (you, not Scamp)

These need to happen **before** the implementation can be tested
end-to-end. None are scriptable — they all need a human in the
Sentry dashboard.

### Required before phase 1 of implementation

1. **Sign up / log in at https://sentry.io.** The free
   "Developer" tier covers 5,000 errors per month, which is
   plenty for early-stage Scamp.
2. **Create a new project**:
   - **Platform**: Electron (Sentry has a first-class Electron
     SDK that wraps main + renderer + utility processes).
   - **Project name**: `scamp` (or whatever — only visible inside
     Sentry).
   - **Alert frequency**: choose "Alert me on every new issue"
     for early stage; tighten later if it's noisy.
3. **Copy the DSN** from the project's "Settings → Client Keys
   (DSN)" page. It looks like
   `https://<32-char-hash>@o<orgid>.ingest.sentry.io/<projectid>`.
   This is the secret(-ish) value Scamp needs in
   `SENTRY_DSN`. Treat it like a write-only key — anyone with
   it can submit events as your project, but they can't read
   anything.
4. **Disable Sentry's automatic PII collection** at the project
   level as a belt-and-braces measure:
   - **Settings → Security & Privacy → "Enable Server-Side Data
     Scrubbing"** — leave ON (default).
   - **Settings → Security & Privacy → "Prevent Storing of IP
     Addresses"** — turn ON.
   - **Settings → Security & Privacy → Data Scrubber → "Use
     Default Scrubbers"** — leave ON.

   We also scrub client-side in `beforeSend` (story spec), so
   these are redundant defence — fine.

### Recommended before shipping

5. **Configure inbound filters** at
   **Settings → Inbound Filters**:
   - Filter known browser extensions ✓
   - Filter web crawlers ✓
   - Filter "legacy browsers" ✓ (cuts out IE/old-Edge noise that
     can't actually run Electron)
6. **Set the release format**. Scamp will report `release:
   scamp@<version>` (matches `package.json`). On the Sentry side:
   **Settings → Releases** — no setup needed, releases are
   auto-created on first event.
7. **Decide who gets alerts**. **Settings → Alerts** — at
   minimum, set yourself as the recipient on the default
   "Issue Alert" rule.

### Optional / future

8. **Source map uploads** for symbolicated stack traces. Without
   this, Sentry shows minified main-process code in stack
   traces, which is annoying but workable. The setup is
   non-trivial (CI step using `@sentry/cli`) and out of scope
   for v1. Worth a follow-up once Scamp has a release pipeline.
9. **Self-hosted Sentry**. The backlog notes this as a future
   privacy marketing point. Not in scope here — start with the
   hosted free tier.

### Per-environment DSN handling

- **Local dev**: put the DSN in a `.env.local` (gitignored) at
  the project root: `SENTRY_DSN=https://...`. The main process
  reads `process.env.SENTRY_DSN` at startup.
- **CI / packaged builds**: the DSN gets injected at build time
  via GitHub Actions secrets (or whatever CI host you wind up
  on). The implementation reads from `process.env` regardless of
  source — no code change between dev and prod.
- The DSN is NOT a secret in the cryptographic sense — exposing
  it in the packaged app's `app.asar` is fine, that's the
  intended deployment model for client SDKs. Sentry rate-limits
  unknown DSNs at the project level.

---

## Current state — what we can build on

- **`settings.json` lives at `app.getPath('userData')/settings.json`**
  (`src/main/ipc/settings.ts`). Current shape:
  `{ defaultProjectsFolder: string | null, artboardBackground: string }`.
  Read on demand via `getSettings()` IPC; written via
  `updateSettings(patch)` which merges a `Partial<Settings>`
  over the current state. **The opt-in preference extends this
  shape — no new file, no new IPC.**
- **Preload bridge** (`src/preload/index.ts`) already exposes
  `window.scamp.getSettings()` and
  `window.scamp.updateSettings(patch)`. No new preload API
  needed for the Privacy toggle.
- **Settings panel** (`SettingsPage.tsx`) has one section
  today: "General" with the default-projects-folder picker.
  Adding "Privacy" below it is a copy-paste of the section
  shape.
- **Main process entry** (`src/main/index.ts`) initialises in a
  single `app.whenReady().then(...)` block. IPC handlers register
  before `createWindow()`. **Sentry.init() slots in at the top
  of the `whenReady` callback, before IPC and before the window
  exists**, so any error during the rest of init is captured.
- **No application menu exists today.** No
  `Menu.setApplicationMenu(...)` call anywhere in `src/main/`.
  We need to create one. The Help → Report a bug entry is the
  excuse; we should also include the platform-standard
  edit / view / window menus so users on macOS get the expected
  experience (cmd+Q, cmd+W, cmd+M, copy/paste in inputs, etc.).
- **`@sentry/electron`** is the right SDK — it transparently
  handles main, renderer, and utility processes in one
  initialisation. Pure-`@sentry/node` would miss renderer
  crashes; pure-`@sentry/browser` would miss main-process
  ones.
- **No `.env.example` or env-var docs** exist today. We'll add
  one as part of this work.

What's NOT there yet:

- No `sentryOptIn` (or equivalent) preference in
  `settings.json`.
- No Sentry SDK install.
- No first-launch opt-in dialog.
- No "Privacy" section in the Settings panel.
- No application menu.
- No GitHub issue template (`.github/ISSUE_TEMPLATE/bug_report.md`).

---

## Non-goals for this story

- **Custom error UI inside Scamp.** Sentry catches crashes; we
  don't show users a "something went wrong" dialog. The crash
  goes silently to Sentry (if opted in) and the user proceeds.
  Adding a panic UI is its own story.
- **Replay or session-tracking features.** Sentry offers
  Session Replay (records DOM mutations) and Performance
  Monitoring (transaction sampling). Both collect more than we
  want for a privacy-conscious tool. Off in `Sentry.init()`.
- **User feedback widget.** Sentry has a built-in feedback
  modal. The story spec uses GitHub issues instead — better
  trail of public-record bug reports, no third-party widget
  loading in-app.
- **Source-map upload for symbolicated stacks.** Non-trivial CI
  step, deferred per "Optional / future" section above.
- **Anonymous user IDs.** Some apps generate a stable random
  ID at install time and send it with each event so multiple
  reports from the same install group correctly in Sentry.
  Privacy-conscious tools usually skip this and accept the
  worse grouping. We skip.
- **Native crash reporting** (Electron's `crashReporter`
  module, separate from Sentry's renderer crash capture).
  `@sentry/electron` covers this internally via Electron's
  Crashpad/Breakpad integration — we don't need to wire
  `crashReporter` separately.
- **In-app changelog / release notes.** Out of scope; the
  Report-a-bug link gives the user a path to the repo where
  they can see commits / releases if they want.

---

## Data model — extend `settings.json`

```ts
// src/main/ipc/settings.ts

export type Settings = {
  defaultProjectsFolder: string | null;
  artboardBackground: string;
  /**
   * Crash-reporting consent. `null` means the user hasn't been
   * asked yet — the opt-in prompt fires. `true` means Sentry is
   * initialised; `false` means it is not (and no SDK code runs).
   */
  sentryOptIn: boolean | null;
};
```

The `null` tri-state is the trigger for the first-launch
prompt: a fresh install reads `sentryOptIn: null` (defaulted
in the read path when the key is absent) and the renderer
shows the opt-in modal before mounting `<StartScreen>`.

Read path: when `settings.json` is missing or doesn't have
the `sentryOptIn` key, default to `null` (NOT false). False
means "user said no"; null means "user hasn't been asked".

### Sentry SDK config

```ts
// src/main/sentry.ts

import * as Sentry from '@sentry/electron/main';
import { app } from 'electron';

export const initSentryIfOptedIn = (optedIn: boolean): void => {
  if (!optedIn) return;
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) {
    console.warn(
      '[sentry] SENTRY_DSN env var not set — crash reporting disabled'
    );
    return;
  }

  Sentry.init({
    dsn,
    release: `scamp@${app.getVersion()}`,
    environment: app.isPackaged ? 'production' : 'development',

    // Privacy — disable every feature that collects PII or
    // persistent identifiers.
    autoSessionTracking: false,
    sendDefaultPii: false,
    enableNative: true, // captures Chromium / Electron crashes
    integrations: (defaults) =>
      defaults.filter(
        (i) =>
          // The Console integration mirrors `console.error` /
          // `.warn` into breadcrumbs. We keep it — it's useful
          // for context — but the beforeSend below scrubs paths.
          // The User integration assigns a random user id to
          // each event. We strip it.
          i.name !== 'BrowserApiErrors' &&
          i.name !== 'OnUncaughtException'
      ),

    beforeSend(event) {
      // Strip every plausible PII surface before transmit.
      delete event.user;
      delete event.server_name;
      delete event.request;
      // Scrub absolute paths from breadcrumbs.
      if (event.breadcrumbs?.values) {
        event.breadcrumbs.values = event.breadcrumbs.values.map(
          (b) => ({
            ...b,
            message: scrubPaths(b.message),
            data: undefined,
          })
        );
      }
      // Scrub paths from the exception value + stack frames'
      // `filename` fields. Sentry's symbolicator strips most of
      // them but we belt-and-braces it.
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          ex.value = scrubPaths(ex.value);
          if (ex.stacktrace?.frames) {
            for (const f of ex.stacktrace.frames) {
              f.filename = scrubPaths(f.filename);
              f.abs_path = undefined;
            }
          }
        }
      }
      return event;
    },
  });
};

const scrubPaths = (s: string | undefined): string | undefined => {
  if (!s) return s;
  return s
    .replace(/\/Users\/[^/]+/g, '/Users/[redacted]')
    .replace(/\/home\/[^/]+/g, '/home/[redacted]')
    .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[redacted]');
};
```

### Init order in `src/main/index.ts`

The Sentry SDK must be initialised **before** anything else that
could throw, so the very first lines of `app.whenReady()` read:

```ts
app.whenReady().then(async () => {
  // Read the saved opt-in synchronously before anything else.
  // The settings.json read is normally async via IPC, but at
  // startup we need a sync read — see `readSettingsSync` in
  // src/main/ipc/settings.ts.
  const initialSettings = readSettingsSync();
  initSentryIfOptedIn(initialSettings.sentryOptIn === true);

  // ... existing init (nativeTheme, protocol, IPC, menu, window) ...
});
```

The `readSettingsSync()` is a new sync sibling of the existing
async read. It uses `fs.readFileSync` + try/catch; on any
failure (missing file, malformed JSON) returns defaults with
`sentryOptIn: null`.

---

## Opt-in dialog (first-launch prompt)

### Why renderer-side rather than native dialog

Two options:

- **Native dialog** via `dialog.showMessageBox()` in main, before
  the BrowserWindow opens. Pro: truly blocking, can't be missed.
  Con: OS-default chrome doesn't match Scamp's aesthetic, can't
  show rich copy, and we'd need IPC to feed the choice back into
  settings.json.
- **Renderer-side modal** rendered as the first thing the
  React tree paints, before `<StartScreen>`. Pro: full design
  control, matches the rest of the UI. Con: the BrowserWindow is
  visible for a few frames while React mounts and decides what
  to show.

**Recommend renderer-side.** The Sentry SDK isn't initialised
before the user decides, so the few-frame window where the
window is visible but the modal isn't is harmless — no events
can fire. The styled modal is a much better first impression
than an OS dialog.

### `SentryOptInPrompt.tsx`

A new full-screen overlay component rendered by `App.tsx` when
`settings.sentryOptIn === null`. Modeled on `ConfirmDialog`
(same backdrop hook, similar chrome).

```tsx
// src/renderer/src/components/SentryOptInPrompt.tsx

type Props = {
  onDecision: (optedIn: boolean) => Promise<void>;
};

export const SentryOptInPrompt = ({ onDecision }: Props): JSX.Element => {
  // ... copy from the backlog spec verbatim:
  //
  //   "Help improve Scamp
  //    Send anonymous crash reports when something goes wrong.
  //    No personal data, no project files, no file contents —
  //    only error details and your OS and app version.
  //    You can change this at any time in Settings."
  //
  // Two buttons: [Send crash reports] (primary), [No thanks]
  // (secondary). Pressing Enter chooses primary; Escape chooses
  // secondary (treats "no decision yet" as "no").
};
```

### Mounting in `App.tsx`

```tsx
const App = (): JSX.Element => {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void window.scamp.getSettings().then(setSettings);
  }, []);

  if (settings === null) {
    return <div className={styles.bootstrap} />; // brief blank
  }

  if (settings.sentryOptIn === null) {
    return (
      <SentryOptInPrompt
        onDecision={async (optedIn) => {
          await window.scamp.updateSettings({ sentryOptIn: optedIn });
          setSettings({ ...settings, sentryOptIn: optedIn });
          // The renderer can't init Sentry retroactively for the
          // main process — the user has to relaunch for Sentry
          // to start collecting. Document this in the toggle's
          // tooltip and the prompt's confirmation copy.
          //
          // OR: send an IPC to main that re-runs
          // `initSentryIfOptedIn(true)` in-place. Sentry.init()
          // is idempotent and safe to call after-the-fact.
        }}
      />
    );
  }

  // Normal app boot.
  return <ErrorBoundary><Router>{...}</Router></ErrorBoundary>;
};
```

### Late opt-in via IPC

The main process exposes a small IPC `app:re-init-sentry`
(naming TBD) that the renderer fires after a settings change.
The handler calls `initSentryIfOptedIn(newValue)`. Sentry's
SDK is safe to call multiple times; the second call replaces
the first hub. When the user toggles OFF mid-session, we
call `Sentry.close()` to stop transmitting.

---

## Settings panel — "Privacy" section

New section in `SettingsPage.tsx`, immediately below "General":

```tsx
<section className={styles.section}>
  <h2 className={styles.sectionTitle}>Privacy</h2>
  <div className={styles.row}>
    <div className={styles.rowLabel}>
      <label htmlFor="sentry-opt-in">Send anonymous crash reports</label>
      <p className={styles.rowHint}>
        Helps fix bugs faster. No personal data or project files are
        ever shared. <a href="https://scampdesign.app/privacy" target="_blank" rel="noopener noreferrer">Privacy policy</a>.
      </p>
    </div>
    <SegmentedControl<boolean>
      value={settings.sentryOptIn === true}
      options={[
        { value: true, label: 'On' },
        { value: false, label: 'Off' },
      ]}
      onChange={async (v) => {
        await window.scamp.updateSettings({ sentryOptIn: v });
        await window.scamp.reInitSentry();
        // refetch settings to re-render the toggle in the new state
      }}
    />
  </div>
</section>
```

Notes:

- The toggle uses the existing `SegmentedControl` for visual
  consistency.
- The privacy-policy link uses `target="_blank"` + the
  `rel="noopener noreferrer"` Scamp already uses elsewhere.
  Electron forwards external links to the OS default browser
  via the existing `webContents.setWindowOpenHandler` if it's
  set up; otherwise add it to the main window config.
- Changing the toggle re-runs `initSentryIfOptedIn` in main,
  so the change takes effect immediately. No restart.

---

## Help menu — Report a bug

### Application menu

Create `src/main/menu.ts`. The Help submenu has one extra item;
the rest of the menu uses Electron's platform-standard
`role`-based entries so users get expected behaviour
(Edit > Copy/Paste/Cut, Window > Close/Minimize, App quit,
etc.).

```ts
import { Menu, app, shell, type MenuItemConstructorOptions } from 'electron';
import * as os from 'os';

const buildBugReportUrl = (): string => {
  const version = app.getVersion();
  const osLabel = `${process.platform} ${os.release()}`;
  const body = [
    `**App version:** ${version}`,
    `**OS:** ${osLabel}`,
    '',
    '## Steps to reproduce',
    '',
    '## Expected behaviour',
    '',
    '## Actual behaviour',
    '',
    '## Screenshots',
    '',
  ].join('\n');
  const params = new URLSearchParams({
    template: 'bug_report.md',
    labels: 'bug',
    body,
  });
  // TODO: confirm the canonical repo URL — placeholder below.
  return `https://github.com/angiehemans/scamp/issues/new?${params}`;
};

export const buildApplicationMenu = (): Menu => {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    // macOS-only app menu (Scamp > About / Quit etc.)
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Report a bug',
          click: () => void shell.openExternal(buildBugReportUrl()),
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
};
```

Register from `src/main/index.ts` inside `app.whenReady`:

```ts
Menu.setApplicationMenu(buildApplicationMenu());
```

### GitHub issue template

New file `.github/ISSUE_TEMPLATE/bug_report.md`:

```md
---
name: Bug report
about: Report a bug in Scamp
labels: bug
---

**App version:**
**OS:**

## Steps to reproduce

## Expected behaviour

## Actual behaviour

## Screenshots
```

The menu URL pre-fills the body, but the template tags the
issue with `bug` and gives the user a structured form if they
arrive at the new-issue page some other way.

---

## Privacy / PII scrubbing — what we promise vs. what we send

| Field | Sent to Sentry? | Notes |
|---|---|---|
| Error message + stack | ✅ | Path prefixes scrubbed by `beforeSend` |
| Scamp app version | ✅ | Set as `release` |
| OS name + version | ✅ | Sentry SDK adds; no scrub needed |
| Electron / Chromium version | ✅ | Standard SDK context |
| File paths (absolute) | ❌ | Scrubbed in `beforeSend` |
| Project / page name | ❌ | Not in stack traces; if we ever add error context tags, they go through `beforeSend` |
| Element / canvas state | ❌ | We never call `Sentry.setContext` with it |
| User name / IP | ❌ | `sendDefaultPii: false` + `setUser` never called + IP scrubbing on at Sentry side |
| Anonymous install ID | ❌ | We don't generate one |
| Breadcrumbs from `console.*` | ✅ (paths scrubbed) | Console integration kept on for debug context |
| Breadcrumb `data` payloads | ❌ | Whole `data` object dropped in `beforeSend` to be safe |
| Session replay / DOM | ❌ | Integration not loaded |
| Performance traces | ❌ | Integration not loaded |

This list goes into the privacy policy doc.

---

## Tests

### Unit tests

New file: `test/sentry.test.ts`. The Sentry SDK is heavy; we
test the small surface we own.

```ts
describe('scrubPaths', () => {
  it('redacts macOS user paths', () => {});
  it('redacts Linux home paths', () => {});
  it('redacts Windows user paths', () => {});
  it('leaves Scamp-internal paths intact (`/Applications/Scamp.app/...`)', () => {});
  it('returns undefined unchanged', () => {});
});

describe('initSentryIfOptedIn', () => {
  it('no-ops when optedIn is false', () => {
    // mock Sentry.init; assert not called
  });
  it('warns and no-ops when DSN env var is missing', () => {});
  it('calls Sentry.init with the configured release tag when optedIn=true and DSN present', () => {});
});

describe('readSettingsSync', () => {
  it('returns defaults with sentryOptIn=null when file is missing', () => {});
  it('returns defaults with sentryOptIn=null when file is malformed JSON', () => {});
  it('returns the stored optIn value when present', () => {});
});
```

### Integration tests

Extend an existing settings integration test (or add
`test/integration/sentryOptIn.integration.test.ts`):

- The opt-in pref round-trips through `getSettings` /
  `updateSettings`.
- A fresh `userData` folder reads as `sentryOptIn: null`.
- Setting to `true` then `false` toggles the value.

### E2E test (Playwright)

A new `test/e2e/settings/sentry-opt-in.spec.ts`:

- On a fresh project the opt-in prompt is visible.
- Clicking "No thanks" dismisses the prompt and stores `false`.
- Reopening the app doesn't re-prompt.
- Toggling the Privacy switch in Settings updates the pref.

We don't test that Sentry actually transmits — that would
require either mocking the network or pointing at a test DSN,
both more trouble than they're worth. The unit tests cover the
init-decision logic; observing the network call is out of
scope.

---

## Implementation order

Bottom-up. Each step ships green tests before the next.

1. **Manual Sentry setup** (you, on the website) — items 1–4
   in the Manual Steps section above. End state: you have a
   working DSN in a `.env.local` at the project root.

2. **Settings shape extension.** Add `sentryOptIn: boolean | null`
   to the `Settings` type in `src/main/ipc/settings.ts`. Add
   `readSettingsSync()`. Default value `null` on missing key.
   Unit tests for the sync read.

3. **`@sentry/electron` install.** `npm install @sentry/electron`
   (runtime dependency, NOT devDependency).

4. **Sentry init module.** `src/main/sentry.ts` with
   `initSentryIfOptedIn(optedIn)` and the `scrubPaths` helper.
   Unit tests for `scrubPaths` and the no-op branches of
   `initSentryIfOptedIn`.

5. **Wire init into `src/main/index.ts`.** Top of `whenReady`
   callback: read settings sync, call
   `initSentryIfOptedIn(settings.sentryOptIn === true)`. Add an
   IPC `app:re-init-sentry` that re-runs the init with the
   current settings — used by the renderer when the toggle
   changes.

6. **Opt-in prompt component.** `SentryOptInPrompt.tsx`. Wire
   into `App.tsx` to render BEFORE `<StartScreen>` when
   `settings.sentryOptIn === null`. The decision writes
   settings + calls the re-init IPC + re-renders the app
   normally.

7. **Settings → Privacy section.** Add the new section to
   `SettingsPage.tsx`. Use the existing `SegmentedControl`.
   Calls `updateSettings` + the re-init IPC.

8. **Application menu.** New `src/main/menu.ts`. Register in
   `whenReady`. Includes platform-standard menus plus
   Help → Report a bug. The bug URL is built in main from
   `app.getVersion()` + `os.release()` and opened via
   `shell.openExternal`.

9. **GitHub issue template.**
   `.github/ISSUE_TEMPLATE/bug_report.md`.

10. **Env / docs.** Add `.env.example` at repo root with
    `SENTRY_DSN=` (empty). Add a `docs/dev/sentry.md` (or a
    section in the existing README) explaining: get a DSN, put
    it in `.env.local`, restart `npm run dev`.

11. **Privacy policy page** at `scampdesign.app/privacy` (or
    wherever the site lives). The Settings toggle's hint links
    there. **This is content work and lives outside this
    plan**, but call it out in the implementation PR so it
    doesn't get forgotten.

12. **Tests** (interleaved with each step above as noted).

13. **Hand-test** the full flow:
    - Fresh `userData` (delete `~/.config/scamp` or
      equivalent): prompt appears, choose "No thanks", verify
      Sentry never initialises (no
      `[sentry] SENTRY_DSN env var not set` log and no `init`
      call).
    - Fresh `userData`: prompt appears, choose "Send", verify
      Sentry initialises (log line confirms DSN present,
      ideally trigger a synthetic error to see it appear in
      the Sentry dashboard).
    - Settings → Privacy toggle: flips the pref, takes effect
      immediately (verify by triggering a synthetic error
      after toggling on; verify nothing transmits after
      toggling off).
    - Help → Report a bug: opens the GitHub new-issue page in
      the OS default browser with version + OS pre-filled.

---

## Risks and edge cases

- **`@sentry/electron` package size.** Adds ~500 KB to the
  packaged app (the SDK has main + renderer + utility bundles
  + native crash plumbing). For a design tool this is
  negligible, but worth noting if bundle size becomes a
  concern.
- **DSN absent in dev.** If a contributor clones the repo
  without setting `SENTRY_DSN`, the opt-in flow still works —
  the user is asked, opts in or out, settings are saved — but
  `initSentryIfOptedIn` silently no-ops because the DSN is
  missing (with a `console.warn`). Document this in
  `.env.example`.
- **Idempotent re-init.** The renderer fires
  `app:re-init-sentry` after every Privacy-toggle change.
  Sentry's docs say `init` is safe to call more than once; new
  calls replace the active hub. We should still test the off→on
  and on→off transitions to confirm there's no breadcrumb leak
  across the boundary.
- **Crashes during `Sentry.init`.** If the init itself throws
  (bad DSN format, env var corruption), the wrapping
  `try / catch` keeps the app starting. Add it.
- **Renderer crashes before settings load.** App.tsx mounts and
  immediately calls `getSettings()`; the bootstrap state shows
  a blank screen for ~30ms. If the renderer crashes during
  that window, Sentry catches it because main-process init
  already ran. Good.
- **Privacy-policy URL placeholder.** Until the policy is
  published, the toggle hint links to a 404. Implementation
  PR should ship a draft of the policy page in parallel, or
  the link hides until it's live.
- **Repo URL placeholder.** `buildBugReportUrl` uses a
  TODO-marked GitHub URL. Confirm the canonical repo (likely
  `angiehemans/scamp`) before merging.
- **Linux portal weirdness.** Unrelated to Sentry's own
  reliability, but Linux users on Wayland might see the
  external-link open via xdg-open into something unexpected.
  Standard `shell.openExternal` behaviour; the alternative
  (open in an in-app browser frame) is worse for security.
- **Existing console.errors will become breadcrumbs.** The
  Console integration captures `console.error` / `.warn` into
  breadcrumbs. Scamp has a few of these already (notably the
  `[main] uncaught exception:` handler). They'll show up in
  Sentry events as breadcrumbs — useful context, no PII risk
  since the messages don't include user data.

---

## Open questions for review

1. **Repo URL for the bug-report link.** My plan uses
   `https://github.com/angiehemans/scamp` as a placeholder.
   Confirm — or supply the actual URL. - yes

2. **Privacy-policy URL.** The Settings hint links to
   `scampdesign.app/privacy`. If that page doesn't exist yet,
   the link goes to a 404. Two options:
   - Hide the link until the page is live (recommended for
     v1).
   - Ship the toggle without a link and add it later.
   Confirm which.

3. **Restart-required vs. live re-init.** My plan does live
   re-init on toggle change (via the `app:re-init-sentry` IPC).
   Alternative: tell the user "restart Scamp for this change
   to take effect" and skip the IPC. Live re-init is more
   user-friendly but adds a small surface for the off→on
   transition to leak breadcrumbs collected during the off
   phase. Recommend live re-init; confirm. yes live re-init

4. **Default for `sendDefaultPii`.** Off, as the plan shows.
   But the Sentry SDK has a setting `sendDefaultPii` that
   defaults to false for `@sentry/electron`. Belt-and-braces:
   set it explicitly to false in `Sentry.init()` so it's
   visible in the source. Confirm OK with the redundancy. OK

5. **Sample rate.** The free Sentry tier caps events at 5,000
   per month. For a small user base this is fine; if Scamp
   grows we might want to set `sampleRate: 0.5` (drop half)
   to stay under the cap. Recommend NOT setting it for v1 —
   we want every crash now while the surface is small.
   Confirm. agreed

6. **Renderer process Sentry.** `@sentry/electron` handles
   renderer-side automatically via `@sentry/electron/renderer`
   — but you have to call `Sentry.init({ dsn: ... })` in the
   renderer too. My plan currently only inits in main; should
   I add a renderer init in `src/renderer/src/main.tsx` for
   full coverage? Recommend yes — renderer is where most user
   code runs, so renderer-side crashes are what we'd want
   visibility into. Confirm. agreed

7. **Help menu — keyboard shortcut for "Report a bug".** No
   shortcut by default. If you want one, what should it be?
   Recommend no shortcut — bug-report is rare-use; menu entry
   is enough. agreed

8. **Bug-report URL pre-fill: include console logs?** The
   GitHub URL can pre-fill the body with the last N console
   messages so the user doesn't have to copy them by hand.
   Two trade-offs: (a) we'd need to mirror Scamp's renderer
   console somewhere main can read it; (b) the user might
   include data they didn't mean to. Recommend NOT including
   logs in the pre-fill; users paste what they want.
   Confirm. agreed 
