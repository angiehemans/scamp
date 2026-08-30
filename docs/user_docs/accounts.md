# Accounts

You can sign in to a Scamp account from the start screen. It is entirely
optional — Scamp is a local-first tool and every feature works the same
whether you are signed in or not. Nothing prompts you on launch, and
there is nothing to dismiss.

## Signing In

The account panel sits at the foot of the sidebar on the start screen,
below your projects. Signing in is an account-level act rather than a
per-project one, which is why it lives here rather than inside an open
project.

1. Click **Sign in** at the bottom of the start-screen sidebar.
2. Your browser opens at scamp.club. Sign in there, or create an account.
3. The browser hands the result back to Scamp automatically. The panel
   fills in with your name and email.

While it is waiting, the button reads **Waiting for browser…**, with
"Finish signing in in your browser." and a **Cancel** link below it.
Cancel stops waiting immediately — you do not have to close the browser
tab or wait anything out.

If you never finish in the browser, the attempt gives up after 15 minutes
and the panel returns to signed out.

## Once You're Signed In

The panel shows an avatar with your initial, your name, your email, and a
**Sign out** link. Long email addresses are shortened so they can't widen
the sidebar.

Signing in or out updates every open Scamp window, not just the one you
did it in.

### What an account currently does

Being signed in does not change how you design. Scamp still stores every
project as ordinary files on your machine, still works offline, and still
never uploads your work. Today an account exists so that:

- Your installation is counted as active while the app is open.
- Cloud features can be added later without asking you to sign in again.

Your projects, page contents, images, and project names are never sent
anywhere as part of this.

## How Long a Session Lasts

Sessions last 30 days and renew every time you use them, so they expire
from disuse rather than on a fixed date. In practice, using Scamp
regularly means you stay signed in.

If your session does expire, Scamp signs you out locally rather than
leaving the panel claiming you are signed in until you restart.

## Where Your Sign-In Is Stored

Scamp stores the session token encrypted by your operating system's own
secure storage (Keychain on macOS, DPAPI on Windows, your keyring on
Linux). It is held by the app's main process and never reaches the part
of Scamp that renders your designs.

Some systems can't provide secure storage — a Linux machine without a
keyring, most commonly. When that happens Scamp signs you in for the
current session only and tells you so directly:

> This device can't store your sign-in securely, so you'll need to sign
> in again next time you open Scamp.

You stay signed in until you quit. Nothing is written to disk unencrypted.

## Signing Out

Click **Sign out** in the account panel. The stored token is deleted from
your machine immediately, and every open window updates.

## One Window at a Time

Scamp now runs as a single instance. Launching it again focuses the
window you already have rather than opening a second copy. This is what
lets the browser hand a completed sign-in back to a known place.

## Troubleshooting

**The browser opened but nothing happened when I signed in.**
Check that you completed sign-in in the browser window Scamp opened
rather than an existing tab already logged in elsewhere. If the panel is
still waiting, click **Cancel** and try again.

**Sign-in says it failed with no obvious reason.**
The panel shows the reason underneath the button. A network error or an
unreachable server both surface here. Trying again is safe.

**I signed in but I'm signed out again after restarting.**
Your OS could not store the token securely — the panel says so while you
are signed in. See [Where Your Sign-In Is Stored](#where-your-sign-in-is-stored).

## Related

- [Getting Started](getting-started.md) — the start screen
- [Settings](settings.md) — privacy and anonymous usage counting, which
  is separate from your account and controlled independently
