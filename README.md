# Wacht OIDC — Backend-for-Frontend reference

A minimal Next.js app demonstrating how to authenticate users through
[Wacht](https://wacht.io) using OpenID Connect, with all token material
held server-side.

The browser **never** sees the OAuth `access_token` or `refresh_token`. It
holds nothing but an opaque session id in an httpOnly cookie. Every
external call goes through this app's own API routes, which means:

- You can swap Wacht out later by changing one env var. The UI doesn't care.
- All authentication traffic flows through code you control, so logs and
  metrics are yours.
- You can rewrite the `/authorize` parameters server-side (extra scopes,
  audience tweaks, custom `prompt`) without touching the UI.

This is a standalone reference — it has no Wacht-specific SDK dependency.
Internally it uses [`openid-client`](https://github.com/panva/openid-client),
which is a spec-compliant OIDC client that works with any OP.

## What's in the box

| Path | What it does |
| --- | --- |
| `app/api/auth/login/route.ts`        | Starts the OIDC flow: builds PKCE + state + nonce, redirects to Wacht's `/oauth/authorize`. |
| `app/api/auth/callback/route.ts`     | Wacht 302s back here after consent. Exchanges the code for tokens, verifies the id_token (signature, issuer, audience, nonce), creates the BFF session. |
| `app/api/auth/me/route.ts`           | Returns the signed-in user to the UI. Refreshes the access_token transparently when it's near expiry. |
| `app/api/auth/logout/route.ts`       | Drops the local session and returns a URL the browser navigates to — Wacht's `/oauth/logout` with an `id_token_hint` so the logout cascade kills every dependent token. |
| `app/api/auth/post-logout/route.ts`  | Wacht's post-logout landing — just sends the user home. |
| `lib/oidc.ts`                        | Lazy `openid-client` configuration (discovery + JWKS). |
| `lib/session.ts`                     | In-memory session store keyed by an opaque cookie. **Swap for Redis / DB in production.** |
| `app/page.tsx`                       | Landing page. Routes signed-in users to the dashboard. |
| `app/dashboard/page.tsx`             | Server-rendered, gated on session. Shows the id_token claims and a sign-out button. |

## Setup

### 1. Register the OAuth client in Wacht

In the Wacht console, under your OAuth app, create a client:

1. **Auth method**: `none` (public client) — recommended for browser/SPA flows. PKCE is mandatory and replaces the client secret.
2. **Grant types**: `authorization_code`, `refresh_token`.
3. **Redirect URIs**: `http://localhost:3000/api/auth/callback` (and any other origins you deploy to).
4. **Post-logout redirect URIs**: `http://localhost:3000/api/auth/post-logout`.

Confidential clients work too — set `WACHT_CLIENT_SECRET` and the BFF
will pass it on every token call. PKCE remains active either way.

### 2. Configure env

```bash
cp .env.example .env.local
# then edit:
WACHT_OAUTH_HOST=<your-oauth-fqdn>
WACHT_CLIENT_ID=<your-client-id>
WACHT_CLIENT_SECRET=                # only if confidential
APP_URL=http://localhost:3000
```

### 3. Run it

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000> and click **Sign in with Wacht**.

## How it actually works

```
 ┌─────────┐   1. /api/auth/login
 │ Browser │ ─────────────────────────────┐
 └────┬────┘                              ▼
      │                          ┌────────────────┐
      │                          │  Next.js BFF   │ ── PKCE / state / nonce
      │                          │   (this app)   │    stored in memory
      │     302 to Wacht's       └───────┬────────┘
      │     /oauth/authorize             │
      │ ◀────────────────────────────────┘
      ▼
 ┌────────────┐
 │   Wacht    │  user signs in, approves consent
 └─────┬──────┘
       │ 302 back to /api/auth/callback?code=…
       ▼
 ┌─────────┐
 │ Browser │
 └────┬────┘  3. /api/auth/callback?code=…
      ▼
 ┌────────────────┐    POST /oauth/token (code, code_verifier)
 │  Next.js BFF   │ ─────────────────────────────────────────┐
 └────┬───────────┘                                          ▼
      │                                              ┌────────────┐
      │ access_token / refresh_token / id_token ◀────│   Wacht    │
      │                                              └────────────┘
      │ store in memory, set httpOnly cookie
      │ (session id only — no tokens leave the server)
      │
      ▼ 302 /dashboard
 ┌─────────┐
 │ Browser │  cookie: bff_session=<opaque>
 └─────────┘
```

When the UI calls `/api/auth/me`, the BFF reads the session, transparently
refreshes the access_token if it's near expiry, then returns just the
identity claims. The browser still never sees a token.

When the user clicks **Sign out**, the BFF clears its own session and
returns a URL pointing at Wacht's `/oauth/logout` with the id_token_hint.
The browser navigates there; Wacht cascades the logout server-side
(revoking the access_token, the refresh token family, and the Wacht
session itself) and finally redirects to `/api/auth/post-logout`.

## Mutating things on the way through

Anything you'd normally want to pass to the IdP — extra scopes, audience
indicators, custom `prompt`, hard-coded `login_hint` — happens in
`app/api/auth/login/route.ts`. The UI doesn't have to know about it.

For example, to silently retry the auth flow without showing consent
(e.g. background token refresh):

```ts
const authorizeUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "none",        // your call, not the UI's
});
```

## Production hardening

The defaults in this repo are deliberately the simplest thing that runs.
For production, do at least these:

1. **Persist sessions outside the process.** Swap the in-memory `Map` in
   `lib/session.ts` for Redis / KV / Postgres. Otherwise a deploy or
   restart logs everyone out.
2. **Encrypt token material at rest.** If your session store is shared,
   wrap the tokens with an AEAD scheme keyed to a secret only the BFF knows.
3. **Bind the session cookie to a single origin.** This repo uses
   `SameSite=Lax`; if you're on a different domain than your API, set
   `SameSite=None; Secure`.
4. **Handle refresh failures.** `/api/auth/me` already drops the session
   and returns 401 on a failed refresh — make sure your UI catches that
   and routes the user back through `/api/auth/login`.
5. **Don't log tokens.** They're sensitive; log only the session id
   and the user's `sub`.

## License

MIT.
