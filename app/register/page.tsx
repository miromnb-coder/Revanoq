import Link from "next/link";
import { signup } from "@/app/login/actions";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="shell">
      <form className="form" action={signup}>
        <div>
          <div className="eyebrow">Revanoq-työtila</div>
          <h1>Luo tili</h1>
          <p className="muted">
            Luo käyttäjätili työosoitteellasi. Tämän jälkeen voit luoda yrityksellesi työtilan.
          </p>
        </div>

        {params.error === "signup" && (
          <div className="notice error">
            Tilin luominen epäonnistui. Tarkista sähköpostiosoite ja käytä vähintään 8 merkin salasanaa.
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
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <button className="button primary" type="submit">
          Luo tili
        </button>

        <Link className="button" href="/login">
          Minulla on jo tili
        </Link>
      </form>
    </main>
  );
}
