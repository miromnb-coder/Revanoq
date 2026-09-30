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

  return (
    <AppShell workspaceName={workspace.name} active="/freight-invoices">
      <header className="header">
        <div>
          <h1>Laskut</h1>
          <p className="kicker">
            Tuo PDF tai CSV. Revanoq poimii PDF:stä laskutiedot ja rivit automaattisesti, kun tiedosto sisältää koneellisesti luettavaa tekstiä.
          </p>
        </div>
      </header>

      <section className="content-grid">
        <article className="panel">
          <h2>Lataa lasku</h2>
          <p className="muted">
            PDF:n kentät ovat valinnaisia: täytä ne vain, jos haluat ohittaa automaattisen tunnistuksen.
          </p>

          <form className="stack-form" action={uploadInvoiceV2}>
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

            <label>
              PDF- tai CSV-tiedosto
              <input name="file" type="file" accept=".pdf,.csv,application/pdf,text/csv" required />
            </label>

            <div className="csv-guide">
              <strong>PDF-evidenssi</strong>
              <span>Poimituille riveille tallennetaan alkuperäinen tekstirivi, sivunumero silloin kun se voidaan kohdistaa ja poiminnan confidence.</span>
              <strong>CSV</strong>
              <code>line_number, description, charge_code, quantity, unit_price, amount</code>
            </div>

            <button className="button primary" type="submit">Tallenna ja poimi tiedot</button>
          </form>
        </article>

        <article className="panel">
          <h2>Tuodut laskut</h2>
          <p className="muted">{invoices?.length ?? 0} laskua</p>

          <div className="list">
            {(invoices ?? []).map((invoice) => {
              const extraction = (invoice.extraction_data ?? {}) as Record<string, unknown>;
              const method = extraction.extraction_method === "pdf_text" ? "PDF · automaattinen poiminta" :
                extraction.extraction_method === "structured_csv" ? "CSV · rakenteinen" : "Tuotu";

              return (
                <Link className="list-item" href={"/invoices/" + invoice.id} key={invoice.id}>
                  <div>
                    <strong>{invoice.invoice_number}</strong>
                    <span>{names.get(invoice.carrier_id) || "Kuljetusyhtiö"} · {invoice.invoice_date || "ei päivää"} · {method}</span>
                  </div>
                  <div className="list-amount">
                    <strong>{money(invoice.total_amount, invoice.currency)}</strong>
                    <span className="status">{invoice.status}</span>
                  </div>
                </Link>
              );
            })}

            {!invoices?.length && <div className="empty-state">Ei laskuja vielä.</div>}
          </div>
        </article>
      </section>
    </AppShell>
  );
}

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency }).format(Number(value));
}
