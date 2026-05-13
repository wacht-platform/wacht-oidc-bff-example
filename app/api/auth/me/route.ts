/**
 * GET /api/auth/me — return the signed-in user to the UI.
 *
 * Refreshes the access_token transparently when it's close to expiry.
 * Tokens never appear in the response, only safe id_token claims.
 */

import { NextResponse } from "next/server";
import * as client from "openid-client";
import { getConfig } from "@/lib/oidc";
import {
    destroySessionViaCookies,
    getSession,
    updateSession,
} from "@/lib/session";

const REFRESH_THRESHOLD_MS = 60 * 1000;

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ signedIn: false }, { status: 401 });
    }

    if (
        session.refreshToken &&
        session.accessTokenExpiresAt - Date.now() < REFRESH_THRESHOLD_MS
    ) {
        try {
            const config = await getConfig();
            const tokens = await client.refreshTokenGrant(
                config,
                session.refreshToken,
            );
            await updateSession({
                accessToken: tokens.access_token,
                accessTokenExpiresAt: Date.now() + (tokens.expires_in ?? 0) * 1000,
                refreshToken: tokens.refresh_token ?? session.refreshToken,
                idToken: tokens.id_token ?? session.idToken,
                idClaims: tokens.claims() ?? session.idClaims,
            });
        } catch {
            // Refresh failed (revoked session, rotated refresh token, etc).
            // Drop the BFF session — UI will get 401 and re-auth.
            await destroySessionViaCookies();
            return NextResponse.json({ signedIn: false }, { status: 401 });
        }
    }

    const current = await getSession();
    if (!current?.idClaims) {
        return NextResponse.json({ signedIn: false }, { status: 401 });
    }

    return NextResponse.json({
        signedIn: true,
        user: {
            sub: current.idClaims.sub,
            name: current.idClaims.name,
            given_name: current.idClaims.given_name,
            family_name: current.idClaims.family_name,
            email: current.idClaims.email,
            email_verified: current.idClaims.email_verified,
            picture: current.idClaims.picture,
        },
    });
}
