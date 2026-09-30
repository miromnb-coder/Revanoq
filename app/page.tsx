import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">REVANOQ</div>
        <Link className="button" href="/login">Kirjaudu sisään</Link>
      </nav>

      <section className="hero">
        <div className="eyebrow">Rahtikulujen älykäs valvonta</div>
        <h1>Löydä se, mitä rahtikulusi piilottavat.</h1>
        <p>
          Revanoq vertaa kuljetuslaskuja lähetyksiin, sopimuksiin ja hinnastoihin
          sekä muuttaa poikkeamat selkeästi perustelluiksi auditointilöydöksiksi.
        </p>
        <div className="actions">
          <Link className="button primary" href="/login">Avaa työtila</Link>
        </div>
      </section>
    </main>
  );
}
