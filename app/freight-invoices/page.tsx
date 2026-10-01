import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { uploadInvoiceV2 } from "@/app/invoices/upload-v2";

const errors: Record<string, string> = {
  missing: "Valitse laskutiedosto.",
  filetype: "Tuettu tiedostomuoto on PDF tai CSV.",
  filesize: "Tiedosto on liian suuri. Raja on 4 Mt.",
  carrier: "Valitse kelvollinen kuljetusyhtiö.",
  "carrier-match": "Kuljetusyhtiötä ei voitu tunnistaa PDF:stä. Valitse se käsin ja yritä uudelleen.",
  "invoice-number": "Laskunumeroa ei voitu tunnistaa. Anna se käsin.",
  currency: "Valuuttaa ei voitu tunnistaa. Anna se käsin.",
  total: "Kokonaissummaa ei voitu tunnistaa. Anna se käsin.",
  "pdf-read": "PDF:n tekstisisältöä ei voitu lukea. Kuvapohjainen PDF tarvitsee OCR-käsittelyn.",
  csv: "CSV:stä ei löytynyt laskurivejä.",
  upload: "Tiedoston tallennus epäonnistui.",
  create: "Laskun luominen epäonnistui.",
  lines: "Laskurivien tallennus epäonnistui.",
};

export default async function FreightInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, workspace } = await getCurrentWorkspace();

  const [{ data: carriers }, { data: invoices }] = await Promise.all([
    supabase
      .from("carriers")
      .select("id,name")
      .eq("workspace_id", workspace.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("invoices")
      .select("id,carrier_id,invoice_number,invoice_date,total_amount,currency,status,extraction_data,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  const names = new Map((carriers ?? []).map((carrier) => [carrier.id, carrier.name]));
  const invoiceCount = invoices?.length ?? 0;
  const auditedTotal = (invoices ?? []).reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const pdfCount = (invoices ?? []).filter((invoice) => {
    const extraction = (invoice.extraction_data ?? {}) as Record<string, unknown>;
    return extraction.extraction_method === "pdf_text";
  }).length;

  return (
    <AppShell workspaceName={workspace.name} active="/freight-invoices">
      <header className="header operational-header">
        <div>
          <div className="page-label">Kuljetuslaskut</div>
          <h1>Laskut</h1>
          <p className="kicker">
            Tuo, tarkista ja auditoi kaikki kuljetuslaskut yhdessä näkymässä.
          </p>
        </div>

        <a className="button primary" href="#upload">+ Lataa lasku</a>
      </header>

      <section className="operational-metrics">
        <div><span className="metric-label">Laskuja</span><strong>{invoiceCount}</strong><small>Työtilassa yhteensä</small></div>
        <div><span className="metric-label">Laskutettu arvo</span><strong>{money(auditedTotal, "EUR")}</strong><small>Tuodut laskut</small></div>
        <div><span className="metric-label">PDF-poiminta</span><strong>{pdfCount}</strong><small>Automaattisesti poimittu</small></div>
      </section>

      <article className="operational-table-shell">
        <div className="section-heading">
          <div>
            <span className="panel-kicker">Laskurekisteri</span>
            <h2>Tuodut laskut</h2>
          </div>
          <span className="record-count">{invoiceCount} laskua</span>
        </div>

        <div className="invoice-register">
          <div className="invoice-register-row invoice-register-head">
            <span>Lasku</span>
            <span>Kuljetusyhtiö</span>
            <span>Päivä</span>
            <span>Tuontitapa</span>
            <span>Summa</span>
            <span>Tila</span>
          </div>

          {(invoices ?? []).map((invoice) => {
            const extraction = (invoice.extraction_data ?? {}) as Record<string, unknown>;
            const method =
              extraction.extraction_method === "pdf_text"
                ? "PDF · automaattinen"
                : extraction.extraction_method === "structured_csv"
                  ? "CSV · rakenteinen"
                  : "Tuotu";

            return (
              <Link className="invoice-register-row" href={"/invoices/" + invoice.id} key={invoice.id}>
                <span><strong>{invoice.invoice_number}</strong></span>
                <span>{names.get(invoice.carrier_id) || "Kuljetusyhtiö"}</span>
                <span>{invoice.invoice_date || "—"}</span>
                <span>{method}</span>
                <span><strong>{money(invoice.total_amount, invoice.currency)}</strong></span>
                <span><span className="status">{invoice.status}</span></span>
              </Link>
            );
          })}

          {!invoices?.length && (
            <div className="operational-empty">
              <strong>Ei laskuja vielä</strong>
              <p>Lataa ensimmäinen PDF- tai CSV-lasku aloittaaksesi auditoinnin.</p>
              <a href="#upload">Lataa ensimmäinen lasku →</a>
            </div>
          )}
        </div>
      </article>

      <details className="upload-drawer" id="upload" open={Boolean(params.error)}>
        <summary>
          <span>
            <small>Uusi lasku</small>
            <strong>Lataa PDF tai CSV</strong>
          </span>
          <b>+</b>
        </summary>

        <div className="upload-drawer-body">
          <div className="upload-drawer-copy">
            <span className="panel-kicker">Automaattinen poiminta</span>
            <h2>Lasku sisään. Data ulos.</h2>
            <p>
              PDF:stä Revanoq poimii laskunumeron, päivät, valuutan, summat ja laskurivejä.
              CSV käsitellään rakenteisena datana. Kentät voi myös vahvistaa käsin.
            </p>
            <div className="csv-guide">
              <strong>PDF-evidenssi</strong>
              <span>Poimituille riveille tallennetaan lähdeteksti ja confidence.</span>
              <strong>CSV</strong>
              <code>line_number, description, charge_code, quantity, unit_price, amount</code>
            </div>
          </div>

          <form className="stack-form upload-form" action={uploadInvoiceV2}>
            {params.error && (
              <div className="notice error">{errors[params.error] || "Laskun käsittely epäonnistui."}</div>
            )}

            <label>
              Kuljetusyhtiö
              <select name="carrier_id" defaultValue="">
                <option value="">Tunnista PDF:stä automaattisesti</option>
                {(carriers ?? []).map((carrier) => (
                  <option value={carrier.id} key={carrier.id}>{carrier.name}</option>
                ))}
              </select>
            </label>

            <div className="form-row">
              <label>
                Laskunumero
                <input name="invoice_number" placeholder="Tunnista automaattisesti" />
              </label>
              <label>
                Laskun päivä
                <input name="invoice_date" type="date" />
              </label>
            </div>

            <div className="form-row">
              <label>
                Valuutta
                <input name="currency" maxLength={3} placeholder="Esim. EUR" />
              </label>
              <label>
                Kokonaissumma
                <input name="total_amount" inputMode="decimal" placeholder="Tunnista automaattisesti" />
              </label>
            </div>

            <label className="file-drop">
              <span>PDF- tai CSV-tiedosto</span>
              <input name="file" type="file" accept=".pdf,.csv,application/pdf,text/csv" required />
              <small>Enintään 4 Mt</small>
            </label>

            <button className="button primary" type="submit">Tallenna ja poimi tiedot</button>
          </form>
        </div>
      </details>
    </AppShell>
  );
}

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}
