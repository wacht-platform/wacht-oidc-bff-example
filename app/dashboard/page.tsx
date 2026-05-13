import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export default async function Dashboard() {
    const session = await getSession();
    if (!session?.idClaims) redirect("/");

    const u = session.idClaims;
    const fullName = [u.given_name, u.family_name].filter(Boolean).join(" ").trim();
    const displayName =
        (u.name as string | undefined) ??
        (fullName || (u.email as string | undefined) || u.sub);

    return (
        <main>
            <h1>Signed in as {displayName}</h1>
            <p>
                You're authenticated through Wacht. The browser holds nothing
                but an opaque session cookie — every token lives server-side.
            </p>

            <div className="card">
                <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>id_token claims</h2>
                <pre>{JSON.stringify(session.idClaims, null, 2)}</pre>
            </div>

            <div className="row">
                <SignOutButton />
                <a className="btn" href="/api/auth/me">
                    Inspect /api/auth/me
                </a>
            </div>
        </main>
    );
}
