import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { uploadInvoice } from "./actions";

const errorMessages: Record<string, string> = {
  missing: "Täytä pakolliset tiedot ja valitse tiedosto.",
  filetype: "Tuettu tiedostomuoto on PDF tai CSV.",
  filesize: "Tiedosto on liian suuri. Ensimmäisen version raja on 4 Mt.",
  carrier: "Kuljetusyhtiötä ei löytynyt.",
  csv: "CSV:stä ei löytynyt laskurivejä. Tarkista sarakkeet.",
  total: "Anna laskun kokonaissumma.",
  upload: "Tiedoston tallennus epäonnistui.",
  create: "Laskun luominen epäonnistui.",
  lines: "Laskurivien tallennus epäonnistui.",
};

export default async function InvoicesPage({
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
      .select("id,carrier_id,invoice_number,invoice_date,total_amount,currency,status,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  const carrierNames = new Map((carriers ?? []).map((carrier) => [carrier.id, carrier.name]));

  return (
    <AppShell workspaceName={workspace.name} active="/invoices">
      <header className="header">
        <div>
          <h1>Laskut</h1>
          <p className="kicker">
            Tuo PDF- tai CSV-rahtilasku Revanoqiin ja käynnistä auditointi.
          </p>
        </div>
      </header>

      <section className="content-grid">
        <article className="panel">
          <h2>Lataa lasku</h2>
          <p className="muted">
            CSV auditoidaan rivitasolla. PDF tallennetaan ja käsitellään tässä
            MVP:ssä kokonaissumman BASE-rivinä.
          </p>

          <form className="stack-form" action={uploadInvoice}>
            {params.error && (
              <div className="notice error">
                {errorMessages[params.error] || "Laskun lataus epäonnistui."}
              </div>
            )}

            <label>
              Kuljetusyhtiö
              <select name="carrier_id" required defaultValue="">
                <option value="" disabled>Valitse kuljetusyhtiö</option>
                {(carriers ?? []).map((carrier) => (
                  <option value={carrier.id} key={carrier.id}>{carrier.name}</option>
                ))}
              </select>
            </label>

            <div className="form-row">
              <label>
                Laskunumero
                <input name="invoice_number" required placeholder="INV-2026-1048" />
              </label>
              <label>
                Laskun päivä
                <input name="invoice_date" type="date" />
              </label>
            </div>

            <div className="form-row">
              <label>
                Valuutta
                <input name="currency" defaultValue="EUR" maxLength={3} required />
              </label>
              <label>
                Kokonaissumma
                <input name="total_amount" inputMode="decimal" placeholder="CSV:ssä voi jättää tyhjäksi" />
              </label>
            </div>

            <label>
              Laskutiedosto
              <input name="file" type="file" accept=".pdf,.csv,application/pdf,text/csv" required />
            </label>

            <div className="csv-guide">
              <strong>CSV:n suositellut sarakkeet</strong>
              <code>line_number, description, charge_code, quantity, unit_price, amount</code>
              <span>Vain <code>amount</code> on pakollinen. Veloituskoodi yhdistää rivin hinnastosääntöön.</span>
            </div>

            <button className="button primary" type="submit" disabled={!carriers?.length}>
              Tallenna lasku
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>Tuodut laskut</h2>
          <p className="muted">{invoices?.length ?? 0} laskua</p>

          <div className="list">
            {(invoices ?? []).map((invoice) => (
              <Link className="list-item" href={`/invoices/${invoice.id}`} key={invoice.id}>
                <div>
                  <strong>{invoice.invoice_number}</strong>
                  <span>
                    {carrierNames.get(invoice.carrier_id) || "Kuljetusyhtiö"} · {invoice.invoice_date || "ei päivää"}
                  </span>
                </div>
                <div className="list-amount">
                  <strong>
                    {new Intl.NumberFormat("fi-FI", {
                      style: "currency",
                      currency: invoice.currency,
                    }).format(Number(invoice.total_amount))}
                  </strong>
                  <span className="status">{invoice.status}</span>
                </div>
              </Link>
            ))}

            {!invoices?.length && <div className="empty-state">Ei laskuja vielä.</div>}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
