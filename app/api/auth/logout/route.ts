/**
 * POST /api/auth/logout — RP-Initiated Logout.
 *
 * Drops the local BFF session and 303-redirects the browser to Wacht's
 * `/oauth/logout` with the id_token_hint, so Wacht can cascade the
 * revocation across every token tied to the user's Wacht session.
 *
 * Browsers follow a 303 from a POST as a GET automatically — the form
 * submit handles all navigation; no client-side JS needed.
 */

import { NextResponse } from "next/server";
import * as client from "openid-client";
import { getConfig, POST_LOGOUT_REDIRECT_URI } from "@/lib/oidc";
import { destroySession, getSession } from "@/lib/session";

export async function POST(req: Request) {
    const session = await getSession();

    if (!session?.idToken) {
        const response = NextResponse.redirect(new URL("/", req.url), 303);
        await destroySession(response);
        return response;
    }

    const config = await getConfig();
    const url = client.buildEndSessionUrl(config, {
        id_token_hint: session.idToken,
        post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
    });

    const response = NextResponse.redirect(url.toString(), 303);
    await destroySession(response);
    return response;
}
