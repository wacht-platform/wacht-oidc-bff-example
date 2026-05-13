/**
 * GET /api/auth/callback — Wacht 302s back here with ?code=…&state=….
 *
 * Exchanges the code for tokens, verifies the id_token, persists the
 * session server-side, and redirects to /dashboard. Anything that fails
 * lands the user on /?error=… so the UI can surface a message.
 */

import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { getConfig } from "@/lib/oidc";
import { consumeHandshake, createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
    const failure = (reason: string) => {
        const url = new URL("/", req.url);
        url.searchParams.set("error", reason);
        return NextResponse.redirect(url);
    };

    const state = req.nextUrl.searchParams.get("state");
    if (!state) return failure("missing_state");
    const handshake = consumeHandshake(state);
    if (!handshake) return failure("state_not_recognized");

    if (req.nextUrl.searchParams.get("error")) {
        return failure(req.nextUrl.searchParams.get("error") ?? "oidc_error");
    }

    try {
        const config = await getConfig();
        // openid-client validates signature, issuer, audience, nonce, pkce,
        // and state in this single call. Pass a real WHATWG URL — req.nextUrl
        // is Next's wrapper and fails the library's instanceof check.
        const tokens = await client.authorizationCodeGrant(
            config,
            new URL(req.url),
            {
                pkceCodeVerifier: handshake.verifier,
                expectedNonce: handshake.nonce,
                expectedState: state,
            },
        );

        const idClaims = tokens.claims();
        if (!idClaims) return failure("missing_id_token");

        const response = NextResponse.redirect(new URL("/dashboard", req.url));
        createSession(response, {
            accessToken: tokens.access_token,
            accessTokenExpiresAt: Date.now() + (tokens.expires_in ?? 0) * 1000,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            idClaims,
        });
        return response;
    } catch (err) {
        console.error("[oidc] callback failed:", err);
        return failure("callback_failed");
    }
}
