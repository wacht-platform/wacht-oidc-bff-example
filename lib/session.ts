/**
 * In-memory BFF session store. The browser holds only an opaque session id
 * in an httpOnly cookie; all token material lives in this process.
 *
 * Production note: swap both Maps for Redis / KV / Postgres so deploys and
 * multi-replica setups don't lose sessions on restart.
 */

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import type { IDToken } from "openid-client";

const SESSION_COOKIE = "bff_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24;
const HANDSHAKE_MAX_AGE_MS = 10 * 60 * 1000;

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
};

export type BffSession = {
    sessionId: string;
    accessToken: string;
    accessTokenExpiresAt: number;
    refreshToken?: string;
    idToken?: string;
    idClaims?: IDToken;
};

type PendingHandshake = {
    verifier: string;
    nonce: string;
    requestedAt: number;
};

// Hoist onto globalThis so `next dev` HMR doesn't wipe state on every
// code edit. In production the module initializes once and this is a no-op.
const globalStore = globalThis as unknown as {
    __bff_sessions?: Map<string, BffSession>;
    __bff_handshakes?: Map<string, PendingHandshake>;
};
const sessions = (globalStore.__bff_sessions ??= new Map<string, BffSession>());
const pendingHandshakes = (globalStore.__bff_handshakes ??= new Map<
    string,
    PendingHandshake
>());

export function rememberHandshake(
    state: string,
    h: Omit<PendingHandshake, "requestedAt">,
): void {
    sweepHandshakes();
    pendingHandshakes.set(state, { ...h, requestedAt: Date.now() });
}

export function consumeHandshake(state: string): PendingHandshake | null {
    sweepHandshakes();
    const value = pendingHandshakes.get(state) ?? null;
    if (value) pendingHandshakes.delete(state);
    return value;
}

function sweepHandshakes(): void {
    const cutoff = Date.now() - HANDSHAKE_MAX_AGE_MS;
    for (const [key, value] of pendingHandshakes) {
        if (value.requestedAt < cutoff) pendingHandshakes.delete(key);
    }
}

/**
 * Cookies set via `next/headers` don't always stick to a
 * `NextResponse.redirect(...)` — setting them on the response object
 * directly is the reliable path.
 */
export function createSession(
    response: NextResponse,
    data: Omit<BffSession, "sessionId">,
): BffSession {
    const sessionId = randomBytes(32).toString("base64url");
    const session: BffSession = { sessionId, ...data };
    sessions.set(sessionId, session);
    response.cookies.set(SESSION_COOKIE, sessionId, COOKIE_OPTIONS);
    return session;
}

export async function getSession(): Promise<BffSession | null> {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!sessionId) return null;
    return sessions.get(sessionId) ?? null;
}

export async function updateSession(
    updates: Partial<BffSession>,
): Promise<BffSession | null> {
    const existing = await getSession();
    if (!existing) return null;
    const next = { ...existing, ...updates };
    sessions.set(existing.sessionId, next);
    return next;
}

export async function destroySession(response: NextResponse): Promise<void> {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (sessionId) sessions.delete(sessionId);
    response.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/** Use when the handler returns JSON, not a redirect (e.g. /api/auth/me). */
export async function destroySessionViaCookies(): Promise<void> {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (sessionId) sessions.delete(sessionId);
    jar.delete(SESSION_COOKIE);
}
