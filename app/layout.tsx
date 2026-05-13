import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Wacht OIDC BFF Example",
    description:
        "Backend-for-Frontend reference using Wacht as the OpenID Connect provider.",
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
