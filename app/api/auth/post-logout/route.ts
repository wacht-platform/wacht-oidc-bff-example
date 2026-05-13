/**
 * GET /api/auth/post-logout
 *
 * Wacht redirects the user back here after RP-Initiated Logout has
 * completed on its side. The session was already destroyed when we built
 * the logout URL; this handler just lands the user back at the home page.
 */

import { NextResponse } from "next/server";

export async function GET(req: Request) {
    return NextResponse.redirect(new URL("/", req.url));
}
