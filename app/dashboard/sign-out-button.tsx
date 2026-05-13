export function SignOutButton() {
    return (
        <form method="POST" action="/api/auth/logout">
            <button type="submit" className="btn btn-danger">
                Sign out
            </button>
        </form>
    );
}
