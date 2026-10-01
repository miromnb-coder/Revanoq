import Link from "next/link";

const findingRows = [
  ["Polttoainelisä", "+382 €", "Tarkista"],
  ["Väärä perushinta", "+219 €", "Tarkista"],
  ["Duplikaattilasku", "+145 €", "Tarkista"],
];

const benefits = [
  ["01", "Automaattinen auditointi", "PDF- ja CSV-laskut sisään. Revanoq vertaa laskurivit sopimuksiin ja hinnastoihin."],
  ["02", "Poikkeamien tunnistus", "Tunnista väärät hinnat, polttoainelisät, lisämaksut ja kaksoislaskut."],
  ["03", "Valmiit reklamaatiot", "Muuta hyväksytty löydös perustelluksi reklamaatioksi ja seuraa hyvitystä."],
  ["04", "Kulujen hallinta", "Näe auditoitu arvo, avoimet poikkeamat ja toteutuneet säästöt yhdessä paikassa."],
];

export default function HomePage() {
  return (
    <main className="marketing-page">
      <div className="marketing-shell">
        <nav className="marketing-nav">
          <Link href="/" className="brand">REVANOQ</Link>

          <div className="marketing-links">
            <a href="#tuote">Tuote</a>
            <a href="#ratkaisu">Ratkaisut</a>
            <a href="#hyodyt">Hyödyt</a>
          </div>

          <div className="marketing-actions">
            <Link className="button button-quiet" href="/login">Kirjaudu</Link>
            <Link className="button primary" href="/register">Aloita ilmaiseksi</Link>
          </div>
        </nav>

        <section className="marketing-hero" id="tuote">
          <div className="marketing-copy">
            <div className="hero-label">
              <span />
              Freight cost intelligence
            </div>

            <h1>
              Löydä ja palauta
              <br />
              rahtilaskujen
              <br />
              <em>ylilaskutus.</em>
            </h1>

            <p>
              Revanoq auditoi kuljetuslaskut automaattisesti, vertaa niitä
              sopimuksiin ja hinnastoihin sekä tunnistaa kustannuspoikkeamat
              ennen kuin ne jäävät huomaamatta.
            </p>

            <div className="hero-actions">
              <Link className="button primary hero-primary" href="/register">
                Aloita ilmaiseksi <span>→</span>
              </Link>
              <Link className="button hero-secondary" href="/login">
                Avaa työtila
              </Link>
            </div>

            <div className="hero-proof">
              <span>PDF & CSV</span>
              <span>Sopimuspohjainen tarkistus</span>
              <span>Reklamaatiot valmiiksi</span>
            </div>
          </div>

          <div className="hero-product" aria-label="Revanoq-tuotteen esikatselu">
            <div className="hero-grid-map" />

            <div className="hero-invoice-card">
              <span className="mini-label">Kuljetuslasku</span>
              <strong>NC-2026-10084</strong>
              <small>NordCargo · 30.9.2026</small>
              <div className="invoice-total">
                <span>Yhteensä</span>
                <strong>4 829 €</strong>
              </div>
            </div>

            <div className="hero-dashboard-card">
              <div className="hero-dashboard-top">
                <div>
                  <span className="mini-label">Löydetyt poikkeamat</span>
                  <strong className="hero-savings">18 420 €</strong>
                </div>
                <span className="trend-pill">+12 %</span>
              </div>

              <div className="micro-bars" aria-hidden="true">
                {[38, 54, 46, 72, 59, 88, 68, 96].map((height, index) => (
                  <span key={index} style={{ height: `${height}%` }} />
                ))}
              </div>

              <div className="hero-findings">
                {findingRows.map(([name, amount, status]) => (
                  <div className="hero-finding-row" key={name}>
                    <span className="finding-alert">!</span>
                    <div>
                      <strong>{name}</strong>
                      <small>Auditointilöydös</small>
                    </div>
                    <b>{amount}</b>
                    <span className="warm-pill">{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="claim-float">
              <span className="claim-check">✓</span>
              <div>
                <strong>Reklamaatio valmis</strong>
                <small>Perusteet ja evidenssi mukana</small>
              </div>
            </div>

            <div className="money-float">
              <span className="mini-label">Takaisin saatu</span>
              <strong>8 760 €</strong>
            </div>
          </div>
        </section>

        <section className="benefit-strip" id="hyodyt">
          {benefits.map(([number, title, copy]) => (
            <article className="benefit-item" key={number}>
              <span className="benefit-number">{number}</span>
              <div className="benefit-icon" aria-hidden="true" />
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </section>

        <section className="marketing-statement" id="ratkaisu">
          <div>
            <span className="hero-label">Rakennettu oikeaan operatiiviseen työhön</span>
            <h2>Muuta kuljetuslaskut takaisin saatavaksi arvoksi.</h2>
          </div>
          <p>
            Talous, hankinta ja logistiikka näkevät samalla kertaa mitä laskutettiin,
            mitä olisi pitänyt laskuttaa ja mitä rahaa on saatu oikeasti takaisin.
          </p>
        </section>
      </div>
    </main>
  );
}
