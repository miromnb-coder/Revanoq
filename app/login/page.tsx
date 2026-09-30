import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="shell">
      <form className="form" action={login}>
        <div>
          <div className="eyebrow">Revanoq-työtila</div>
          <h1>Kirjaudu sisään</h1>
          <p className="muted">
            Käytä työosoitettasi päästäksesi rahtilaskujen auditointiin.
          </p>
        </div>

        {params.error === "login" && (
          <div className="notice error">
            Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.
          </div>
        )}

        {params.message === "check-email" && (
          <div className="notice">
            Tili luotiin. Tarkista sähköpostisi ja vahvista osoite ennen kirjautumista.
          </div>
        )}

        {params.message === "confirmed" && (
          <div className="notice">
            Sähköposti vahvistettu. Voit nyt kirjautua sisään.
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

        <button className="button primary" type="submit">
          Kirjaudu sisään
        </button>

        <Link className="button" href="/register">
          Luo uusi tili
        </Link>
      </form>
    </main>
  );
}
