# Why the sign-in loopback server destroys its connections

`src/main/auth/loopbackServer.ts`

## The incident

A desktop sign-in against the local backend completed end to end: the
browser hit `/callback`, the confirmation page rendered, the code was
exchanged for a session token, and the encrypted token was written to
`auth-token.bin`. The app still showed "Waiting for browser…" — and would
have forever.

Everything had worked. The failure was in the shutdown afterwards.

## The cause

`signIn` closes the loopback listener in a `finally`, and awaits it:

```ts
await new Promise<void>((resolve) => server.close(() => resolve()));
```

`server.close` stops accepting new connections and fires its callback once
every **existing** connection has ended. A browser leaves more connections
open than the one it made the request on — Chrome speculatively
preconnects, so there is a socket sitting there having sent no request at
all.

Node does not treat a socket that has never carried a request as idle, so
it is never reaped:

- `server.closeIdleConnections()` does **not** close it (verified).
- `server.close()` therefore waits on it indefinitely.

The awaited promise never settles, so `signIn` never returns, so the IPC
`invoke` never resolves, so the renderer's `await` never comes back.

Node ≥ 19 closes idle *keep-alive* connections on `close`, which is why
the request socket alone was not the problem. The preconnect socket is.

## The fix

Three parts, each doing something the others do not:

1. `server.closeAllConnections()` before `server.close()` — the only call
   that reaps a never-used socket.
2. `connection: close` on both responses, so a browser that honours it
   drops the request socket itself rather than pooling it.
3. `settle` moved into the `res.end` callback, so the confirmation page has
   flushed before anything downstream can destroy the socket it is going
   out on. Without this, the ordering is: reply → exchange → destroy, with
   nothing guaranteeing the reply reached the wire first.

## Why the tests missed it

`test/authService.test.ts` drives the browser half with `fetch`, which
opens exactly one connection and never preconnects. The listener closed
cleanly every time. The regression test in
`test/authLoopbackAndExchange.test.ts` now opens a bare socket with
`net.connect` and sends nothing, which is what a browser actually does.

## The general shape

A resource cleanup in a `finally` that is awaited will hang the operation
it was meant to tidy up after. `server.close`, `stream.end`, and anything
else that waits for peers to cooperate can block on a peer that never
does. If a close is awaited on a user-visible path, it needs a way to
finish that does not depend on the other end behaving.
