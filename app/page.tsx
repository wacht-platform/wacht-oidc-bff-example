import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const ERROR_MESSAGES: Record<string, string> = {
    state_not_recognized:
        "Your sign-in attempt expired or was tampered with. Please try again.",
    missing_state: "The OIDC callback was missing a `state` parameter.",
    missing_id_token: "Wacht didn't return an id_token.",
    callback_failed: "Couldn't complete sign-in — see server logs for details.",
    access_denied: "You declined the consent screen.",
    consent_required: "Consent is required but couldn't be granted silently.",
    login_required: "You need to sign in again.",
};

export default async function Home({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>;
}) {
    const session = await getSession();
    if (session) redirect("/dashboard");

    const { error } = await searchParams;
    const errorMessage = error ? (ERROR_MESSAGES[error] ?? error) : null;

    return (
        <main>
            <h1>Wacht OIDC — Backend for Frontend</h1>
            <p>
                This is a reference Next.js app that uses Wacht as its OpenID
                Connect provider. The browser only talks to this server; the
                access_token and refresh_token never leave the BFF.
            </p>

            {errorMessage ? (
                <div className="card error">
                    <strong>Sign-in failed:</strong> {errorMessage}
                </div>
            ) : null}

            <div className="card">
                <p style={{ color: "var(--text)", marginTop: 0 }}>
                    Ready to try it?
                </p>
                <a className="btn btn-primary" href="/api/auth/login">
                    Sign in with Wacht →
                </a>
            </div>

            <details className="card">
                <summary style={{ cursor: "pointer", color: "var(--text)" }}>
                    What happens when you click sign in
                </summary>
                <ol style={{ color: "var(--muted)", paddingLeft: 20 }}>
                    <li>
                        Browser → <code>/api/auth/login</code> (this app)
                    </li>
                    <li>
                        Server generates PKCE + state + nonce, redirects you to
                        Wacht's <code>/oauth/authorize</code>
                    </li>
                    <li>
                        Wacht handles the user (sign-in / consent) and redirects
                        back to <code>/api/auth/callback?code=…</code>
                    </li>
                    <li>
                        Server exchanges the code for tokens, verifies the
                        id_token, stores everything server-side, drops an
                        httpOnly cookie carrying only a session id
                    </li>
                    <li>You land on the dashboard</li>
                </ol>
            </details>
        </main>
    );
}
