import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="shell">
      <form className="form">
        <div>
          <div className="eyebrow">Revanoq workspace</div>
          <h1>Sign in</h1>
          <p className="muted">Use your work email to access freight audit data.</p>
        </div>

        {params.error && (
          <div className="notice error">
            Authentication failed. Check your details.
          </div>
        )}

        {params.message === "check-email" && (
          <div className="notice">
            Account created. Check your email if confirmation is enabled.
          </div>
        )}

        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>

        <button className="button primary" formAction={login}>
          Sign in
        </button>

        <button className="button" formAction={signup}>
          Create account
        </button>
      </form>
    </main>
  );
}
