# Scamp — Auto-Update PRD

---

## Overview

This document covers everything needed to ship automatic updates for Scamp on
macOS (Apple Silicon), Windows, and Linux (AppImage). It is split into two
parts: manual prerequisite steps you need to complete before any code is
written, and the technical development requirements for implementing the update
system in the app.

The update mechanism uses **electron-updater** (part of the `electron-builder`
ecosystem already in use) with **GitHub Releases** as the update server.

---

## How it works

```
User launches Scamp
  → app checks GitHub Releases for a newer version
  → if found: downloads update in background silently
  → notifies user with an in-app prompt to restart and install
  → user clicks restart → new version launches
```

The app checks for updates once on launch and again every 4 hours while
running. Updates download silently in the background — the user is only
interrupted when the download is complete and ready to install.

---

## Part 1 — Manual Prerequisite Steps

These steps must be completed before the development work begins. Most are
one-time setup tasks.

---

### 1.1 GitHub repository setup

**Required before:** everything else.

1. Ensure the Scamp repository is on GitHub and you have admin access
2. Go to **Settings → Actions → General** and confirm GitHub Actions is enabled
3. Go to **Settings → Secrets and variables → Actions** — this is where all
   signing credentials will be stored (steps below)
4. Confirm that the account or organisation has sufficient GitHub Actions
   minutes for your plan (public repos have unlimited free minutes)

---

### 1.2 macOS code signing and notarization

**Required before:** macOS auto-updates work. Without signing and notarization,
macOS Gatekeeper will block the app on download and auto-updates will fail
silently on many machines.

**What you need:**

- An Apple Developer Program membership ($99/year)
  at [developer.apple.com](https://developer.apple.com)

**Step by step:**

1. **Enroll in the Apple Developer Program** if not already enrolled.
   Approval takes 24–48 hours for individuals.

2. **Create a Developer ID Application certificate** in Xcode or at
   [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates):
   - Certificate type: **Developer ID Application** (not Mac App Distribution)
   - Download and install the certificate into your local Keychain

3. **Export the certificate as a .p12 file:**
   - Open Keychain Access
   - Find the Developer ID Application certificate
   - Right-click → Export → save as `.p12`
   - Set a strong password — you will need this password again in step 5

4. **Convert the .p12 to base64** for storage in GitHub Secrets:

   ```bash
   base64 -i certificate.p12 | pbcopy
   ```

   This copies the base64 string to your clipboard.

5. **Add the following GitHub Actions secrets** in your repository
   (Settings → Secrets and variables → Actions → New repository secret):

   | Secret name          | Value                                                               |
   | -------------------- | ------------------------------------------------------------------- |
   | `MAC_CERTS`          | The base64 string from step 4                                       |
   | `MAC_CERTS_PASSWORD` | The .p12 export password from step 3                                |
   | `APPLE_ID`           | Your Apple ID email address                                         |
   | `APPLE_ID_PASSWORD`  | An app-specific password (see step 6)                               |
   | `APPLE_TEAM_ID`      | Your Apple Developer Team ID (found at developer.apple.com/account) |

6. **Create an app-specific password** for notarization:
   - Sign in at [appleid.apple.com](https://appleid.apple.com)
   - Security → App-Specific Passwords → Generate
   - Label it "Scamp notarization"
   - Copy the generated password — this is `APPLE_ID_PASSWORD` above

---

### 1.3 Windows code signing

**Required before:** Windows auto-updates work reliably. Without signing,
Windows SmartScreen will show a warning on download and auto-updates may be
blocked by some corporate security policies.

**What you need:**

- A code signing certificate from a trusted certificate authority
- Recommended providers: **DigiCert** (~$300/year), **Sectigo** (~$200/year)
- Certificate type: **Standard Code Signing Certificate**
  (not EV — EV requires a hardware token which complicates CI)

**Step by step:**

1. **Purchase a Standard Code Signing Certificate** from DigiCert or Sectigo.
   Verification takes 1–3 business days — they will verify your identity.

2. **Download and export the certificate** as a `.p12` or `.pfx` file from
   your certificate authority's portal once issued.

3. **Convert to base64:**

   ```bash
   base64 -i certificate.p12 | pbcopy
   ```

4. **Add the following GitHub Actions secrets:**

   | Secret name          | Value                           |
   | -------------------- | ------------------------------- |
   | `WIN_CERTS`          | The base64 string from step 3   |
   | `WIN_CERTS_PASSWORD` | The certificate export password |

---

### 1.4 GitHub Personal Access Token

**Required before:** electron-updater can publish releases.

electron-builder needs permission to publish release artifacts to GitHub
Releases during the CI build.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens**
2. Generate a new token with:
   - Repository access: Scamp repository only
   - Permissions: **Contents** → Read and write
3. Add to GitHub Actions secrets:

   | Secret name | Value                               |
   | ----------- | ----------------------------------- |
   | `GH_TOKEN`  | The generated personal access token |

---

### 1.5 Linux — no signing required

Linux AppImage auto-updates do not require code signing. No manual
prerequisites needed for Linux beyond the GitHub setup in step 1.1.

---

## Part 2 — Development Requirements

---

### 2.1 Dependencies

Add to `package.json`:

```json
"dependencies": {
  "electron-updater": "^6.x"
}
```

`electron-updater` is separate from `electron-builder` — it must be added
explicitly as a runtime dependency, not a dev dependency, since it runs inside
the packaged app.

---

### 2.2 electron-builder configuration

Update `electron.vite.config.ts` (or your `electron-builder` config file) to
add publish configuration and platform-specific signing:

```json
{
  "publish": {
    "provider": "github",
    "owner": "[your-github-org-or-username]",
    "repo": "scamp"
  },
  "mac": {
    "target": {
      "target": "dmg",
      "arch": ["arm64"]
    },
    "identity": "Developer ID Application: [Your Name] ([Team ID])",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist",
    "notarize": {
      "teamId": "[Your Apple Team ID]"
    }
  },
  "win": {
    "target": "nsis",
    "certificateSubjectName": "[Your Certificate Subject Name]"
  },
  "linux": {
    "target": "AppImage",
    "category": "Development"
  }
}
```

---

### 2.3 macOS entitlements file

Create `build/entitlements.mac.plist` — required for hardened runtime and
notarization:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
  </dict>
</plist>
```

---

### 2.4 Main process — auto-update logic

Create `src/main/updater.ts`:

```ts
import { autoUpdater } from "electron-updater"
import { BrowserWindow, dialog } from "electron"
import log from "electron-log"

const FOUR_HOURS = 4 * 60 * 60 * 1000

export const initAutoUpdater = (mainWindow: BrowserWindow): void => {
  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on("checking-for-update", () => {
    mainWindow.webContents.send("updater:checking")
  })

  autoUpdater.on("update-available", (info) => {
    mainWindow.webContents.send("updater:available", info)
  })

  autoUpdater.on("update-not-available", () => {
    mainWindow.webContents.send("updater:not-available")
  })

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("updater:progress", progress)
  })

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow.webContents.send("updater:downloaded", info)
  })

  autoUpdater.on("error", (err) => {
    log.error("Auto-updater error:", err)
    mainWindow.webContents.send("updater:error", err.message)
  })

  // Check on launch, then every 4 hours
  autoUpdater.checkForUpdatesAndNotify()
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, FOUR_HOURS)
}
```

Call `initAutoUpdater(mainWindow)` from `src/main/index.ts` after the window
is created and ready.

---

### 2.5 IPC channels

Add the following channels to `src/shared/ipcChannels.ts`:

```ts
export const UPDATER_CHANNELS = {
  CHECKING: "updater:checking",
  AVAILABLE: "updater:available",
  NOT_AVAILABLE: "updater:not-available",
  PROGRESS: "updater:progress",
  DOWNLOADED: "updater:downloaded",
  ERROR: "updater:error",
  INSTALL_NOW: "updater:install-now",
} as const
```

Add an IPC handler in `src/main/ipc/updater.ts` for the install-now action
(triggered when the user clicks "Restart and install" in the UI):

```ts
import { ipcMain } from "electron"
import { autoUpdater } from "electron-updater"
import { UPDATER_CHANNELS } from "../../shared/ipcChannels"

export const registerUpdaterHandlers = (): void => {
  ipcMain.on(UPDATER_CHANNELS.INSTALL_NOW, () => {
    autoUpdater.quitAndInstall()
  })
}
```

---

### 2.6 In-app update prompt (renderer)

When an update has been downloaded, show a non-intrusive prompt in the app UI.
This should appear as a small banner at the bottom of the window — not a modal,
not a blocking dialog.

**Banner states:**

| State            | Message                                 | Action                       |
| ---------------- | --------------------------------------- | ---------------------------- |
| Downloading      | `Downloading update…  X%`               | No action — progress only    |
| Ready to install | `Scamp [version] is ready to install`   | `Restart and install` button |
| Error            | `Update failed — check your connection` | `Dismiss` button             |

**Behaviour:**

- The banner slides up from the bottom when a download completes
- Dismissing it does not cancel the update — it installs silently on next
  launch via `autoInstallOnAppQuit`
- Clicking "Restart and install" sends `updater:install-now` via IPC and
  calls `autoUpdater.quitAndInstall()`
- The banner never appears mid-edit — if the save status indicator shows
  "Saving…", delay showing the banner until the status returns to "Saved"

---

### 2.7 GitHub Actions release workflow

Create `.github/workflows/release.yml`. This workflow runs when a version tag
is pushed, builds all three platform targets, signs them, and publishes to
GitHub Releases.

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      # macOS signing
      - name: Import macOS certificate
        if: matrix.os == 'macos-latest'
        run: |
          echo "$MAC_CERTS" | base64 --decode > certificate.p12
          security create-keychain -p "" build.keychain
          security import certificate.p12 -k build.keychain \
            -P "$MAC_CERTS_PASSWORD" -T /usr/bin/codesign
          security list-keychains -s build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "" build.keychain
          security set-key-partition-list -S apple-tool:,apple: \
            -s -k "" build.keychain
        env:
          MAC_CERTS: ${{ secrets.MAC_CERTS }}
          MAC_CERTS_PASSWORD: ${{ secrets.MAC_CERTS_PASSWORD }}

      # Windows signing
      - name: Import Windows certificate
        if: matrix.os == 'windows-latest'
        run: |
          echo "$WIN_CERTS" | base64 -d > certificate.p12
        shell: bash
        env:
          WIN_CERTS: ${{ secrets.WIN_CERTS }}

      - name: Build and publish
        run: npm run build && npx electron-builder --publish always
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          WIN_CERTS_PASSWORD: ${{ secrets.WIN_CERTS_PASSWORD }}
```

---

### 2.8 Release process

To ship a new version:

1. Update the version number in `package.json`
2. Update `CHANGELOG.md` with the release notes
3. Commit and push
4. Tag the release:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
5. GitHub Actions picks up the tag, builds all three platforms, signs and
   notarizes, and publishes to GitHub Releases automatically
6. Running instances of Scamp check for the new version on their next launch
   or 4-hour interval and download it in the background

---

## Summary of secrets required

| Secret               | Platform | Where obtained                               |
| -------------------- | -------- | -------------------------------------------- |
| `GH_TOKEN`           | All      | GitHub personal access token                 |
| `MAC_CERTS`          | macOS    | Exported .p12 from Keychain, base64 encoded  |
| `MAC_CERTS_PASSWORD` | macOS    | Password set when exporting .p12             |
| `APPLE_ID`           | macOS    | Apple Developer account email                |
| `APPLE_ID_PASSWORD`  | macOS    | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID`      | macOS    | Found at developer.apple.com/account         |
| `WIN_CERTS`          | Windows  | Exported .p12 from CA, base64 encoded        |
| `WIN_CERTS_PASSWORD` | Windows  | Password set when exporting .p12             |

---

## Platform notes

| Platform | Format       | Signing required                         | Auto-update support                   |
| -------- | ------------ | ---------------------------------------- | ------------------------------------- |
| macOS    | .dmg (arm64) | Yes — Developer ID + notarization        | Full                                  |
| Windows  | .exe (NSIS)  | Recommended — Standard code signing cert | Full                                  |
| Linux    | .AppImage    | No                                       | Full — AppImage self-updates natively |
