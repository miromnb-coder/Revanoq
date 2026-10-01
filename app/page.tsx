import Link from "next/link";

export default function HomePage() {
  return (
    <main className="rq-landing-page">
      <section className="rq-landing" id="tuote">
        <header className="rq-landing-nav">
          <Link href="/" className="rq-landing-brand" aria-label="Revanoq etusivu">
            REVANOQ
          </Link>

          <nav className="rq-landing-links" aria-label="Päänavigaatio">
            <a href="#tuote">Tuote</a>
            <a href="#tuote">Ratkaisu</a>
            <a href="#tuote">Hinnoittelu</a>
            <a href="#tuote">Resurssit</a>
          </nav>

          <div className="rq-landing-actions">
            <Link href="/login" className="rq-landing-login">
              Kirjaudu
            </Link>
            <Link href="/register" className="rq-landing-start">
              Aloita
            </Link>
          </div>
        </header>

        <div className="rq-landing-hero">
          <div className="rq-landing-copy">
            <h1>
              Löydä ja palauta
              <br />
              kuljetuslaskujen ylilaskutus
            </h1>
            <p>
              Revanoq auttaa valmistajia, maahantuojia ja tukkuyrityksiä auditoimaan
              rahtilaskut sopimuksia vasten, löytämään poikkeamat ja palauttamaan
              menetettyä rahaa.
            </p>
          </div>
        </div>

        <div className="rq-landing-lower">
          <div className="rq-landing-lower-inner">
            <h2>Muuta kuljetuslaskut takaisin saatavaksi arvoksi</h2>
            <p>
              Revanoq yhdistää sopimukset, laskut ja auditointilogiikan yhteen
              näkymään, jotta poikkeamat löytyvät nopeasti ja säästö muuttuu
              todelliseksi hyvitykseksi.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
