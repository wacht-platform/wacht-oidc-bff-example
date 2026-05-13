/**
 * GET /api/auth/login — start the OIDC flow.
 *
 * Generates PKCE + state + nonce, stashes them server-side keyed by
 * `state`, then 302-redirects to Wacht's `/oauth/authorize`. The browser
 * never sees the verifier or the OAuth host until Wacht renders.
 */

import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import {
    getConfig,
    REDIRECT_URI,
    randomPKCECodeVerifier,
    calculatePKCECodeChallenge,
    randomState,
    randomNonce,
} from "@/lib/oidc";
import { rememberHandshake } from "@/lib/session";

export async function GET(req: NextRequest) {
    const config = await getConfig();

    const verifier = randomPKCECodeVerifier();
    const challenge = await calculatePKCECodeChallenge(verifier);
    const state = randomState();
    const nonce = randomNonce();

    rememberHandshake(state, { verifier, nonce });

    const params: Record<string, string> = {
        redirect_uri: REDIRECT_URI,
        scope: "openid profile email offline_access",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        nonce,
    };

    // Forward optional /authorize tweaks the caller asked for.
    for (const key of ["prompt", "max_age", "login_hint", "ui_locales"]) {
        const value = req.nextUrl.searchParams.get(key);
        if (value) params[key] = value;
    }

    const authorizeUrl = client.buildAuthorizationUrl(config, params);
    return NextResponse.redirect(authorizeUrl);
}
