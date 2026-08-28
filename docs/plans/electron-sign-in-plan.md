# Sign in to a Scamp account from the app — Plan

Status: **answered, not started.** Waiting on local backend work before
implementation begins. Backlog v11, story 1.

## Context

Scamp works fully offline and should keep doing so. This adds an
opt-in account: a "Sign in" button in the toolbar, a browser round-trip
to the existing Better Auth backend, and a token stored in the OS
keychain. Cloud sync (story 2) depends on it; nothing else does.

The governing constraint is that **the signed-out app must not get
worse**. No blocking prompts, no network calls on launch for a user who
never signs in, no failure mode where a broken keychain stops someone
drawing rectangles.

---

## What already exists

Very little of this, which is worth knowing up front:

- **No protocol registration.** `setAsDefaultProtocolClient` appears
  nowhere, and `electron-builder.yml` has no `protocols` entry.
- **No single-instance lock.** `main/index.ts` never calls
  `requestSingleInstanceLock`. This matters more than it looks — see
  decision 2.
- **No `safeStorage` usage** anywhere in the codebase.
- **Settings persistence does exist** (`settingsOps.ts`,
  `DEFAULT_SETTINGS` + `parseSettingsBlob`), so there is a pattern for
  main-side JSON state, and `installId` shows the shape for a per-install
  identifier.
- **The IPC conventions are well established** — channel constants in
  `shared/ipcChannels.ts`, one handler file per domain in `main/ipc/`,
  payload types in `shared/types.ts`.

---

## Decisions

### 1. The token never touches the renderer

The renderer gets `{ signedIn, user }` and nothing else. The JWT lives in
the main process, is written through `safeStorage`, and is attached to
outbound requests by main-side code.

This is the difference between "a token in an encrypted store" and "a
token in an encrypted store that is also in a web page's memory". Story 2
will want to send authenticated requests; those should be main-side IPC
handlers, not `fetch` from the renderer with a token it was handed.

### 2. The callback needs a single-instance lock, and this is the part that usually breaks

On macOS a `scamp://` callback fires `open-url` on the running app. On
**Windows and Linux it launches a second copy of the app**, with the URL
in `process.argv`. Without `requestSingleInstanceLock()` plus a
`second-instance` handler, that second copy takes the token, does nothing
visible with it, and exits — the original window sits there still signed
out, with no error anywhere.

So this feature requires adding a single-instance lock to an app that has
never had one. That is a behaviour change in its own right (a second
launch now focuses the existing window rather than opening another), and
it should be verified on Windows and Linux specifically.

Handled in three places:

- `open-url` — macOS, app running or cold
- `second-instance` — Windows/Linux, app already running
- `process.argv` at startup — Windows/Linux, cold start from the link

### 3. A state nonce, because any app can claim `scamp://`

Custom protocol schemes are first-come, unverified, and OS-wide. Another
application can register `scamp://` and receive callbacks meant for us,
and a malicious local process can invoke `scamp://auth/callback?token=…`
with anything it likes.

So the flow generates a random `state` before opening the browser, holds
it in memory only, and **rejects any callback whose state does not
match**. That stops a replayed or forged callback injecting a token.
Single-use: the pending state is cleared as soon as a callback arrives,
matched or not.

This needs the backend to echo `state` back on the redirect — see the
manual tasks.

### 4. Refuse to store rather than store in plaintext

`safeStorage.isEncryptionAvailable()` returns false on a Linux box with
no keyring (and can on a misconfigured macOS keychain). Electron's
`encryptString` will still "work" there in some builds by falling back to
plaintext, which is exactly what the story says must not happen.

If encryption is unavailable: sign-in still completes for the session,
the token is held in memory only, and the user is told they will need to
sign in again next launch. Never a silent plaintext write.

### 5. Sessions expire on inactivity, not on a clock

Answering the question on open question 2: yes, this is a solved shape,
and it is the one to use. A session that never expires at all is
achievable and a bad idea — a stolen keychain entry would be permanent
access with no way to age it out. What you want is a **sliding window**:

- a **short-lived access token** (~1 hour) that main attaches to requests
- a **long-lived refresh token** (30–90 days) that **rolls forward every
  time it is used**

Use the app on Monday and the window moves to Monday+90. Use it every
week and it never expires. Stop using it entirely and it lapses after the
inactivity period. That is exactly "long sessions that only expire after
a period of inactivity", and it needs no compromise on security.

Better Auth expresses this natively: its session config has `expiresIn`
(the window) and `updateAge` (how often an active session is extended),
so a long `expiresIn` with a sensible `updateAge` is a sliding window
without custom code. **Worth confirming which token type the backend
issues for a desktop client** — Better Auth's default web sessions are
cookie-based, so a desktop flow usually wants its JWT/bearer plugin.
That's part of manual task 3.

Three things that make this safer on desktop than it would be in a
browser, and one that doesn't:

- the refresh token lives in the OS keychain, not in web storage
- it never reaches the renderer (decision 1)
- a short access-token lifetime means a server-side revocation takes
  effect within the hour
- but it *is* a real credential at rest, so the backend should support
  revocation — "sign out everywhere" — rather than relying on expiry
  alone

Refresh is attempted on launch and again on any 401. A failed refresh is
**passive**: the app drops to signed-out and the user finds out next time
they touch a cloud feature. No modal interrupts someone mid-drag, which
is the "never intrusive" rule from the story.

### 6. Signed-out is the default and costs nothing

No token file, no keychain read, no network on launch until the user
clicks Sign in. `auth:status` answers from memory after a single lazy
read on first request.

---

## Phases

**Phase 1 — the plumbing, no UI.** Protocol registration, the
single-instance lock, the three callback entry points, state generation
and validation, `safeStorage` read/write with the unavailable path. IPC
channels and types. Testable end to end by invoking the URL by hand
before any button exists.

**Phase 2 — token lifecycle.** Validate against the cloud API on first
use, silent refresh, expiry handling, sign-out clearing both the store
and memory.

**Phase 3 — UI.** Sign-in lives on the **start screen**, before a project
is opened — not in the project toolbar as the backlog story describes.
That is a deliberate departure and a better fit: signing in is an
account-level act, not a per-project one, and the start screen is where a
user already is when they are not mid-task. The signed-in identity
(avatar, name, sign-out, tier) belongs there too.

The project toolbar therefore gets nothing in this story. If a cloud
feature later needs per-project affordance — a sync toggle, story 2 —
that is its own decision.

Phase 1 is the risky part and the part worth reviewing closely; 3 is
mostly presentation.

---

## Files to touch

**New:** `src/main/auth/protocol.ts` (registration + the three entry
points), `src/main/auth/tokenStore.ts` (safeStorage wrapper),
`src/main/auth/state.ts` (nonce generation/validation, pure),
`src/main/ipc/auth.ts` (handlers),
`src/renderer/src/components/projectShell/AccountButton.tsx`,
`test/authState.test.ts`, `test/authTokenStore.test.ts`,
`test/e2e/auth/sign-in.spec.ts`.

**Modified:** `src/main/index.ts` (single-instance lock, protocol
handlers — the only invasive edit), `src/shared/ipcChannels.ts`,
`src/shared/types.ts`, `src/preload/index.ts`, `ProjectHeader.tsx`,
`electron-builder.yml` (`protocols` entry), `docs/user_docs/`,
`docs/CHANGELOG.md`.

## Tests

Pure and testable: state nonce generation and matching (including the
rejection cases), callback URL parsing (missing token, missing state,
wrong state, extra params, malformed URL), and the token store's
behaviour when encryption is unavailable.

Not unit-testable and needs manual verification: the OS actually routing
`scamp://` to the app. That is the part most likely to be wrong and least
likely to be caught by a test — see below.

An e2e can cover everything after the callback by invoking the handler
directly with a synthetic URL, which is worth having, but it does **not**
prove the OS registration works.

---

## Things I need you to do

These can't be done from here, and phase 1 is blocked on the first two.

1. **Allow the redirect on the backend.** `scamp://auth/callback` has to
   be in Better Auth's permitted redirect list, or the sign-in page will
   refuse to redirect to it. Non-http schemes are often rejected by
   default.

2. **Echo the `state` parameter back.** The sign-in page must return the
   `state` it was given, unmodified, on the callback URL. Without it,
   decision 3 is not possible and the callback is spoofable. If the
   backend can't do this, tell me and I'll write up the alternatives —
   they're all worse.

3. **Confirm the token contract:** what the JWT contains (is `name` and
   `email` in the claims, or does the app need a `/me` call?), its
   lifetime, and how refresh works — a refresh token, a silent re-auth,
   or a long-lived JWT. Decision 2 in phase 2 depends on the answer.

4. **Decide the sign-in URL per environment.** Production URL, and what
   a dev build should point at. I'd suggest an env var with a production
   default so a dev build can't accidentally hit prod.

5. **macOS signing.** `safeStorage` uses the Keychain, and an unsigned or
   ad-hoc-signed build gets a different keychain identity — tokens
   stored by one build may not be readable by the next. Worth confirming
   the release build signs consistently before we rely on it.

6. **Manual verification on all three platforms**, once phase 1 lands. I
   can test the callback handling, but not the OS routing. Specifically:
   clicking a `scamp://` link with the app **closed**, and with it
   **already running**, on macOS, Windows and Linux. The
   already-running case on Windows/Linux is the one decision 2 exists for
   and the one most likely to fail.

**No secrets are needed in the app.** This flow receives a token via
redirect; there is no client secret to embed, and there should not be —
anything shipped in the bundle is readable. If the backend expects a
client secret for this flow, that's a design problem worth raising before
implementation.

## Open questions

1. **Where does the account UI live?** The toolbar button is specified;
   the account panel less so. Settings has a natural home for it — or is
   it a popover from the avatar? I lean a popover for identity plus a
   Settings row for the detail.
   the sign in should be on the main page of the app before a project is opened
2. **What happens to an expired session mid-use?** Silently re-auth in
   the background if possible, or a passive "signed out" state the user
   notices when they next use a cloud feature? I lean passive — a modal
   interrupting someone's work fails the "never intrusive" rule.
   is there a way for app users to not have expired sessions or just very long sessions that only expired when theres a period of inactivity?
3. **Should sign-in be per-install or per-project?** Per-install is
   implied and is what I'd build, but story 2 syncs *projects*, so it's
   worth confirming one account per machine is the model. per install
4. **Does the single-instance lock need a carve-out?** Answered: no
   carve-out, and both instances should be signed in.

   Worth naming a tension in that pair. A single-instance lock means a
   second launch **focuses the existing window instead of starting a
   second copy** — so under it, two instances cannot exist, and "signed
   in on both" is satisfied trivially because there is only ever one.

   If genuinely running two copies at once matters, the lock cannot be a
   hard lock, and the Windows/Linux callback problem in decision 2 comes
   back — the second copy would receive the token and the first would
   never learn about it. Solvable (the copies would need to share auth
   state through a file watcher or a local socket) but materially more
   work.

   My reading is that you meant windows rather than OS processes, and
   that focusing the existing window is fine. **Flagging it because it is
   cheap to confirm now and expensive to discover in phase 1.**
