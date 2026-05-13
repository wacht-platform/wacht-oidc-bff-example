/**
 * Server-only OIDC helpers. All Wacht communication funnels through
 * here — the browser never sees Wacht's OAuth host, the access_token,
 * the refresh_token, or the id_token.
 */

import * as client from "openid-client";

const OAUTH_HOST = required("WACHT_OAUTH_HOST");
const CLIENT_ID = required("WACHT_CLIENT_ID");
const CLIENT_SECRET = process.env.WACHT_CLIENT_SECRET;
const APP_URL = required("APP_URL");

export const REDIRECT_URI = new URL("/api/auth/callback", APP_URL).toString();
export const POST_LOGOUT_REDIRECT_URI = new URL(
    "/api/auth/post-logout",
    APP_URL,
).toString();

const ISSUER = new URL(`https://${OAUTH_HOST}`);

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

let configPromise: Promise<client.Configuration> | null = null;

export function getConfig(): Promise<client.Configuration> {
    if (!configPromise) {
        configPromise = client.discovery(
            ISSUER,
            CLIENT_ID,
            undefined,
            CLIENT_SECRET
                ? client.ClientSecretPost(CLIENT_SECRET)
                : client.None(),
        );
    }
    return configPromise;
}

export const {
    randomPKCECodeVerifier,
    calculatePKCECodeChallenge,
    randomState,
    randomNonce,
} = client;

export type TokenSet = client.TokenEndpointResponse &
    client.TokenEndpointResponseHelpers;
