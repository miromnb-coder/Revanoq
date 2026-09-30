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
          <div className="eyebrow">Revanoq-työtila</div>
          <h1>Kirjaudu sisään</h1>
          <p className="muted">
            Käytä työosoitettasi päästäksesi rahtilaskujen auditointiin.
          </p>
        </div>

        {params.error && (
          <div className="notice error">
            Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.
          </div>
        )}

        {params.message === "check-email" && (
          <div className="notice">
            Tili luotiin. Tarkista sähköpostisi, jos sähköpostivahvistus on käytössä.
          </div>
        )}

        <label>
          Sähköposti
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label>
          Salasana
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>

        <button className="button primary" formAction={login}>
          Kirjaudu sisään
        </button>

        <button className="button" formAction={signup}>
          Luo tili
        </button>
      </form>
    </main>
  );
}
